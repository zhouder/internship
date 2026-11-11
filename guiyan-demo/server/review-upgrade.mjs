import { resourceArtwork } from "./resource-artwork.mjs";
import { extensionColumns } from "./extension-schema.mjs";
export const datedCategories = [
  "show",
  "heritage",
  "tourism",
  "digital",
  "artist",
];
export const inventoryMode = (r) =>
  ["venue", "equipment"].includes(r.category)
    ? "rental"
    : r.category === "service"
      ? "none"
      : datedCategories.includes(r.category)
        ? "date"
        : "global";
export const upgradeColumns = {
  orders: {
    ...extensionColumns.orders,
    paid_at: "TEXT",
    refunded_at: "TEXT",
    refund_decision: "TEXT DEFAULT ''",
    stock_mode: "TEXT DEFAULT 'legacy'",
    time_estimated: "INTEGER DEFAULT 0",
    refunded_time_estimated: "INTEGER DEFAULT 0",
  },
  resources: { daily_capacity: "INTEGER" },
  messages: {
    kind: "TEXT DEFAULT 'system'",
    status: "TEXT DEFAULT 'approved'",
    related_order_id: "INTEGER",
  },
};
export const defaultTagRules = [
  {
    id: "high",
    name: "高价值用户",
    enabled: true,
    match: "all",
    conditions: [{ field: "spent", op: "gte", value: 1000000 }],
  },
  {
    id: "potential",
    name: "潜力会员",
    enabled: true,
    match: "all",
    conditions: [
      { field: "spent", op: "gte", value: 100000 },
      { field: "spent", op: "lt", value: 1000000 },
      { field: "paid_count", op: "gte", value: 2 },
      { field: "days_since_payment", op: "lte", value: 90 },
    ],
  },
  {
    id: "silent",
    name: "沉默用户",
    enabled: true,
    match: "all",
    conditions: [
      { field: "paid_count", op: "gte", value: 1 },
      { field: "days_since_payment", op: "gt", value: 90 },
    ],
  },
  {
    id: "heritage",
    name: "非遗浏览未购",
    enabled: true,
    match: "all",
    conditions: [
      { field: "view_category", op: "eq", value: "heritage" },
      { field: "paid_count", op: "eq", value: 0 },
    ],
  },
];
export async function upgradeReview(db) {
  const get = (s, ...p) => db.prepare(s).get(...p),
    run = (s, ...p) => db.prepare(s).run(...p);
  if (await get("SELECT value FROM settings WHERE key=?", "team-review-v4"))
    return;
  // Historical timestamps were never recorded. Keep an explicit estimate marker;
  // new payment/refund transitions record their actual timestamps.
  await run(
    "UPDATE orders SET paid_at=created_at,time_estimated=1 WHERE paid_at IS NULL AND status IN ('paid','completed','disputed','refund_requested','refunded')",
  );
  await run(
    "UPDATE orders SET refunded_at=created_at,refunded_time_estimated=1 WHERE refunded_at IS NULL AND status='refunded'",
  );
  const rows = await db
    .prepare("SELECT id,name,category,city,stock,meta FROM resources")
    .all();
  const seededNames = new Set(resourceArtwork.map((r) => r.name));
  for (const r of rows) {
    if (r.category === "show" && seededNames.has(r.name)) {
      const meta = JSON.parse(r.meta),
        venue = rows.find((v) => v.category === "venue" && v.city === r.city);
      if (!meta.venueId && venue) {
        meta.venueId = venue.id;
        meta.venueLinkSource = "模拟场馆关联，非真实排期";
        await run(
          "UPDATE resources SET meta=? WHERE id=?",
          JSON.stringify(meta),
          r.id,
        );
      }
    }
    if (inventoryMode(r) !== "date") continue;
    const held = await get(
      "SELECT COALESCE(SUM(quantity),0) AS n FROM orders WHERE resource_id=? AND status NOT IN ('cancelled','refunded')",
      r.id,
    );
    // Preserve the legacy stock counter. The separate daily quota includes
    // existing reservations; each day only subtracts that day's reservations.
    await run(
      "UPDATE resources SET daily_capacity=? WHERE id=?",
      r.stock + Number(held.n),
      r.id,
    );
  }
  await run("UPDATE messages SET kind='private' WHERE sender_id<>1");
  if (!(await get("SELECT value FROM settings WHERE key=?", "tagRules")))
    await run(
      "INSERT INTO settings(key,value) VALUES(?,?)",
      "tagRules",
      JSON.stringify(defaultTagRules),
    );
  if (!(await get("SELECT value FROM settings WHERE key=?", "segments")))
    await run("INSERT INTO settings(key,value) VALUES(?,?)", "segments", "[]");
  await run(
    "INSERT INTO settings(key,value) VALUES(?,?)",
    "team-review-v4",
    JSON.stringify({ version: 4 }),
  );
}
