import { inventoryMode } from "./review-upgrade.mjs";
export const paidStatuses = [
  "paid",
  "completed",
  "disputed",
  "refund_requested",
];
export const dayOf = (value) =>
  value
    ? new Date(new Date(value).getTime() + 8 * 3600000)
        .toISOString()
        .slice(0, 10)
    : null;
export const shiftDay = (d, n) =>
  new Date(new Date(d + "T00:00:00Z").getTime() + n * 86400000)
    .toISOString()
    .slice(0, 10);
const sum = (rows, key) => rows.reduce((n, r) => n + Number(r[key] || 0), 0);
const priceBand = (value) =>
  value < 10000
    ? "100元以下"
    : value < 20000
      ? "100–199元"
      : value < 50000
        ? "200–499元"
        : value < 100000
          ? "500–999元"
          : "1000元及以上";
export function ruleMatches(user, rule) {
  const result = rule.conditions.map((c) => {
    const a = user[c.field],
      b = c.value;
    if (c.field === "view_category") return Array.isArray(a) && a.includes(b);
    return c.op === "gte"
      ? a >= b
      : c.op === "lte"
        ? a <= b
        : c.op === "gt"
          ? a > b
          : c.op === "lt"
            ? a < b
            : String(a) === String(b);
  });
  return rule.match === "any" ? result.some(Boolean) : result.every(Boolean);
}
export function createInsights({
  all,
  get,
  orderRows,
  categories,
  today: clock,
  resourceRow,
}) {
  const setting = async (key, fallback) =>
    JSON.parse(
      (await get("SELECT value FROM settings WHERE key=?", key))?.value ||
        JSON.stringify(fallback),
    );
  async function profileRows() {
    const today = typeof clock === "function" ? clock() : clock;
    const [users, orders, favorites, events, rules, resources] =
      await Promise.all([
        all(
          "SELECT id,username,name,city,age,gender,channel,preference,verified,role,created_at FROM users WHERE role<>'admin'",
        ),
        orderRows({ role: "admin" }),
        all("SELECT * FROM favorites"),
        all("SELECT user_id,detail,created_at FROM events WHERE type='view'"),
        setting("tagRules", []),
        all("SELECT id,category FROM resources"),
      ]);
    const byId = new Map(resources.map((r) => [r.id, r]));
    return users.map((u) => {
      const own = orders.filter((o) => o.user_id === u.id),
        paid = own.filter((o) => paidStatuses.includes(o.status));
      const last =
        paid
          .map((o) => o.paid_at || o.created_at)
          .sort()
          .at(-1) || null;
      const bands = new Map();
      for (const o of paid.filter((o) => o.category === "show")) {
        const b = priceBand(o.amount / o.quantity);
        bands.set(b, (bands.get(b) || 0) + o.quantity);
      }
      const views = events.filter((e) => e.user_id === u.id),
        spent = sum(paid, "amount");
      const metrics = {
        ...u,
        order_count: own.length,
        paid_count: paid.length,
        spent,
        last_order: last,
        days_since_payment: last
          ? Math.max(
              0,
              Math.floor((new Date(today) - new Date(dayOf(last))) / 86400000),
            )
          : 99999,
        favorite_count: favorites.filter((f) => f.user_id === u.id).length,
        view_count: views.length,
        view_category: [
          ...new Set(
            views
              .map((e) => byId.get(Number(e.detail))?.category)
              .filter(Boolean),
          ),
        ],
      };
      const matched = rules
        .filter((r) => r.enabled && ruleMatches(metrics, r))
        .map((r) => r.name);
      const tags = [
        ...new Set([
          ...matched,
          ...(!paid.length
            ? ["新用户"]
            : !matched.some((t) => ["高价值用户", "潜力会员"].includes(t))
              ? ["体验用户"]
              : []),
          paid.length >= 5 ? "高频消费" : paid.length ? "已付费" : "待培育",
          categories.find((c) => c.id === u.preference)?.name || "综合兴趣",
        ]),
      ];
      return {
        ...metrics,
        tags,
        portrait: {
          pricePreference: paid.length ? Math.round(spent / paid.length) : 0,
          priceBand:
            [...bands].sort((a, b) => b[1] - a[1])[0]?.[0] ||
            "暂无已支付票价样本",
          priceDistribution: [...bands].map(([name, count]) => ({
            name,
            count,
          })),
          balance: null,
          payment: "模拟支付",
          favorites: metrics.favorite_count,
          views: metrics.view_count,
          purchaseWindow: last
            ? new Date(new Date(last).getTime() + 8 * 3600000)
                .toISOString()
                .slice(11, 16)
            : "暂无",
          repeat: paid.length > 1 ? "有复购" : "暂无复购",
          lastOrder: last,
        },
        suggestion: tags.includes("沉默用户")
          ? "超过设定天数未消费，建议站内召回并推荐同城、同票价区间内容；优惠权益需运营另行确认。"
          : tags.includes("高价值用户")
            ? "推荐剧场专场与会员组合权益"
            : tags.includes("潜力会员")
              ? "近期有付费与复购，推荐同城演出及偏好价位资源"
              : "推荐低门槛非遗体验与首购活动",
      };
    });
  }
  async function recommendations(user, resources) {
    if (!user) return [];
    const [views, favorites, orders] = await Promise.all([
      all(
        "SELECT detail FROM events WHERE type='view' AND user_id=? ORDER BY id DESC LIMIT 100",
        user.id,
      ),
      all("SELECT resource_id FROM favorites WHERE user_id=?", user.id),
      orderRows({ id: user.id, role: "user" }),
    ]);
    const byId = new Map(resources.map((r) => [r.id, r])),
      signals = new Map();
    for (const [rows, key, weight, label] of [
      [views, "detail", 2, "浏览"],
      [favorites, "resource_id", 5, "收藏"],
      [
        orders.filter((o) => paidStatuses.includes(o.status)),
        "resource_id",
        8,
        "购买",
      ],
    ])
      for (const row of rows) {
        const c = byId.get(Number(row[key]))?.category;
        if (c) {
          const s = signals.get(c) || { score: 0, reasons: new Set() };
          s.score += weight;
          s.reasons.add(label);
          signals.set(c, s);
        }
      }
    return resources
      .map((r) => {
        let score = 0;
        const reasons = [];
        const signal = signals.get(r.category);
        if (r.category === user.preference) {
          score += 20;
          reasons.push("符合你的兴趣偏好");
        }
        if (signal) {
          score += Math.min(35, signal.score);
          reasons.push("你" + [...signal.reasons].join("、") + "过同类资源");
        }
        if (r.city === user.city) {
          score += 6;
          reasons.push("与你的所在城市相同");
        }
        return {
          resourceId: r.id,
          score,
          reason: reasons.join(" · ") || "发现更多广西文化资源",
        };
      })
      .sort((a, b) => b.score - a.score || a.resourceId - b.resourceId);
  }
  function bucket(d, period) {
    if (period === "week") {
      const n = (new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7;
      return shiftDay(d, -n);
    }
    if (period === "month") return d.slice(0, 7);
    if (period === "quarter")
      return `${d.slice(0, 4)} Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
    return d;
  }
  async function analysis(period = "day") {
    const today = typeof clock === "function" ? clock() : clock;
    const orders = await orderRows({ role: "admin" }),
      paid = orders.filter((o) => paidStatuses.includes(o.status)),
      resources = (await all("SELECT * FROM resources")).map(resourceRow),
      profiles = await profileRows();
    const daily = new Map(),
      channels = new Map();
    const start = paid.length
      ? paid.map((o) => dayOf(o.paid_at || o.created_at)).sort()[0]
      : shiftDay(today, -29);
    const end = [today, ...paid.map((o) => dayOf(o.paid_at || o.created_at))]
      .sort()
      .at(-1);
    for (let d = start; d <= end; d = shiftDay(d, 1)) {
      const key = bucket(d, period);
      if (!daily.has(key))
        daily.set(key, {
          date: key,
          label:
            period === "week"
              ? key.slice(5) + "～" + shiftDay(key, 6).slice(5)
              : period === "quarter"
                ? key
                : key.slice(period === "day" ? 5 : 0),
          amount: 0,
          count: 0,
        });
    }
    for (const o of paid) {
      const cell = daily.get(bucket(dayOf(o.paid_at || o.created_at), period));
      cell.amount += o.amount;
      cell.count++;
      channels.set(o.channel, (channels.get(o.channel) || 0) + o.amount);
    }
    const ranking = resources
      .map((r) => {
        const rows = paid.filter((o) => o.resource_id === r.id);
        return {
          ...r,
          sales: rows.length,
          quantity: sum(rows, "quantity"),
          revenue: sum(rows, "amount"),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
    const threshold = await setting("alertThreshold", 5);
    const alerts = resources
      .filter(
        (r) =>
          r.status === "published" &&
          inventoryMode(r) === "global" &&
          r.stock <= threshold,
      )
      .map((r) => ({
        severity: "warning",
        title: `${r.name}库存仅剩${r.stock}`,
        detail: "建议补充库存或暂时下架，避免超卖。",
      }));
    const pending = orders.filter((o) => o.status === "pending").length,
      abnormal = orders.filter((o) =>
        ["disputed", "refund_requested"].includes(o.status),
      ).length;
    for (const r of resources.filter(
      (r) => r.status === "published" && inventoryMode(r) === "date",
    )) {
      const held = new Map();
      for (const o of orders.filter(
        (o) =>
          o.resource_id === r.id &&
          o.booking_date >= today &&
          !["cancelled", "refunded"].includes(o.status),
      ))
        held.set(o.booking_date, (held.get(o.booking_date) || 0) + o.quantity);
      for (const [date, quantity] of held) {
        const left = Math.max(0, (r.daily_capacity ?? r.stock) - quantity);
        if (left <= threshold)
          alerts.push({
            severity: "warning",
            title: `${r.name} ${date}余量${left}`,
            detail: "该日期配额紧张，请核对场次库存；其他日期独立计算。",
          });
      }
    }
    if (pending)
      alerts.push({
        severity: "info",
        title: `${pending}笔预约等待确认`,
        detail: "请在交易管理中确认档期和资源，及时处理预约。",
      });
    if (abnormal)
      alerts.push({
        severity: "warning",
        title: `${abnormal}笔售后或纠纷待处理`,
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
    const monthStart = shiftDay(today, -29),
      active = new Set(
        orders
          .filter((o) => dayOf(o.created_at) >= monthStart)
          .map((o) => o.user_id),
      );
    const venues = resources
      .filter((r) => r.category === "venue")
      .map((r) => {
        const booked = orders.filter(
          (o) =>
            o.resource_id === r.id &&
            !["cancelled", "refunded"].includes(o.status) &&
            o.booking_date >= today &&
            o.booking_date <= shiftDay(today, 29),
        );
        const bookedDays = new Set(booked.map((o) => o.booking_date)).size,
          occupancy = Math.round((bookedDays / 30) * 1000) / 10;
        const linked = resources.filter(
            (s) => s.category === "show" && Number(s.meta.venueId) === r.id,
          ),
          linkedIds = new Set(linked.map((s) => s.id));
        const showOrders = orders.filter(
          (o) =>
            linkedIds.has(o.resource_id) &&
            !["cancelled", "refunded"].includes(o.status),
        );
        const performances = [
          ...new Set(
            showOrders.map((o) => `${o.resource_id}:${o.booking_date}`),
          ),
        ];
        const seats = performances.reduce(
            (n, k) =>
              n +
              Number(
                linked.find((s) => s.id === Number(k.split(":")[0]))
                  ?.daily_capacity || 0,
              ),
            0,
          ),
          sold = sum(
            showOrders.filter((o) => paidStatuses.includes(o.status)),
            "quantity",
          );
        const revenue = sum(
            paid.filter((o) => o.resource_id === r.id),
            "amount",
          ),
          ticketRevenue = sum(
            showOrders.filter((o) => paidStatuses.includes(o.status)),
            "amount",
          );
        const weekday = new Map();
        for (const o of booked) {
          const k = new Date(o.booking_date + "T00:00:00Z").getUTCDay();
          weekday.set(k, (weekday.get(k) || 0) + 1);
        }
        const genre = ["歌舞", "音乐", "话剧", "民歌", "舞蹈"];
        const content =
          r.description + r.tags.join("") + JSON.stringify(r.meta);
        const recommendations = resources
          .filter((s) => s.category === "show" && s.status === "published")
          .map((s) => {
            const tags = genre.filter(
              (t) =>
                content.includes(t) &&
                (s.name + s.description + s.tags.join("")).includes(t),
            );
            return {
              id: s.id,
              name: s.name,
              score: tags.length * 10 + (s.city === r.city ? 3 : 0),
              reason: tags.length
                ? "适配" + tags.join("、") + "演出"
                : s.city === r.city
                  ? "同城剧目，需核实舞台条件"
                  : "需核实设备与舞台条件",
            };
          })
          .sort((a, b) => b.score - a.score || a.id - b.id)
          .slice(0, 3);
        return {
          id: r.id,
          name: r.name,
          bookedDays,
          occupancy,
          idleRate: Math.round((100 - occupancy) * 10) / 10,
          revenue,
          performances: performances.length,
          seatOccupancy: seats ? Math.round((sold / seats) * 1000) / 10 : null,
          ticketRevenue,
          averageRevenue: performances.length
            ? Math.round(ticketRevenue / performances.length)
            : null,
          peak: weekday.size
            ? "周" +
              ["日", "一", "二", "三", "四", "五", "六"][
                [...weekday].sort((a, b) => b[1] - a[1])[0][0]
              ]
            : "暂无预约样本",
          recommendations,
        };
      });
    const cold = ranking
        .filter((r) => r.status === "published" && r.sales === 0)
        .slice(0, 5),
      high = profiles.filter((u) => u.tags.includes("高价值用户")).length,
      silent = profiles.filter((u) => u.tags.includes("沉默用户")).length;
    const byMonth = new Map();
    for (const o of paid) {
      const k = dayOf(o.paid_at || o.created_at).slice(0, 7);
      byMonth.set(k, (byMonth.get(k) || 0) + o.amount);
    }
    const seasons = [...byMonth].sort((a, b) => b[1] - a[1]);
    const channelRows = [...channels]
      .map(([name, amount]) => ({
        name,
        amount,
        orders: paid.filter((o) => o.channel === name).length,
      }))
      .sort((a, b) => b.amount - a.amount);
    const insights = [
      `热销引进：${ranking[0]?.name || "暂无"}当前交易额领先，建议评估同类剧目联动。`,
      `冷门资源：${cold.map((r) => r.name).join("、") || "暂无零成交资源"}；建议补充介绍与小规模曝光，先验证需求再调价。`,
      `场馆经营：未来30天平均档期占用率${venues.length ? (sum(venues, "occupancy") / venues.length).toFixed(1) : 0}%；空闲场馆可采用工作日套餐。`,
      `季节观察：${seasons[0]?.[0] || "暂无"}为当前样本交易额最高月份；仅有${seasons.length}个月样本，不能据此认定长期淡旺季。`,
      `渠道复盘：${channelRows[0]?.name || "暂无"}成交额最高；缺少投放成本、曝光和转化数据，暂不计算营销ROI。`,
      `定价建议：按付费用户的票价区间与冷门资源表现设计小额试验，避免直接全量降价。`,
      `用户运营：高价值用户${high}人、沉默用户${silent}人；优先分群触达并观察复购。`,
      `预约跟进：${pending}笔待确认，${abnormal}笔售后待处理。`,
    ];
    const kpis = {
      revenue: sum(paid, "amount"),
      orders: orders.length,
      paidOrders: paid.length,
      resources: resources.filter((r) => r.status === "published").length,
      users: active.size,
    };
    const report = [
      "【模拟经营分析报告】",
      `生成日期：${today}；金额按有效已支付订单统计，退款成功订单剔除。`,
      `交易总额：${(kpis.revenue / 100).toFixed(2)}元；历史订单：${kpis.orders}笔；有效付费订单：${paid.length}笔。`,
      ...venues.map(
        (v) =>
          `${v.name}：未来30天档期占用${v.occupancy}%，闲置${v.idleRate}%，热门预约星期${v.peak}；关联剧目${v.performances}场，上座率${v.seatOccupancy === null ? "暂无关联售票样本" : v.seatOccupancy + "%"}，场均票房${v.averageRevenue === null ? "暂无" : (v.averageRevenue / 100).toFixed(2) + "元"}。`,
      ),
      ...insights,
      "说明：租赁档期占用率与售票上座率分别计算；仅有日期，不推断一天内的热门小时。历史支付/退款时间为标注的估算值，新订单记录实际操作时间。",
    ].join("\n");
    return {
      period,
      today,
      kpis,
      series: [...daily.values()],
      channels: channelRows,
      ranking,
      alerts,
      insights,
      venues,
      cold,
      report,
      userSummary: {
        total: profiles.length,
        newUsers: profiles.filter((u) => dayOf(u.created_at) >= monthStart)
          .length,
        highValue: high,
        potential: profiles.filter((u) => u.tags.includes("潜力会员")).length,
        silent,
      },
      definitions: {
        revenue:
          "有效已支付金额（含退款审核中、纠纷中，剔除退款成功及取消订单）",
        orders: "历史全部订单，包含取消与退款",
        series:
          "按北京时间支付日归集，补齐零交易周期；旧数据的支付时间为估算值",
        users: "近30天提交订单的去重用户数",
      },
    };
  }
  return { profileRows, analysis, recommendations };
}
