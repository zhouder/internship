import { useState } from "react";
import { useApp } from "../state";
import { api, money, shortDate, downloadText } from "../api";
import { PageTitle, FormField } from "../ui";
const weightLabels = {
  interest: "兴趣",
  view: "浏览",
  favorite: "收藏",
  purchase: "购买",
  city: "同城",
};
export function Operations() {
  const { data, action, busy, refresh, setToast } = useApp(),
    o = data.operations || {
      campaigns: [],
      coupons: [],
      recentTickets: [],
      prints: [],
    };
  const storage = "guiyan.pending-tickets." + data.user.id;
  const [code, setCode] = useState(""),
    [offline, setOffline] = useState(false),
    [queue, setQueue] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem(storage) || "[]").slice(0, 100);
      } catch {
        return [];
      }
    }),
    [result, setResult] = useState(""),
    [checking, setChecking] = useState(false);
  const [campaign, setCampaign] = useState({
      name: "",
      budget: 200,
      impressions: 1000,
      clicks: 100,
    }),
    [coupon, setCoupon] = useState({
      name: "",
      amount: 20,
      minSpend: 100,
      validDays: 7,
      campaignCode: "weekend",
    }),
    [policies, setPolicies] = useState(() =>
      structuredClone(
        data.settings?.recommendationPolicies || {
          H5: { interest: 20, view: 3, favorite: 6, purchase: 8, city: 8 },
          电脑网页: {
            interest: 16,
            view: 1,
            favorite: 4,
            purchase: 10,
            city: 4,
          },
        },
      ),
    );
  function saveQueue(q) {
    setQueue(q);
    localStorage.setItem(storage, JSON.stringify(q));
  }
  async function verify(e) {
    e.preventDefault();
    const value = code.trim().toUpperCase();
    if (!value) return;
    if (offline) {
      if (queue.length >= 100) {
        setResult("待校验列表已达100条，请先联网处理");
        return;
      }
      saveQueue([...new Set([...queue, value])]);
      setResult("已暂存票码，尚未核销，联网后需服务端校验");
      setCode("");
      return;
    }
    setChecking(true);
    try {
      const r = await api("/demo/tickets/verify", {
        method: "POST",
        body: { code: value },
      });
      setResult(r.message + " · " + r.ticket.resource + " · " + r.ticket.seat);
      setCode("");
      try {
        navigator.vibrate?.(120);
      } catch {}
      await refresh();
    } catch (e) {
      setResult(e.message);
    } finally {
      setChecking(false);
    }
  }
  async function sync() {
    setChecking(true);
    const failed = [],
      messages = [];
    for (const value of queue) {
      try {
        await api("/demo/tickets/verify", {
          method: "POST",
          body: { code: value },
        });
        messages.push(value + "：联网核销成功");
      } catch (e) {
        messages.push(value + "：" + e.message);
        failed.push(value);
      }
    }
    saveQueue(failed);
    setResult(messages.join("\n"));
    try {
      await refresh();
    } catch (e) {
      setToast("核销列表已保留，请恢复网络后刷新：" + e.message);
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <PageTitle
        title="票务与运营"
        subtitle="模拟票务闭环、渠道推荐策略和营销复盘"
      />
      <div className="extension-stack">
        <section className="extension-card">
          <h2>手机核销台（PDA流程演示）</h2>
          <p className="note">
            输入票码或用键盘式扫码枪输入；核销只在联网校验通过后成立。演示允许提前核销未来场次，未对接真实PDA设备。
          </p>
          <form className="extension-inline" onSubmit={verify}>
            <label>
              电子票码
              <input
                aria-label="电子票码"
                maxLength={40}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="GYT…"
              />
            </label>
            <button className="button primary" disabled={checking}>
              {offline ? "暂存待校验" : "联网核销"}
            </button>
          </form>
          <label className="extension-check">
            <input
              type="checkbox"
              checked={offline}
              onChange={(e) => setOffline(e.target.checked)}
            />
            模拟离线，仅暂存票码
          </label>
          <pre className="verification-result" role="status">
            {result || "等待输入票码"}
          </pre>
          <p>待联网校验：{queue.length} 条</p>
          <div className="extension-inline">
            <button
              className="button"
              disabled={offline || checking || !queue.length}
              onClick={sync}
            >
              联网校验暂存票码
            </button>
            <button
              className="button"
              disabled={checking || !queue.length}
              onClick={() => saveQueue([])}
            >
              清空暂存
            </button>
          </div>
        </section>
        <section className="extension-card">
          <h2>电子票与打印请求</h2>
          <div className="extension-scroll">
            <table>
              <thead>
                <tr>
                  <th>演出</th>
                  <th>票码</th>
                  <th>座位</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {o.recentTickets.map((t) => (
                  <tr key={t.code}>
                    <td>{t.resource_name}</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setCode(t.code)}
                      >
                        {t.code}
                      </button>
                    </td>
                    <td>{t.seat_label}</td>
                    <td>
                      {
                        { active: "待核销", used: "已核销", void: "已作废" }[
                          t.status
                        ]
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!o.recentTickets.length ? (
            <p className="muted">演出订单支付后自动出票，在交易管理中查看。</p>
          ) : null}
          <details>
            <summary>最近打印请求（{o.prints.length}）</summary>
            {o.prints.map((p) => (
              <p key={p.code}>
                {shortDate(p.created_at)} · {p.user_name} ·{" "}
                {JSON.parse(p.tickets).length}张（不代表纸张已输出）
              </p>
            ))}
          </details>
        </section>
        <section className="extension-card">
          <h2>每日用户画像快照</h2>
          <p>
            {o.snapshot
              ? `最近保存：${shortDate(o.snapshot.created_at)}，${o.snapshot.count}份，来源：${o.snapshot.source === "timer" ? "自动任务" : "手动"}`
              : "尚未保存画像快照"}
          </p>
          <p className="note">
            服务器每天北京时间00:10左右自动保存；同一用户同一天只保留一份，重复执行更新当日结果。
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() => action("/profiles/snapshot", {})}
          >
            立即保存今日快照
          </button>
        </section>
        <section className="extension-card">
          <h2>H5 / 电脑网页推荐策略</h2>
          <p className="note">
            基于兴趣、浏览、收藏、购买和同城的规则推荐。各渠道独立权重，不是模型训练或A/B实验。
          </p>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              action(
                "/demo/recommendation-policy",
                { policies },
                null,
                "PATCH",
              );
            }}
          >
            {Object.entries(policies).map(([channel, weights]) => (
              <fieldset className="weight-fields" key={channel}>
                <legend>{channel}</legend>
                {Object.entries(weights).map(([key, value]) => (
                  <label key={key}>
                    {weightLabels[key]}
                    <input
                      aria-label={channel + weightLabels[key] + "权重"}
                      type="number"
                      min="0"
                      max="50"
                      required
                      value={value}
                      onChange={(e) =>
                        setPolicies((p) => ({
                          ...p,
                          [channel]: {
                            ...p[channel],
                            [key]: Number(e.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </fieldset>
            ))}
            <button className="button primary" disabled={busy}>
              保存渠道权重
            </button>
          </form>
        </section>
        <div className="extension-grid">
          <section className="extension-card">
            <h2>创建模拟营销活动</h2>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await action("/demo/campaigns", {
                  ...campaign,
                  budget: Math.round(campaign.budget * 100),
                });
                if (r) setCampaign((c) => ({ ...c, name: "" }));
              }}
            >
              <FormField label="活动名称">
                <input
                  required
                  maxLength={60}
                  value={campaign.name}
                  onChange={(e) =>
                    setCampaign((c) => ({ ...c, name: e.target.value }))
                  }
                />
              </FormField>
              {[
                ["budget", "预算（元）"],
                ["impressions", "模拟曝光"],
                ["clicks", "模拟点击"],
              ].map(([k, label]) => (
                <FormField key={k} label={label}>
                  <input
                    required
                    type="number"
                    min="0"
                    max={k === "budget" ? 1000000 : 10000000}
                    step={k === "budget" ? "0.01" : "1"}
                    value={campaign[k]}
                    onChange={(e) =>
                      setCampaign((c) => ({
                        ...c,
                        [k]: Number(e.target.value),
                      }))
                    }
                  />
                </FormField>
              ))}
              <button className="button primary" disabled={busy}>
                创建活动
              </button>
            </form>
          </section>
          <section className="extension-card">
            <h2>创建演示优惠券</h2>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await action("/demo/coupons", {
                  ...coupon,
                  amount: Math.round(coupon.amount * 100),
                  minSpend: Math.round(coupon.minSpend * 100),
                });
                if (r) setCoupon((c) => ({ ...c, name: "" }));
              }}
            >
              <FormField label="券名称">
                <input
                  required
                  maxLength={60}
                  value={coupon.name}
                  onChange={(e) =>
                    setCoupon((c) => ({ ...c, name: e.target.value }))
                  }
                />
              </FormField>
              {[
                ["amount", "优惠额（元）", 0.01, 10000],
                ["minSpend", "使用门槛（元）", 0, 1000000],
                ["validDays", "领取后有效天数", 1, 90],
              ].map(([k, label, min, max]) => (
                <FormField key={k} label={label}>
                  <input
                    required
                    type="number"
                    min={min}
                    max={max}
                    step={k === "validDays" ? 1 : 0.01}
                    value={coupon[k]}
                    onChange={(e) =>
                      setCoupon((c) => ({ ...c, [k]: Number(e.target.value) }))
                    }
                  />
                </FormField>
              ))}
              <FormField label="归属营销活动">
                <select
                  value={coupon.campaignCode}
                  onChange={(e) =>
                    setCoupon((c) => ({ ...c, campaignCode: e.target.value }))
                  }
                >
                  <option value="">不归因</option>
                  {o.campaigns.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <button className="button primary" disabled={busy}>
                创建优惠券
              </button>
            </form>
          </section>
        </div>
        <section className="extension-card">
          <h2>营销复盘（模拟归因）</h2>
          <p className="note">
            预算、曝光和点击为手动模拟输入；订单通过优惠券归因。ROAS=有效已支付金额÷预算，转化率=有效付费订单÷模拟点击。退款成功剔除，不代表真实投放ROI。
          </p>
          <div className="extension-scroll">
            <table>
              <thead>
                <tr>
                  <th>活动</th>
                  <th>预算</th>
                  <th>曝光 / 点击</th>
                  <th>订单 / 付费</th>
                  <th>有效交易额</th>
                  <th>ROAS</th>
                  <th>转化率</th>
                </tr>
              </thead>
              <tbody>
                {o.campaigns.map((c) => (
                  <tr key={c.code}>
                    <td>{c.name}</td>
                    <td>{money(c.budget)}</td>
                    <td>
                      {c.impressions} / {c.clicks}
                    </td>
                    <td>
                      {c.orders} / {c.paidOrders}
                    </td>
                    <td>{money(c.revenue)}</td>
                    <td>{c.roas ?? "—"}</td>
                    <td>{c.conversion === null ? "—" : c.conversion + "%"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="button"
            onClick={() => {
              downloadText(
                [
                  "桂演营销复盘（模拟归因）",
                  "手动模拟曝光与预算；ROAS不等于净利润ROI。",
                  ...o.campaigns.map(
                    (c) =>
                      `${c.name}：预算${money(c.budget)}，有效交易额${money(c.revenue)}，ROAS ${c.roas ?? "无预算"}，转化${c.conversion ?? "无点击"}%`,
                  ),
                ].join("\n"),
                "模拟营销复盘.txt",
              );
              setToast("报告已下载");
            }}
          >
            下载复盘报告
          </button>
        </section>
      </div>
    </>
  );
}
