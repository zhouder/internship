import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { schema } from "./schema.mjs";
import { seed } from "./demo-data.mjs";
import { upgradeColumns } from "./review-upgrade.mjs";
export { categories, hashPassword } from "./demo-data.mjs";

export function openDatabase(filename) {
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;" + schema);
  if (
    !db
      .prepare("PRAGMA table_info(comments)")
      .all()
      .some((c) => c.name === "dimensions")
  ) {
    db.exec(
      "ALTER TABLE comments ADD COLUMN dimensions TEXT NOT NULL DEFAULT '{}'",
    );
  }
  if (!db.prepare("SELECT COUNT(*) AS n FROM users").get().n) seed(db);
  for (const [table, columns] of Object.entries(upgradeColumns)) {
    const existing = new Set(
      db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((c) => c.name),
    );
    for (const [name, type] of Object.entries(columns))
      if (!existing.has(name))
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
  return db;
}
