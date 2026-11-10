import { useState } from "react";
import { ChevronRight } from "lucide-react";
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
    image: "/images/river-evening.webp",
    title: ["跟着演出，", "去旅行"],
    subtitle: "沿着山水与歌声，发现广西的另一面",
    cta: "发现文旅",
    category: "tourism",
    alt: "漓江山水与滨水演出，文旅主题生成示意图",
  },
  {
    image: "/images/heritage-workshop.webp",
    title: ["指尖非遗，", "锦绣生活"],
    subtitle: "从一梭壮锦开始，走近广西的手艺",
    cta: "体验非遗",
    category: "heritage",
    alt: "传统壮锦织造工坊，非遗主题生成示意图",
  },
];

export function Hero({ onDiscover, desktop = false }) {
  const [active, setActive] = useState(0);
  const slide = slides[active];
  return (
    <section
      className={`market-hero ${desktop ? "desktop-hero" : "mobile-hero"}`}
      aria-roledescription="轮播图"
      aria-label="广西文化精选"
    >
      <img
        src={desktop ? slide.desktop || slide.image : slide.image}
        alt={slide.alt}
        fetchPriority="high"
      />
      <div className="hero-copy">
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
      <div className="hero-dots" aria-label="切换精选主题">
        {slides.map((item, index) => (
          <button
            key={item.category}
            aria-label={`第${index + 1}张：${item.cta}`}
            aria-pressed={active === index}
            onClick={() => setActive(index)}
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
          src="/images/river-evening.webp"
          alt="漓江山水与夜色示意图"
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
          src="/images/heritage-workshop.webp"
          alt="壮锦织造示意图"
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
