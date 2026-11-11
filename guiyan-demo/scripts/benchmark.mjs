import { createApp } from "../server/index.mjs";
import { once } from "node:events";
import assert from "node:assert/strict";
const app = await createApp({ dbFile: ":memory:", aiOptions: { apiKey: "" } });
try {
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  const base = "http://127.0.0.1:" + app.address().port;
  async function call(path, body, token) {
    const start = performance.now(),
      r = await fetch(base + "/api" + path, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    return {
      status: r.status,
      data: await r.json(),
      ms: performance.now() - start,
    };
  }
  const admin = (
      await call("/login", { username: "admin", password: "admin123" })
    ).data.token,
    user = (await call("/login", { username: "demo", password: "demo123" }))
      .data.token;
  const resource = await call(
    "/resources",
    {
      name: "隔离并发测试",
      category: "show",
      city: "南宁",
      price: 10000,
      unit: "张",
      description: "仅用于内存数据库基线",
      stock: 5,
      capacity: 5,
      tags: [],
      meta: {},
    },
    admin,
  );
  assert.equal(resource.status, 200);
  const start = performance.now(),
    results = await Promise.all(
      Array.from({ length: 20 }, () =>
        call(
          "/orders",
          {
            resourceId: resource.data.id,
            date: "2099-01-01",
            quantity: 1,
            sessionTime: "19:30",
          },
          user,
        ),
      ),
    ),
    elapsed = performance.now() - start;
  assert.equal(results.filter((r) => r.status === 200).length, 5);
  assert.equal(results.filter((r) => r.status === 409).length, 15);
  const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        scope: "SQLite内存数据库，本机单批20并发；非生产容量承诺",
        requests: 20,
        successful: 5,
        rejected: 15,
        unexpected: 0,
        elapsedMs: Math.round(elapsed),
        p50Ms: Math.round(sorted[9]),
        p95Ms: Math.round(sorted[18]),
        requestsPerSecond: Number((20000 / elapsed).toFixed(1)),
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise((resolve) => app.close(resolve));
}
