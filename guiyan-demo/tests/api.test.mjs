import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/index.mjs";
import pg from "pg";
import { openPostgresStore } from "../server/postgres.mjs";
import { catalogResources } from "../server/catalog-content.mjs";
let server, base, admin, user, cleanupPool, testSchema;
async function request(route, { token, method = "GET", body } = {}) {
  const response = await fetch(base + "/api" + route, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get("content-type") || "";
  return {
    status: response.status,
    data: type.includes("json") ? await response.json() : await response.text(),
  };
}
before(async () => {
  let database;
  if (process.env.TEST_DATABASE_URL) {
    const connection = new URL(process.env.TEST_DATABASE_URL);
    if (connection.searchParams.get("sslmode") === "require")
      connection.searchParams.set("sslmode", "verify-full");
    testSchema = `test_guiyan_${Date.now()}_${process.pid}`;
    cleanupPool = new pg.Pool({ connectionString: connection.toString() });
    await cleanupPool.query(`CREATE SCHEMA "${testSchema}"`);
    database = await openPostgresStore(connection.toString(), {
      poolOptions: { options: `-c search_path=${testSchema}` },
    });
  }
  server = await createApp({ dbFile: ":memory:", database });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = "http://127.0.0.1:" + server.address().port;
  admin = (
    await request("/login", {
      method: "POST",
      body: { username: "admin", password: "admin123" },
    })
  ).data.token;
  user = (
    await request("/login", {
      method: "POST",
      body: { username: "demo", password: "demo123" },
    })
  ).data.token;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (cleanupPool) {
    assert.match(testSchema, /^test_guiyan_\d+_\d+$/);
    await cleanupPool.query(`DROP SCHEMA "${testSchema}" CASCADE`);
    await cleanupPool.end();
  }
});
async function reviewResource(category, stock = 2, meta = {}) {
  const r = await request("/resources", {
    token: admin,
    method: "POST",
    body: {
      name: "验收-" + category + "-" + Date.now(),
      category,
      city: "南宁",
      price: 18000,
      unit: category === "show" ? "张" : "项",
      description: "歌舞音乐适配资源，用于隔离回归",
      capacity: 100,
      stock,
      meta,
      tags: ["歌舞"],
    },
  });
  assert.equal(r.status, 200);
  return r.data.id;
}
async function availability(id, date) {
  const r = await request(`/availability?resourceId=${id}&date=${date}`);
  assert.equal(r.status, 200);
  return r.data.available;
}
test("公开浏览提供资源但不泄露私有订单或密码", async () => {
  const r = await request("/bootstrap");
  assert.equal(r.status, 200);
  assert.equal(r.data.resources.length, 22 + catalogResources.length);
  assert.equal(
    new Set(r.data.resources.map((resource) => resource.image)).size,
    r.data.resources.length,
  );
  assert.equal(r.data.categories.length, 10);
  assert.equal(r.data.orders.length, 0);
  assert.equal(r.data.profiles.length, 0);
  assert.equal(r.data.analytics, null);
  assert.ok(!JSON.stringify(r.data).includes("password"));
});
test("认证与后台权限由API校验", async () => {
  assert.equal((await request("/analytics")).status, 401);
  assert.equal((await request("/analytics", { token: user })).status, 403);
  assert.equal(
    (
      await request("/login", {
        method: "POST",
        body: { username: "admin", password: "wrong123" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/resources", {
        method: "POST",
        token: user,
        body: { name: "越权" },
      })
    ).status,
    403,
  );
});
test("预约审核支付完成链路及非法状态跳转", async () => {
  const created = await request("/orders", {
    token: user,
    method: "POST",
    body: {
      resourceId: 6,
      date: "2027-01-10",
      quantity: 1,
      channel: "微信小程序",
    },
  });
  assert.equal(created.status, 200);
  const route = "/orders/" + created.data.id;
  assert.equal(
    (
      await request(route, {
        token: user,
        method: "PATCH",
        body: { action: "pay" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(route, {
        token: user,
        method: "PATCH",
        body: { action: "confirm" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(route, {
        token: admin,
        method: "PATCH",
        body: { action: "confirm" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(route, {
        token: user,
        method: "PATCH",
        body: { action: "pay" },
      })
    ).status,
    200,
  );
  let d = (await request("/bootstrap", { token: user })).data;
  assert.equal(
    d.orders.find((o) => o.id === created.data.id).escrow,
    "模拟托管中",
  );
  assert.equal(
    (
      await request(route, {
        token: user,
        method: "PATCH",
        body: { action: "complete" },
      })
    ).status,
    200,
  );
  d = (await request("/bootstrap", { token: user })).data;
  assert.equal(d.orders.find((o) => o.id === created.data.id).escrow, "已结算");
  assert.match(
    (await request(route + "/contract", { token: user })).data.content,
    /无真实合同效力/,
  );
});
test("电脑网页下单保留独立来源，取消后库存恢复", async () => {
  const before = (await request("/bootstrap")).data.resources.find(
    (r) => r.id === 2,
  ).stock;
  const created = await request("/orders", {
    token: user,
    method: "POST",
    body: {
      resourceId: 2,
      date: "2028-03-20",
      quantity: 1,
      channel: "电脑网页",
    },
  });
  assert.equal(created.status, 200);
  const order = (await request("/bootstrap", { token: user })).data.orders.find(
    (o) => o.id === created.data.id,
  );
  assert.equal(order.channel, "电脑网页");
  assert.equal(
    (
      await request(`/orders/${order.id}`, {
        token: user,
        method: "PATCH",
        body: { action: "cancel" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/bootstrap")).data.resources.find((r) => r.id === 2).stock,
    before,
  );
});

test("场馆档期冲突拒绝，取消后释放档期", async () => {
  const body = { resourceId: 1, date: "2027-02-12", quantity: 1 };
  const first = await request("/orders", { token: user, method: "POST", body });
  assert.equal(first.status, 200);
  assert.equal(
    (await request("/orders", { token: user, method: "POST", body })).status,
    409,
  );
  await request("/orders/" + first.data.id, {
    token: user,
    method: "PATCH",
    body: { action: "cancel" },
  });
  assert.equal(
    (await request("/orders", { token: user, method: "POST", body })).status,
    200,
  );
});
test("库存不足和非法数量拒绝，退款后恢复库存且不能重复退款", async () => {
  const before = (await request("/bootstrap")).data.resources.find(
    (r) => r.id === 12,
  ).stock;
  assert.equal(
    (
      await request("/orders", {
        token: user,
        method: "POST",
        body: { resourceId: 12, date: "2027-01-10", quantity: before + 1 },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/orders", {
        token: user,
        method: "POST",
        body: { resourceId: 12, date: "2027-01-10", quantity: -1 },
      })
    ).status,
    400,
  );
  const r = await request("/orders", {
      token: user,
      method: "POST",
      body: { resourceId: 12, date: "2027-01-10", quantity: 1 },
    }),
    route = "/orders/" + r.data.id;
  assert.equal(
    (await request("/bootstrap")).data.resources.find((r) => r.id === 12).stock,
    before - 1,
  );
  await request(route, {
    token: admin,
    method: "PATCH",
    body: { action: "confirm" },
  });
  await request(route, {
    token: user,
    method: "PATCH",
    body: { action: "pay" },
  });
  await request(route, {
    token: user,
    method: "PATCH",
    body: { action: "refund", reason: "测试退款" },
  });
  assert.equal(
    (
      await request(route, {
        token: user,
        method: "PATCH",
        body: { action: "approveRefund" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(route, {
        token: admin,
        method: "PATCH",
        body: { action: "approveRefund" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/bootstrap")).data.resources.find((r) => r.id === 12).stock,
    before,
  );
  assert.equal(
    (
      await request(route, {
        token: admin,
        method: "PATCH",
        body: { action: "approveRefund" },
      })
    ).status,
    409,
  );
});
test("新账号认证后发布需求，审核前不公开；评论评分和审核有效", async () => {
  const reg = await request("/register", {
    method: "POST",
    body: { username: "test_new", password: "password123", name: "测试用户" },
  });
  assert.equal(reg.status, 200);
  const tok = (
    await request("/login", {
      method: "POST",
      body: { username: "test_new", password: "password123" },
    })
  ).data.token;
  const b = {
    title: "测试合作意向",
    category: "artist",
    budget: 500000,
    city: "南宁",
    description: "测试需求说明",
  };
  assert.equal(
    (await request("/demands", { token: tok, method: "POST", body: b })).status,
    403,
  );
  await request("/profile", {
    token: tok,
    method: "PATCH",
    body: { verify: true },
  });
  assert.equal(
    (await request("/demands", { token: tok, method: "POST", body: b })).status,
    200,
  );
  assert.ok(
    !(await request("/bootstrap")).data.demands.some(
      (d) => d.title === b.title,
    ),
  );
  const own = (await request("/bootstrap", { token: tok })).data.demands.find(
    (d) => d.title === b.title,
  );
  await request("/moderate", {
    token: admin,
    method: "POST",
    body: { type: "demand", id: own.id, status: "approved" },
  });
  assert.ok(
    (await request("/bootstrap")).data.demands.some((d) => d.title === b.title),
  );
  assert.equal(
    (
      await request("/comments", {
        token: tok,
        method: "POST",
        body: { resourceId: 2, content: "测试评论", rating: 6 },
      })
    ).status,
    400,
  );
  await request("/comments", {
    token: tok,
    method: "POST",
    body: { resourceId: 2, content: "测试评论", rating: 3 },
  });
  const comment = (
    await request("/bootstrap", { token: admin })
  ).data.comments.find((c) => c.content === "测试评论");
  assert.ok(
    !(await request("/bootstrap")).data.comments.some(
      (c) => c.id === comment.id,
    ),
  );
  await request("/moderate", {
    token: admin,
    method: "POST",
    body: {
      type: "comment",
      id: comment.id,
      status: "approved",
      reply: "收到反馈",
    },
  });
  assert.equal(
    (await request("/bootstrap")).data.resources.find((r) => r.id === 2).rating,
    4,
  );
  assert.equal(
    (
      await request("/orders/1", {
        token: tok,
        method: "PATCH",
        body: { action: "cancel" },
      })
    ).status,
    403,
  );
});
test("收藏、消息、偏好、数据同步和统计导出联动", async () => {
  await request("/favorites", {
    token: user,
    method: "POST",
    body: { resourceId: 3 },
  });
  assert.ok(
    (await request("/bootstrap", { token: user })).data.favorites.includes(3),
  );
  await request("/favorites", {
    token: user,
    method: "POST",
    body: { resourceId: 3 },
  });
  assert.ok(
    !(await request("/bootstrap", { token: user })).data.favorites.includes(3),
  );
  await request("/profile", {
    token: user,
    method: "PATCH",
    body: { preference: "heritage" },
  });
  assert.equal(
    (await request("/bootstrap", { token: user })).data.user.preference,
    "heritage",
  );
  await request("/messages", {
    token: admin,
    method: "POST",
    body: { to: 2, title: "测试消息", content: "测试消息内容" },
  });
  assert.ok(
    (await request("/bootstrap", { token: user })).data.messages.some(
      (m) => m.title === "测试消息",
    ),
  );
  await request("/messages/read", { token: user, method: "POST", body: {} });
  assert.ok(
    (await request("/bootstrap", { token: user })).data.messages.every(
      (m) => m.is_read,
    ),
  );
  const before = (await request("/analytics", { token: admin })).data;
  await request("/sync", {
    token: admin,
    method: "POST",
    body: { channel: "大麦" },
  });
  const after = (await request("/analytics?period=quarter", { token: admin }))
    .data;
  assert.equal(after.kpis.orders, before.kpis.orders + 1);
  assert.ok(after.kpis.revenue > before.kpis.revenue);
  assert.equal(
    after.series.reduce((a, r) => a + r.amount, 0),
    after.kpis.revenue,
  );
  assert.ok(after.series.every((r) => /Q[1-4]$/.test(r.date)));
  assert.match((await request("/export", { token: admin })).data, /订单编号/);
});
test("AI输出明确模拟，普通用户不能调用运营问数", async () => {
  assert.match(
    (
      await request("/ai", {
        token: user,
        method: "POST",
        body: { kind: "support", prompt: "怎么退款" },
      })
    ).data.answer,
    /本地规则客服/,
  );
  assert.match(
    (
      await request("/ai", {
        token: user,
        method: "POST",
        body: { kind: "copy", prompt: "山歌演出" },
      })
    ).data.answer,
    /本地多渠道模板/,
  );
  assert.equal(
    (
      await request("/ai", {
        token: user,
        method: "POST",
        body: { kind: "operator", prompt: "订单" },
      })
    ).status,
    403,
  );
  assert.match(
    (
      await request("/ai", {
        token: admin,
        method: "POST",
        body: { kind: "operator", prompt: "库存异常" },
      })
    ).data.answer,
    /未接入大模型/,
  );
});
test("模拟异常、剧目同步、多维评分与画像维度", async () => {
  let r = await request("/alerts", {
    token: admin,
    method: "POST",
    body: { kind: "sentiment" },
  });
  assert.equal(r.status, 200);
  const a = (await request("/analytics", { token: admin })).data;
  const event = a.alerts.find((v) => v.id && v.title.includes("舆情"));
  assert.ok(event);
  await request("/alerts", {
    token: admin,
    method: "POST",
    body: { resolve: event.id },
  });
  assert.ok(
    !(await request("/analytics", { token: admin })).data.alerts.some(
      (v) => v.id === event.id,
    ),
  );
  assert.equal(
    (
      await request("/resources/2/sync", {
        token: admin,
        method: "POST",
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/bootstrap")).data.resources.find((r) => r.id === 2).meta
      .syncResult,
    "三渠道内容同步成功（模拟）",
  );
  assert.equal(
    (
      await request("/comments", {
        token: user,
        method: "POST",
        body: {
          resourceId: 4,
          rating: 5,
          content: "多维评分测试",
          dimensions: { quality: 5, service: 3, value: 1 },
        },
      })
    ).status,
    200,
  );
  const boot = (await request("/bootstrap", { token: admin })).data;
  assert.equal(
    boot.comments.find((c) => c.content === "多维评分测试").rating,
    3,
  );
  assert.ok(
    boot.profiles.every(
      (u) => u.portrait && Number.isInteger(u.portrait.views),
    ),
  );
});
test("登出后原令牌失效", async () => {
  const tok = (
    await request("/login", {
      method: "POST",
      body: { username: "demo", password: "demo123" },
    })
  ).data.token;
  await request("/logout", { token: tok, method: "POST", body: {} });
  assert.equal(
    (
      await request("/orders", {
        token: tok,
        method: "POST",
        body: { resourceId: 2, date: "2027-01-10", quantity: 1 },
      })
    ).status,
    401,
  );
});

test("并发预约不超卖，同一订单重复取消只恢复一次库存", async () => {
  const before = (await request("/bootstrap")).data.resources.find(
    (r) => r.id === 12,
  ).stock;
  const results = await Promise.all(
    Array.from({ length: before + 2 }, () =>
      request("/orders", {
        token: user,
        method: "POST",
        body: { resourceId: 12, date: "2027-03-10", quantity: 1 },
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 200).length, before);
  assert.equal(results.filter((r) => r.status === 409).length, 2);
  for (const order of results.filter((r) => r.status === 200)) {
    const cancelled = await Promise.all(
      [1, 2].map(() =>
        request(`/orders/${order.data.id}`, {
          token: user,
          method: "PATCH",
          body: { action: "cancel" },
        }),
      ),
    );
    assert.deepEqual(cancelled.map((r) => r.status).sort(), [200, 409]);
  }
  assert.equal(
    (await request("/bootstrap")).data.resources.find((r) => r.id === 12).stock,
    before,
  );
});

test("并发提交同一场馆档期只有一笔成功", async () => {
  const results = await Promise.all(
    [1, 2, 3].map(() =>
      request("/orders", {
        token: user,
        method: "POST",
        body: { resourceId: 1, date: "2027-03-15", quantity: 1 },
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409]);
  await request(`/orders/${results.find((r) => r.status === 200).data.id}`, {
    token: user,
    method: "PATCH",
    body: { action: "cancel" },
  });
});

test("API拒绝JSON数组或null作为请求对象", async () => {
  for (const body of [[], null]) {
    const response = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
  }
});

test("按日库存隔离、并发不超卖、售后拒绝和释放库存闭环", async () => {
  const id = await reviewResource("show", 2),
    d = "2027-04-01",
    other = "2027-04-02";
  assert.equal(await availability(id, d), 2);
  const bookings = await Promise.all(
    Array.from({ length: 4 }, () =>
      request("/orders", {
        token: user,
        method: "POST",
        body: { resourceId: id, date: d, quantity: 1 },
      }),
    ),
  );
  assert.equal(bookings.filter((r) => r.status === 200).length, 2);
  assert.equal(bookings.filter((r) => r.status === 409).length, 2);
  assert.equal(await availability(id, d), 0);
  assert.equal(await availability(id, other), 2);
  const orderId = bookings.find((r) => r.status === 200).data.id,
    route = "/orders/" + orderId;
  await request(route, {
    token: admin,
    method: "PATCH",
    body: { action: "confirm" },
  });
  await request(route, {
    token: user,
    method: "PATCH",
    body: { action: "pay" },
  });
  await request(route, {
    token: user,
    method: "PATCH",
    body: { action: "refund", reason: "行程变化" },
  });
  assert.equal(
    (
      await request(route, {
        token: user,
        method: "PATCH",
        body: { action: "rejectRefund", reason: "越权" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(route, {
        token: admin,
        method: "PATCH",
        body: { action: "rejectRefund" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(route, {
        token: admin,
        method: "PATCH",
        body: { action: "rejectRefund", reason: "请补充说明" },
      })
    ).status,
    200,
  );
  assert.equal(await availability(id, d), 0);
  const o = (await request("/bootstrap", { token: user })).data.orders.find(
    (o) => o.id === orderId,
  );
  assert.ok(o.paid_at);
  assert.equal(o.refund_decision, "请补充说明");
  assert.equal(o.status, "paid");
  await request(route, {
    token: user,
    method: "PATCH",
    body: { action: "dispute", reason: "申请复核" },
  });
  assert.equal(
    (
      await request(route, {
        token: admin,
        method: "PATCH",
        body: { action: "rejectDispute", reason: "已核实可正常使用" },
      })
    ).status,
    200,
  );
  await request(route, {
    token: user,
    method: "PATCH",
    body: { action: "refund", reason: "再次申请" },
  });
  await request(route, {
    token: admin,
    method: "PATCH",
    body: { action: "approveRefund" },
  });
  assert.equal(await availability(id, d), 1);
  assert.equal(await availability(id, other), 2);
  const refunded = (
    await request("/bootstrap", { token: user })
  ).data.orders.find((o) => o.id === orderId);
  assert.ok(refunded.refunded_at);
  assert.equal(refunded.time_estimated, 0);
});
test("服务类不扣商品库存，新增配额按管理员配置生效", async () => {
  const service = await reviewResource("service", 0);
  assert.equal(await availability(service, "2027-04-01"), null);
  assert.equal(
    (
      await request("/orders", {
        token: user,
        method: "POST",
        body: { resourceId: service, date: "2027-04-01", quantity: 2 },
      })
    ).status,
    200,
  );
});
test("趋势补零、周区间、支付口径与导出时间列明确", async () => {
  const a = (await request("/analytics", { token: admin })).data;
  assert.ok(a.series.some((s) => s.amount === 0));
  for (let i = 1; i < a.series.length; i++)
    assert.equal(
      (new Date(a.series[i].date) - new Date(a.series[i - 1].date)) / 86400000,
      1,
    );
  assert.equal(
    a.series.reduce((n, s) => n + s.amount, 0),
    a.kpis.revenue,
  );
  const w = (await request("/analytics?period=week", { token: admin })).data;
  assert.ok(w.series.every((s) => s.label.includes("～")));
  const csv = (await request("/export", { token: admin })).data;
  for (const label of [
    "演出/使用日期",
    "下单时间",
    "支付时间",
    "退款时间",
    "历史时间说明",
  ])
    assert.ok(csv.includes(label));
  assert.equal(
    (await request("/analytics?period=invalid", { token: admin })).status,
    400,
  );
});
test("零付费用户不误标潜力，规则可配置且快照权限隔离", async () => {
  const before = (await request("/bootstrap", { token: admin })).data;
  assert.ok(
    before.profiles
      .filter((p) => p.spent === 0)
      .every((p) => !p.tags.includes("潜力会员")),
  );
  const rules = before.settings.tagRules,
    newRule = {
      id: "test-no-pay",
      name: "未付费验收分群",
      enabled: true,
      match: "all",
      conditions: [{ field: "paid_count", op: "eq", value: 0 }],
    };
  assert.equal(
    (
      await request("/settings", {
        token: user,
        method: "PATCH",
        body: { tagRules: [newRule] },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/settings", {
        token: admin,
        method: "PATCH",
        body: { tagRules: [...rules, newRule] },
      })
    ).status,
    200,
  );
  let a = (await request("/bootstrap", { token: admin })).data;
  assert.ok(a.profiles.some((p) => p.tags.includes(newRule.name)));
  assert.equal(
    (
      await request("/profiles/snapshot", {
        token: admin,
        method: "POST",
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/profiles/2/history", { token: user })).status,
    403,
  );
  assert.equal(
    (await request("/profiles/2/history", { token: admin })).data.snapshots
      .length,
    1,
  );
  await request("/profiles/snapshot", {
    token: admin,
    method: "POST",
    body: {},
  });
  assert.equal(
    (await request("/profiles/2/history", { token: admin })).data.snapshots
      .length,
    1,
  );
  newRule.enabled = false;
  await request("/settings", {
    token: admin,
    method: "PATCH",
    body: { tagRules: [...rules, newRule] },
  });
  a = (await request("/bootstrap", { token: admin })).data;
  assert.ok(a.profiles.every((p) => !p.tags.includes(newRule.name)));
  await request("/settings", {
    token: admin,
    method: "PATCH",
    body: { tagRules: rules },
  });
});
test("分群保存后实时圈选，站内通知不越权且可导出同源名单", async () => {
  const segments = [
    {
      id: "review-group",
      name: "南宁用户",
      tag: "",
      city: "南宁",
      channel: "",
    },
  ];
  await request("/settings", {
    token: admin,
    method: "PATCH",
    body: { segments },
  });
  const a = (await request("/bootstrap", { token: admin })).data;
  assert.equal(a.settings.segments[0].name, "南宁用户");
  assert.equal(
    (
      await request("/segments/notify", {
        token: user,
        method: "POST",
        body: { segmentId: "review-group", content: "越权" },
      })
    ).status,
    403,
  );
  const r = await request("/segments/notify", {
    token: admin,
    method: "POST",
    body: { segmentId: "review-group", content: "隔离测试活动" },
  });
  assert.equal(r.status, 200);
  assert.match(
    r.data.message,
    new RegExp(a.profiles.filter((p) => p.city === "南宁").length + "名"),
  );
});
test("私信审核、双向可见与单条已读均限制到本人", async () => {
  const supplier = (
    await request("/login", {
      method: "POST",
      body: { username: "supplier", password: "demo123" },
    })
  ).data.token;
  const sender = (await request("/bootstrap", { token: user })).data.user;
  await request("/messages", {
    token: user,
    method: "POST",
    body: { to: 3, content: "请核实诈骗风险", title: "风险沟通" },
  });
  const own = (await request("/bootstrap", { token: user })).data.messages.find(
    (m) => m.content === "请核实诈骗风险",
  );
  assert.equal(own.status, "pending");
  assert.ok(
    !(await request("/bootstrap", { token: supplier })).data.messages.some(
      (m) => m.id === own.id,
    ),
  );
  assert.equal(
    (
      await request("/moderate", {
        token: user,
        method: "POST",
        body: { type: "message", id: own.id, status: "approved" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/moderate", {
        token: admin,
        method: "POST",
        body: { type: "message", id: own.id, status: "approved" },
      })
    ).status,
    200,
  );
  const delivered = (
    await request("/bootstrap", { token: supplier })
  ).data.messages.find((m) => m.id === own.id);
  assert.ok(delivered);
  assert.equal(delivered.is_read, 0);
  assert.equal(
    (
      await request("/messages/read", {
        token: user,
        method: "POST",
        body: { id: own.id },
      })
    ).status,
    404,
  );
  await request("/messages/read", {
    token: supplier,
    method: "POST",
    body: { id: own.id },
  });
  assert.equal(
    (await request("/bootstrap", { token: supplier })).data.messages.find(
      (m) => m.id === own.id,
    ).is_read,
    1,
  );
  await request("/messages", {
    token: supplier,
    method: "POST",
    body: { to: sender.id, content: "收到，我们继续沟通" },
  });
  assert.ok(
    (await request("/bootstrap", { token: user })).data.messages.some(
      (m) => m.content === "收到，我们继续沟通",
    ),
  );
});
test("推荐消费真实行为，助手按意图回答且文案按主题分渠道", async () => {
  await request("/resources/10/view", {
    token: user,
    method: "POST",
    body: {},
  });
  await request("/favorites", {
    token: user,
    method: "POST",
    body: { resourceId: 10 },
  });
  const rec = (await request("/recommendations", { token: user })).data
    .recommendations;
  assert.ok(rec.find((r) => r.resourceId === 10).reason.includes("浏览"));
  assert.equal(
    (await request("/recommendations?userId=3", { token: user })).status,
    403,
  );
  const operator = (
    await request("/ai", {
      token: admin,
      method: "POST",
      body: { kind: "operator", prompt: "最近用户增长和活跃怎么样" },
    })
  ).data.answer;
  assert.match(operator, /新增|活跃/);
  assert.ok(!operator.includes("热销TOP"));
  const copy1 = (
      await request("/ai", {
        token: user,
        method: "POST",
        body: { kind: "copy", prompt: "给昆曲表演写一段公众号文案" },
      })
    ).data,
    copy2 = (
      await request("/ai", {
        token: user,
        method: "POST",
        body: { kind: "copy", prompt: "给非遗亲子体验写一段小红书文案" },
      })
    ).data;
  assert.match(copy1.sections.body, /昆曲/);
  assert.match(copy2.sections.body, /孩子/);
  assert.notEqual(copy1.sections.body, copy2.sections.body);
  assert.equal(copy1.sections.channels.length, 3);
  assert.ok(copy1.sections.channels[2].content.length <= 70);
  const support = (
    await request("/ai", {
      token: admin,
      method: "POST",
      body: { kind: "support", prompt: "查询订单" },
    })
  ).data.answer;
  assert.match(support, /共0笔/);
});
test("场馆档期与售票上座率分开，场均票房和匹配可核验", async () => {
  const venue = await reviewResource("venue", 1),
    show = await reviewResource("show", 2, { venueId: venue });
  const booking = await request("/orders", {
    token: user,
    method: "POST",
    body: { resourceId: show, date: "2027-04-03", quantity: 1 },
  });
  await request("/orders/" + booking.data.id, {
    token: admin,
    method: "PATCH",
    body: { action: "confirm" },
  });
  await request("/orders/" + booking.data.id, {
    token: user,
    method: "PATCH",
    body: { action: "pay" },
  });
  const a = (await request("/analytics", { token: admin })).data,
    v = a.venues.find((v) => v.id === venue);
  assert.equal(v.seatOccupancy, 50);
  assert.equal(v.averageRevenue, 18000);
  assert.equal(v.performances, 1);
  assert.equal(v.occupancy, 0);
  assert.equal(v.idleRate, 100);
  assert.ok(v.recommendations.length);
  assert.match(a.report, /模拟经营分析报告/);
});
test("活跃用户只统计用户档案，不把管理员测试下单算作用户增长", async () => {
  const before = (await request("/analytics", { token: admin })).data;
  const created = await request("/orders", {
    token: admin,
    method: "POST",
    body: { resourceId: 2, date: "2027-07-09", quantity: 1 },
  });
  assert.equal(created.status, 200);
  const after = (await request("/analytics", { token: admin })).data;
  assert.equal(after.kpis.users, before.kpis.users);
  assert.ok(after.kpis.users <= after.userSummary.total);
  await request("/orders/" + created.data.id, {
    token: admin,
    method: "PATCH",
    body: { action: "cancel" },
  });
});
test(
  "PostgreSQL重新建立应用连接后仍保留数据和会话",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const before = (await request("/bootstrap", { token: user })).data;
    await new Promise((resolve) => server.close(resolve));
    const database = await openPostgresStore(process.env.TEST_DATABASE_URL, {
      poolOptions: { options: `-c search_path=${testSchema}` },
    });
    server = await createApp({ database });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = "http://127.0.0.1:" + server.address().port;
    const after = (await request("/bootstrap", { token: user })).data;
    assert.equal(after.user.id, before.user.id);
    assert.equal(after.orders.length, before.orders.length);
    assert.equal(after.resources.length, before.resources.length);
  },
);
