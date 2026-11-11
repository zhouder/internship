import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import {
  Search,
  X,
  MapPin,
  ChevronRight,
  Heart,
  Calendar,
  Layers,
  Users,
  Mic,
  Videotape,
  Palette,
  Landmark,
  Theater,
  Briefcase,
  ShoppingBag,
  Compass,
  Settings,
  Copyright,
  Flower,
  Gift,
  MonitorPlay,
  Mountain,
  LayoutGrid,
  Drama,
  MapPinned,
} from "lucide-react";
import { money, statusNames } from "./api";
export const categoryIcons = {
  show: Drama,
  venue: Landmark,
  artist: Users,
  equipment: Settings,
  copyright: Copyright,
  heritage: Flower,
  creative: Gift,
  digital: MonitorPlay,
  tourism: MapPinned,
  service: LayoutGrid,
};
const responsiveArtwork = new Set(
  [
    "venue-evening",
    "folk-performer",
    "ensemble",
    "heritage-workshop",
    "cultural-gifts",
    "stage-equipment",
    "river-evening",
    "digital-landscape",
    "venue",
  ].map((name) => `/images/${name}.webp`),
);
export function Icon({ name, ...props }) {
  const C = categoryIcons[name] || Layers;
  return <C size={21} strokeWidth={1.8} {...props} />;
}
export function Badge({ status, children }) {
  return (
    <span className={`badge status-${status || "neutral"}`}>
      {children || statusNames[status] || status}
    </span>
  );
}
export function Empty({ text = "暂无记录" }) {
  return (
    <div className="empty">
      <Layers size={32} />
      <p>{text}</p>
    </div>
  );
}
export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "搜索资源、订单、用户或关键词",
}) {
  return (
    <div className="search-box">
      <Search size={17} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value ? (
        <button
          type="button"
          className="icon-button"
          aria-label="清空搜索"
          onClick={() => onChange("")}
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}
export function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
const ModalDepth = createContext(0);
const openModals = [];
let savedBodyStyles;
const topModal = () =>
  openModals.reduce(
    (top, item) => (!top || item.depth >= top.depth ? item : top),
    null,
  );
export function Modal({
  title,
  onClose,
  children,
  wide = false,
  className = "",
}) {
  const depth = useContext(ModalDepth);
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useLayoutEffect(() => {
    const previous = document.activeElement;
    const entry = { depth, ref };
    if (!openModals.length) {
      savedBodyStyles = {
        overflow: document.body.style.overflow,
        paddingRight: document.body.style.paddingRight,
      };
      const gap = window.innerWidth - document.documentElement.clientWidth;
      if (gap > 0)
        document.body.style.paddingRight =
          (parseFloat(getComputedStyle(document.body).paddingRight) || 0) +
          gap +
          "px";
      document.body.style.overflow = "hidden";
    }
    openModals.push(entry);
    ref.current?.focus({ preventScroll: true });
    const handler = (e) => {
      if (topModal() !== entry) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const nodes = [
          ...(ref.current?.querySelectorAll(
            "button,input,textarea,select,[href],[tabindex]",
          ) || []),
        ].filter(
          (node) =>
            !node.disabled &&
            node.tabIndex >= 0 &&
            node.getClientRects().length &&
            !node.closest('[aria-hidden="true"]'),
        );
        if (!nodes.length) {
          e.preventDefault();
          ref.current?.focus();
          return;
        }
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !ref.current?.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      const index = openModals.indexOf(entry);
      if (index >= 0) openModals.splice(index, 1);
      if (!openModals.length && savedBodyStyles) {
        Object.assign(document.body.style, savedBodyStyles);
        savedBodyStyles = null;
      }
      document.removeEventListener("keydown", handler);
      if (
        previous?.isConnected &&
        (!topModal() || topModal().ref.current?.contains(previous))
      )
        previous.focus({ preventScroll: true });
    };
  }, [depth]);
  return createPortal(
    <ModalDepth.Provider value={depth + 1}>
      <div
        className="modal-backdrop"
        style={{ zIndex: 1000 + depth * 10 }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <section
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`modal ${wide ? "wide" : ""} ${className}`}
        >
          <header>
            <h2>{title}</h2>
            <button className="icon-button" aria-label="关闭" onClick={onClose}>
              <X />
            </button>
          </header>
          <div className="modal-body">{children}</div>
        </section>
      </div>
    </ModalDepth.Provider>,
    document.body,
  );
}
export function ResourceCard({
  resource: r,
  onOpen,
  onFavorite,
  favorite = false,
  compact = false,
  tile = false,
}) {
  const district = r.meta?.address?.includes("区")
    ? r.meta.address.replace(`${r.city}市`, "").replace(/[（(].*/, "")
    : "";
  return (
    <article
      className={`resource-card ${compact ? "compact" : ""} ${tile ? "resource-tile" : ""}`}
    >
      <button
        className="resource-image"
        onClick={() => onOpen(r)}
        aria-label={`查看${r.name}`}
      >
        <img
          src={r.image}
          srcSet={
            responsiveArtwork.has(r.image) ||
            /^\/images\/catalog\/r\d{3}\.webp$/.test(r.image)
              ? `${r.image.replace(/\.webp$/, "-card.webp")} 640w, ${r.image} 1536w`
              : undefined
          }
          sizes={
            tile
              ? "(max-width:560px) 46vw, (max-width:850px) 45vw, 320px"
              : "150px"
          }
          alt={r.name + " · 演示示意图"}
          loading="lazy"
        />
      </button>
      <div className="resource-content">
        <div className="resource-title">
          <button onClick={() => onOpen(r)}>{r.name}</button>
          {onFavorite ? (
            <button
              className={`icon-button ${favorite ? "favorite" : ""}`}
              aria-label={favorite ? "取消收藏" : "收藏"}
              onClick={() => onFavorite(r.id)}
            >
              <Heart size={18} fill={favorite ? "currentColor" : "none"} />
            </button>
          ) : null}
        </div>
        <p className="location">
          <MapPin size={13} />
          {r.city === "全区" ? "广西全区" : `${r.city}市`}
          {district ? ` · ${district}` : ""}
        </p>
        <div className="tags">
          {r.tags.slice(0, 2).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        {r.recommendationReason ? (
          <p className="recommendation-reason">{r.recommendationReason}</p>
        ) : null}
        {r.category === "service" ? (
          <small className="resource-hint">可预约 · 服务需求待确认</small>
        ) : r.low_stock ? (
          <small className="stock-warning">
            {r.stock === 0 ? "暂时无库存" : "库存紧张 · 剩余" + r.stock}
          </small>
        ) : null}
        {!compact ? (
          <div className="resource-bottom">
            <strong>
              {money(r.price).replace(/\.00$/, "")}
              <small>起</small>
            </strong>
            <button className="text-button" onClick={() => onOpen(r)}>
              查看详情
              <ChevronRight size={15} />
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
export function FormField({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function SubmitButton({ busy, children = "提交", ...props }) {
  return (
    <button className="button primary" disabled={busy} type="submit" {...props}>
      {busy ? "处理中…" : children}
    </button>
  );
}
