import { useEffect, useRef } from "react";
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
export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handler = (e) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll(
          "button,input,textarea,select,[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = saved;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
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
        className={`modal ${wide ? "wide" : ""}`}
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
