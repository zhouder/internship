import { createApp } from "../server/index.mjs";
import { openPostgresStore } from "../server/postgres.mjs";

let app;
export default async function handler(req, res) {
  try {
    app ||= openPostgresStore(process.env.DATABASE_URL)
      .then((database) => createApp({ database }))
      .catch((error) => {
        app = undefined;
        throw error;
      });
    const url = new URL(req.url, "https://demo.invalid");
    const route = url.searchParams.get("route");
    if (route !== null) {
      url.pathname = "/api/" + route;
      url.searchParams.delete("route");
      req.url = url.pathname + url.search;
    }
    await (await app).handler(req, res);
  } catch (error) {
    console.error("API initialization failed", {
      code: error.code || "INITIALIZATION_FAILED",
    });
    res.writeHead(503, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ error: "服务正在连接数据库，请稍后重试" }));
  }
}
