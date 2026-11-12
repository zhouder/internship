import {useId, useLayoutEffect, useRef, useState} from "react";
import {money} from "./api";
import {amountScale, chartBounds, tickIndices, tickLines} from "./chart-layout.mjs";

export function Trend({series = [], period = "day", window}) {
  const [active, setActive] = useState(null);
  const [width, setWidth] = useState(chartBounds.width);
  const plot = useRef(null);
  useLayoutEffect(() => {
    const update = () => setWidth(Math.max(240, Math.round(plot.current.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(plot.current);
    return () => observer.disconnect();
  }, []);
  const b = {...chartBounds, width, right:width - 30};
  const maxLabels = Math.max(2, Math.min(period === "day" ? 7 : 6, Math.floor((b.right - b.left) / (period === "week" ? 70 : 60)) + 1));
  const minimumTickStep = Math.max(1, Math.ceil((period === "week" ? 70 : 60) * (series.length - 1) / (b.right - b.left)));
  const gradient = useId(), tooltipId = useId();
  const scale = amountScale(series.map(s => s.amount));
  const points = series.map((s, i) => ({
    ...s, index:i,
    x:series.length === 1 ? (b.left + b.right) / 2 : b.left + i / (series.length - 1) * (b.right - b.left),
    y:b.bottom - s.amount / scale.max * (b.bottom - b.top),
  }));
  const selected = active === null ? null : points[active];
  const line = points.map(p => `${p.x},${p.y}`).join(" ");
  const dateRange = window ? `${window.start} — ${window.end}` : "";
  function move(event) {
    if (!points.length) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width * b.width;
    setActive(Math.max(0, Math.min(points.length - 1, Math.round((x - b.left) / (b.right - b.left) * (points.length - 1)))));
  }
  function keyDown(event) {
    if (!points.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setActive(index => event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : Math.max(0, Math.min(points.length - 1, (index ?? points.length - 1) + (event.key === "ArrowLeft" ? -1 : 1))));
  }
  return <div className="trend trend-readable">
    <div className="trend-heading">
      <div className="trend-window"><strong>{window?.label || "交易趋势"}</strong><span>{dateRange}</span></div>
      <div className="chart-legend"><i/>交易金额（元）</div>
    </div>
    <div className="trend-plot" ref={plot}>
      <svg viewBox={`0 0 ${b.width} ${b.height}`} role="img" aria-label="交易金额趋势图，可用左右方向键查看每期金额" aria-describedby={selected ? tooltipId : undefined} tabIndex={0} onPointerMove={move} onPointerLeave={() => setActive(null)} onKeyDown={keyDown} onFocus={() => points.length && setActive(points.length - 1)} onBlur={() => setActive(null)}>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b7472c" stopOpacity=".15"/><stop offset="1" stopColor="#b7472c" stopOpacity=".01"/></linearGradient></defs>
        {scale.ticks.map(amount => {
          const y = b.bottom - amount / scale.max * (b.bottom - b.top);
          return <g key={amount}><line x1={b.left} x2={b.right} y1={y} y2={y} stroke="#eceef0"/><text x={b.left - 12} y={y + 4} textAnchor="end" className="trend-value-label">{(amount / 100).toLocaleString("zh-CN", {maximumFractionDigits:2})}</text></g>;
        })}
        {points.length ? <>
          <polygon points={`${points[0].x},${b.bottom} ${line} ${points.at(-1).x},${b.bottom}`} fill={`url(#${gradient})`}/>
          <polyline points={line} fill="none" stroke="#b7472c" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round"/>
          {points.length <= 12 ? points.filter(p => p.amount > 0).map(p => <circle key={p.date} cx={p.x} cy={p.y} r="3" fill="white" stroke="#b7472c" strokeWidth="1.8"/>) : null}
        </> : <text x="330" y="120" textAnchor="middle">暂无统计记录</text>}
        {selected ? <g className="trend-selected"><line x1={selected.x} x2={selected.x} y1={b.top} y2={b.bottom} stroke="#c6b4a8" strokeDasharray="3 4"/><circle cx={selected.x} cy={selected.y} r="4" fill="white" stroke="#b7472c" strokeWidth="2"/></g> : null}
        {tickIndices(points.length, period, maxLabels, minimumTickStep).map(i => <text key={points[i].date} x={points[i].x} y="230" textAnchor="middle" className="trend-date-label">{tickLines(points[i], period).map((line, j) => <tspan x={points[i].x} dy={j ? 16 : 0} key={j}>{line}</tspan>)}</text>)}
      </svg>
      {selected ? <div id={tooltipId} role="tooltip" className="trend-tooltip" style={{left:Math.max(90, Math.min(b.width - 90, selected.x)) / b.width * 100 + "%"}}><span>{period === "week" ? `${selected.date} 起一周` : selected.date}</span><strong>{money(selected.amount)}</strong><small>{selected.count} 笔有效支付</small></div> : null}
    </div>
    <p className="trend-help">悬停或使用方向键查看每期金额{series.length > 0 && series.every(p => !p.amount) ? " · 所选范围暂无成交" : ""}</p>
  </div>;
}
