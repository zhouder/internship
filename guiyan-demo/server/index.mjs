import http from "node:http";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { hashPassword, categories } from "./demo-data.mjs";
import { openSqliteStore, createRequestHandler } from "./database.mjs";
import { categoryImages } from "./catalog-content.mjs";
import { createInsights, dayOf, shiftDay } from "./insights.mjs";
import { inventoryMode } from "./review-upgrade.mjs";
import { createDemoExtensions } from "./demo-extensions.mjs";
import { createBookingSlots } from "./booking-slots.mjs";
import { operatorAnswer, supportAnswer, copyAnswer } from "./assistants.mjs";
import {
  createDeepseek,
  operatorContext,
  supportContext,
} from "./deepseek.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const currentDay = () => dayOf(new Date().toISOString());
const time = () => new Date().toISOString();
const validStatuses = ["published", "draft"];
function assert(condition, message, status = 400) {
  if (!condition)
    throw Object.assign(new Error(message), {
      status,
    });
}
function text(value, label, max = 1000) {
  assert(
    typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= max,
    `${label}不能为空且不能超过${max}字`,
  );
  return value.trim();
}
function int(value, label, min = 0, max = 100000000) {
  assert(
    Number.isSafeInteger(value) && value >= min && value <= max,
    `${label}必须为${min}至${max}之间的整数`,
  );
  return value;
}
function date(value) {
  assert(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !isNaN(new Date(value).valueOf()) &&
      new Date(value).toISOString().slice(0, 10) === value &&
      value >= currentDay(),
    "请选择有效日期，且不能早于演示基准日",
  );
  return value;
}
const safeUser = ({ password, ...u }) => u;
const resourceRow = (r) => ({
  ...r,
  inventory_mode: inventoryMode(r),
  tags: JSON.parse(r.tags),
  meta: JSON.parse(r.meta),
});
const isAdmin = (u) => u?.role === "admin";
const bookingType = (r) => ["venue", "equipment"].includes(r.category);
export async function createApp({
  dbFile = path.join(root, "data", "guiyan.sqlite"),
  database,
  aiOptions,
} = {}) {
  const db = database || (await openSqliteStore(dbFile));
  const ai = createDeepseek(aiOptions);
  const all = (sql, ...params) => db.prepare(sql).all(...params);
  const get = (sql, ...params) => db.prepare(sql).get(...params);
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const audit = async (u, action, detail) =>
    await run(
      "INSERT INTO audit_logs(user_id,action,detail,created_at) VALUES(?,?,?,?)",
      u?.id || null,
      action,
      detail,
      time(),
    );
  const notify = async (
    uid,
    title,
    content,
    sender = 1,
    kind = "system",
    relatedOrder = null,
  ) =>
    await run(
      "INSERT INTO messages(user_id,sender_id,title,content,created_at,kind,related_order_id) VALUES(?,?,?,?,?,?,?)",
      uid,
      sender,
      title,
      content,
      time(),
      kind,
      relatedOrder,
    );
  function transaction(fn) {
    // Write requests already run atomically on one database connection.
    return fn();
  }
  async function orderRows(user) {
    return await all(
      `SELECT o.*,r.name AS resource_name,r.image,r.category,r.unit,u.name AS user_name FROM orders o JOIN resources r ON r.id=o.resource_id JOIN users u ON u.id=o.user_id ${isAdmin(user) ? "" : "WHERE o.user_id=?"} ORDER BY o.id DESC`,
      ...(isAdmin(user) ? [] : [user?.id || 0]),
    );
  }
  const { profileRows, analysis, recommendations } = createInsights({
    all,
    get,
    orderRows,
    categories,
    today: currentDay,
    resourceRow,
  });
  async function available(r, d) {
    return (await slots.availability(r, d)).available;
  }
  const slots = createBookingSlots({ all, assert, int });
  const ops = createDemoExtensions({
    all,
    get,
    run,
    audit,
    notify,
    assert,
    int,
    text,
    currentDay,
  });
  async function saveProfileSnapshots(source = "manual") {
    const profiles = await profileRows(),
      day = currentDay();
    for (const profile of profiles)
      await run(
        "INSERT INTO profile_snapshots(user_id,snapshot_date,data) VALUES(?,?,?) ON CONFLICT(user_id,snapshot_date) DO UPDATE SET data=excluded.data",
        profile.id,
        day,
        JSON.stringify(profile),
      );
    const summary = {
      date: day,
      count: profiles.length,
      source,
      created_at: time(),
    };
    await run(
      "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      "lastProfileSnapshot",
      JSON.stringify(summary),
    );
    return summary;
  }
  const handle = async (req, res) => {
    const today = currentDay();
    const send = (value, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    const url = new URL(req.url, "http://localhost"),
      p = url.pathname;
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,Authorization,X-Guiyan-Channel",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      });
      res.end();
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (!p.startsWith("/api/")) {
        const staticRoot = p.startsWith("/images/")
          ? path.join(root, "public")
          : path.join(root, "dist");
        let file = path.resolve(staticRoot, "." + decodeURIComponent(p));
        assert(
          file.startsWith(staticRoot + path.sep) || file === staticRoot,
          "无效路径",
        );
        try {
          if (!(await stat(file)).isFile()) throw Error();
        } catch {
          file = path.join(root, "dist", "index.html");
        }
        let data;
        try {
          data = await readFile(file);
        } catch {
          send(
            {
              error: "前端尚未构建，请运行 npm run dev 或 npm run build",
            },
            404,
          );
          return;
        }
        const mime = {
          ".html": "text/html; charset=utf-8",
          ".js": "application/javascript",
          ".css": "text/css",
          ".png": "image/png",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
          ".json": "application/json",
        };
        res.writeHead(200, {
          "Content-Type":
            mime[path.extname(file)] || "application/octet-stream",
        });
        res.end(data);
        return;
      }
      let b = {};
      if (["POST", "PATCH", "PUT"].includes(req.method)) {
        // Vercel may provide an already-parsed body; local HTTP uses a stream.
        if (req.body !== undefined) {
          const raw =
            typeof req.body === "string" || Buffer.isBuffer(req.body)
              ? req.body.toString()
              : JSON.stringify(req.body);
          assert(Buffer.byteLength(raw) < 300000, "请求内容过长", 413);
          try {
            b = raw ? JSON.parse(raw) : {};
          } catch {
            assert(false, "请求数据格式错误");
          }
        } else {
          let raw = "";
          for await (const chunk of req) {
            raw += chunk;
            assert(Buffer.byteLength(raw) < 300000, "请求内容过长", 413);
          }
          try {
            b = raw ? JSON.parse(raw) : {};
          } catch {
            assert(false, "请求数据格式错误");
          }
        }
        assert(
          b && typeof b === "object" && !Array.isArray(b),
          "请求数据必须为对象",
        );
      }
      const token = req.headers.authorization?.replace(/^Bearer /, "");
      const session = token
        ? await get(
            "SELECT u.* FROM sessions s JOIN users u ON s.user_id=u.id WHERE token=? AND expires_at>?",
            token,
            time(),
          )
        : null;
      const needUser = () => {
        assert(session, "请先登录", 401);
        return session;
      };
      const needAdmin = () => {
        const u = needUser();
        assert(isAdmin(u), "需要管理员权限", 403);
        return u;
      };
      if (await ops.handle({ p, b, req, session, needUser, needAdmin, send }))
        return;
      if (p === "/api/health") {
        send({
          ok: true,
          mode: "mock",
          database: db.dialect,
          version:
            process.env.DEPLOYMENT_VERSION ||
            process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
            "local",
          today,
        });
        return;
      }
      if (p === "/api/login" && req.method === "POST") {
        const u = await get(
          "SELECT * FROM users WHERE username=?",
          text(b.username, "账号", 40),
        );
        assert(u, "账号或密码不正确", 401);
        const [salt, expected] = u.password.split(":"),
          actual = scryptSync(text(b.password, "密码", 100), salt, 32);
        assert(
          timingSafeEqual(actual, Buffer.from(expected, "hex")),
          "账号或密码不正确",
          401,
        );
        const newToken = randomBytes(32).toString("hex");
        await run(
          "INSERT INTO sessions VALUES(?,?,?)",
          newToken,
          u.id,
          new Date(Date.now() + 86400000 * 7).toISOString(),
        );
        await audit(u, "登录", "演示账号登录");
        send({
          token: newToken,
          user: safeUser(u),
        });
        return;
      }
      if (p === "/api/register" && req.method === "POST") {
        const username = text(b.username, "账号", 30);
        assert(
          /^[a-zA-Z0-9_]{3,30}$/.test(username),
          "账号需为3至30位字母、数字或下划线",
        );
        const password = text(b.password, "密码", 100);
        assert(password.length >= 6, "密码至少6位");
        assert(
          !(await get("SELECT id FROM users WHERE username=?", username)),
          "账号已存在",
          409,
        );
        await run(
          "INSERT INTO users(username,password,name,role,city,age,gender,channel,preference,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
          username,
          hashPassword(password),
          text(b.name, "姓名", 30),
          "user",
          b.city || "南宁",
          23,
          "未设置",
          ["H5", "电脑网页", "微信小程序"].includes(b.channel)
            ? b.channel
            : "H5",
          b.preference || "show",
          time(),
        );
        send({
          ok: true,
        });
        return;
      }
      if (p === "/api/logout" && req.method === "POST") {
        if (token) await run("DELETE FROM sessions WHERE token=?", token);
        send({
          ok: true,
        });
        return;
      }
      if (p === "/api/bootstrap") {
        const resources = (
          await all(
            `SELECT r.*,COALESCE((SELECT AVG(rating) FROM comments c WHERE c.resource_id=r.id AND c.status='approved'),0) rating,(SELECT COUNT(*) FROM comments c WHERE c.resource_id=r.id AND c.status='approved') review_count FROM resources r ${isAdmin(session) ? "" : "WHERE r.status='published'"} ORDER BY r.id`,
          )
        ).map(resourceRow);
        const inventoryThreshold = Number(
          JSON.parse(
            (
              await get(
                "SELECT value FROM settings WHERE key=?",
                "alertThreshold",
              )
            )?.value || "5",
          ),
        );
        for (const resource of resources)
          resource.low_stock =
            inventoryMode(resource) === "global" &&
            resource.stock <= inventoryThreshold;
        const demands = await all(
          `SELECT d.*,u.name AS user_name FROM demands d JOIN users u ON u.id=d.user_id ${isAdmin(session) ? "" : "WHERE d.status='approved' OR d.user_id=?"} ORDER BY d.id DESC`,
          ...(isAdmin(session) ? [] : [session?.id || 0]),
        );
        const comments = await all(
          `SELECT c.*,u.name AS user_name,r.name AS resource_name FROM comments c JOIN users u ON u.id=c.user_id JOIN resources r ON r.id=c.resource_id ${isAdmin(session) ? "" : "WHERE c.status='approved' OR c.user_id=?"} ORDER BY c.id DESC`,
          ...(isAdmin(session) ? [] : [session?.id || 0]),
        );
        send({
          mode: "mock",
          today,
          database: db.dialect,
          user: session ? safeUser(session) : null,
          ai: ai.info(),
          benefits: session ? await ops.benefits(session) : null,
          operations: isAdmin(session) ? await ops.report() : null,
          categories,
          resources,
          recommendations: session
            ? await recommendations(
                session,
                resources,
                req.headers["x-guiyan-channel"],
              )
            : [],
          inventoryThreshold,
          demands,
          comments,
          orders: session ? await orderRows(session) : [],
          favorites: session
            ? (
                await all(
                  "SELECT resource_id FROM favorites WHERE user_id=?",
                  session.id,
                )
              ).map((f) => f.resource_id)
            : [],
          messages: session
            ? (
                await all(
                  "SELECT m.*,u.name AS sender_name,t.name AS recipient_name FROM messages m LEFT JOIN users u ON u.id=m.sender_id LEFT JOIN users t ON t.id=m.user_id WHERE (m.user_id=? AND m.status='approved') OR (m.sender_id=? AND m.kind='private') ORDER BY m.id DESC",
                  session.id,
                  session.id,
                )
              ).map((m) => ({
                ...m,
                is_read: m.user_id === session.id ? m.is_read : 1,
              }))
            : [],
          members: session ? await all("SELECT id,name FROM users") : [],
          profiles: isAdmin(session) ? await profileRows() : [],
          moderatedMessages: isAdmin(session)
            ? await all(
                "SELECT m.*,u.name AS user_name,s.name AS sender_name FROM messages m LEFT JOIN users u ON u.id=m.user_id LEFT JOIN users s ON s.id=m.sender_id WHERE m.kind='private' ORDER BY m.id DESC LIMIT 100",
              )
            : [],
          analytics: isAdmin(session) ? await analysis() : null,
          settings: isAdmin(session)
            ? Object.fromEntries(
                (await all("SELECT * FROM settings")).map((s) => [
                  s.key,
                  JSON.parse(s.value),
                ]),
              )
            : null,
          logs: isAdmin(session)
            ? await all(
                "SELECT a.*,u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 60",
              )
            : [],
        });
        return;
      }
      if (p === "/api/analytics") {
        needAdmin();
        const period = url.searchParams.get("period") || "day";
        assert(
          ["day", "week", "month", "quarter"].includes(period),
          "无效统计周期",
        );
        send(await analysis(period));
        return;
      }
      if (p === "/api/alerts" && req.method === "POST") {
        const u = needAdmin();
        if (b.resolve) {
          await run(
            "DELETE FROM events WHERE id=? AND type LIKE 'alert.%'",
            int(b.resolve, "事件编号", 1),
          );
          await audit(u, "处理模拟预警", String(b.resolve));
          send({
            ok: true,
          });
          return;
        }
        const cases = {
          sales: [
            "销量突降",
            "模拟渠道销量较上一周期下降40%，建议检查库存与渠道活动。",
          ],
          verification: [
            "核销异常",
            "模拟检测到一张演示票重复核销，已标记待核实。",
          ],
          inventory: [
            "库存异常",
            "模拟渠道库存与本地记录不一致，请进行库存核对。",
          ],
          data: ["数据异常", "模拟导入记录缺少场馆标识，已进入待补全队列。"],
          sentiment: [
            "潜在舆情风险",
            "模拟收到低评分集中反馈，请联系资源方核实服务情况。",
          ],
        };
        assert(cases[b.kind], "请选择预警类型");
        const [title, detail] = cases[b.kind];
        await run(
          "INSERT INTO events(user_id,type,detail,created_at) VALUES(?,?,?,?)",
          u.id,
          "alert." + b.kind,
          JSON.stringify({
            title,
            detail,
          }),
          time(),
        );
        await audit(u, "触发模拟预警", title);
        send({
          ok: true,
        });
        return;
      }
      if (p === "/api/export") {
        const u = needAdmin(),
          rows = await orderRows(u);
        const csv = (v) =>
          `"${String(v ?? "")
            .replace(/"/g, '""')
            .replace(/^[=+@-]/, "'$&")}"`;
        const content =
          "\uFEFF" +
          [
            [
              "订单编号",
              "资源",
              "用户",
              "金额(元)",
              "演出/使用日期",
              "状态",
              "渠道",
              "下单时间(北京时间)",
              "支付时间(北京时间)",
              "退款时间(北京时间)",
              "历史时间说明",
            ],
            ...rows.map((o) => [
              o.code,
              o.resource_name,
              o.user_name,
              (o.amount / 100).toFixed(2),
              o.booking_date,
              o.status,
              o.channel,
              new Date(new Date(o.created_at).getTime() + 8 * 3600000)
                .toISOString()
                .slice(0, 19)
                .replace("T", " "),
              o.paid_at
                ? new Date(new Date(o.paid_at).getTime() + 8 * 3600000)
                    .toISOString()
                    .slice(0, 19)
                    .replace("T", " ")
                : "",
              o.refunded_at
                ? new Date(new Date(o.refunded_at).getTime() + 8 * 3600000)
                    .toISOString()
                    .slice(0, 19)
                    .replace("T", " ")
                : "",
              [
                o.paid_at
                  ? o.time_estimated
                    ? "支付时间：旧记录按下单时间估算"
                    : "支付时间：实际操作时间"
                  : "未支付",
                o.refunded_at
                  ? o.refunded_time_estimated
                    ? "退款时间：旧记录按下单时间估算"
                    : "退款时间：实际操作时间"
                  : "未退款",
              ].join("；"),
            ]),
          ]
            .map((r) => r.map(csv).join(","))
            .join("\r\n");
        await audit(u, "导出报表", `${rows.length}条订单`);
        res.writeHead(200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="guiyan-orders.csv"',
        });
        res.end(content);
        return;
      }
      if (p === "/api/sync" && req.method === "POST") {
        const u = needAdmin();
        const channel = b.channel || "票务平台";
        assert(
          [
            "票务平台",
            "抖音",
            "小红书",
            "大麦",
            "猫眼",
            "文惠卡",
            "消费卡",
          ].includes(channel),
          "无效模拟渠道",
        );
        const r = await get(
          "SELECT * FROM resources WHERE category='show' AND status='published' LIMIT 1",
        );
        assert(r, "无可同步的演出资源");
        const syncDate = shiftDay(today, 40);
        assert((await available(r, syncDate)) > 0, "所选场次库存不足", 409);
        await transaction(async () => {
          await run(
            "INSERT INTO orders(code,user_id,resource_id,quantity,amount,booking_date,status,channel,note,escrow,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            `GY${Date.now()}${randomBytes(2).toString("hex")}`,
            2,
            r.id,
            1,
            r.price,
            syncDate,
            "paid",
            channel,
            "模拟渠道同步订单",
            "模拟托管中",
            time(),
          );
          const synced = await get(
            "SELECT id FROM orders WHERE resource_id=? AND user_id=? ORDER BY id DESC LIMIT 1",
            r.id,
            2,
          );
          await run(
            "UPDATE orders SET paid_at=?,stock_mode='date',gross_amount=amount WHERE id=?",
            time(),
            synced.id,
          );
          await audit(
            u,
            "模拟数据同步",
            `${channel}：接收1条订单，状态模拟成功`,
          );
        });
        send({
          ok: true,
          message: `${channel}模拟同步完成，新增1条订单；未调用外部API。`,
        });
        return;
      }
      if (p === "/api/resources" && req.method === "POST") {
        const u = needAdmin();
        assert(
          categories.some((c) => c.id === b.category),
          "请选择资源分类",
        );
        const result = await run(
          "INSERT INTO resources(name,category,city,price,unit,description,image,capacity,stock,tags,meta,status,owner_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          text(b.name, "名称", 80),
          b.category,
          text(b.city, "城市", 30),
          int(b.price, "价格"),
          text(b.unit, "单位", 10),
          text(b.description, "介绍", 3000),
          categoryImages[b.category],
          int(b.capacity || 0, "人数", 0, 100000),
          int(b.stock ?? 100, "库存", 0, 100000),
          JSON.stringify(b.tags || []),
          JSON.stringify(b.meta || {}),
          "published",
          u.id,
          time(),
        );
        await audit(u, "新增资源", b.name);
        if (inventoryMode(b) === "date")
          await run(
            "UPDATE resources SET daily_capacity=? WHERE id=?",
            b.stock ?? 100,
            Number(result.lastInsertRowid),
          );
        send({
          ok: true,
          id: Number(result.lastInsertRowid),
        });
        return;
      }
      let m = p.match(/^\/api\/resources\/(\d+)$/);
      if (m && req.method === "PATCH") {
        const u = needAdmin(),
          r = await get("SELECT * FROM resources WHERE id=?", Number(m[1]));
        assert(r, "资源不存在", 404);
        assert(validStatuses.includes(b.status || r.status), "资源状态错误");
        await run(
          "UPDATE resources SET name=?,price=?,stock=?,description=?,status=? WHERE id=?",
          b.name === undefined ? r.name : text(b.name, "名称", 80),
          b.price === undefined ? r.price : int(b.price, "价格"),
          b.stock === undefined ? r.stock : int(b.stock, "库存"),
          b.description === undefined
            ? r.description
            : text(b.description, "介绍", 3000),
          b.status || r.status,
          r.id,
        );
        await audit(u, "修改资源", r.name);
        if (b.stock !== undefined && inventoryMode(r) === "date")
          await run(
            "UPDATE resources SET daily_capacity=? WHERE id=?",
            b.stock,
            r.id,
          );
        if (b.meta !== undefined) {
          assert(
            b.meta && typeof b.meta === "object" && !Array.isArray(b.meta),
            "扩展信息格式错误",
          );
          const meta = JSON.parse(r.meta);
          if (b.meta.venueId !== undefined) {
            const venueId = int(Number(b.meta.venueId), "关联场馆", 0);
            if (venueId)
              assert(
                await get(
                  "SELECT id FROM resources WHERE id=? AND category='venue'",
                  venueId,
                ),
                "关联场馆不存在",
              );
            meta.venueId = venueId;
          }
          await run(
            "UPDATE resources SET meta=? WHERE id=?",
            JSON.stringify(meta),
            r.id,
          );
        }
        send({
          ok: true,
        });
        return;
      }
      m = p.match(/^\/api\/resources\/(\d+)\/sync$/);
      if (m && req.method === "POST") {
        const u = needAdmin(),
          r = await get("SELECT * FROM resources WHERE id=?", Number(m[1]));
        assert(r, "资源不存在", 404);
        assert(r.category === "show", "只有剧目可进行渠道发布模拟");
        const meta = JSON.parse(r.meta);
        meta.channels = ["抖音", "小红书", "大麦"];
        meta.lastSync = time();
        meta.syncResult = "三渠道内容同步成功（模拟）";
        await run(
          "UPDATE resources SET meta=? WHERE id=?",
          JSON.stringify(meta),
          r.id,
        );
        await audit(u, "剧目渠道同步", r.name + "：抖音、小红书、大麦（模拟）");
        send({
          ok: true,
          message: "剧目已模拟同步至抖音、小红书和大麦，未发送外部请求。",
        });
        return;
      }
      m = p.match(/^\/api\/resources\/(\d+)\/view$/);
      if (m && req.method === "POST") {
        const r = await get(
          "SELECT * FROM resources WHERE id=? AND status='published'",
          Number(m[1]),
        );
        assert(r, "资源不存在", 404);
        await run("UPDATE resources SET views=views+1 WHERE id=?", r.id);
        await run(
          "INSERT INTO events(user_id,type,detail,created_at) VALUES(?,?,?,?)",
          session?.id || null,
          "view",
          String(r.id),
          time(),
        );
        send({
          ok: true,
        });
        return;
      }
      if (p === "/api/orders" && req.method === "POST") {
        const u = needUser(),
          rid = int(b.resourceId, "资源编号", 1),
          r = await get(
            "SELECT * FROM resources WHERE id=? AND status='published'",
            rid,
          );
        assert(r, "资源不存在或已下架", 404);
        const qty = int(b.quantity ?? 1, "数量", 1, 100),
          d = date(b.date);
        assert(!bookingType(r) || qty === 1, "租赁类资源每单数量为1");
        const id = await transaction(async () => {
          const selection = slots.selection(r, b),
            seats = await slots.reserveSelection(r, d, qty, selection),
            quote = await ops.quote(u, r, qty, b);
          if (inventoryMode(r) === "global") {
            const updated = await run(
              "UPDATE resources SET stock=stock-? WHERE id=? AND stock>=?",
              qty,
              rid,
              qty,
            );
            assert(updated.changes > 0, "库存不足", 409);
          }
          const result = await run(
            "INSERT INTO orders(code,user_id,resource_id,quantity,amount,booking_date,status,channel,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
            `GY${Date.now()}${randomBytes(2).toString("hex")}`,
            u.id,
            rid,
            qty,
            quote.amount,
            d,
            "pending",
            ["H5", "电脑网页", "微信小程序"].includes(b.channel)
              ? b.channel
              : "H5",
            String(b.note || "").slice(0, 1000),
            time(),
          );
          await run(
            "UPDATE orders SET stock_mode=?,session_time=?,seat_labels=?,start_time=?,end_time=? WHERE id=?",
            inventoryMode(r),
            selection.session,
            JSON.stringify(seats),
            selection.start,
            selection.end,
            Number(result.lastInsertRowid),
          );
          await ops.bindQuote(Number(result.lastInsertRowid), quote);
          await notify(
            u.id,
            "预约提交成功",
            `“${r.name}”${d}的预约已提交，等待后台审核。`,
            1,
            "system",
            Number(result.lastInsertRowid),
          );
          await audit(u, "提交预约", r.name);
          return Number(result.lastInsertRowid);
        });
        send({
          ok: true,
          id,
        });
        return;
      }
      m = p.match(/^\/api\/orders\/(\d+)$/);
      if (m && req.method === "PATCH") {
        const u = needUser(),
          o = await get(
            "SELECT o.*,r.category,r.name resource_name FROM orders o JOIN resources r ON r.id=o.resource_id WHERE o.id=?",
            Number(m[1]),
          );
        assert(o, "订单不存在", 404);
        assert(isAdmin(u) || o.user_id === u.id, "无权操作此订单", 403);
        const action = b.action;
        const transitions = {
          confirm: ["pending", "confirmed"],
          reject: ["pending", "cancelled"],
          pay: ["confirmed", "paid"],
          complete: ["paid", "completed"],
          cancel: [["pending", "confirmed"], "cancelled"],
          refund: ["paid", "refund_requested"],
          approveRefund: [["refund_requested", "disputed"], "refunded"],
          rejectRefund: ["refund_requested", "paid"],
          rejectDispute: ["disputed", "paid"],
          dispute: ["paid", "disputed"],
          resolve: ["disputed", "completed"],
        };
        assert(transitions[action], "无效操作");
        const [from, to] = transitions[action];
        assert(
          (Array.isArray(from) ? from : [from]).includes(o.status),
          "当前状态不允许该操作",
          409,
        );
        if (
          [
            "confirm",
            "reject",
            "approveRefund",
            "resolve",
            "rejectRefund",
            "rejectDispute",
          ].includes(action)
        )
          needAdmin();
        const decision = ["rejectRefund", "rejectDispute"].includes(action)
          ? text(b.reason, "拒绝原因", 500)
          : null;
        await transaction(async () => {
          await ops.beforeTransition(o, action, b, u);
          await run(
            "UPDATE orders SET status=?,escrow=?,refund_reason=? WHERE id=?",
            to,
            to === "paid"
              ? "模拟托管中"
              : to === "completed"
                ? "已结算"
                : to === "refunded"
                  ? "已模拟退款"
                  : o.escrow,
            ["refund", "dispute"].includes(action)
              ? text(b.reason || "用户申请售后", "申请原因", 500)
              : o.refund_reason,
            o.id,
          );
          if (action === "pay")
            await run(
              "UPDATE orders SET paid_at=?,time_estimated=0,refund_decision=? WHERE id=?",
              time(),
              "",
              o.id,
            );
          if (to === "refunded")
            await run(
              "UPDATE orders SET refunded_at=?,refunded_time_estimated=0,refund_decision=? WHERE id=?",
              time(),
              "审核通过，已模拟退款",
              o.id,
            );
          if (["refund", "dispute"].includes(action))
            await run(
              "UPDATE orders SET refund_decision=? WHERE id=?",
              "",
              o.id,
            );
          if (decision)
            await run(
              "UPDATE orders SET refund_decision=? WHERE id=?",
              decision,
              o.id,
            );
          if (
            ["cancelled", "refunded"].includes(to) &&
            !bookingType(o) &&
            ["legacy", "global"].includes(o.stock_mode)
          )
            await run(
              "UPDATE resources SET stock=stock+? WHERE id=?",
              o.quantity,
              o.resource_id,
            );
          await ops.afterTransition(o, action, to);
          await notify(
            o.user_id,
            "订单状态更新",
            `${o.code} · ${o.resource_name} → ${to}。${action === "pay" ? "这是模拟支付，未扣除真实资金。" : ""}${decision ? "售后未通过：" + decision : ""}`,
            1,
            "system",
            o.id,
          );
          await audit(
            u,
            `订单操作 ${action}`,
            o.code + (decision ? "；原因：" + decision : ""),
          );
        });
        send({
          ok: true,
        });
        return;
      }
      m = p.match(/^\/api\/orders\/(\d+)\/contract$/);
      if (m) {
        const u = needUser(),
          o = await get(
            "SELECT o.*,r.name,r.meta FROM orders o JOIN resources r ON r.id=o.resource_id WHERE o.id=?",
            Number(m[1]),
          );
        assert(
          o && (isAdmin(u) || o.user_id === u.id),
          "订单不存在或无权查看",
          403,
        );
        const meta = JSON.parse(o.meta);
        send({
          title: "模拟服务与授权协议",
          content: `【毕业实习演示文件，无真实合同效力】\n订单：${o.code}\n资源：${o.name}\n日期：${o.booking_date}\n金额：${(o.amount / 100).toFixed(2)}元（模拟）\n授权范围：${meta.scope || "订单约定的资源服务"}\n期限：${meta.term || "预约日期当日"}\n区域：${meta.territory || "订单约定地点"}\n设备押金：${((meta.deposit || 0) / 100).toFixed(2)}元（仅展示，不收取）\n服务流程：预约→审核→模拟支付→服务完成→模拟结算。\n纠纷可通过订单申诉提交，资金状态仅为本地模拟。`,
        });
        return;
      }
      if (p === "/api/demands" && req.method === "POST") {
        const u = needUser();
        assert(u.verified, "发布需求前请先完成演示身份认证", 403);
        assert(
          categories.some((c) => c.id === b.category),
          "请选择需求分类",
        );
        await run(
          "INSERT INTO demands(user_id,title,category,budget,city,description,created_at) VALUES(?,?,?,?,?,?,?)",
          u.id,
          text(b.title, "标题", 80),
          b.category,
          int(b.budget, "预算"),
          text(b.city, "城市", 30),
          text(b.description, "需求说明", 2000),
          time(),
        );
        await audit(u, "发布需求", b.title);
        await notify(
          u.id,
          "需求等待审核",
          `“${b.title}”已提交，审核通过后公开展示。`,
        );
        send({
          ok: true,
        });
        return;
      }
      if (p === "/api/comments" && req.method === "POST") {
        const u = needUser(),
          rid = int(b.resourceId, "资源编号", 1);
        assert(
          await get("SELECT id FROM resources WHERE id=?", rid),
          "资源不存在",
        );
        const content = text(b.content, "评论", 1000);
        assert(
          !/诈骗|色情|辱骂/.test(content),
          "评论包含不适当内容，请修改后提交",
        );
        let score = int(b.rating, "评分", 1, 5);
        const dimensions = {};
        if (b.dimensions) {
          for (const key of ["quality", "service", "value"])
            dimensions[key] = int(b.dimensions[key], "分项评分", 1, 5);
          score = Math.round(
            (dimensions.quality + dimensions.service + dimensions.value) / 3,
          );
        }
        await run(
          "INSERT INTO comments(user_id,resource_id,rating,content,created_at,dimensions) VALUES(?,?,?,?,?,?)",
          u.id,
          rid,
          score,
          content,
          time(),
          JSON.stringify(dimensions),
        );
        await audit(u, "提交评论", String(rid));
        send({
          ok: true,
          message: "已提交，后台审核后公开显示",
        });
        return;
      }
      if (p === "/api/moderate" && req.method === "POST") {
        const u = needAdmin();
        assert(
          ["demand", "comment", "message"].includes(b.type),
          "审核类型错误",
        );
        assert(["approved", "rejected"].includes(b.status), "审核状态错误");
        const table =
            b.type === "demand"
              ? "demands"
              : b.type === "message"
                ? "messages"
                : "comments",
          id = int(b.id, "编号", 1),
          r = await get(`SELECT * FROM ${table} WHERE id=?`, id);
        assert(r, "内容不存在", 404);
        if (b.type === "message")
          assert(r.kind === "private", "仅审核合作私信");
        await run(`UPDATE ${table} SET status=? WHERE id=?`, b.status, id);
        if (b.reply && b.type === "comment")
          await run(
            "UPDATE comments SET reply=? WHERE id=?",
            text(b.reply, "回复", 1000),
            id,
          );
        await notify(
          b.type === "message" ? r.sender_id : r.user_id,
          "内容审核结果",
          `${b.type === "demand" ? r.title : r.content.slice(0, 30)}：${b.status === "approved" ? "审核通过" : "未通过审核"}`,
        );
        await audit(u, "内容审核", `${b.type} ${id} ${b.status}`);
        send({
          ok: true,
        });
        return;
      }
      if (p === "/api/favorites" && req.method === "POST") {
        const u = needUser(),
          id = int(b.resourceId, "资源编号", 1);
        assert(
          await get("SELECT id FROM resources WHERE id=?", id),
          "资源不存在",
        );
        const exists = await get(
          "SELECT 1 FROM favorites WHERE user_id=? AND resource_id=?",
          u.id,
          id,
        );
        if (exists)
          await run(
            "DELETE FROM favorites WHERE user_id=? AND resource_id=?",
            u.id,
            id,
          );
        else await run("INSERT INTO favorites VALUES(?,?)", u.id, id);
        send({
          ok: true,
          favorite: !exists,
        });
        return;
      }
      if (p === "/api/profile" && req.method === "PATCH") {
        const u = needUser();
        await run(
          "UPDATE users SET name=?,city=?,preference=?,verified=? WHERE id=?",
          b.name ? text(b.name, "姓名", 30) : u.name,
          b.city ? text(b.city, "城市", 30) : u.city,
          categories.some((c) => c.id === b.preference)
            ? b.preference
            : u.preference,
          b.verify === true ? 1 : u.verified,
          u.id,
        );
        await audit(
          u,
          b.verify ? "模拟身份认证" : "更新用户资料",
          "未采集真实身份证信息",
        );
        send({
          ok: true,
        });
        return;
      }
      if (p === "/api/messages" && req.method === "POST") {
        const u = needUser(),
          uid = int(b.to, "接收人", 1);
        assert(
          await get("SELECT id FROM users WHERE id=?", uid),
          "接收人不存在",
        );
        assert(uid !== u.id, "不能给自己发送私信");
        const content = text(b.content, "消息", 1000),
          title = text(b.title || "合作私信", "标题", 80);
        const status = /诈骗|色情|辱骂/.test(title + content)
          ? "pending"
          : "approved";
        await run(
          "INSERT INTO messages(user_id,sender_id,title,content,created_at,kind,status) VALUES(?,?,?,?,?,?,?)",
          uid,
          u.id,
          title,
          content,
          time(),
          "private",
          status,
        );
        await audit(u, "发送站内私信", String(uid));
        send({
          ok: true,
          message:
            status === "pending"
              ? "私信含待核实内容，已进入人工审核，尚未送达"
              : "私信已发送",
        });
        return;
      }
      if (p === "/api/messages/read" && req.method === "POST") {
        const u = needUser();
        if (b.id !== undefined) {
          const id = int(b.id, "消息编号", 1);
          assert(
            await get(
              "SELECT id FROM messages WHERE id=? AND user_id=? AND status='approved'",
              id,
              u.id,
            ),
            "消息不存在或无权操作",
            404,
          );
          await run(
            "UPDATE messages SET is_read=1 WHERE id=? AND user_id=?",
            id,
            u.id,
          );
        } else
          await run(
            "UPDATE messages SET is_read=1 WHERE user_id=? AND status='approved'",
            u.id,
          );
        send({
          ok: true,
        });
        return;
      }
      if (p === "/api/recommendations") {
        const u = needUser(),
          id = Number(url.searchParams.get("userId") || u.id);
        if (id !== u.id) needAdmin();
        const target = await get("SELECT * FROM users WHERE id=?", id);
        assert(target, "用户不存在", 404);
        send({
          recommendations: await recommendations(
            target,
            (await all("SELECT * FROM resources WHERE status='published'")).map(
              resourceRow,
            ),
            url.searchParams.get("channel") || req.headers["x-guiyan-channel"],
          ),
        });
        return;
      }
      if (p === "/api/profiles/snapshot" && req.method === "POST") {
        const u = needAdmin();
        await saveProfileSnapshots("manual");
        await audit(u, "保存画像快照", today);
        send({
          ok: true,
          message: "今日画像快照已保存；同日再次保存将更新当日快照",
        });
        return;
      }
      m = p.match(/^\/api\/profiles\/(\d+)\/history$/);
      if (m) {
        needAdmin();
        send({
          snapshots: (
            await all(
              "SELECT snapshot_date,data FROM profile_snapshots WHERE user_id=? ORDER BY snapshot_date DESC LIMIT 30",
              Number(m[1]),
            )
          ).map((r) => ({
            date: r.snapshot_date,
            profile: JSON.parse(r.data),
          })),
        });
        return;
      }
      if (p === "/api/segments/notify" && req.method === "POST") {
        const u = needAdmin(),
          segments = JSON.parse(
            (await get("SELECT value FROM settings WHERE key=?", "segments"))
              .value,
          );
        const segment = segments.find((s) => s.id === b.segmentId);
        assert(segment, "请先保存分群");
        const rows = (await profileRows()).filter(
          (p) =>
            (!segment.tag || p.tags.includes(segment.tag)) &&
            (!segment.city || p.city === segment.city) &&
            (!segment.channel || p.channel === segment.channel),
        );
        const content = text(b.content, "站内通知", 500);
        assert(rows.length, "分群当前没有用户");
        for (const p of rows)
          await notify(p.id, "分群活动通知（模拟）", content);
        await audit(u, "分群站内通知", `${segment.name}：${rows.length}人`);
        send({
          ok: true,
          message: `已向${rows.length}名分群用户发送模拟站内通知，未发送外部短信`,
        });
        return;
      }
      if (p === "/api/ai" && req.method === "POST") {
        const u = needUser(),
          prompt = text(b.prompt, "问题", 1000);
        assert(
          ["copy", "operator", "support"].includes(b.kind || "support"),
          "无效助手类型",
        );
        const kind = b.kind || "support";
        if (b.history !== undefined)
          assert(
            Array.isArray(b.history) &&
              b.history.length <= 6 &&
              b.history.every(
                (m) =>
                  m &&
                  ["user", "assistant"].includes(m.role) &&
                  typeof m.content === "string" &&
                  m.content.length <= 1500,
              ),
            "对话历史格式错误",
          );
        let fallback, context;
        if (kind === "copy") fallback = () => copyAnswer(prompt);
        else if (b.kind === "operator") {
          needAdmin();
          const a = await analysis();
          context = operatorContext(a);
          fallback = () => ({ answer: operatorAnswer(prompt, a) });
        } else {
          const own = await orderRows({ id: u.id, role: "user" }),
            resources = (
              await all("SELECT * FROM resources WHERE status='published'")
            ).map(resourceRow);
          context = supportContext(own, resources);
          fallback = () => ({ answer: supportAnswer(prompt, own, resources) });
        }
        let blocked;
        if (ai.configured) {
          const now = time(),
            start = new Date(today + "T00:00:00+08:00").toISOString(),
            minute = new Date(Date.now() - 60000).toISOString();
          const usage = await get(
            "SELECT COUNT(CASE WHEN created_at>=? THEN 1 END) AS total,COUNT(CASE WHEN user_id=? AND created_at>=? THEN 1 END) AS own,COUNT(CASE WHEN user_id=? AND created_at>=? THEN 1 END) AS recent FROM events WHERE type='ai.external' AND created_at>=?",
            start,
            u.id,
            start,
            u.id,
            minute,
            minute < start ? minute : start,
          );
          blocked =
            usage.total >= ai.limits.daily
              ? "daily_limit"
              : usage.own >= ai.limits.user
                ? "user_limit"
                : usage.recent >= ai.limits.minute
                  ? "minute_limit"
                  : null;
          if (!blocked)
            await run(
              "INSERT INTO events(user_id,type,detail,created_at) VALUES(?,?,?,?)",
              u.id,
              "ai.external",
              kind,
              now,
            );
        }
        await audit(
          u,
          `AI提问 ${kind}`,
          `服务：${ai.info().provider}；问题${prompt.length}字${blocked ? "；使用本地回退" : ""}`,
        );
        res.afterDatabase = async () =>
          send(
            await ai.generate({
              kind,
              prompt,
              history: b.history,
              context,
              fallback,
              blocked,
            }),
          );
        return;
      }
      if (p === "/api/settings" && req.method === "PATCH") {
        const u = needAdmin();
        if (b.alertThreshold !== undefined)
          await run(
            "UPDATE settings SET value=? WHERE key=?",
            JSON.stringify(int(b.alertThreshold, "预警阈值", 0, 1000)),
            "alertThreshold",
          );
        if (b.tagRules !== undefined) {
          assert(
            Array.isArray(b.tagRules) && b.tagRules.length <= 20,
            "最多配置20条标签规则",
          );
          const fields = [
            "spent",
            "paid_count",
            "days_since_payment",
            "view_count",
            "favorite_count",
            "preference",
            "city",
            "channel",
            "view_category",
          ];
          const ids = new Set(),
            names = new Set();
          for (const r of b.tagRules) {
            text(r.id, "规则编号", 60);
            text(r.name, "标签名称", 20);
            assert(
              !ids.has(r.id) && !names.has(r.name),
              "规则编号和标签名称不能重复",
            );
            ids.add(r.id);
            names.add(r.name);
            assert(
              typeof r.enabled === "boolean" &&
                ["all", "any"].includes(r.match) &&
                Array.isArray(r.conditions) &&
                r.conditions.length >= 1 &&
                r.conditions.length <= 6,
              "规则至少需要1个、最多6个条件",
            );
            for (const c of r.conditions) {
              assert(
                fields.includes(c.field) &&
                  ["gte", "lte", "gt", "lt", "eq"].includes(c.op),
                "不支持的规则条件",
              );
              if (
                [
                  "spent",
                  "paid_count",
                  "days_since_payment",
                  "view_count",
                  "favorite_count",
                ].includes(c.field)
              )
                int(c.value, "阈值", 0);
              else {
                assert(c.op === "eq", "文本条件仅支持等于");
                text(c.value, "匹配值", 40);
              }
            }
          }
          await run(
            "UPDATE settings SET value=? WHERE key=?",
            JSON.stringify(b.tagRules),
            "tagRules",
          );
        }
        if (b.segments !== undefined) {
          assert(
            Array.isArray(b.segments) && b.segments.length <= 30,
            "最多保存30个分群",
          );
          const ids = new Set();
          for (const s of b.segments) {
            text(s.id, "分群编号", 60);
            text(s.name, "分群名称", 40);
            assert(!ids.has(s.id), "分群编号不能重复");
            ids.add(s.id);
            for (const key of ["tag", "city", "channel"])
              assert(
                typeof s[key] === "string" && s[key].length <= 40,
                "分群条件格式错误",
              );
          }
          await run(
            "UPDATE settings SET value=? WHERE key=?",
            JSON.stringify(b.segments),
            "segments",
          );
        }
        await audit(u, "更新设置", "库存预警阈值");
        send({
          ok: true,
        });
        return;
      }
      if (p === "/api/availability") {
        const id = Number(url.searchParams.get("resourceId"));
        const resource = await get("SELECT * FROM resources WHERE id=?", id);
        assert(
          resource && (resource.status === "published" || isAdmin(session)),
          "资源不存在",
          404,
        );
        send({
          ...(await slots.availability(
            resource,
            date(url.searchParams.get("date") || today),
            slots.selection(resource, Object.fromEntries(url.searchParams)),
          )),
          date: url.searchParams.get("date") || today,
          dates: await all(
            "SELECT booking_date,status,session_time,start_time,end_time FROM orders WHERE resource_id=? AND status NOT IN ('cancelled','refunded')",
            id,
          ),
        });
        return;
      }
      send(
        {
          error: "接口不存在",
        },
        404,
      );
    } catch (e) {
      if (e.code === "23505")
        Object.assign(e, { status: 409, message: "记录已存在，请刷新后重试" });
      if (!e.status)
        console.error("Business request failed", {
          code: e.code || "INTERNAL_ERROR",
        });
      send(
        {
          error: e.status ? e.message : "服务暂时无法处理请求",
        },
        e.status || 500,
      );
    }
  };
  const handler = createRequestHandler(db, handle);
  const server = http.createServer(handler);
  server.handler = handler;
  server.snapshotProfiles = () =>
    db.request(() => saveProfileSnapshots("timer"), {
      write: true,
      success: () => true,
    });
  server.dispose = () => db.close();
  server.on("close", () => db.close());
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const database = process.env.DATABASE_URL
    ? await (
        await import("./postgres.mjs")
      ).openPostgresStore(process.env.DATABASE_URL)
    : undefined;
  const server = await createApp({ database });
  const port = Number(process.env.PORT || 3001);
  server.listen(port, process.env.HOST || "0.0.0.0", () =>
    console.log(`桂演 API / 生产预览：http://localhost:${port}（模拟数据）`),
  );
}
