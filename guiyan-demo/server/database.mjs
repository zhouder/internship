import { enrichCatalog } from "./catalog-content.mjs";
import { enrichResourceArtwork } from "./resource-artwork.mjs";
import { upgradeReview } from "./review-upgrade.mjs";
// Keep SQL dialect differences and request transactions outside business routes.
export async function openSqliteStore(filename) {
  const { openDatabase } = await import("./db.mjs");
  const db = openDatabase(filename);
  db.exec("BEGIN IMMEDIATE");
  try {
    await enrichCatalog(db);
    await enrichResourceArtwork(db);
    await upgradeReview(db);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  let tail = Promise.resolve();
  return {
    dialect: "sqlite",
    prepare: (sql) => db.prepare(sql),
    close: () => db.close(),
    async request(fn, { write, success }) {
      // SQLite uses one connection; never interleave requests in its transaction.
      const previous = tail;
      let release;
      tail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        if (write) db.exec("BEGIN IMMEDIATE");
        const result = await fn();
        if (write) db.exec(success() ? "COMMIT" : "ROLLBACK");
        return result;
      } catch (error) {
        if (write) db.exec("ROLLBACK");
        throw error;
      } finally {
        release();
      }
    },
  };
}

// Commit before sending the response, so the next request sees saved changes.
export function createRequestHandler(db, handle) {
  return async (req, res) => {
    const end = res.end;
    let pending;
    res.end = function (...args) {
      pending = args;
      return this;
    };
    try {
      await db.request(() => handle(req, res), {
        // Export is a GET that also records an audit entry.
        write:
          !["GET", "HEAD", "OPTIONS"].includes(req.method) ||
          new URL(req.url, "http://localhost").pathname === "/api/export",
        success: () => res.statusCode < 400,
      });
      res.end = end;
      res.end(...(pending || []));
    } catch (error) {
      res.end = end;
      console.error("Request transaction failed", {
        code: error.code || "DATABASE_UNAVAILABLE",
      });
      if (!res.headersSent)
        res.writeHead(503, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
      res.end(JSON.stringify({ error: "数据库暂时不可用，请稍后重试" }));
    }
  };
}
