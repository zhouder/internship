import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useApp } from "./state";
import { Icon } from "./ui";

export const shortCategories = {
  show: "演出",
  venue: "场馆",
  artist: "艺人",
  equipment: "设备服务",
  copyright: "版权",
  heritage: "非遗",
  creative: "文创",
  digital: "数字演出",
  tourism: "文旅",
  service: "配套服务",
};
const slides = [
  {
    image: "/images/performance.webp",
    desktop: "/images/desktop-performance.webp",
    title: ["好戏广西，", "触手可及"],
    subtitle: "一站发现广西演艺与文化体验",
    cta: "发现演出",
    category: "show",
    alt: "壮乡舞者与广西山水，演艺主题生成示意图",
  },
  {
    image: "/images/hero-travel.webp",
    title: ["跟着演出，", "去旅行"],
    subtitle: "沿着山水与歌声，发现广西的另一面",
    cta: "发现文旅",
    category: "tourism",
    alt: "漓江山水与游船，文旅主题生成示意图",
  },
  {
    image: "/images/hero-craft.webp",
    title: ["指尖非遗，", "锦绣生活"],
    subtitle: "从一梭壮锦开始，走近广西的手艺",
    cta: "体验非遗",
    category: "heritage",
    alt: "传统壮锦织造工坊，非遗主题生成示意图",
  },
];

export function Hero({ onDiscover, desktop = false }) {
  const [active, setActive] = useState(0);
  const [autoPlay, setAutoPlay] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [dragging, setDragging] = useState(false);
  const [interaction, setInteraction] = useState(0);
  const pointer = useRef(null);
  const swiped = useRef(false);
  const carousel = useRef(null);
  const paused = hovered || keyboardFocused || dragging || !visible;
  const move = (direction) => {
    setActive(
      (current) => (current + direction + slides.length) % slides.length,
    );
    setInteraction((current) => current + 1);
  };
  useEffect(() => {
    const updateVisibility = () => setVisible(!document.hidden);
    // SVG children change when Play/Pause is toggled. Observe the real pointer
    // target too, so a removed child cannot leave the carousel stuck on hover.
    const updatePointer = (event) => {
      if (event.pointerType === "mouse")
        setHovered(Boolean(carousel.current?.contains(event.target)));
    };
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      if (motion.matches) setAutoPlay(false);
    };
    document.addEventListener("visibilitychange", updateVisibility);
    document.addEventListener("pointermove", updatePointer, { passive: true });
    motion.addEventListener("change", updateMotion);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      document.removeEventListener("pointermove", updatePointer);
      motion.removeEventListener("change", updateMotion);
    };
  }, []);
  useEffect(() => {
    if (!autoPlay || paused) return;
    const timer = window.setTimeout(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [active, autoPlay, paused, interaction]);
  useEffect(() => {
    if (!visible) return;
    const next = slides[(active + 1) % slides.length];
    const image = new Image();
    image.src = desktop ? next.desktop || next.image : next.image;
  }, [active, desktop, visible]);
  const slide = slides[active];
  return (
    <section
      ref={carousel}
      className={`market-hero ${desktop ? "desktop-hero" : "mobile-hero"}`}
      aria-roledescription="轮播图"
      aria-label="广西文化精选"
      role="region"
      tabIndex={0}
      data-active-slide={active}
      data-autoplay={autoPlay && !paused ? "playing" : "paused"}
      data-pause-reason={
        hovered
          ? "hover"
          : keyboardFocused
            ? "keyboard"
            : dragging
              ? "touch"
              : !visible
                ? "hidden"
                : ""
      }
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => {
        setHovered(false);
      }}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) setKeyboardFocused(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setKeyboardFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
      onPointerDown={(event) => {
        swiped.current = false;
        if (event.pointerType !== "mouse") {
          pointer.current = { x: event.clientX, y: event.clientY };
          setDragging(true);
        }
      }}
      onPointerCancel={() => {
        pointer.current = null;
        setDragging(false);
      }}
      onPointerUp={(event) => {
        if (!pointer.current) return;
        const dx = event.clientX - pointer.current.x;
        const dy = event.clientY - pointer.current.y;
        pointer.current = null;
        setDragging(false);
        if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          swiped.current = true;
          move(dx < 0 ? 1 : -1);
        }
      }}
      onClickCapture={(event) => {
        if (swiped.current) {
          event.preventDefault();
          event.stopPropagation();
          swiped.current = false;
        }
      }}
    >
      <img
        src={desktop ? slide.desktop || slide.image : slide.image}
        alt={slide.alt}
        fetchPriority="high"
      />
      <div className="hero-copy" aria-live={autoPlay ? "off" : "polite"}>
        <h1>
          {slide.title[0]}
          <br />
          {slide.title[1]}
        </h1>
        {desktop ? <p>{slide.subtitle}</p> : null}
        <button className="hero-cta" onClick={() => onDiscover(slide.category)}>
          {slide.cta}
          <ChevronRight size={19} />
        </button>
      </div>
      <button
        className="hero-arrow hero-previous"
        aria-label="上一张精选"
        onClick={() => move(-1)}
      >
        <ChevronLeft size={24} />
      </button>
      <button
        className="hero-arrow hero-next"
        aria-label="下一张精选"
        onClick={() => move(1)}
      >
        <ChevronRight size={24} />
      </button>
      <button
        className="hero-toggle"
        aria-label={autoPlay ? "暂停自动轮播" : "开启自动轮播"}
        title={autoPlay ? "暂停自动轮播" : "开启自动轮播"}
        onClick={() => {
          setAutoPlay((current) => !current);
          setKeyboardFocused(false);
        }}
      >
        {autoPlay ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div className="hero-dots" aria-label="切换精选主题">
        {slides.map((item, index) => (
          <button
            key={item.category}
            aria-label={`第${index + 1}张：${item.cta}`}
            aria-pressed={active === index}
            onClick={() => {
              setActive(index);
              setInteraction((current) => current + 1);
            }}
          />
        ))}
      </div>
    </section>
  );
}

export function Categories({ onSelect, desktop = false }) {
  const { data } = useApp();
  return (
    <nav
      className={`market-categories ${desktop ? "desktop-categories" : "mobile-categories"}`}
      aria-label="资源分类"
    >
      {data.categories.map((category) => (
        <button
          key={category.id}
          aria-label={category.name}
          onClick={() => onSelect(category.id)}
        >
          <span className="category-glyph">
            <Icon name={category.id} />
          </span>
          <span>{shortCategories[category.id]}</span>
        </button>
      ))}
    </nav>
  );
}

export function Stories({ onSelect, compact = false }) {
  return (
    <section
      className={`story-grid ${compact ? "compact-stories" : ""}`}
      aria-label="广西文化专题"
    >
      <button className="story-card" onClick={() => onSelect("tourism")}>
        <img
          src="/images/story-travel.webp"
          alt="广西山水步道与文化旅行示意图"
          loading="lazy"
        />
        <div>
          <span>山水之间 · 文化同行</span>
          <h2>
            跟着演出去旅行
            <ChevronRight />
          </h2>
        </div>
      </button>
      <button className="story-card" onClick={() => onSelect("heritage")}>
        <img
          src="/images/story-craft.webp"
          alt="广西绣球与传统手作示意图"
          loading="lazy"
        />
        <div>
          <span>一针一线 · 广西手艺</span>
          <h2>
            把广西的非遗带回家
            <ChevronRight />
          </h2>
        </div>
      </button>
    </section>
  );
}
