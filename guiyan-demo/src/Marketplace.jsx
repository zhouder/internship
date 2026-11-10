import { useState } from "react";
import {
  ChevronDown,
  Bell,
  ArrowUpRight,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { useApp } from "./state";
import { LoginModal } from "./Login";
import { SearchBox, ResourceCard, Empty, Modal } from "./ui";
import { Profile, Messages } from "./Mobile";
import { Demands } from "./pages/Demands";
import { Transactions } from "./pages/Transactions";
import { AI } from "./pages/AI";
import { money } from "./api";

export { Hero, Categories, Stories } from "./MarketComponents";
import { Hero, Categories, Stories, shortCategories } from "./MarketComponents";

const helpContent = {
  关于桂演:
    "桂演连接广西演出、场馆、艺人及文化服务资源，帮助用户发现演出、预约体验和发布合作需求。本网站为毕业实习演示系统，资源、价格、评价和身份均为模拟数据，图片为AI生成示意，不代表真实商家承诺。",
  预约与退款:
    "打开资源详情，选择日期与数量提交预约。后台确认后可进行模拟支付；需要退订时，在“我的订单”申请退款，等待后台处理。演示系统不收取真实费用。",
  合作与资源入驻:
    "可在需求大厅发布合作需求，说明预算、城市和活动内容。资源合作方账号可体验资源管理功能；内容审核通过后再对其他用户展示。",
  隐私与使用说明:
    "请使用演示账号和虚构信息测试，不上传身份证、银行卡或真实客户资料。支付、AI、授权和第三方渠道均为模拟功能。",
};

export function Desktop({ onOpen }) {
  const { data, action } = useApp();
  const [page, setPage] = useState(() =>
    [
      "resources",
      "demands",
      "profile",
      "orders",
      "favorites",
      "messages",
      "ai",
      "topics",
    ].includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : "home",
  );
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState("default");
  const [login, setLogin] = useState(false);
  const [help, setHelp] = useState("");
  const [limit, setLimit] = useState(12);
  const [featured, setFeatured] = useState("");
  function navigate(next) {
    if (
      ["orders", "favorites", "messages", "ai"].includes(next) &&
      !data.user
    ) {
      setLogin(true);
      return;
    }
    setPage(next);
    location.hash = next === "home" ? "" : next;
    window.scrollTo({ top: 0 });
  }
  function discover(id = "") {
    setCategory(id);
    setQuery("");
    setLimit(12);
    navigate("resources");
  }
  function favorite(id) {
    if (!data.user) {
      setLogin(true);
      return;
    }
    action(
      "/favorites",
      { resourceId: id },
      data.favorites.includes(id) ? "已取消收藏" : "已收藏",
    );
  }
  const open = (resource) =>
    onOpen(
      resource,
      () => setLogin(true),
      () => navigate("orders"),
      "电脑网页",
    );
  const matching = data.resources.filter(
    (resource) =>
      (!category || resource.category === category) &&
      (!city || resource.city === city) &&
      (!query ||
        (resource.name + resource.description + resource.tags.join(""))
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const resources =
    sort === "price"
      ? [...matching].sort((a, b) => a.price - b.price)
      : sort === "rating"
        ? [...matching].sort((a, b) => b.rating - a.rating)
        : data.user
          ? [...matching].sort(
              (a, b) =>
                Number(b.category === data.user.preference) -
                Number(a.category === data.user.preference),
            )
          : matching;
  const selectedNames = [
    "广西文化艺术中心",
    "民族歌舞剧《刘三姐》",
    "一梭一锦·壮锦织造体验",
    "八桂弦歌·民族室内乐专场",
  ];
  const selected = featured
    ? data.resources
        .filter((resource) => resource.category === featured)
        .slice(0, 4)
    : selectedNames
        .map((name) =>
          data.resources.find((resource) => resource.name === name),
        )
        .filter(Boolean);
  const moreBase = ["artist", "creative", "digital", "tourism"].flatMap((id) =>
    data.resources.filter((resource) => resource.category === id).slice(-2),
  );
  const more = data.user
    ? [
        ...data.resources
          .filter((resource) => resource.category === data.user.preference)
          .slice(-2),
        ...moreBase.filter(
          (resource) => resource.category !== data.user.preference,
        ),
      ].slice(0, 8)
    : moreBase;
  const card = (resource) => (
    <ResourceCard
      key={resource.id}
      resource={resource}
      onOpen={open}
      onFavorite={favorite}
      favorite={data.favorites.includes(resource.id)}
      tile
    />
  );
  return (
    <div className="website-app">
      <div className="utility-bar">
        <div className="site-container">
          <span>广西演艺资源平台</span>
          <div>
            <button onClick={() => navigate("orders")}>我的订单</button>
            <button onClick={() => setHelp("预约与退款")}>帮助中心</button>
          </div>
        </div>
      </div>
      <header className="website-header">
        <div className="site-container website-header-inner">
          <a className="site-wordmark" href="/web" aria-label="桂演首页">
            桂演
          </a>
          <label className="site-city">
            <span className="sr-only">所在城市</span>
            <select
              aria-label="所在城市"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            >
              <option value="">南宁</option>
              {["南宁", "柳州", "桂林", "北海", "崇左", "河池"].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
          <nav className="website-nav" aria-label="网站导航">
            {[
              ["home", "首页"],
              ["resources", "演艺资源"],
              ["demands", "需求大厅"],
              ["topics", "文旅专题"],
            ].map(([key, text]) => (
              <button
                key={key}
                className={page === key ? "active" : ""}
                onClick={() => {
                  if (key === "resources") {
                    setCategory("");
                    setQuery("");
                    setLimit(12);
                  }
                  navigate(key);
                }}
              >
                {text}
              </button>
            ))}
          </nav>
          <form
            className="website-search"
            onSubmit={(event) => {
              event.preventDefault();
              setCategory("");
              setLimit(12);
              navigate("resources");
            }}
          >
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="演出、场馆、艺人"
            />
          </form>
          <button
            className="icon-button website-bell"
            aria-label="查看消息"
            onClick={() => navigate("messages")}
          >
            <Bell size={21} />
          </button>
          {data.user ? (
            <button
              className="site-account"
              onClick={() => navigate("profile")}
            >
              <span>{data.user.name.slice(0, 1)}</span>
              {data.user.name}
            </button>
          ) : (
            <button
              className="button primary website-login"
              onClick={() => setLogin(true)}
            >
              登录 / 注册
            </button>
          )}
        </div>
      </header>
      <main>
        {page === "home" ? (
          <>
            <Hero desktop onDiscover={discover} />
            <div className="site-container">
              <Categories desktop onSelect={discover} />
              <section className="featured-section">
                <div className="site-section-title">
                  <h2>本周精选</h2>
                  <div className="featured-tabs" aria-label="精选筛选">
                    {[
                      ["", "全部"],
                      ["show", "热门演出"],
                      ["heritage", "非遗体验"],
                      ["venue", "场馆空间"],
                    ].map(([key, text]) => (
                      <button
                        key={key}
                        className={featured === key ? "active" : ""}
                        onClick={() => setFeatured(key)}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="catalog-grid">{selected.map(card)}</div>
                {!selected.length ? (
                  <Empty text="当前城市暂无相关资源，试试其他分类" />
                ) : null}
              </section>
              <Stories onSelect={discover} />
              <section className="discovery-section">
                <div className="site-section-title">
                  <div>
                    <h2>{data.user ? "为你推荐" : "发现更多好戏"}</h2>
                    <p>
                      {data.user
                        ? "根据你的兴趣，发现更多演出与文化体验"
                        : "从一场演出开始，遇见广西的万种精彩"}
                    </p>
                  </div>
                  <button className="text-button" onClick={() => discover()}>
                    探索全部资源
                    <ArrowRight size={17} />
                  </button>
                </div>
                <div className="catalog-grid">{more.map(card)}</div>
              </section>
              <section className="cooperation-section">
                <div className="site-section-title">
                  <div>
                    <h2>让好资源，遇见好伙伴</h2>
                    <p>看看大家正在寻找什么，一起促成下一场精彩</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("demands")}
                  >
                    更多合作需求
                    <ArrowRight size={17} />
                  </button>
                </div>
                <div className="cooperation-grid">
                  {data.demands
                    .filter((demand) => demand.status === "approved")
                    .slice(-3)
                    .map((demand) => (
                      <button
                        key={demand.id}
                        className="cooperation-card"
                        onClick={() => navigate("demands")}
                      >
                        <span>
                          {shortCategories[demand.category]}合作
                          <ArrowUpRight size={18} />
                        </span>
                        <h3>{demand.title}</h3>
                        <p>{demand.description}</p>
                        <div>
                          <small>
                            <MapPin size={13} />
                            {demand.city}
                          </small>
                          <strong>
                            {money(demand.budget).replace(/\.00$/, "")}
                            <small>预算</small>
                          </strong>
                        </div>
                      </button>
                    ))}
                </div>
              </section>
            </div>
          </>
        ) : null}
        {page === "resources" || page === "favorites" ? (
          <div className="site-container website-page">
            <div className="site-section-title">
              <div>
                <h1>{page === "favorites" ? "我的收藏" : "演艺资源"}</h1>
                <p>找到下一场好戏，也找到每一种文化所需</p>
              </div>
              <span className="muted">
                {page === "favorites"
                  ? data.favorites.length
                  : resources.length}{" "}
                项资源
              </span>
            </div>
            {page === "resources" ? (
              <>
                <div className="category-tabs website-category-tabs">
                  <button
                    className={!category ? "active" : ""}
                    onClick={() => {
                      setCategory("");
                      setLimit(12);
                    }}
                  >
                    全部资源
                  </button>
                  {data.categories.map((item) => (
                    <button
                      key={item.id}
                      className={category === item.id ? "active" : ""}
                      onClick={() => {
                        setCategory(item.id);
                        setLimit(12);
                      }}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
                <div className="website-filter-row">
                  <span>
                    {category
                      ? data.categories.find((item) => item.id === category)
                          ?.name
                      : "全部分类"}
                  </span>
                  <div>
                    <select
                      aria-label="城市筛选"
                      value={city}
                      onChange={(event) => {
                        setCity(event.target.value);
                        setLimit(12);
                      }}
                    >
                      <option value="">全部城市</option>
                      {[
                        "南宁",
                        "柳州",
                        "桂林",
                        "北海",
                        "崇左",
                        "河池",
                        "全区",
                      ].map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                    <select
                      aria-label="资源排序"
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                    >
                      <option value="default">推荐排序</option>
                      <option value="price">价格从低到高</option>
                      <option value="rating">评分从高到低</option>
                    </select>
                  </div>
                </div>
              </>
            ) : null}
            <div className="catalog-grid">
              {(page === "favorites"
                ? data.resources.filter((resource) =>
                    data.favorites.includes(resource.id),
                  )
                : resources.slice(0, limit)
              ).map(card)}
            </div>
            {(page === "favorites" && !data.favorites.length) ||
            (page === "resources" && !resources.length) ? (
              <Empty text="暂无符合条件的资源" />
            ) : null}
            {page === "resources" && resources.length > limit ? (
              <button
                className="button load-more"
                onClick={() => setLimit((value) => value + 12)}
              >
                加载更多资源
                <ChevronDown size={17} />
              </button>
            ) : null}
          </div>
        ) : null}
        {page === "topics" ? (
          <div className="site-container website-page">
            <div className="site-section-title">
              <div>
                <h1>在广西，与美好相遇</h1>
                <p>让舞台延伸到山水之间，让手艺走进日常生活</p>
              </div>
            </div>
            <Stories onSelect={discover} />
            <section className="discovery-section">
              <div className="site-section-title">
                <h2>文化旅行灵感</h2>
              </div>
              <div className="catalog-grid">
                {data.resources
                  .filter((resource) =>
                    ["tourism", "heritage", "creative"].includes(
                      resource.category,
                    ),
                  )
                  .slice(-12)
                  .map(card)}
              </div>
            </section>
          </div>
        ) : null}
        {page === "demands" ? (
          <div className="site-container website-page">
            <Demands onNeedLogin={() => setLogin(true)} onOpen={open} />
          </div>
        ) : null}
        {page === "profile" ? (
          <div className="site-container website-page website-profile">
            <Profile onLogin={() => setLogin(true)} onNavigate={navigate} />
          </div>
        ) : null}
        {page === "orders" ? (
          <div className="site-container website-page">
            <Transactions />
          </div>
        ) : null}
        {page === "messages" ? (
          <div className="site-container website-page">
            <Messages />
          </div>
        ) : null}
        {page === "ai" ? (
          <div className="site-container website-page">
            <AI />
          </div>
        ) : null}
      </main>
      <footer className="website-footer">
        <div className="site-container footer-main">
          <div className="footer-brand">
            <a className="site-wordmark" href="/web">
              桂演
            </a>
            <p>好戏广西，触手可及</p>
            <span>连接舞台与生活，发现身边的文化之美。</span>
          </div>
          <div>
            <h3>发现广西</h3>
            <button onClick={() => discover("show")}>演出与剧目</button>
            <button onClick={() => discover("heritage")}>非遗与手作</button>
            <button onClick={() => discover("tourism")}>文化与旅行</button>
          </div>
          <div>
            <h3>用户服务</h3>
            <button onClick={() => navigate("orders")}>我的订单</button>
            <button onClick={() => setHelp("预约与退款")}>预约与退款</button>
            <button onClick={() => setHelp("合作与资源入驻")}>
              合作与入驻
            </button>
          </div>
          <div>
            <h3>关于平台</h3>
            <button onClick={() => setHelp("关于桂演")}>关于桂演</button>
            <button onClick={() => setHelp("隐私与使用说明")}>
              隐私与使用说明
            </button>
            <a href="/admin">
              管理后台
              <ArrowUpRight size={12} />
            </a>
            <a href="/h5">
              H5 手机端
              <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
        <div className="site-container footer-note">
          © 2026 桂演 · 广西演艺资源平台
          <span>毕业实习演示 · 模拟数据 · AI生成示意图片 · 无真实交易</span>
        </div>
      </footer>
      {login ? <LoginModal onClose={() => setLogin(false)} /> : null}
      {help ? (
        <Modal title={help} onClose={() => setHelp("")}>
          <p className="help-copy">{helpContent[help]}</p>
        </Modal>
      ) : null}
    </div>
  );
}
