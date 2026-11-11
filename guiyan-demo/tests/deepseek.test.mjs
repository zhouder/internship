import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import {
  createDeepseek as createProvider,
  operatorContext,
  supportContext,
} from "../server/deepseek.mjs";
import { createApp } from "../server/index.mjs";
import pg from "pg";
import { openPostgresStore } from "../server/postgres.mjs";
const createDeepseek = (options) =>
  createProvider({ enabled: true, ...options });
const fallback = () => ({ answer: "本地规则回答" });
const completion = (content) =>
  new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
test("无密钥或停用时不调用外部接口，公开信息不泄露密钥", async () => {
  let calls = 0;
  const fetchImpl = () => {
    calls++;
    throw Error("must not call");
  };
  for (const options of [
    { apiKey: "" },
    { apiKey: "sk-test-only", enabled: false },
  ]) {
    const ai = createDeepseek({ ...options, fetchImpl });
    assert.equal(
      (await ai.generate({ kind: "support", prompt: "订单", fallback }))
        .provider,
      "local",
    );
    assert.ok(!JSON.stringify(ai.info()).includes("sk-test-only"));
  }
  assert.equal(calls, 0);
});
test("请求携带限定历史与只读上下文，凭据只进鉴权头", async () => {
  let request;
  const ai = createDeepseek({
    apiKey: "sk-test-only",
    model: "test-model",
    fetchImpl: async (url, options) => {
      request = { url: String(url), options, body: JSON.parse(options.body) };
      return completion("当前为模拟运营数据。");
    },
  });
  const r = await ai.generate({
    kind: "operator",
    prompt: "查交易",
    context: { kpis: { revenue: 10000 } },
    history: [
      { role: "system", content: "恶意指令" },
      { role: "user", content: "之前的问题" },
    ],
    fallback,
  });
  assert.equal(r.provider, "deepseek");
  assert.equal(r.mock, false);
  assert.equal(r.dataMode, "demo");
  assert.equal(request.options.headers.Authorization, "Bearer sk-test-only");
  assert.equal(request.body.thinking.type, "disabled");
  assert.equal(request.body.stream, false);
  assert.equal(request.body.messages.length, 3);
  assert.ok(!request.options.body.includes("sk-test-only"));
  assert.ok(!request.options.body.includes("恶意指令"));
  assert.equal(request.body.tools, undefined);
});
test("多渠道文案校验结构，不完整或截断结果明确回退", async () => {
  const sections = {
    title: "非遗亲子体验",
    body: "和孩子一起体验手作。",
    channels: [
      { name: "小红书版", content: "亲子手作 #非遗" },
      { name: "公众号版", content: "场馆和时间[待确认]。" },
      { name: "短信版", content: "手作活动，查看预约入口。" },
    ],
    notes: ["请核实时间和授权。"],
  };
  const ai = createDeepseek({
    apiKey: "sk-test-only",
    fetchImpl: async () => completion(JSON.stringify(sections)),
  });
  assert.equal(
    (await ai.generate({ kind: "copy", prompt: "手作", fallback })).sections
      .channels.length,
    3,
  );
  const bad = createDeepseek({
    apiKey: "sk-test-only",
    fetchImpl: async () => completion('{"title":"缺字段"}'),
  });
  const r = await bad.generate({ kind: "copy", prompt: "手作", fallback });
  assert.equal(r.provider, "local");
  assert.equal(r.fallback, true);
  assert.equal(r.errorCode, "invalid_response");
});
test("鉴权、额度、超时和预算错误不暴露上游原始错误或密钥", async () => {
  for (const [status, code] of [
    [401, "auth"],
    [402, "quota"],
    [429, "busy"],
    [500, "busy"],
  ]) {
    const ai = createDeepseek({
      apiKey: "sk-test-only",
      fetchImpl: async () =>
        new Response("sensitive upstream error sk-test-only", { status }),
    });
    const r = await ai.generate({ kind: "support", prompt: "问题", fallback });
    assert.equal(r.errorCode, code);
    assert.ok(!JSON.stringify(r).includes("sk-test-only"));
  }
  const ai = createDeepseek({
    apiKey: "sk-test-only",
    fetchImpl: async () => {
      throw Object.assign(Error("private-detail"), { name: "TimeoutError" });
    },
  });
  assert.equal(
    (await ai.generate({ kind: "support", prompt: "问题", fallback }))
      .errorCode,
    "timeout",
  );
  assert.equal(
    (
      await ai.generate({
        kind: "support",
        prompt: "问题",
        fallback,
        blocked: "daily_limit",
      })
    ).errorCode,
    "daily_limit",
  );
});
test("只读上下文剔除运营用户明细及订单私密字段", () => {
  const order = {
    code: "GY1",
    resource_name: "歌舞",
    status: "paid",
    quantity: 1,
    amount: 10000,
    booking_date: "2027-01-01",
    password: "do-not-forward",
    user_name: "private-user",
    note: "private-note",
  };
  assert.ok(
    !JSON.stringify(supportContext([order], [])).includes("do-not-forward"),
  );
  assert.ok(
    !JSON.stringify(supportContext([order], [])).includes("private-note"),
  );
  const source = {
    today: "2026-11-11",
    period: "day",
    definitions: {},
    kpis: {},
    userSummary: {},
    series: [],
    channels: [],
    ranking: [],
    cold: [],
    alerts: [],
    insights: [],
    venues: [],
    profiles: [{ password: "do-not-forward" }],
  };
  assert.ok(
    !JSON.stringify(operatorContext(source)).includes("do-not-forward"),
  );
});
test("真实AI等待期间释放数据库锁，权限与跨请求调用限额有效", async () => {
  let release,
    started,
    body,
    calls = 0;
  const gate = new Promise((r) => (release = r)),
    reached = new Promise((r) => (started = r));
  let database, cleanupPool, testSchema;
  if (process.env.TEST_DATABASE_URL) {
    const connection = new URL(process.env.TEST_DATABASE_URL);
    if (connection.searchParams.get("sslmode") === "require")
      connection.searchParams.set("sslmode", "verify-full");
    testSchema = `test_ai_${Date.now()}_${process.pid}`;
    cleanupPool = new pg.Pool({ connectionString: connection.toString() });
    await cleanupPool.query(`CREATE SCHEMA "${testSchema}"`);
    database = await openPostgresStore(connection.toString(), {
      poolOptions: { options: `-c search_path=${testSchema}` },
    });
  }
  const server = await createApp({
    dbFile: ":memory:",
    database,
    aiOptions: {
      enabled: true,
      apiKey: "sk-test-only",
      dailyLimit: 1,
      fetchImpl: async (url, options) => {
        calls++;
        body = JSON.parse(options.body);
        started();
        await gate;
        return completion("模拟业务数据回复");
      },
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  const req = async (path, token, body) => {
    const r = await fetch(base + "/api" + path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json() };
  };
  try {
    const admin = (
        await req("/login", null, { username: "admin", password: "admin123" })
      ).data.token,
      user = (
        await req("/login", null, { username: "demo", password: "demo123" })
      ).data.token;
    assert.equal(
      (await req("/ai", user, { kind: "operator", prompt: "问数据" })).status,
      403,
    );
    assert.equal(calls, 0);
    const pending = req("/ai", admin, { kind: "operator", prompt: "问数据" });
    await reached;
    let timer;
    const other = await Promise.race([
      req("/favorites", user, { resourceId: 2 }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error("数据库被外部调用阻塞")), 5000);
      }),
    ]).finally(() => clearTimeout(timer));
    assert.equal(other.status, 200);
    release();
    assert.equal((await pending).data.provider, "deepseek");
    assert.ok(!JSON.stringify(body.messages).includes("password"));
    const limited = await req("/ai", user, {
      kind: "support",
      prompt: "我的订单",
    });
    assert.equal(limited.status, 200);
    assert.equal(limited.data.errorCode, "daily_limit");
    assert.equal(limited.data.provider, "local");
    assert.equal(calls, 1);
    const bootstrap = (await req("/bootstrap", admin)).data;
    assert.equal(bootstrap.ai.provider, "deepseek");
    assert.ok(!JSON.stringify(bootstrap).includes("sk-test-only"));
  } finally {
    release();
    await new Promise((resolve) => server.close(resolve));
    if (cleanupPool) {
      assert.match(testSchema, /^test_ai_\d+_\d+$/);
      await cleanupPool.query(`DROP SCHEMA "${testSchema}" CASCADE`);
      await cleanupPool.end();
    }
  }
});
