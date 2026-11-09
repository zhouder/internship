import { useState, useEffect } from "react";
import {
  Banknote,
  CalendarDays,
  Layers,
  Users,
  Download,
  RefreshCw,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import { useApp } from "../state";
import { api, exportOrders, money, shortDate } from "../api";
import { PageTitle, Panel, Badge, ResourceCard } from "../ui";

export function Trend({ series = [] }) {
  const max = Math.max(...series.map((s) => s.amount), 100);
  const points = series.map((s, i) => [
    45 + (i / Math.max(series.length - 1, 1)) * 545,
    215 - (s.amount / max) * 175,
  ]);
  const line = points.map((p) => p.join(",")).join(" ");
  return (
    <div className="trend">
      <div className="chart-legend">
        <i />
        交易金额（元）
      </div>
      <svg viewBox="0 0 620 260" role="img" aria-label="交易金额趋势图">
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#0cae91" stopOpacity=".22" />
            <stop offset="1" stopColor="#0cae91" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1="45"
              x2="590"
              y1={215 - t * 175}
              y2={215 - t * 175}
              stroke="#e9edf3"
            />
            <text x="37" y={219 - t * 175} textAnchor="end">
              {Math.round((max * t) / 100).toLocaleString()}
            </text>
          </g>
        ))}
        {points.length ? (
          <>
            <polygon
              points={`45,215 ${line} 590,215`}
              fill="url(#chart-fill)"
            />
            <polyline
              points={line}
              fill="none"
              stroke="#088775"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {points.map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3"
                fill="white"
                stroke="#088775"
                strokeWidth="2"
              >
                <title>
                  {series[i].date}：{money(series[i].amount)}
                </title>
              </circle>
            ))}
          </>
        ) : null}
        {series
          .filter((_, i) => i % Math.max(1, Math.ceil(series.length / 7)) === 0)
          .map((s) => {
            const i = series.indexOf(s);
            return (
              <text
                key={s.date}
                x={45 + (i / Math.max(series.length - 1, 1)) * 545}
                y="245"
                textAnchor="middle"
              >
                {s.date.length === 10 ? s.date.slice(5) : s.date}
              </text>
            );
          })}
      </svg>
    </div>
  );
}
function Channels({ channels }) {
  const total = channels.reduce((a, c) => a + c.amount, 0),
    colors = ["#008b78", "#23bd9b", "#78d6ba", "#ccece5", "#7a9bba"];
  let acc = 0;
  const stops = channels.map((c, i) => {
    const start = acc;
    acc += (c.amount / Math.max(total, 1)) * 100;
    return `${colors[i % colors.length]} ${start}% ${acc}%`;
  });
  return (
    <div className="channels">
      <div
        className="donut"
        style={{
          background: total ? `conic-gradient(${stops.join(",")})` : "#edf1f5",
        }}
      >
        <div>
          <strong>{money(total)}</strong>
          <small>交易总额</small>
        </div>
      </div>
      <div className="channel-legend">
        {channels.map((c, i) => (
          <div key={c.name}>
            <i style={{ background: colors[i % colors.length] }} />
            <span>{c.name}</span>
            <b>{((c.amount / Math.max(total, 1)) * 100).toFixed(1)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}
export function Dashboard({ onNavigate, onOpen, analyticsPage = false }) {
  const { data, action, setToast } = useApp();
  const [period, setPeriod] = useState("day"),
    [custom, setCustom] = useState(null),
    [loading, setLoading] = useState(false);
  const a = custom || data.analytics;
  useEffect(() => {
    if (period === "day") {
      setCustom(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    api("/analytics?period=" + period)
      .then((value) => {
        if (active) setCustom(value);
      })
      .catch((e) => {
        if (active) setToast(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period, data.analytics, setToast]);
  function changePeriod(value) {
    setPeriod(value);
  }
  async function sync() {
    const r = await action("/sync", { channel: "票务平台" });
    if (r) setCustom(null);
  }
  return (
    <>
      <PageTitle
        title={analyticsPage ? "数据分析" : "运营总览"}
        subtitle="演艺资源与运营数据，一目了然"
      >
        <select
          aria-label="统计周期"
          value={period}
          onChange={(e) => changePeriod(e.target.value)}
        >
          <option value="day">按日统计</option>
          <option value="week">按周统计</option>
          <option value="month">按月统计</option>
          <option value="quarter">按季度统计</option>
        </select>
        <button
          className="button primary"
          onClick={() => exportOrders().catch((e) => setToast(e.message))}
        >
          <Download size={16} />
          导出报表
        </button>
      </PageTitle>
      <div className="kpi-grid">
        {[
          ["交易总额", money(a.kpis.revenue), Banknote, "已支付及已完成订单"],
          [
            "预约订单",
            a.kpis.orders + " 笔",
            CalendarDays,
            "包含各渠道模拟订单",
          ],
          ["上架资源", a.kpis.resources + " 项", Layers, "覆盖全区演艺资源"],
          ["活跃用户", a.kpis.users + " 人", Users, "模拟用户档案"],
        ].map(([label, value, I, desc]) => (
          <div className="kpi" key={label}>
            <I size={25} />
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{desc}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="chart-grid">
        <Panel
          title="交易趋势"
          action={
            loading ? (
              <span>更新中…</span>
            ) : (
              <span className="muted">模拟订单数据</span>
            )
          }
        >
          <Trend series={a.series} />
        </Panel>
        <Panel title="交易渠道分布">
          <Channels channels={a.channels} />
        </Panel>
      </div>
      {analyticsPage ? (
        <>
          <div className="two-col">
            <Panel title="运营分析与建议">
              <div className="insights">
                {a.insights.map((v, i) => (
                  <div key={v}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <p>{v}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="异常预警"
              action={
                <select
                  aria-label="触发模拟预警"
                  defaultValue=""
                  onChange={async (e) => {
                    const kind = e.target.value;
                    if (!kind) return;
                    e.target.value = "";
                    const r = await action(
                      "/alerts",
                      { kind },
                      "模拟预警已触发",
                    );
                    if (r) setCustom(null);
                  }}
                >
                  <option value="">触发模拟事件</option>
                  <option value="sales">销量突降</option>
                  <option value="verification">核销异常</option>
                  <option value="inventory">库存异常</option>
                  <option value="data">数据异常</option>
                  <option value="sentiment">舆情风险</option>
                </select>
              }
            >
              <div className="alerts">
                {a.alerts.map((v) => (
                  <div key={v.title}>
                    <AlertTriangle size={18} />
                    <div>
                      <strong>{v.title}</strong>
                      <p>{v.detail}</p>
                      {v.id ? (
                        <button
                          className="text-button"
                          onClick={() =>
                            action(
                              "/alerts",
                              { resolve: v.id },
                              "预警已处理",
                            ).then((r) => {
                              if (r) setCustom(null);
                            })
                          }
                        >
                          标为已处理
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <Panel
            title="数据汇聚与渠道对接"
            action={
              <button className="button primary" onClick={sync}>
                <RefreshCw size={15} />
                模拟同步订单
              </button>
            }
          >
            <p className="note">
              票房、订单、用户、资源、渠道数据自动从本地数据库聚合；外部渠道仅模拟接入。
            </p>
            <div className="integration-grid">
              {["抖音", "小红书", "大麦", "猫眼", "文惠卡", "消费卡"].map(
                (c) => (
                  <div key={c}>
                    <span>{c}</span>
                    <Badge>模拟连接</Badge>
                    <button
                      className="text-button"
                      onClick={() =>
                        action("/sync", { channel: c }).then((r) => {
                          if (r) setCustom(null);
                        })
                      }
                    >
                      同步
                    </button>
                  </div>
                ),
              )}
            </div>
          </Panel>
          <Panel title="场馆经营分析">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>场馆</th>
                    <th>已预约天数</th>
                    <th>30天档期占用率</th>
                    <th>模拟交易额</th>
                  </tr>
                </thead>
                <tbody>
                  {a.venues.map((v) => (
                    <tr key={v.id}>
                      <td>{v.name}</td>
                      <td>{v.bookedDays}天</td>
                      <td>
                        <div className="progress">
                          <i style={{ width: v.occupancy + "%" }} />
                        </div>
                        {v.occupancy}%
                      </td>
                      <td>{money(v.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">
              占用率为当前订单中的去重预约日数÷30，非真实场馆上座率。
            </p>
          </Panel>
        </>
      ) : (
        <div className="dashboard-bottom">
          <Panel
            title="最近订单"
            action={
              <button
                className="text-button"
                onClick={() => onNavigate("orders")}
              >
                查看更多
                <ArrowUpRight size={14} />
              </button>
            }
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>订单编号</th>
                    <th>资源名称</th>
                    <th>交易金额</th>
                    <th>订单状态</th>
                    <th>下单时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.slice(0, 5).map((o) => (
                    <tr key={o.id}>
                      <td className="order-code">{o.code}</td>
                      <td>{o.resource_name}</td>
                      <td>{money(o.amount)}</td>
                      <td>
                        <Badge status={o.status} />
                      </td>
                      <td className="muted">{shortDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel
            title="资源推荐"
            action={
              <button
                className="text-button"
                onClick={() => onNavigate("resources")}
              >
                查看更多
                <ArrowUpRight size={14} />
              </button>
            }
          >
            <div className="recommend-list">
              {data.resources.slice(0, 3).map((r) => (
                <ResourceCard key={r.id} resource={r} onOpen={onOpen} compact />
              ))}
            </div>
          </Panel>
        </div>
      )}
      <p className="data-caption">
        所有用户、交易和经营指标均为模拟数据 · 演示基准日 {data.today}
      </p>
    </>
  );
}
