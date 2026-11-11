import { useState } from "react";
import {
  Home,
  BarChart3,
  Users,
  Bot,
  Layers,
  ClipboardList,
  ShoppingBag,
  ShieldCheck,
  Settings,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  ExternalLink,
} from "lucide-react";
import { useApp } from "./state";
import { SearchBox, Modal } from "./ui";
import { AdminLogin } from "./Login";
import { Mobile, Messages } from "./Mobile";
import { Desktop } from "./Marketplace";
import { Dashboard } from "./pages/Dashboard";
import { Resources, ResourceDetail } from "./pages/Resources";
import { Users as UsersPage } from "./pages/Users";
import { AI } from "./pages/AI";
import { Demands } from "./pages/Demands";
import { Transactions } from "./pages/Transactions";
import { Moderation } from "./pages/Moderation";
import { Settings as SettingsPage } from "./pages/Settings";
import { Operations } from "./pages/Operations";

const nav = [
  ["overview", "总览", Home],
  ["analytics", "数据分析", BarChart3],
  ["users", "用户画像", Users],
  ["ai", "AI工作台", Bot],
  ["resources", "演艺资源", Layers],
  ["demands", "需求大厅", ClipboardList],
  ["orders", "交易管理", ShoppingBag],
  ["operations", "票务与运营", ClipboardList],
  ["moderation", "内容审核", ShieldCheck],
  ["settings", "系统设置", Settings],
];
function Admin({ onOpen }) {
  const { data, logout } = useApp();
  const [page, setPage] = useState(
      nav.some(([k]) => k === location.hash.slice(1))
        ? location.hash.slice(1)
        : "overview",
    ),
    [query, setQuery] = useState(""),
    [messages, setMessages] = useState(false),
    [menu, setMenu] = useState(false),
    [account, setAccount] = useState(false);
  function navigate(key) {
    setPage(key);
    location.hash = key;
    setMenu(false);
    window.scrollTo({ top: 0 });
  }
  return (
    <div className="admin-app">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a href="/admin" className="sidebar-brand">
          <strong>桂演</strong>
          <span>广西演艺资源平台</span>
        </a>
        <nav aria-label="管理导航">
          {nav.map(([key, label, I]) => (
            <button
              key={key}
              aria-label={label}
              onClick={() => navigate(key)}
              className={page === key ? "active" : ""}
            >
              <I size={21} strokeWidth={1.8} />
              <span>{label}</span>
              {key === "moderation" &&
              data.comments.filter((c) => c.status === "pending").length +
                data.demands.filter((d) => d.status === "pending").length >
                0 ? (
                <small>
                  {data.comments.filter((c) => c.status === "pending").length +
                    data.demands.filter((d) => d.status === "pending").length}
                </small>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="online-dot" />
          实习演示环境
          <a href="/h5" target="_blank" rel="noreferrer">
            打开用户端
            <ExternalLink size={14} />
          </a>
        </div>
      </aside>
      {menu ? (
        <button
          className="sidebar-mask"
          aria-label="关闭导航"
          onClick={() => setMenu(false)}
        />
      ) : null}
      <div className="admin-workspace">
        <header className="topbar">
          <button
            className="icon-button sidebar-toggle"
            aria-label="展开导航"
            onClick={() => setMenu((v) => !v)}
          >
            <Menu />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate("resources");
            }}
          >
            <SearchBox value={query} onChange={setQuery} />
          </form>
          <div className="topbar-right">
            <button
              className="icon-button notification-button"
              aria-label="查看通知"
              onClick={() => setMessages(true)}
            >
              <Bell size={21} />
              {data.messages.some((m) => !m.is_read) ? <i /> : null}
            </button>
            <div className="account-wrap">
              <button
                className="account-button"
                onClick={() => setAccount((v) => !v)}
              >
                <span className="avatar">
                  <Users size={19} />
                </span>
                <strong>
                  管理员<span className="muted">（模拟数据）</span>
                </strong>
                <ChevronDown size={16} />
              </button>
              {account ? (
                <div className="account-menu">
                  <button onClick={logout}>
                    <LogOut size={16} />
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="admin-main">
          {page === "overview" ? (
            <Dashboard onNavigate={navigate} onOpen={onOpen} />
          ) : null}
          {page === "analytics" ? (
            <Dashboard analyticsPage onNavigate={navigate} onOpen={onOpen} />
          ) : null}
          {page === "resources" ? (
            <Resources onOpen={onOpen} query={query} onQueryChange={setQuery} />
          ) : null}
          {page === "users" ? <UsersPage /> : null}
          {page === "ai" ? <AI /> : null}
          {page === "demands" ? <Demands onOpen={onOpen} /> : null}
          {page === "orders" ? <Transactions /> : null}
          {page === "operations" ? <Operations /> : null}
          {page === "moderation" ? <Moderation /> : null}
          {page === "settings" ? <SettingsPage /> : null}
        </main>
      </div>
      {messages ? (
        <Modal title="平台消息" onClose={() => setMessages(false)} wide>
          <Messages />
        </Modal>
      ) : null}
    </div>
  );
}
export default function App() {
  const { data, error, refresh, logout } = useApp();
  const [detail, setDetail] = useState(null);
  const admin = location.pathname.startsWith("/admin");
  if (error)
    return (
      <div className="loading-screen">
        <h1>暂时无法连接服务</h1>
        <p>{error}</p>
        <button
          className="button primary"
          onClick={() => refresh().catch(() => {})}
        >
          重试
        </button>
        <p className="muted">请检查网络连接，稍后重试。</p>
      </div>
    );
  if (!data)
    return (
      <div className="loading-screen">
        <span className="brand-word">桂演</span>
        <div className="spinner" />
        <p>正在加载演艺资源…</p>
      </div>
    );
  if (admin && !data.user) return <AdminLogin />;
  if (admin && data.user.role !== "admin")
    return (
      <div className="loading-screen">
        <h1>需要管理员账号</h1>
        <p>请使用 admin / admin123 登录管理后台。</p>
        <button className="button primary" onClick={logout}>
          切换账号
        </button>
      </div>
    );
  const open = (resource, onNeedLogin, onBooked, channel) =>
    setDetail({ resource, onNeedLogin, onBooked, channel });
  return (
    <>
      {admin ? (
        <Admin onOpen={open} />
      ) : location.pathname.startsWith("/h5") ? (
        <Mobile onOpen={open} />
      ) : (
        <Desktop onOpen={open} />
      )}
      {detail ? (
        <ResourceDetail {...detail} onClose={() => setDetail(null)} />
      ) : null}
    </>
  );
}
