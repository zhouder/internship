import test from "node:test";
import assert from "node:assert/strict";
import { openSqliteStore } from "../server/database.mjs";
import { upgradeExtensions } from "../server/extension-schema.mjs";
import { createApp } from "../server/index.mjs";
import { once } from "node:events";
test("重复升级保留运营配置和原业务字段，过期券无法占用订单", async () => {
  const db = await openSqliteStore(":memory:");
  let app;
  try {
    const before = JSON.stringify(
      db.prepare("SELECT id,amount,status FROM orders ORDER BY id").all(),
    );
    db.prepare("UPDATE demo_campaigns SET budget=? WHERE code=?").run(
      321,
      "weekend",
    );
    await upgradeExtensions(db);
    assert.equal(
      db
        .prepare("SELECT budget FROM demo_campaigns WHERE code=?")
        .get("weekend").budget,
      321,
    );
    assert.equal(
      JSON.stringify(
        db.prepare("SELECT id,amount,status FROM orders ORDER BY id").all(),
      ),
      before,
    );
    app = await createApp({ database: db, aiOptions: { apiKey: "" } });
    app.listen(0, "127.0.0.1");
    await once(app, "listening");
    const base = "http://127.0.0.1:" + app.address().port;
    const login = await (
      await fetch(base + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "demo", password: "demo123" }),
      })
    ).json();
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + login.token,
    };
    await fetch(base + "/api/demo/coupons/claim", {
      method: "POST",
      headers,
      body: JSON.stringify({ code: "WELCOME20" }),
    });
    const claim = db
      .prepare("SELECT code FROM demo_coupon_claims LIMIT 1")
      .get();
    db.prepare("UPDATE demo_coupon_claims SET expires_at=? WHERE code=?").run(
      "2000-01-01T00:00:00.000Z",
      claim.code,
    );
    const count = db.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
    const result = await fetch(base + "/api/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({
        resourceId: 2,
        date: "2099-01-01",
        quantity: 1,
        couponClaim: claim.code,
      }),
    });
    assert.equal(result.status, 409);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM orders").get().n, count);
  } finally {
    if (app) await new Promise((resolve) => app.close(resolve));
    else db.close();
  }
});
