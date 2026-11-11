import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Heart,
  CalendarDays,
  MapPin,
  Star,
  MessageCircle,
  RotateCw,
} from "lucide-react";
import { useApp } from "../state";
import { api, money, downloadText } from "../api";
import { matchesSearch } from "../search";
import {
  PageTitle,
  SearchBox,
  ResourceCard,
  Empty,
  Modal,
  FormField,
  SubmitButton,
  Badge,
  Icon,
} from "../ui";

export function ResourceForm({ resource, onClose }) {
  const { data, action, busy } = useApp();
  const [f, setF] = useState({
    name: resource?.name || "",
    category: resource?.category || "show",
    city: resource?.city || "南宁",
    price: resource ? resource.price / 100 : 198,
    stock: resource?.daily_capacity ?? resource?.stock ?? 100,
    unit: resource?.unit || "张",
    description: resource?.description || "",
    capacity: resource?.capacity || 0,
    venueId: resource?.meta?.venueId || 0,
  });
  const change = (k, v) => setF((s) => ({ ...s, [k]: v }));
  async function submit(e) {
    e.preventDefault();
    const payload = {
      ...f,
      price: Math.round(Number(f.price) * 100),
      stock: Number(f.stock),
      capacity: Number(f.capacity),
      meta: { venueId: Number(f.venueId) },
      tags: [
        data.categories.find((c) => c.id === f.category)?.name,
        "平台自营",
      ],
    };
    const r = await action(
      resource ? "/resources/" + resource.id : "/resources",
      payload,
      resource ? "资源已更新" : "资源已上架",
      resource ? "PATCH" : "POST",
    );
    if (r) onClose();
  }
  return (
    <Modal title={resource ? "编辑资源" : "新增演艺资源"} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <FormField label="资源名称">
          <input
            required
            maxLength={80}
            value={f.name}
            onChange={(e) => change("name", e.target.value)}
          />
        </FormField>
        <div className="form-row">
          <FormField label="资源分类">
            <select
              disabled={!!resource}
              value={f.category}
              onChange={(e) => change("category", e.target.value)}
            >
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="所在城市">
            <input
              required
              value={f.city}
              disabled={!!resource}
              onChange={(e) => change("city", e.target.value)}
            />
          </FormField>
        </div>
        <div className="form-row">
          <FormField label="价格（元）">
            <input
              required
              type="number"
              min="0"
              step=".01"
              value={f.price}
              onChange={(e) => change("price", e.target.value)}
            />
          </FormField>
          <FormField label="计价单位">
            <input
              required
              value={f.unit}
              disabled={!!resource}
              onChange={(e) => change("unit", e.target.value)}
            />
          </FormField>
          <FormField
            label={
              ["show", "heritage", "tourism", "digital", "artist"].includes(
                f.category,
              )
                ? "每日配额（按日期独立）"
                : "库存（服务类不扣减）"
            }
          >
            <input
              type="number"
              required
              min="0"
              value={f.stock}
              onChange={(e) => change("stock", e.target.value)}
            />
          </FormField>
        </div>
        {f.category === "show" ? (
          <FormField label="关联售票场馆（用于经营分析）">
            <select
              value={f.venueId}
              onChange={(e) => change("venueId", e.target.value)}
            >
              <option value="0">尚未关联</option>
              {data.resources
                .filter((r) => r.category === "venue")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </FormField>
        ) : null}
        <FormField label="资源介绍">
          <textarea
            required
            rows={4}
            maxLength={3000}
            value={f.description}
            onChange={(e) => change("description", e.target.value)}
          />
        </FormField>
        <SubmitButton busy={busy}>保存资源</SubmitButton>
      </form>
    </Modal>
  );
}
export function Resources({
  onOpen,
  query = "",
  onQueryChange,
  category: initialCategory = "",
}) {
  const { data, action } = useApp();
  const [category, setCategory] = useState(initialCategory),
    [city, setCity] = useState(""),
    [sort, setSort] = useState("default"),
    [editing, setEditing] = useState(null);
  let rows = data.resources.filter(
    (r) =>
      (!category || r.category === category) &&
      (!city || r.city === city) &&
      matchesSearch(r, query),
  );
  if (sort === "price") rows = [...rows].sort((a, b) => a.price - b.price);
  if (sort === "rating") rows = [...rows].sort((a, b) => b.rating - a.rating);
  return (
    <>
      <PageTitle title="演艺资源" subtitle="连接场馆、剧目、艺人与文化服务">
        <button className="button primary" onClick={() => setEditing({})}>
          <Plus size={16} />
          新增资源
        </button>
      </PageTitle>
      <div className="filter-bar">
        <SearchBox
          value={query}
          onChange={onQueryChange}
          placeholder="搜索演出、场馆、艺人或服务"
        />
        <select
          aria-label="城市筛选"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          <option value="">全部城市</option>
          {["南宁", "柳州", "桂林", "北海", "崇左", "全区"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="资源排序"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="default">默认排序</option>
          <option value="price">价格从低到高</option>
          <option value="rating">评分从高到低</option>
        </select>
      </div>
      <div className="category-tabs">
        <button
          className={!category ? "active" : ""}
          onClick={() => setCategory("")}
        >
          全部资源
        </button>
        {data.categories.map((c) => (
          <button
            key={c.id}
            className={category === c.id ? "active" : ""}
            onClick={() => setCategory(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <p className="list-count">共 {rows.length} 项资源 · 图片均为演示示意图</p>
      <div className="resource-grid">
        {rows.map((r) => (
          <div className="managed-resource" key={r.id}>
            <ResourceCard resource={r} onOpen={onOpen} />
            <div className="management-actions">
              <Badge status={r.status} />
              <button className="text-button" onClick={() => setEditing(r)}>
                编辑
              </button>
              {r.category === "show" ? (
                <button
                  className="text-button"
                  onClick={() => action("/resources/" + r.id + "/sync", {})}
                >
                  同步渠道
                </button>
              ) : null}
              <button
                className="text-button"
                onClick={() =>
                  action(
                    "/resources/" + r.id,
                    {
                      status: r.status === "published" ? "draft" : "published",
                    },
                    r.status === "published" ? "资源已下架" : "资源已上架",
                    "PATCH",
                  )
                }
              >
                {r.status === "published" ? "下架" : "上架"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {!rows.length ? <Empty text="没有符合条件的资源" /> : null}
      {editing ? (
        <ResourceForm
          resource={editing.id ? editing : null}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
function EquipmentPreview() {
  const [angle, setAngle] = useState(0),
    [color, setColor] = useState("#26c6a1");
  return (
    <div className="equipment-preview">
      <div className="preview-controls">
        <strong>舞台灯位示意（模拟数字孪生）</strong>
        <button className="text-button" onClick={() => setAngle((a) => a + 30)}>
          <RotateCw size={14} />
          旋转
        </button>
        <input
          aria-label="灯光颜色"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>
      <div className="stage-view" style={{ perspective: 600 }}>
        <div
          style={{
            transform: `rotateX(45deg) rotateZ(${angle}deg)`,
            background: color,
          }}
          className="stage-platform"
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <span
              key={n}
              style={{
                left: `${10 + ((n - 1) % 3) * 35}%`,
                top: n > 3 ? "80%" : "8%",
              }}
            >
              ●
            </span>
          ))}
        </div>
      </div>
      <p className="note">仅演示灯位与颜色变化，不进行真实设备仿真。</p>
    </div>
  );
}
function DigitalPreview({ image }) {
  const [playing, setPlaying] = useState(false),
    [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(
      () => setProgress((p) => (p >= 100 ? 0 : p + 1)),
      500,
    );
    return () => clearInterval(t);
  }, [playing]);
  return (
    <div className="digital-preview">
      <img src={image} alt="数字演出演示封面" />
      <button className="button primary" onClick={() => setPlaying((p) => !p)}>
        {playing ? "暂停模拟播放" : "开始模拟点播"}
      </button>
      <div className="progress">
        <i style={{ width: progress + "%" }} />
      </div>
      <p className="note">模拟播放进度与点播权益，无真实视频流。</p>
    </div>
  );
}
export function ResourceDetail({
  resource,
  onClose,
  onNeedLogin,
  onBooked,
  channel = "H5",
}) {
  const { data, action, busy, setToast } = useApp();
  const r = data.resources.find((x) => x.id === resource.id) || resource;
  const [tab, setTab] = useState("detail"),
    [date, setDate] = useState(() =>
      new Date(new Date(data.today + "T00:00:00Z").getTime() + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
    ),
    [qty, setQty] = useState(1),
    [sessionTime, setSessionTime] = useState("19:30"),
    [startTime, setStartTime] = useState("09:00"),
    [endTime, setEndTime] = useState("18:00"),
    [seats, setSeats] = useState([]),
    [occupied, setOccupied] = useState([]),
    [couponClaim, setCouponClaim] = useState(""),
    [note, setNote] = useState(""),
    [content, setContent] = useState(""),
    [rating, setRating] = useState(5),
    [serviceRating, setServiceRating] = useState(5),
    [valueRating, setValueRating] = useState(5),
    [availability, setAvailability] = useState([]),
    [remaining, setRemaining] = useState(null),
    [inventoryLoading, setInventoryLoading] = useState(true),
    [inventoryError, setInventoryError] = useState("");
  const stableClose = useCallback(onClose, [onClose]);
  useEffect(() => {
    api("/resources/" + r.id + "/view", { method: "POST" }).catch(() => {});
  }, [r.id]);
  useEffect(() => {
    let active = true;
    setInventoryLoading(true);
    setInventoryError("");
    api(
      "/availability?" +
        new URLSearchParams({
          resourceId: r.id,
          date,
          sessionTime,
          startTime,
          endTime,
        }),
    )
      .then((v) => {
        if (active) {
          setAvailability(v.dates);
          setRemaining(v.available);
          setOccupied(v.occupiedSeats || []);
        }
      })
      .catch((e) => {
        if (active) setInventoryError(e.message);
      })
      .finally(() => {
        if (active) setInventoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    r.id,
    date,
    sessionTime,
    startTime,
    endTime,
    data.orders,
    data.resources,
  ]);
  useEffect(() => {
    setSeats([]);
  }, [date, sessionTime]);
  useEffect(() => {
    setCouponClaim("");
  }, [qty]);
  const rental = ["venue", "equipment"].includes(r.category),
    favorite = data.favorites.includes(r.id),
    comments = data.comments.filter(
      (c) => c.resource_id === r.id && c.status === "approved",
    );
  const requireLogin = () => {
    if (data.user) return true;
    setToast("请先登录后操作");
    onNeedLogin?.();
    onClose();
    return false;
  };
  async function book(e) {
    e.preventDefault();
    if (!requireLogin()) return;
    const result = await action(
      "/orders",
      {
        resourceId: r.id,
        date,
        quantity: Number(qty),
        note,
        channel,
        sessionTime,
        startTime,
        endTime,
        seats,
        couponClaim,
      },
      "预约已提交，等待后台确认",
    );
    if (result) {
      onBooked?.();
      onClose();
    }
  }
  async function comment(e) {
    e.preventDefault();
    if (!requireLogin()) return;
    const result = await action("/comments", {
      resourceId: r.id,
      content,
      rating: Number(rating),
      dimensions: {
        quality: Number(rating),
        service: Number(serviceRating),
        value: Number(valueRating),
      },
    });
    if (result) setContent("");
  }
  return (
    <Modal title="资源详情" onClose={stableClose} wide>
      <div className="detail-hero">
        <img src={r.image} alt={r.name + "示意图"} />
        <div>
          <Badge>
            {data.categories.find((c) => c.id === r.category)?.name}
          </Badge>
          <h2>{r.name}</h2>
          <p className="location">
            <MapPin size={14} />
            {r.city} · 示例资源
          </p>
          <strong className="detail-price">
            {money(r.price)}
            <small>/{r.unit}</small>
          </strong>
          {rental ? (
            <p className="resource-hint">
              按所选时段独占，系统检查时间重叠；按展示单价计费，不自动折算小时价。
            </p>
          ) : r.category === "service" ? (
            <p className="resource-hint">
              可预约，服务需求由平台确认；不显示商品库存。
            </p>
          ) : r.inventory_mode === "date" ? (
            <p className="resource-hint">
              {r.category === "show"
                ? "按日期和场次独立配额，选定场次后查看余量与座位。"
                : "按日期独立配额，选定日期后查看余量。"}
            </p>
          ) : null}
          <button
            className={`button ${favorite ? "selected" : ""}`}
            onClick={() => {
              if (requireLogin())
                action(
                  "/favorites",
                  { resourceId: r.id },
                  favorite ? "已取消收藏" : "已收藏",
                );
            }}
          >
            <Heart size={15} fill={favorite ? "currentColor" : "none"} />
            {favorite ? "已收藏" : "收藏资源"}
          </button>
        </div>
      </div>
      <div className="category-tabs">
        <button
          className={tab === "detail" ? "active" : ""}
          onClick={() => setTab("detail")}
        >
          资源介绍
        </button>
        <button
          className={tab === "book" ? "active" : ""}
          onClick={() => setTab("book")}
        >
          {rental ? "档期与预约" : "预约 / 下单"}
        </button>
        <button
          className={tab === "comments" ? "active" : ""}
          onClick={() => setTab("comments")}
        >
          评分与评论（{comments.length}）
        </button>
      </div>
      {tab === "detail" ? (
        <div className="detail-body">
          <p>{r.description}</p>
          <div className="meta-grid">
            {Object.entries(r.meta)
              .filter(
                ([k]) =>
                  !["schedule", "seatRows", "seatCols", "preview"].includes(k),
              )
              .map(([k, v]) => (
                <div key={k}>
                  <span>
                    {{
                      address: "地址",
                      facilities: "设施",
                      duration: "时长（分钟）",
                      team: "演出团队",
                      genre: "剧种",
                      channels: "同步渠道",
                      experience: "演出经历",
                      agency: "经纪机构",
                      process: "服务流程",
                      model: "型号",
                      deposit: "押金（分，模拟）",
                      usage: "使用说明",
                      scope: "授权范围",
                      term: "期限",
                      territory: "地域",
                      rights: "权益说明",
                      certificate: "演示凭证",
                      specification: "规格",
                      shipping: "配送",
                      delivery: "交付方式",
                      includes: "套餐内容",
                      partner: "渠道",
                      kind: "服务类别",
                      playback: "播放说明",
                      lastSync: "最近模拟同步",
                      syncResult: "渠道同步结果",
                      venueId: "关联场馆",
                      venueLinkSource: "关联说明",
                    }[k] || k}
                  </span>
                  <strong>
                    {k === "venueId"
                      ? data.resources.find((x) => x.id === Number(v))?.name ||
                        "尚未关联"
                      : Array.isArray(v)
                        ? v.join("、")
                        : String(v)}
                  </strong>
                </div>
              ))}
          </div>
          {r.category === "equipment" ? <EquipmentPreview /> : null}
          {r.category === "digital" ? <DigitalPreview image={r.image} /> : null}
          {r.category === "copyright" ? (
            <p className="note">
              授权范围、期限及地域见上方字段。仅演示模拟授权，不做真实版权确权。
            </p>
          ) : null}
          {r.category === "venue" ? (
            <div className="seat-map">
              <h3>座位布局示意</h3>
              <div className="stage-label">舞台</div>
              <div>
                {Array.from({ length: 60 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
              <p className="note">示意图用于场地介绍，本Demo按场地整体预约。</p>
            </div>
          ) : null}
          <button
            className="button primary full"
            onClick={() => setTab("book")}
          >
            选择日期，提交预约
          </button>
        </div>
      ) : null}
      {tab === "book" ? (
        <form onSubmit={book} className="form detail-body">
          <div className="info-box">
            <CalendarDays size={18} />
            <div>
              {rental
                ? "场馆和设备支持时段预约，系统自动校验时间重叠，数量固定为1。"
                : "订单经后台确认后，可在“我的订单”进行模拟支付。"}
              <br />
              模拟协议、物流与权益在订单中查看。
            </div>
          </div>
          {rental ? (
            <div className="availability">
              <strong>已有预约</strong>
              <div>
                {availability.length ? (
                  availability.slice(0, 12).map((a, i) => (
                    <span key={i}>
                      {a.booking_date} {a.start_time}–{a.end_time}
                    </span>
                  ))
                ) : (
                  <span>暂无占用档期</span>
                )}
              </div>
            </div>
          ) : null}
          <div className="form-row">
            <FormField label={rental ? "预约日期" : "使用 / 配送日期"}>
              <input
                aria-label="预约日期"
                type="date"
                required
                min={data.today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </FormField>
            <FormField
              label={
                rental
                  ? "数量（按时段独占）"
                  : r.category === "service"
                    ? "预约数量"
                    : `数量 · ${inventoryLoading ? "余量查询中" : inventoryError ? "余量查询失败" : (r.category === "show" ? "所选场次剩余" : r.inventory_mode === "date" ? "所选日期剩余" : "剩余") + remaining}`
              }
            >
              <input
                type="number"
                required
                min="1"
                max={
                  rental
                    ? 1
                    : remaining === null
                      ? 100
                      : Math.max(1, Math.min(100, remaining))
                }
                disabled={rental}
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value);
                  setSeats([]);
                }}
              />
            </FormField>
          </div>
          {rental ? (
            <div className="form-row">
              <FormField label="开始时间">
                <input
                  aria-label="开始时间"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </FormField>
              <FormField label="结束时间">
                <input
                  aria-label="结束时间"
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </FormField>
            </div>
          ) : null}
          {r.category === "show" ? (
            <>
              <FormField label="演出场次">
                <select
                  aria-label="演出场次"
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                >
                  <option value="14:00">14:00（模拟场次）</option>
                  <option value="19:30">19:30（模拟场次）</option>
                </select>
              </FormField>
              <div>
                <p>示例选座 · 已选{seats.length}席</p>
                <div className="booking-seats" aria-label="示例选座">
                  {Array.from(
                    { length: Math.min(60, r.daily_capacity ?? r.stock) },
                    (_, i) => i + 1,
                  ).map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`座位${n}`}
                      aria-pressed={seats.includes(n)}
                      disabled={inventoryLoading || occupied.includes(n)}
                      className={seats.includes(n) ? "selected" : ""}
                      onClick={() => {
                        const next = seats.includes(n)
                          ? seats.filter((x) => x !== n)
                          : [...seats, n];
                        setSeats(next);
                        setQty(next.length || 1);
                      }}
                    >
                      {Math.floor((n - 1) / 10) + 1}-{((n - 1) % 10) + 1}
                    </button>
                  ))}
                </div>
                <p className="seat-legend">
                  红色已选 ·
                  灰色已占用。仅展示前60席；不选座时由系统模拟配票。座位仅在提交成功后占用。
                </p>
              </div>
            </>
          ) : null}
          {inventoryError ? (
            <p role="alert" className="stock-warning">
              {inventoryError}，请重新选择日期后重试。
            </p>
          ) : !inventoryLoading &&
            remaining !== null &&
            remaining <= data.inventoryThreshold ? (
            <p className="stock-warning">
              {remaining === 0
                ? "所选日期或资源已约满，请更换日期或资源。"
                : "库存紧张，当前剩余" +
                  remaining +
                  (r.inventory_mode === "date" ? "；其他日期独立计算。" : "。")}
            </p>
          ) : null}
          <FormField label="备注 / 合作需求">
            <textarea
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="可填写人数、使用场景或定制要求"
            />
          </FormField>
          {data.user ? (
            <FormField label="使用演示优惠券">
              <select
                aria-label="使用演示优惠券"
                value={couponClaim}
                onChange={(e) => setCouponClaim(e.target.value)}
              >
                <option value="">不使用优惠券</option>
                {(data.benefits?.claims || [])
                  .filter(
                    (c) =>
                      c.status === "available" &&
                      c.min_spend <= r.price * Number(qty),
                  )
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} · 减{money(c.amount)}
                    </option>
                  ))}
              </select>
              <small>请先在“我的 → 模拟钱包与优惠券”领券；每单最多一张。</small>
            </FormField>
          ) : null}
          <div className="order-total">
            合计{" "}
            <strong>
              {money(
                Math.max(
                  0,
                  r.price * Number(qty || 1) -
                    ((data.benefits?.claims || []).find(
                      (c) => c.code === couponClaim,
                    )?.amount || 0),
                ),
              )}
            </strong>
          </div>
          <p className="note">所有支付均为模拟，不收取真实费用。</p>
          <SubmitButton
            busy={busy}
            disabled={
              busy || inventoryLoading || !!inventoryError || remaining === 0
            }
          >
            提交预约
          </SubmitButton>
        </form>
      ) : null}
      {tab === "comments" ? (
        <div className="detail-body">
          <div className="review-list">
            {comments.map((c) => (
              <div key={c.id}>
                <div>
                  <strong>{c.user_name}</strong>
                  <span className="stars">{"★".repeat(c.rating)}</span>
                </div>
                <p>{c.content}</p>
                {c.reply ? <blockquote>平台回复：{c.reply}</blockquote> : null}
              </div>
            ))}
            {!comments.length ? <Empty text="暂无已审核评论" /> : null}
          </div>
          <form onSubmit={comment} className="form">
            <h3>分享体验</h3>
            <div className="form-row">
              <FormField
                label={
                  r.category === "venue"
                    ? "设施质量"
                    : r.category === "equipment"
                      ? "设备质量"
                      : r.category === "show"
                        ? "演出质量"
                        : "资源质量"
                }
              >
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                >
                  {[5, 4, 3, 2, 1].map((v) => (
                    <option key={v} value={v}>
                      {v}分
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="服务体验">
                <select
                  value={serviceRating}
                  onChange={(e) => setServiceRating(e.target.value)}
                >
                  {[5, 4, 3, 2, 1].map((v) => (
                    <option key={v} value={v}>
                      {v}分
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="体验价值">
                <select
                  value={valueRating}
                  onChange={(e) => setValueRating(e.target.value)}
                >
                  {[5, 4, 3, 2, 1].map((v) => (
                    <option key={v} value={v}>
                      {v}分
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="评论内容">
              <textarea
                required
                maxLength={1000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </FormField>
            <SubmitButton busy={busy}>提交评论，等待审核</SubmitButton>
          </form>
        </div>
      ) : null}
    </Modal>
  );
}
