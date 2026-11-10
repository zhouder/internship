import http from "node:http";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { hashPassword, categories } from "./demo-data.mjs";
import { openSqliteStore, createRequestHandler } from "./database.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const today = "2026-11-09";
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
      value >= today,
    "请选择有效日期，且不能早于演示基准日",
  );
  return value;
}
const safeUser = ({ password, ...u }) => u;
const resourceRow = (r) => ({
  ...r,
  tags: JSON.parse(r.tags),
  meta: JSON.parse(r.meta),
});
const isAdmin = (u) => u?.role === "admin";
const bookingType = (r) => ["venue", "equipment"].includes(r.category);
export async function createApp({
  dbFile = path.join(root, "data", "guiyan.sqlite"),
  database,
} = {}) {
  const db = database || (await openSqliteStore(dbFile));
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
  const notify = async (uid, title, content, sender = 1) =>
    await run(
      "INSERT INTO messages(user_id,sender_id,title,content,created_at) VALUES(?,?,?,?,?)",
      uid,
      sender,
      title,
      content,
      time(),
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
  async function profileRows() {
    return (
      await all(
        `SELECT u.id,u.username,u.name,u.city,u.age,u.gender,u.channel,u.preference,u.verified,u.role,COUNT(o.id) AS order_count,COALESCE(SUM(CASE WHEN o.status IN ('paid','completed','disputed','refund_requested') THEN o.amount ELSE 0 END),0) AS spent,MAX(o.created_at) AS last_order,(SELECT COUNT(*) FROM favorites f WHERE f.user_id=u.id) AS favorite_count,(SELECT COUNT(*) FROM events e WHERE e.user_id=u.id AND e.type='view') AS view_count FROM users u LEFT JOIN orders o ON o.user_id=u.id WHERE u.role<>'admin' GROUP BY u.id`,
      )
    ).map((u) => ({
      ...u,
      portrait: {
        pricePreference: u.order_count
          ? Math.round(u.spent / u.order_count)
          : 0,
        balance: 0,
        favorites: u.favorite_count,
        views: u.view_count,
        purchaseWindow: u.last_order ? u.last_order.slice(11, 16) : "暂无",
        payment: "模拟支付",
        repeat: u.order_count > 1 ? "有复购" : "暂无复购",
        lastOrder: u.last_order,
      },
      tags: [
        u.spent > 1000000
          ? "高价值用户"
          : u.order_count > 2
            ? "潜力会员"
            : "新用户",
        u.order_count > 4 ? "高频观演" : "待培育",
        categories.find((c) => c.id === u.preference)?.name || "综合兴趣",
      ],
      suggestion:
        u.spent > 1000000
          ? "推荐剧场专场与会员组合权益"
          : u.order_count > 2
            ? "推送同城演出及复购优惠"
            : "推荐低门槛非遗体验与首购活动",
    }));
  }
  async function analysis(period = "day") {
    assert(
      ["day", "week", "month", "quarter"].includes(period),
      "无效统计周期",
    );
    const orders = await orderRows({
        role: "admin",
      }),
      paid = orders.filter((o) =>
        ["paid", "completed", "disputed", "refund_requested"].includes(
          o.status,
        ),
      );
    const daily = new Map(),
      channels = new Map();
    paid.forEach((o) => {
      const d = o.created_at.slice(0, 10),
        dt = new Date(d);
      let key = d;
      if (period === "week") {
        dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
        key = dt.toISOString().slice(0, 10);
      }
      if (period === "month") key = d.slice(0, 7);
      if (period === "quarter")
        key = `${d.slice(0, 4)} Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
      const cell = daily.get(key) || {
        date: key,
        amount: 0,
        count: 0,
      };
      cell.amount += o.amount;
      cell.count++;
      daily.set(key, cell);
      channels.set(o.channel, (channels.get(o.channel) || 0) + o.amount);
    });
    const resources = (await all("SELECT * FROM resources")).map(resourceRow);
    const ranking = resources
      .map((r) => ({
        ...r,
        sales: paid.filter((o) => o.resource_id === r.id).length,
        revenue: paid
          .filter((o) => o.resource_id === r.id)
          .reduce((a, o) => a + o.amount, 0),
      }))
      .sort((a, b) => b.revenue - a.revenue);
    const threshold = JSON.parse(
      (await get("SELECT value FROM settings WHERE key=?", "alertThreshold"))
        .value,
    );
    const alerts = resources
      .filter((r) => !bookingType(r) && r.stock <= threshold)
      .map((r) => ({
        severity: "warning",
        title: `${r.name}库存仅剩${r.stock}`,
        detail: "建议补充库存或暂时下架，避免超卖。",
      }));
    const pending = orders.filter((o) => o.status === "pending").length;
    if (pending)
      alerts.push({
        severity: "info",
        title: `${pending}笔预约等待确认`,
        detail: "请在交易管理中确认档期和资源，及时处理预约。",
      });
    const abnormal = orders.filter(
      (o) => o.status === "disputed" || o.status === "refund_requested",
    );
    if (abnormal.length)
      alerts.push({
        severity: "warning",
        title: `${abnormal.length}笔售后或纠纷待处理`,
        detail: "请核实退款和申诉信息。",
      });
    for (const event of await all(
      "SELECT * FROM events WHERE type LIKE 'alert.%' ORDER BY id DESC LIMIT 5",
    )) {
      const item = JSON.parse(event.detail);
      alerts.push({
        id: event.id,
        severity: "warning",
        title: item.title + "（模拟事件）",
        detail: item.detail,
      });
    }
    const activeUsers = new Set(
      orders
        .filter(
          (o) =>
            o.created_at.slice(0, 10) >= "2026-10-10" &&
            o.created_at.slice(0, 10) <= "2026-11-09",
        )
        .map((o) => o.user_id),
    );
    return {
      period,
      today,
      kpis: {
        revenue: paid.reduce((a, o) => a + o.amount, 0),
        orders: orders.length,
        resources: resources.filter((r) => r.status === "published").length,
        users: activeUsers.size,
      },
      series: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
      channels: [...channels].map(([name, amount]) => ({
        name,
        amount,
      })),
      ranking,
      alerts,
      insights: [
        `交易额最高的资源是“${ranking[0]?.name || "暂无"}”，可优先安排联动推广。`,
        `当前${pending}笔预约待确认，建议安排专人跟进。`,
        `高价值用户${(await profileRows()).filter((u) => u.spent > 1000000).length}人，可推荐专场合作与会员组合权益。`,
      ],
      venues: resources
        .filter((r) => r.category === "venue")
        .map((r) => {
          const booked = orders.filter(
            (o) =>
              o.resource_id === r.id &&
              !["cancelled", "refunded"].includes(o.status),
          );
          return {
            id: r.id,
            name: r.name,
            bookedDays: new Set(booked.map((o) => o.booking_date)).size,
            occupancy: Math.min(
              100,
              Math.round(
                (new Set(booked.map((o) => o.booking_date)).size / 30) * 100,
              ),
            ),
            revenue: paid
              .filter((o) => o.resource_id === r.id)
              .reduce((a, o) => a + o.amount, 0),
          };
        }),
    };
  }
  const handle = async (req, res) => {
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
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
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
      if (p === "/api/health") {
        send({
          ok: true,
          mode: "mock",
          database: db.dialect,
          version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
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
          b.channel === "微信小程序" ? "微信小程序" : "H5",
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
          user: session ? safeUser(session) : null,
          categories,
          resources,
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
            ? await all(
                "SELECT m.*,u.name AS sender_name FROM messages m LEFT JOIN users u ON u.id=m.sender_id WHERE m.user_id=? ORDER BY m.id DESC",
                session.id,
              )
            : [],
          members: session
            ? await all("SELECT id,name FROM users WHERE role<>?", "admin")
            : [],
          profiles: isAdmin(session) ? await profileRows() : [],
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
        send(await analysis(url.searchParams.get("period") || "day"));
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
            ["订单编号", "资源", "用户", "金额(元)", "日期", "状态", "渠道"],
            ...rows.map((o) => [
              o.code,
              o.resource_name,
              o.user_name,
              (o.amount / 100).toFixed(2),
              o.booking_date,
              o.status,
              o.channel,
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
          "SELECT * FROM resources WHERE category='show' AND status='published' AND stock>0 LIMIT 1",
        );
        assert(r, "无可同步的演出资源");
        await transaction(async () => {
          await run(
            "INSERT INTO orders(code,user_id,resource_id,quantity,amount,booking_date,status,channel,note,escrow,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            `GY${Date.now()}${randomBytes(2).toString("hex")}`,
            2,
            r.id,
            1,
            r.price,
            "2026-12-20",
            "paid",
            channel,
            "模拟渠道同步订单",
            "模拟托管中",
            time(),
          );
          await run("UPDATE resources SET stock=stock-1 WHERE id=?", r.id);
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
          b.category === "venue"
            ? "/images/venue.png"
            : "/images/performance.png",
          int(b.capacity || 0, "人数", 0, 100000),
          int(b.stock ?? 100, "库存", 0, 100000),
          JSON.stringify(b.tags || []),
          JSON.stringify(b.meta || {}),
          "published",
          u.id,
          time(),
        );
        await audit(u, "新增资源", b.name);
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
          if (bookingType(r))
            assert(
              !(await get(
                "SELECT id FROM orders WHERE resource_id=? AND booking_date=? AND status NOT IN ('cancelled','refunded')",
                rid,
                d,
              )),
              "该档期已被预约，请选择其他日期",
              409,
            );
          else {
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
            r.price * qty,
            d,
            "pending",
            b.channel === "微信小程序" ? "微信小程序" : "H5",
            String(b.note || "").slice(0, 1000),
            time(),
          );
          await notify(
            u.id,
            "预约提交成功",
            `“${r.name}”${d}的预约已提交，等待后台审核。`,
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
        if (["confirm", "reject", "approveRefund", "resolve"].includes(action))
          needAdmin();
        await transaction(async () => {
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
          if (["cancelled", "refunded"].includes(to) && !bookingType(o))
            await run(
              "UPDATE resources SET stock=stock+? WHERE id=?",
              o.quantity,
              o.resource_id,
            );
          await notify(
            o.user_id,
            "订单状态更新",
            `${o.code} · ${o.resource_name} → ${to}。${action === "pay" ? "这是模拟支付，未扣款。" : ""}`,
          );
          await audit(u, `订单操作 ${action}`, o.code);
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
        assert(["demand", "comment"].includes(b.type), "审核类型错误");
        assert(["approved", "rejected"].includes(b.status), "审核状态错误");
        const table = b.type === "demand" ? "demands" : "comments",
          id = int(b.id, "编号", 1),
          r = await get(`SELECT * FROM ${table} WHERE id=?`, id);
        assert(r, "内容不存在", 404);
        await run(`UPDATE ${table} SET status=? WHERE id=?`, b.status, id);
        if (b.reply && b.type === "comment")
          await run(
            "UPDATE comments SET reply=? WHERE id=?",
            text(b.reply, "回复", 1000),
            id,
          );
        await notify(
          r.user_id,
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
        await notify(
          uid,
          text(b.title || "合作私信", "标题", 80),
          text(b.content, "消息", 1000),
          u.id,
        );
        await audit(u, "发送站内私信", String(uid));
        send({
          ok: true,
        });
        return;
      }
      if (p === "/api/messages/read" && req.method === "POST") {
        const u = needUser();
        await run("UPDATE messages SET is_read=1 WHERE user_id=?", u.id);
        send({
          ok: true,
        });
        return;
      }
      if (p === "/api/ai" && req.method === "POST") {
        const u = needUser(),
          prompt = text(b.prompt, "问题", 1000);
        let answer;
        if (b.kind === "copy")
          answer = `【本地模板生成示例】\n${prompt}\n\n活动标题：山歌有约，好戏广西\n推送文案：走进广西的舞台与山水，让民族歌舞点亮周末。打开桂演，查看同城演出、非遗体验与文旅套餐，选择适合你的文化之旅。\n渠道建议：小红书突出体验，公众号补充时间地点，短信保留预约入口。\n请在发布前核实场次、价格与授权。`;
        else if (b.kind === "operator") {
          needAdmin();
          const a = await analysis();
          answer = `【规则分析示例，未接入大模型】\n当前模拟交易总额：¥${(a.kpis.revenue / 100).toFixed(2)}；订单${a.kpis.orders}笔，上架资源${a.kpis.resources}项。\n${a.insights.join("\n")}\n${
            /库存|异常|预警/.test(prompt)
              ? a.alerts.map((x) => x.title).join("\n")
              : a.ranking
                  .slice(0, 3)
                  .map((r, i) => `${i + 1}. ${r.name}：${r.sales}笔有效交易`)
                  .join("\n")
          }`;
        } else if (/退款|退票|改签/.test(prompt))
          answer =
            "【规则客服示例】进入“我的订单”，待确认或待支付订单可取消；模拟支付后可申请退款，等待后台处理。改签请先联系资源方确认档期，再取消重订。";
        else if (/会员|文惠|消费卡/.test(prompt))
          answer =
            "【规则客服示例】本Demo展示用户分群和权益说明；文惠卡、消费卡暂不实际扣款，相关数据通过后台“模拟数据同步”演示。";
        else if (/订单/.test(prompt)) {
          const os = await orderRows(u);
          answer = `【规则客服示例】你当前有${os.length}笔订单。${os
            .slice(0, 3)
            .map((o) => `${o.code}：${o.resource_name}，${o.status}`)
            .join("；")}。可在“我的订单”查看详情。`;
        } else
          answer =
            "【规则客服示例】你可以浏览资源、查看详情并预约。预约经后台确认后，可进行模拟支付。需要帮助时可询问订单、退票、改签或会员权益。本助手使用本地规则，没有连接外部AI接口。";
        await audit(u, `AI模拟 ${b.kind || "support"}`, prompt);
        send({
          answer,
          mock: true,
        });
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
        await audit(u, "更新设置", "库存预警阈值");
        send({
          ok: true,
        });
        return;
      }
      if (p === "/api/availability") {
        const id = Number(url.searchParams.get("resourceId"));
        assert(
          await get("SELECT id FROM resources WHERE id=?", id),
          "资源不存在",
          404,
        );
        send({
          dates: await all(
            "SELECT booking_date,status FROM orders WHERE resource_id=? AND status NOT IN ('cancelled','refunded')",
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
  server.listen(port, "0.0.0.0", () =>
    console.log(`桂演 API / 生产预览：http://localhost:${port}（模拟数据）`),
  );
}
