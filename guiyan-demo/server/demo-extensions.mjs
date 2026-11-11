import { randomBytes } from "node:crypto";
import { paidStatuses } from "./insights.mjs";
const code = (prefix) => prefix + randomBytes(10).toString("hex").toUpperCase();
const seatName = (n) =>
  `${Math.floor((n - 1) / 10) + 1}排${((n - 1) % 10) + 1}座`;
export function createDemoExtensions({
  all,
  get,
  run,
  audit,
  notify,
  assert,
  int,
  text,
  currentDay,
}) {
  const now = () => new Date().toISOString();
  async function wallet(uid) {
    await run(
      "INSERT INTO demo_wallets(user_id,balance) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING",
      uid,
      0,
    );
  }
  async function benefits(u) {
    if (!u) return null;
    const balance =
      (await get("SELECT balance FROM demo_wallets WHERE user_id=?", u.id))
        ?.balance || 0;
    const coupons = await all(
      "SELECT * FROM demo_coupons WHERE status='active' ORDER BY created_at,code",
    );
    const claims = await all(
      "SELECT c.*,t.name,t.amount,t.min_spend,t.campaign_code FROM demo_coupon_claims c JOIN demo_coupons t ON t.code=c.coupon_code WHERE c.user_id=? ORDER BY c.claimed_at DESC",
      u.id,
    );
    return {
      balance,
      coupons,
      claims: claims.map((c) => ({
        ...c,
        status:
          c.status === "available" && c.expires_at < now()
            ? "expired"
            : c.status,
      })),
      ledger: await all(
        "SELECT * FROM demo_wallet_entries WHERE user_id=? ORDER BY created_at DESC LIMIT 25",
        u.id,
      ),
    };
  }
  async function quote(u, r, qty, b) {
    const gross = r.price * qty;
    int(gross, "订单金额", 0, 100000000);
    let discount = 0,
      campaign = "",
      claim = "";
    if (b.couponClaim) {
      const c = await get(
        "SELECT c.*,t.amount,t.min_spend,t.status AS template_status,t.campaign_code FROM demo_coupon_claims c JOIN demo_coupons t ON t.code=c.coupon_code WHERE c.code=? AND c.user_id=?",
        text(b.couponClaim, "优惠券", 80),
        u.id,
      );
      assert(
        c &&
          c.status === "available" &&
          c.template_status === "active" &&
          c.expires_at >= now(),
        "优惠券不可用或已过期",
        409,
      );
      assert(gross >= c.min_spend, "未达到优惠券使用门槛");
      discount = Math.min(gross, c.amount);
      claim = c.code;
      campaign = c.campaign_code || "";
    } else if (b.campaignCode) {
      const c = await get(
        "SELECT code FROM demo_campaigns WHERE code=? AND status='active'",
        text(b.campaignCode, "活动", 80),
      );
      assert(c, "活动不存在或已结束");
      campaign = c.code;
    }
    return { gross, discount, amount: gross - discount, claim, campaign };
  }
  async function bindQuote(id, q) {
    await run(
      "UPDATE orders SET gross_amount=?,discount_amount=?,coupon_claim=?,campaign_code=? WHERE id=?",
      q.gross,
      q.discount,
      q.claim,
      q.campaign,
      id,
    );
    if (q.claim)
      assert(
        (
          await run(
            "UPDATE demo_coupon_claims SET status='reserved',order_id=? WHERE code=? AND status='available'",
            id,
            q.claim,
          )
        ).changes === 1,
        "优惠券已被其他订单占用",
        409,
      );
  }
  async function issue(id) {
    const o = await get(
      "SELECT o.*,r.category FROM orders o JOIN resources r ON r.id=o.resource_id WHERE o.id=?",
      id,
    );
    assert(
      o &&
        o.category === "show" &&
        o.status === "paid" &&
        o.booking_date >= currentDay(),
      "只有有效已支付演出订单可出票",
      409,
    );
    if (!(await get("SELECT code FROM demo_tickets WHERE order_id=?", id))) {
      const seats = JSON.parse(o.seat_labels || "[]");
      for (let i = 0; i < o.quantity; i++)
        await run(
          "INSERT INTO demo_tickets(code,order_id,ordinal,seat_label,issued_at) VALUES(?,?,?,?,?)",
          code("GYT"),
          id,
          i + 1,
          seats[i] ? seatName(seats[i]) : "渠道配票（模拟）",
          now(),
        );
    }
    return await all(
      "SELECT t.*,o.code AS order_code,o.user_id,o.booking_date,o.session_time,o.status AS order_status,r.name AS resource_name,r.city FROM demo_tickets t JOIN orders o ON o.id=t.order_id JOIN resources r ON r.id=o.resource_id WHERE t.order_id=? ORDER BY t.ordinal",
      id,
    );
  }
  async function beforeTransition(o, action, b, u) {
    if (["refund", "approveRefund"].includes(action))
      assert(
        !(await get(
          "SELECT code FROM demo_tickets WHERE order_id=? AND status='used'",
          o.id,
        )),
        "已有电子票核销，不能整单退款",
        409,
      );
    if (action === "pay") {
      const method = b.paymentMethod || "mock";
      assert(["mock", "balance"].includes(method), "不支持的模拟支付方式");
      if (o.coupon_claim) {
        const c = await get(
          "SELECT code FROM demo_coupon_claims WHERE code=? AND user_id=? AND order_id=? AND status='reserved' AND expires_at>=?",
          o.coupon_claim,
          o.user_id,
          o.id,
          now(),
        );
        assert(c, "优惠券已过期，请取消订单后重新预约", 409);
      }
      if (method === "balance") {
        assert(u.id === o.user_id, "只能使用本人模拟余额", 403);
        await wallet(o.user_id);
        assert(
          (
            await run(
              "UPDATE demo_wallets SET balance=balance-? WHERE user_id=? AND balance>=?",
              o.amount,
              o.user_id,
              o.amount,
            )
          ).changes === 1,
          "模拟余额不足，请模拟充值或选择普通模拟支付",
          409,
        );
        await run(
          "INSERT INTO demo_wallet_entries(code,user_id,amount,kind,order_id,created_at) VALUES(?,?,?,?,?,?)",
          code("W"),
          o.user_id,
          -o.amount,
          "payment",
          o.id,
          now(),
        );
      }
      await run("UPDATE orders SET payment_method=? WHERE id=?", method, o.id);
    }
  }
  async function afterTransition(o, action, to) {
    if (action === "pay") {
      if (o.coupon_claim)
        await run(
          "UPDATE demo_coupon_claims SET status='used' WHERE code=? AND order_id=?",
          o.coupon_claim,
          o.id,
        );
      if (o.category === "show" && o.booking_date >= currentDay())
        await issue(o.id);
    }
    if (["cancelled", "refunded"].includes(to)) {
      if (o.coupon_claim)
        await run(
          "UPDATE demo_coupon_claims SET status='available',order_id=NULL WHERE code=? AND order_id=?",
          o.coupon_claim,
          o.id,
        );
      await run(
        "UPDATE demo_tickets SET status='void' WHERE order_id=? AND status='active'",
        o.id,
      );
      if (to === "refunded" && o.payment_method === "balance") {
        await wallet(o.user_id);
        await run(
          "UPDATE demo_wallets SET balance=balance+? WHERE user_id=?",
          o.amount,
          o.user_id,
        );
        await run(
          "INSERT INTO demo_wallet_entries(code,user_id,amount,kind,order_id,created_at) VALUES(?,?,?,?,?,?)",
          code("W"),
          o.user_id,
          o.amount,
          "refund",
          o.id,
          now(),
        );
      }
    }
    if (to === "completed")
      await run(
        "UPDATE demo_tickets SET status='void' WHERE order_id=? AND status='active'",
        o.id,
      );
  }
  async function report() {
    const orders = await all("SELECT campaign_code,amount,status FROM orders"),
      campaigns = await all(
        "SELECT * FROM demo_campaigns ORDER BY created_at DESC",
      );
    const rows = campaigns.map((c) => {
      const own = orders.filter((o) => o.campaign_code === c.code),
        paid = own.filter((o) => paidStatuses.includes(o.status)),
        revenue = paid.reduce((n, o) => n + o.amount, 0);
      return {
        ...c,
        orders: own.length,
        paidOrders: paid.length,
        revenue,
        roas: c.budget ? Number((revenue / c.budget).toFixed(2)) : null,
        conversion: c.clicks
          ? Number(((paid.length / c.clicks) * 100).toFixed(2))
          : null,
      };
    });
    return {
      campaigns: rows,
      coupons: await all("SELECT * FROM demo_coupons ORDER BY created_at DESC"),
      tickets: await all(
        "SELECT status,COUNT(*) AS count FROM demo_tickets GROUP BY status",
      ),
      recentTickets: await all(
        "SELECT t.*,o.code AS order_code,r.name AS resource_name FROM demo_tickets t JOIN orders o ON o.id=t.order_id JOIN resources r ON r.id=o.resource_id ORDER BY t.issued_at DESC,t.ordinal LIMIT 12",
      ),
      prints: await all(
        "SELECT p.*,u.name AS user_name FROM demo_print_requests p JOIN users u ON u.id=p.user_id ORDER BY created_at DESC LIMIT 20",
      ),
      snapshot: JSON.parse(
        (
          await get(
            "SELECT value FROM settings WHERE key=?",
            "lastProfileSnapshot",
          )
        )?.value || "null",
      ),
    };
  }
  async function handle({ p, b, req, session, needUser, needAdmin, send }) {
    if (p === "/api/benefits" && req.method === "GET") {
      send(await benefits(needUser()));
      return true;
    }
    if (p === "/api/demo/wallet/recharge" && req.method === "POST") {
      const u = needUser(),
        amount = int(b.amount, "模拟充值金额", 100, 10000000);
      await wallet(u.id);
      assert(
        (
          await run(
            "UPDATE demo_wallets SET balance=balance+? WHERE user_id=? AND balance<=?",
            amount,
            u.id,
            100000000 - amount,
          )
        ).changes === 1,
        "演示余额已达到上限",
      );
      await run(
        "INSERT INTO demo_wallet_entries(code,user_id,amount,kind,created_at) VALUES(?,?,?,?,?)",
        code("W"),
        u.id,
        amount,
        "recharge",
        now(),
      );
      await audit(u, "模拟充值", amount + "分（未收取真实资金）");
      send({ ok: true, message: "模拟余额已增加，没有收取真实资金" });
      return true;
    }
    if (p === "/api/demo/coupons/claim" && req.method === "POST") {
      const u = needUser(),
        c = await get(
          "SELECT * FROM demo_coupons WHERE code=? AND status='active'",
          text(b.code, "优惠券", 80),
        );
      assert(c, "优惠券不存在");
      assert(
        !(await get(
          "SELECT code FROM demo_coupon_claims WHERE user_id=? AND coupon_code=?",
          u.id,
          c.code,
        )),
        "每个账号限领一次",
        409,
      );
      await run(
        "INSERT INTO demo_coupon_claims(code,user_id,coupon_code,claimed_at,expires_at) VALUES(?,?,?,?,?)",
        code("C"),
        u.id,
        c.code,
        now(),
        new Date(Date.now() + c.valid_days * 86400000).toISOString(),
      );
      send({ ok: true, message: "演示优惠券已领取" });
      return true;
    }
    if (p === "/api/demo/operations" && req.method === "GET") {
      needAdmin();
      send(await report());
      return true;
    }
    if (p === "/api/demo/campaigns" && req.method === "POST") {
      const u = needAdmin(),
        impressions = int(b.impressions ?? 0, "模拟曝光", 0, 10000000),
        clicks = int(b.clicks ?? 0, "模拟点击", 0, impressions);
      const id = code("M");
      await run(
        "INSERT INTO demo_campaigns(code,name,budget,impressions,clicks,created_at) VALUES(?,?,?,?,?,?)",
        id,
        text(b.name, "活动名称", 60),
        int(b.budget, "活动预算", 0, 100000000),
        impressions,
        clicks,
        now(),
      );
      await audit(u, "创建模拟活动", b.name);
      send({ ok: true, code: id });
      return true;
    }
    if (p === "/api/demo/coupons" && req.method === "POST") {
      const u = needAdmin(),
        id = code("T"),
        campaign = b.campaignCode || "";
      if (campaign)
        assert(
          await get("SELECT code FROM demo_campaigns WHERE code=?", campaign),
          "活动不存在",
        );
      await run(
        "INSERT INTO demo_coupons(code,name,amount,min_spend,valid_days,campaign_code,created_at) VALUES(?,?,?,?,?,?,?)",
        id,
        text(b.name, "优惠券名称", 60),
        int(b.amount, "优惠额", 1, 1000000),
        int(b.minSpend ?? 0, "使用门槛", 0, 100000000),
        int(b.validDays ?? 7, "有效天数", 1, 90),
        campaign,
        now(),
      );
      await audit(u, "创建模拟优惠券", b.name);
      send({ ok: true, code: id });
      return true;
    }
    if (p === "/api/demo/recommendation-policy" && req.method === "PATCH") {
      const u = needAdmin(),
        policies = b.policies;
      assert(policies && typeof policies === "object", "缺少策略");
      const clean = {};
      for (const channel of ["H5", "电脑网页"]) {
        clean[channel] = {};
        for (const key of ["interest", "view", "favorite", "purchase", "city"])
          clean[channel][key] = int(
            policies[channel]?.[key],
            "推荐权重",
            0,
            50,
          );
      }
      await run(
        "UPDATE settings SET value=? WHERE key=?",
        JSON.stringify(clean),
        "recommendationPolicies",
      );
      await audit(u, "保存渠道推荐策略", "H5/电脑网页");
      send({ ok: true, message: "两种渠道的推荐权重已保存" });
      return true;
    }
    const ticketPath = p.match(/^\/api\/orders\/(\d+)\/tickets$/);
    if (ticketPath) {
      const u = needUser(),
        o = await get(
          "SELECT user_id FROM orders WHERE id=?",
          Number(ticketPath[1]),
        );
      assert(
        o && (u.role === "admin" || u.id === o.user_id),
        "无权查看电子票",
        403,
      );
      if (req.method === "POST")
        send({ tickets: await issue(Number(ticketPath[1])) });
      else if (req.method === "GET")
        send({
          tickets: await all(
            "SELECT t.*,o.code AS order_code,o.booking_date,o.session_time,o.status AS order_status,r.name AS resource_name,r.city FROM demo_tickets t JOIN orders o ON o.id=t.order_id JOIN resources r ON r.id=o.resource_id WHERE t.order_id=? ORDER BY t.ordinal",
            Number(ticketPath[1]),
          ),
        });
      else return false;
      return true;
    }
    if (p === "/api/demo/tickets/verify" && req.method === "POST") {
      const u = needAdmin(),
        id = text(b.code, "票码", 40).toUpperCase(),
        t = await get(
          "SELECT t.*,o.status AS order_status,o.booking_date,o.user_id,r.name AS resource_name FROM demo_tickets t JOIN orders o ON o.id=t.order_id JOIN resources r ON r.id=o.resource_id WHERE t.code=?",
          id,
        );
      assert(t, "票码不存在", 404);
      assert(
        t.status === "active" &&
          t.order_status === "paid" &&
          t.booking_date >= currentDay(),
        "票已核销、订单不可用或已过期",
        409,
      );
      assert(
        (
          await run(
            "UPDATE demo_tickets SET status='used',verified_at=?,verified_by=? WHERE code=? AND status='active'",
            now(),
            u.id,
            id,
          )
        ).changes === 1,
        "电子票已被核销",
        409,
      );
      if (
        !(await get(
          "SELECT code FROM demo_tickets WHERE order_id=? AND status='active'",
          t.order_id,
        ))
      )
        await run(
          "UPDATE orders SET status='completed',escrow='已结算' WHERE id=? AND status='paid'",
          t.order_id,
        );
      await audit(u, "模拟核销", id);
      await notify(
        t.user_id,
        "电子票核销（模拟）",
        t.resource_name + " 的一张演示票已核销。",
        1,
        "system",
        t.order_id,
      );
      send({
        ok: true,
        message: "核销成功（模拟）",
        ticket: {
          code: id,
          resource: t.resource_name,
          seat: t.seat_label,
          date: t.booking_date,
        },
      });
      return true;
    }
    if (p === "/api/demo/tickets/print" && req.method === "POST") {
      const u = needUser();
      assert(
        Array.isArray(b.codes) && b.codes.length > 0 && b.codes.length <= 100,
        "每批最多打印100张票",
      );
      const ids = [...new Set(b.codes)];
      for (const id of ids) {
        const t = await get(
          "SELECT o.user_id FROM demo_tickets t JOIN orders o ON o.id=t.order_id WHERE t.code=?",
          text(id, "票码", 40),
        );
        assert(
          t && (u.role === "admin" || t.user_id === u.id),
          "无权打印该票",
          403,
        );
      }
      await run(
        "INSERT INTO demo_print_requests(code,user_id,tickets,created_at) VALUES(?,?,?,?)",
        code("P"),
        u.id,
        JSON.stringify(ids),
        now(),
      );
      await audit(
        u,
        "发起演示票打印",
        ids.length + "张；仅记录请求，不代表纸张已输出",
      );
      send({
        ok: true,
        message: "打印请求已记录，请在浏览器中选择打印或保存PDF",
      });
      return true;
    }
    return false;
  }
  return {
    benefits,
    quote,
    bindQuote,
    beforeTransition,
    afterTransition,
    handle,
    report,
    issue,
  };
}
