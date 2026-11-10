import test from "node:test";
import assert from "node:assert/strict";
import { openSqliteStore } from "../server/database.mjs";
import { enrichCatalog, catalogResources } from "../server/catalog-content.mjs";

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
