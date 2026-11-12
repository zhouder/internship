import { Trend } from "../Trend";
import { Select } from "../Select";
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
import { api, exportOrders, money, shortDate, downloadText } from "../api";
import { PageTitle, Panel, Badge, ResourceCard } from "../ui";

export { Trend } from "../Trend";
function Channels({ channels }) {
  const total = channels.reduce((a, c) => a + c.amount, 0),
    colors = ["#b7472c", "#d27753", "#e5b08a", "#efd8bb", "#6a786d"];
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
    [range, setRange] = useState("recent"),
    [custom, setCustom] = useState(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [retry, setRetry] = useState(0);
  const a = custom || data.analytics;
  const trendReady = !loading && !loadError && a.period === period && a.trendWindow?.range === range;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    api("/analytics?" + new URLSearchParams({period, range}), {signal:controller.signal})
      .then((value) => {
        if (!controller.signal.aborted) setCustom(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {setLoadError(e.message); setToast(e.message);}
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [period, range, data.analytics, setToast, retry]);
  function changePeriod(value) {
    setPeriod(value);
  }
  async function sync() {
    await action("/sync", { channel: "票务平台" });
  }
  return (
    <>
      <PageTitle
        title={analyticsPage ? "数据分析" : "运营总览"}
        subtitle="演艺资源与运营数据，一目了然"
      >
        {analyticsPage ? (
          <button
            className="button"
            onClick={() => downloadText(a.report, "桂演经营分析报告.txt")}
          >
            导出经营报告
          </button>
        ) : null}
        <Select
          aria-label="统计周期"
          value={period}
          onChange={(e) => changePeriod(e.target.value)}
        >
          <option value="day">按日统计</option>
          <option value="week">按周统计</option>
          <option value="month">按月统计</option>
          <option value="quarter">按季度统计</option>
        </Select>
        <Select aria-label="趋势范围" value={range} onChange={e => setRange(e.target.value)}>
          <option value="recent">{{day:"近30天",week:"近8周",month:"近12个月",quarter:"近8个季度"}[period]}</option>
          <option value="all">全部历史</option>
        </Select>
        <button
          className="button primary"
          disabled={!trendReady}
          onClick={() => exportOrders(period, range).catch((e) => setToast(e.message))}
        >
          <Download size={16} />
          导出当前统计
        </button>
      </PageTitle>
      <div className="kpi-grid">
        {[
          [
            "交易总额",
            money(a.kpis.revenue),
            Banknote,
            "有效已支付金额，剔除已退款",
          ],
          [
            "预约订单",
            a.kpis.orders + " 笔",
            CalendarDays,
            "历史全部订单，含取消和退款",
          ],
          ["上架资源", a.kpis.resources + " 项", Layers, "覆盖全区演艺资源"],
          ["活跃用户", a.kpis.users + " 人", Users, "近30天下单去重用户"],
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
            !trendReady && !loadError ? (
              <span>更新中…</span>
            ) : (
              <span className="muted">模拟订单数据</span>
            )
          }
        >
          {loadError ? <div className="trend-placeholder" role="alert"><p>{loadError}</p><button className="button" onClick={() => setRetry(n => n+1)}>重试</button></div> : !trendReady ? <div className="trend-placeholder" role="status">正在加载趋势…</div> : <Trend series={a.series} period={a.period} window={a.trendWindow} />}
        </Panel>
        <Panel title="交易渠道分布">
          <Channels channels={a.channels} />
        </Panel>
      </div>
      <p className="note">
        范围选择仅作用于交易趋势及其导出，累计指标与渠道分布按全部历史记录统计。趋势按北京时间支付日补齐零成交周期，旧订单支付时间已标注为估算；周区间按周一至周日。
      </p>
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
                <Select
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
                </Select>
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
                    <th>30天闲置率</th>
                    <th>热门预约日</th>
                    <th>关联演出场次</th>
                    <th>售票上座率</th>
                    <th>场均票房</th>
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
                      <td>{v.idleRate}%</td>
                      <td>{v.peak}</td>
                      <td>{v.performances}场</td>
                      <td>
                        {v.seatOccupancy === null
                          ? "暂无关联售票样本"
                          : v.seatOccupancy + "%"}
                      </td>
                      <td>
                        {v.averageRevenue === null
                          ? "暂无样本"
                          : money(v.averageRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">
              档期占用率仅取未来30天去重租赁日期；上座率按关联剧目的已支付票数÷相应场次配额计算。请在“演艺资源→编辑剧目”关联场馆。热门预约日按星期统计，当前不采集小时档期。
            </p>
          </Panel>
          <Panel title="场馆适配剧目建议">
            <div className="venue-recommendations">
              {a.venues.map((v) => (
                <article key={v.id}>
                  <h3>{v.name}</h3>
                  <ol>
                    {v.recommendations.map((r) => (
                      <li key={r.id}>
                        <button
                          className="text-button"
                          onClick={() =>
                            onOpen(data.resources.find((x) => x.id === r.id))
                          }
                        >
                          {r.name}
                        </button>{" "}
                        · {r.reason}
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
            <p className="note">
              按场馆介绍、设施、演出类型和城市匹配的本地建议；正式排期仍需人工确认。
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
        所有用户、交易和经营指标均为模拟数据 · 统计日期 {data.today}
      </p>
    </>
  );
}
