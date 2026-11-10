import test from "node:test";
import assert from "node:assert/strict";
import { openSqliteStore } from "../server/database.mjs";
import { enrichCatalog, catalogResources } from "../server/catalog-content.mjs";
import { enrichResourceArtwork } from "../server/resource-artwork.mjs";
import { upgradeReview, defaultTagRules } from "../server/review-upgrade.mjs";
import { ruleMatches } from "../server/insights.mjs";

test("内容扩充重复运行不重复插入，也不覆盖库存与现有订单", async () => {
  const store = await openSqliteStore(":memory:");
  try {
    const count = (table) =>
      store.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    const before = {
      resources: count("resources"),
      orders: count("orders"),
      demands: count("demands"),
      comments: count("comments"),
    };
    assert.equal(before.resources, 22 + catalogResources.length);
    store.prepare("UPDATE resources SET stock=? WHERE id=?").run(17, 2);
    await enrichCatalog(store);
    await enrichResourceArtwork(store);
    const covers = store
      .prepare("SELECT image FROM resources")
      .all()
      .map((resource) => resource.image);
    assert.equal(new Set(covers).size, before.resources);
    assert.deepEqual(
      {
        resources: count("resources"),
        orders: count("orders"),
        demands: count("demands"),
        comments: count("comments"),
      },
      before,
    );
    assert.equal(
      store.prepare("SELECT stock FROM resources WHERE id=2").get().stock,
      17,
    );
    assert.equal(
      store
        .prepare("SELECT COUNT(*) AS n FROM resources WHERE name=?")
        .get("一梭一锦·壮锦织造体验").n,
      1,
    );
  } finally {
    store.close();
  }
});

test("独立配图迁移保留用户自定义封面", async () => {
  const store = await openSqliteStore(":memory:");
  try {
    store
      .prepare("UPDATE resources SET image=? WHERE id=?")
      .run("https://example.test/my-own-cover.webp", 2);
    store
      .prepare("DELETE FROM settings WHERE key=?")
      .run("resource-artwork-2026-v3");
    await enrichResourceArtwork(store);
    assert.equal(
      store.prepare("SELECT image FROM resources WHERE id=2").get().image,
      "https://example.test/my-own-cover.webp",
    );
  } finally {
    store.close();
  }
});
test("台账升级不改历史业务字段，重复运行不重置规则和配额", async () => {
  const store = await openSqliteStore(":memory:");
  try {
    const core = () =>
      JSON.stringify({
        orders: store
          .prepare(
            "SELECT id,code,user_id,resource_id,quantity,amount,booking_date,status,channel,note,escrow,refund_reason,created_at FROM orders ORDER BY id",
          )
          .all(),
        resources: store
          .prepare(
            "SELECT id,name,price,stock,status FROM resources ORDER BY id",
          )
          .all(),
      });
    const before = core();
    store.prepare("DELETE FROM settings WHERE key=?").run("team-review-v4");
    await upgradeReview(store);
    assert.equal(core(), before);
    store
      .prepare("UPDATE resources SET daily_capacity=? WHERE id=?")
      .run(321, 2);
    await upgradeReview(store);
    assert.equal(
      store.prepare("SELECT daily_capacity FROM resources WHERE id=?").get(2)
        .daily_capacity,
      321,
    );
  } finally {
    store.close();
  }
});
test("默认潜力会员需付费且近期活跃，沉默召回按90天规则判定", () => {
  const potential = defaultTagRules.find((r) => r.id === "potential"),
    silent = defaultTagRules.find((r) => r.id === "silent");
  assert.equal(
    ruleMatches({ spent: 0, paid_count: 4, days_since_payment: 1 }, potential),
    false,
  );
  assert.equal(
    ruleMatches(
      { spent: 120000, paid_count: 2, days_since_payment: 10 },
      potential,
    ),
    true,
  );
  assert.equal(
    ruleMatches(
      { spent: 120000, paid_count: 2, days_since_payment: 100 },
      potential,
    ),
    false,
  );
  assert.equal(
    ruleMatches({ paid_count: 1, days_since_payment: 100 }, silent),
    true,
  );
  assert.equal(
    ruleMatches({ paid_count: 0, days_since_payment: 99999 }, silent),
    false,
  );
});
