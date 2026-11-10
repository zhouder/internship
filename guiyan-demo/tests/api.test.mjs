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
test("公开浏览提供资源但不泄露私有订单或密码", async () => {
  const r = await request("/bootstrap");
  assert.equal(r.status, 200);
  assert.equal(r.data.resources.length, 22 + catalogResources.length);
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
    /规则客服示例/,
  );
  assert.match(
    (
      await request("/ai", {
        token: user,
        method: "POST",
        body: { kind: "copy", prompt: "山歌演出" },
      })
    ).data.answer,
    /本地模板/,
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
