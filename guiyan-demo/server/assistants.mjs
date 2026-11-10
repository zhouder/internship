import { randomInt } from "node:crypto";
const yuan = (n) => `¥${(Number(n || 0) / 100).toFixed(2)}`;
export function operatorAnswer(prompt, a) {
  const parts = [];
  const report = /报告|总结|日报|周报|运营分析/.test(prompt);
  if (report) return "【本地规则分析，未接入大模型】\n" + a.report;
  if (/销量|交易|订单|总额|卖了|客单/.test(prompt))
    parts.push(
      `交易概览：有效交易额${yuan(a.kpis.revenue)}，历史订单${a.kpis.orders}笔，有效付费订单${a.kpis.paidOrders}笔，付费客单价${yuan(a.kpis.paidOrders ? a.kpis.revenue / a.kpis.paidOrders : 0)}。`,
    );
  if (/用户|增长|活跃|新用户|会员|分群|沉默/.test(prompt))
    parts.push(
      `用户情况：注册档案${a.userSummary.total}人，近30天新增${a.userSummary.newUsers}人，近30天下单活跃${a.kpis.users}人；高价值${a.userSummary.highValue}人、潜力会员${a.userSummary.potential}人、沉默用户${a.userSummary.silent}人。标签按后台已启用规则计算。`,
    );
  if (/场馆|场地|档期|占用|上座/.test(prompt))
    parts.push(
      "场馆表现：\n" +
        a.venues
          .map(
            (v) =>
              `${v.name}：未来30天档期占用${v.occupancy}%，闲置${v.idleRate}%，租赁交易额${yuan(v.revenue)}，关联售票上座率${v.seatOccupancy === null ? "暂无关联剧目样本" : v.seatOccupancy + "%"}。`,
          )
          .join("\n"),
    );
  if (/渠道|来源/.test(prompt)) {
    const total = a.kpis.revenue;
    parts.push(
      "渠道分析：\n" +
        a.channels
          .map(
            (c) =>
              `${c.name}：${yuan(c.amount)}，占比${total ? ((c.amount / total) * 100).toFixed(1) : 0}%。`,
          )
          .join("\n"),
    );
  }
  if (/库存|异常|预警|紧张|超卖/.test(prompt))
    parts.push(
      "预警提醒：\n" +
        (a.alerts.map((v) => v.title + "；" + v.detail).join("\n") ||
          "当前没有待处理预警。"),
    );
  if (/热销|排行|排名|卖得好/.test(prompt))
    parts.push(
      "热销TOP5：\n" +
        a.ranking
          .slice(0, 5)
          .map(
            (r, i) =>
              `${i + 1}. ${r.name}：${r.sales}笔、${r.quantity}份，${yuan(r.revenue)}`,
          )
          .join("\n"),
    );
  if (/推荐|建议|活动|应该|冷门|定价|营销|复盘/.test(prompt))
    parts.push("运营建议：\n" + a.insights.join("\n"));
  if (!parts.length)
    parts.push(
      "可以查询交易、用户增长与分群、场馆、渠道、热销、预警，或输入“生成经营报告”。当前问题未命中支持范围，请补充你想看的维度。",
    );
  return "【本地规则分析，未接入大模型】\n" + parts.join("\n\n");
}
export function supportAnswer(prompt, orders, resources) {
  const parts = [];
  if (/退款|退票|退订|退钱|cancel|refund|能退|怎么退|改签/i.test(prompt)) {
    const groups = [
      ["pending", "待确认，可直接取消"],
      ["confirmed", "待支付，可直接取消"],
      ["paid", "已支付，可申请退款"],
      ["refund_requested", "退款审核中，请等待平台处理"],
      ["disputed", "申诉处理中，请等待平台处理"],
      ["completed", "已完成，不支持在线退款"],
    ];
    parts.push(
      "退订与售后：\n" +
        (groups
          .map(([status, label]) => {
            const rows = orders.filter((o) => o.status === status);
            return rows.length
              ? `${rows.length}笔${label}：${rows
                  .slice(0, 3)
                  .map((o) => o.code)
                  .join("、")}`
              : null;
          })
          .filter(Boolean)
          .join("\n") || "你当前没有可退款的订单。") +
        "\n改签需先联系资源方确认档期，再取消重订；不承诺未配置的24小时退票规则。",
    );
  }
  if (/订单|预约|支付|付款/.test(prompt))
    parts.push(
      `你的订单：共${orders.length}笔。\n` +
        orders
          .slice(0, 5)
          .map(
            (o) =>
              `${o.code} · ${o.resource_name} · ${o.status} · ${yuan(o.amount)}`,
          )
          .join("\n") +
        "\n在“我的订单”查看详情；待确认→后台确认→模拟支付，不扣真实资金。",
    );
  if (/演出|资源|非遗|场馆|文旅|库存|还有|找|推荐/.test(prompt)) {
    const cat = /非遗|手作|壮锦/.test(prompt)
      ? "heritage"
      : /场馆|场地/.test(prompt)
        ? "venue"
        : /文旅|旅行|旅游/.test(prompt)
          ? "tourism"
          : "show";
    parts.push(
      "可查看的资源：\n" +
        resources
          .filter((r) => r.category === cat && r.status === "published")
          .slice(0, 4)
          .map((r) => `${r.name} · ${r.city} · ${yuan(r.price)}起`)
          .join("\n") +
        "\n余量以详情页选定日期的查询结果为准。",
    );
  }
  if (/会员|文惠|消费卡|储值/.test(prompt))
    parts.push(
      "会员与权益：演示支持兴趣偏好、收藏和模拟订单。文惠卡、消费卡、储值与真实优惠券尚未接入，不产生扣款或真实权益。",
    );
  if (/私信|联系|消息/.test(prompt))
    parts.push(
      "联系合作方：进入“消息与私信”选择联系人，或在合作需求中发起沟通。私信经过站内敏感词检查后送达；涉及资金与授权请以实际确认结果为准。",
    );
  if (!parts.length)
    parts.push(
      "目前可以帮你查询自己的订单、退订和售后、找演出或场馆、了解会员说明。请补充资源名称或想办理的事项；超出规则范围的问题需要联系平台处理。",
    );
  return "【本地规则客服，未接入大模型】\n" + parts.join("\n\n");
}
export function copyAnswer(prompt) {
  const topic =
    prompt.match(/《([^》]+)》/)?.[1] ||
    [
      "昆曲",
      "京剧",
      "交响乐",
      "音乐会",
      "民族歌舞剧",
      "非遗亲子体验",
      "壮锦",
      "铜鼓",
      "山歌",
      "文旅",
      "话剧",
    ].find((t) => prompt.includes(t)) ||
    prompt
      .replace(
        /请|帮我|写一段|写|生成|设计|一段|推送|文案|标题|小红书|公众号|短信|为|给/g,
        "",
      )
      .trim()
      .slice(0, 30) ||
    "广西文化体验";
  const family = /亲子|儿童|家庭|小朋友/.test(prompt),
    classic = /昆曲|京剧|古典|交响|音乐会/.test(prompt),
    travel = /文旅|旅游|旅行|漓江/.test(prompt);
  const intro = family
    ? "和孩子一起听、看、动手，让好奇心走近传统文化"
    : classic
      ? "在一段唱腔与一席乐声之间，细品舞台的韵味"
      : travel
        ? "沿着山水与歌声，为旅途留下一段文化记忆"
        : "把日常交给舞台，感受广西文化的鲜活与温度";
  const title = [
    `${topic}，周末见`,
    `相约${topic}，遇见好时光`,
    `把${topic}写进你的行程`,
  ][randomInt(3)];
  const givenDate = prompt.match(/20\d{2}[年/-]\d{1,2}[月/-]\d{1,2}日?/)?.[0];
  const givenPrice = prompt.match(/(?:¥|￥)?\d+(?:\.\d{1,2})?元/)?.[0];
  const givenVenue = prompt.match(
    /(?:地点|场馆)[:：]\s*([^，。；\n]{2,30})/,
  )?.[1];
  const facts = `时间：${givenDate || "[待确认日期]"}；地点：${givenVenue || "[待确认场馆]"}；价格：${givenPrice || "[待确认价格]"}。`;
  const body = `${intro}。本次推荐${topic}，适合${family ? "家庭共同参与" : classic ? "喜爱舞台艺术的观众" : "想体验地方文化的朋友"}。${facts}查看资源详情与适用说明，再选择合适日期提交预约。`;
  const channels = [
    {
      name: "小红书版",
      content: `✨ ${title}\n${intro}！想体验${topic}的朋友可以先收藏。${facts}\n#广西文化 #${topic.replace(/\s/g, "")} ${family ? "#亲子活动" : ""}`,
    },
    {
      name: "公众号版",
      content: `${title}\n${body}\n预约方式：桂演资源详情页；场次、价格及授权以发布前确认结果为准。`,
    },
    {
      name: "短信版",
      content: `【桂演】${topic.slice(0, 18)}活动待上线，场次和价格确认后可在桂演查看预约。[预约入口]`,
    },
  ];
  const sections = {
    title,
    body,
    channels,
    notes: [
      "发布前核实日期、场馆、价格、适用人群及授权。",
      "本地模板草稿，不保证演出事实或生成真实营销权益。",
    ],
  };
  return {
    sections,
    answer:
      "【本地多渠道模板草稿，未接入大模型】\n活动标题：" +
      title +
      "\n推送文案：" +
      body +
      "\n" +
      channels.map((c) => c.name + "：" + c.content).join("\n") +
      "\n注意事项：" +
      sections.notes.join("；"),
  };
}
