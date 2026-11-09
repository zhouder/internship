import { useState } from "react";
import {
  Home,
  Layers,
  ClipboardList,
  User,
  Search,
  ChevronRight,
  MapPin,
  Bell,
  Heart,
  MessageCircle,
  Bot,
  LogOut,
  Settings,
  CheckCircle,
  Compass,
  ExternalLink,
} from "lucide-react";
import { useApp } from "./state";
import { api } from "./api";
import { LoginModal } from "./Login";
import {
  SearchBox,
  ResourceCard,
  Icon,
  Empty,
  FormField,
  SubmitButton,
  Badge,
  Modal,
  PageTitle,
} from "./ui";
import { Demands, MessageForm } from "./pages/Demands";
import { Transactions } from "./pages/Transactions";
import { AI } from "./pages/AI";

function Profile({ onLogin, onNavigate }) {
  const { data, action, logout, busy } = useApp();
  const [edit, setEdit] = useState(false),
    [message, setMessage] = useState(false),
    [f, setF] = useState({
      name: data.user?.name || "",
      city: data.user?.city || "南宁",
      preference: data.user?.preference || "show",
    });
  if (!data.user)
    return (
      <div className="guest-profile">
        <div className="avatar large">
          <User />
        </div>
        <h2>登录，发现更多好戏</h2>
        <p>收藏喜欢的资源，管理预约与合作需求</p>
        <button className="button primary" onClick={onLogin}>
          登录 / 注册
        </button>
      </div>
    );
  const items = [
    ["我的订单", "orders", ClipboardList, data.orders.length],
    ["我的收藏", "favorites", Heart, data.favorites.length],
    [
      "消息与私信",
      "messages",
      MessageCircle,
      data.messages.filter((m) => !m.is_read).length,
    ],
    ["智能客服", "ai", Bot, ""],
    ["个人资料与偏好", "edit", Settings, ""],
  ];
  return (
    <>
      <div className="user-banner">
        <div className="avatar large">{data.user.name[0]}</div>
        <div>
          <h2>{data.user.name}</h2>
          <p>
            {data.user.city} ·{" "}
            {data.user.role === "supplier" ? "资源合作方" : "文化体验者"}
          </p>
        </div>
        <Badge>{data.user.verified ? "演示已认证" : "未认证"}</Badge>
      </div>
      <div className="profile-menu">
        {items.map(([label, key, I, count]) => (
          <button
            key={key}
            onClick={() => {
              if (key === "edit") setEdit(true);
              else onNavigate(key);
            }}
          >
            <I size={20} />
            <span>{label}</span>
            {count ? <b>{count}</b> : null}
            <ChevronRight size={16} />
          </button>
        ))}
        <button onClick={() => setMessage(true)}>
          <MessageCircle size={20} />
          <span>发起合作私信</span>
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() =>
            action("/profile", { verify: true }, "演示身份认证完成", "PATCH")
          }
        >
          <CheckCircle size={20} />
          <span>
            {data.user.verified ? "查看认证说明" : "完成演示身份认证"}
          </span>
          <small>无需真实证件</small>
        </button>
        <button onClick={logout}>
          <LogOut size={20} />
          <span>退出登录</span>
        </button>
      </div>
      <p className="note mobile-note">
        所有身份、订单、AI、支付与对接结果均为模拟。资源图片为生成示意图。
      </p>
      <a href="/admin" className="admin-entry">
        进入管理后台
        <ExternalLink size={13} />
      </a>
      {message ? <MessageForm onClose={() => setMessage(false)} /> : null}
      {edit ? (
        <Modal title="个人资料与偏好" onClose={() => setEdit(false)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await action(
                "/profile",
                f,
                "资料已保存，首页推荐已更新",
                "PATCH",
              );
              if (r) setEdit(false);
            }}
          >
            <FormField label="昵称">
              <input
                required
                maxLength={30}
                value={f.name}
                onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))}
              />
            </FormField>
            <FormField label="城市">
              <select
                value={f.city}
                onChange={(e) => setF((x) => ({ ...x, city: e.target.value }))}
              >
                {["南宁", "柳州", "桂林", "北海"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField label="兴趣偏好">
              <select
                value={f.preference}
                onChange={(e) =>
                  setF((x) => ({ ...x, preference: e.target.value }))
                }
              >
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>
            <SubmitButton busy={busy}>保存偏好</SubmitButton>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
export function Messages() {
  const { data, action } = useApp();
  return (
    <>
      <PageTitle title="消息与私信">
        <button
          className="text-button"
          onClick={() => action("/messages/read", {}, "消息已全部标为已读")}
        >
          全部已读
        </button>
      </PageTitle>
      <div className="message-list">
        {data.messages.map((m) => (
          <article key={m.id} className={m.is_read ? "" : "unread"}>
            <div>
              <MessageCircle size={19} />
              <h3>{m.title}</h3>
              {!m.is_read ? <i /> : null}
            </div>
            <p>{m.content}</p>
            <small>
              {m.sender_name || "平台"} · {m.created_at.slice(0, 10)}
            </small>
          </article>
        ))}
        {!data.messages.length ? <Empty text="暂无消息" /> : null}
      </div>
    </>
  );
}
export function Mobile({ onOpen }) {
  const { data, action, setToast } = useApp();
  const [page, setPage] = useState("home"),
    [category, setCategory] = useState(""),
    [query, setQuery] = useState(""),
    [city, setCity] = useState(""),
    [sort, setSort] = useState("default"),
    [login, setLogin] = useState(false);
  const mini = location.pathname.startsWith("/mini"),
    channel = mini ? "微信小程序" : "H5";
  function navigate(target) {
    if (
      ["orders", "favorites", "messages", "ai"].includes(target) &&
      !data.user
    ) {
      setLogin(true);
      return;
    }
    setPage(target);
    window.scrollTo({ top: 0 });
  }
  const favorite = (id) => {
    if (!data.user) {
      setLogin(true);
      return;
    }
    action(
      "/favorites",
      { resourceId: id },
      data.favorites.includes(id) ? "已取消收藏" : "已收藏",
    );
  };
  const open = (r) =>
    onOpen(
      r,
      () => setLogin(true),
      () => navigate("orders"),
      channel,
    );
  let resources = data.resources.filter(
    (r) =>
      (!category || r.category === category) &&
      (!city || r.city === city) &&
      (!query || (r.name + r.description + r.tags.join("")).includes(query)),
  );
  if (sort === "price")
    resources = [...resources].sort((a, b) => a.price - b.price);
  else if (sort === "rating")
    resources = [...resources].sort((a, b) => b.rating - a.rating);
  else if (data.user)
    resources = [...resources].sort(
      (a, b) =>
        Number(b.category === data.user.preference) -
        Number(a.category === data.user.preference),
    );
  const home = page === "home",
    listing = page === "resources" || page === "favorites";
  return (
    <div className="mobile-canvas">
      <div className="mobile-shell">
        {mini ? (
          <div className="mini-status">
            <span>10:24</span>
            <span>微信小程序 · 网页预览</span>
            <span>▰</span>
          </div>
        ) : null}
        <header className="mobile-header">
          <div className="mobile-top">
            <a className="mobile-brand" href="/h5">
              桂演
            </a>
            <button
              className="city-button"
              onClick={() => {
                const cities = ["", "南宁", "柳州", "桂林", "北海"];
                setCity(cities[(cities.indexOf(city) + 1) % cities.length]);
              }}
            >
              {city || "全区"}⌄
            </button>
            <div className="mobile-top-right">
              {mini ? (
                <span className="wechat-capsule">•••　◉</span>
              ) : (
                <button
                  aria-label="消息"
                  className="icon-button"
                  onClick={() => navigate("messages")}
                >
                  <Bell size={20} />
                  {data.messages.some((m) => !m.is_read) ? <i /> : null}
                </button>
              )}
            </div>
          </div>
          {home || listing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigate("resources");
              }}
            >
              <SearchBox
                value={query}
                onChange={setQuery}
                placeholder="演出、场馆、艺人"
              />
            </form>
          ) : null}
        </header>
        <main className={`mobile-main page-${page}`}>
          {home ? (
            <>
              <section className="mobile-hero">
                <img
                  src="/images/performance.png"
                  alt="壮族民族歌舞演出示意图"
                />
                <h1>好戏广西，触手可及</h1>
                <button
                  onClick={() => {
                    setCategory("show");
                    navigate("resources");
                  }}
                >
                  发现演出
                  <ChevronRight size={14} />
                </button>
              </section>
              <div className="mobile-categories">
                {data.categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCategory(c.id);
                      navigate("resources");
                    }}
                  >
                    <span>
                      <Icon name={c.id} />
                    </span>
                    {c.name}
                  </button>
                ))}
              </div>
              <section className="mobile-recommend">
                <div className="section-title">
                  <h2>{data.user ? "为你推荐" : "推荐资源"}</h2>
                  <button
                    className="text-button"
                    onClick={() => {
                      setCategory("");
                      navigate("resources");
                    }}
                  >
                    查看更多
                    <ChevronRight size={14} />
                  </button>
                </div>
                {resources.slice(0, 5).map((r) => (
                  <ResourceCard
                    key={r.id}
                    resource={r}
                    onOpen={open}
                    onFavorite={favorite}
                    favorite={data.favorites.includes(r.id)}
                  />
                ))}
              </section>
              <p className="note mobile-note">
                毕业实习演示 · 模拟数据与示意图片
              </p>
            </>
          ) : null}
          {listing ? (
            <section className="mobile-section">
              <div className="section-title">
                <h1>{page === "favorites" ? "我的收藏" : "演艺资源"}</h1>
                <span className="muted">
                  {page === "favorites"
                    ? data.favorites.length
                    : resources.length}
                  项
                </span>
              </div>
              {page === "resources" ? (
                <>
                  <div className="category-tabs mobile-tabs">
                    <button
                      className={!category ? "active" : ""}
                      onClick={() => setCategory("")}
                    >
                      全部
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
                  <div className="filter-bar">
                    <select
                      aria-label="城市"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      <option value="">全部城市</option>
                      {["南宁", "柳州", "桂林", "北海", "崇左", "全区"].map(
                        (c) => (
                          <option key={c}>{c}</option>
                        ),
                      )}
                    </select>
                    <select
                      aria-label="排序"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="default">推荐排序</option>
                      <option value="price">价格最低</option>
                      <option value="rating">评分最高</option>
                    </select>
                  </div>
                </>
              ) : null}
              {(page === "favorites"
                ? data.resources.filter((r) => data.favorites.includes(r.id))
                : resources
              ).map((r) => (
                <ResourceCard
                  key={r.id}
                  resource={r}
                  onOpen={open}
                  onFavorite={favorite}
                  favorite={data.favorites.includes(r.id)}
                />
              ))}
              {(page === "favorites" && !data.favorites.length) ||
              (page === "resources" && !resources.length) ? (
                <Empty text="暂无符合条件的资源" />
              ) : null}
            </section>
          ) : null}
          {page === "demands" ? (
            <div className="mobile-section">
              <Demands onNeedLogin={() => setLogin(true)} onOpen={open} />
            </div>
          ) : null}
          {page === "profile" ? (
            <Profile onLogin={() => setLogin(true)} onNavigate={navigate} />
          ) : null}
          {page === "orders" ? (
            <div className="mobile-section">
              <Transactions mobile />
            </div>
          ) : null}
          {page === "messages" ? (
            <div className="mobile-section">
              <Messages />
            </div>
          ) : null}
          {page === "ai" ? (
            <div className="mobile-section">
              <AI mobile />
            </div>
          ) : null}
        </main>
        <nav className="mobile-nav" aria-label="用户端导航">
          {[
            ["home", "发现", Home],
            ["resources", "资源", Layers],
            ["demands", "需求", ClipboardList],
            ["profile", "我的", User],
          ].map(([key, label, I]) => (
            <button
              key={key}
              className={
                page === key ||
                (key === "profile" &&
                  ["orders", "favorites", "messages", "ai"].includes(page))
                  ? "active"
                  : ""
              }
              onClick={() => {
                if (key === "resources") setCategory("");
                navigate(key);
              }}
            >
              <I size={22} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
      <aside className="desktop-mobile-links">
        <span className="brand-word">桂演</span>
        <p>广西演艺资源平台</p>
        <a className={mini ? "" : "active"} href="/h5">
          H5 用户端
        </a>
        <a className={mini ? "active" : ""} href="/mini">
          小程序界面预览
        </a>
        <a href="/admin">
          电脑管理后台
          <ExternalLink size={14} />
        </a>
        <small>
          原生微信小程序源码位于
          <br />
          miniprogram 文件夹
        </small>
      </aside>
      {login ? <LoginModal onClose={() => setLogin(false)} /> : null}
    </div>
  );
}
