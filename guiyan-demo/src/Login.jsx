import { useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useApp } from "./state";
import { api } from "./api";
import { Modal, FormField, SubmitButton } from "./ui";
export function LoginForm({ admin = false, onDone }) {
  const { login, setToast } = useApp();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [username, setUsername] = useState(admin ? "admin" : "demo"),
    [password, setPassword] = useState(admin ? "admin123" : "demo123"),
    [name, setName] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (register) {
        await api("/register", {
          method: "POST",
          body: {
            username,
            password,
            name,
            channel: location.pathname.startsWith("/h5") ? "H5" : "电脑网页",
          },
        });
        setToast("注册成功，正在登录");
      }
      const ok = await login(username, password);
      if (ok) onDone?.();
    } catch (e) {
      setToast(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      <FormField label="账号">
        <input
          autoComplete="username"
          required
          minLength={3}
          maxLength={30}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </FormField>
      {register ? (
        <FormField label="昵称">
          <input
            required
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
      ) : null}
      <FormField label="密码">
        <input
          type="password"
          autoComplete={register ? "new-password" : "current-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </FormField>
      <SubmitButton busy={busy}>
        {register ? "注册并登录" : "登录"}
      </SubmitButton>
      {!admin ? (
        <button
          className="text-button centered"
          type="button"
          onClick={() => setRegister((v) => !v)}
        >
          {register ? "已有账号，返回登录" : "创建演示账号"}
        </button>
      ) : null}
      <div className="demo-accounts">
        <strong>演示账号</strong>
        <p>{admin ? "管理员：admin / admin123" : "普通用户：demo / demo123"}</p>
        {!admin ? <p>资源方：supplier / demo123</p> : null}
        <small>使用虚构数据，无真实支付。</small>
      </div>
    </form>
  );
}
export function LoginModal({ onClose }) {
  return (
    <Modal title="登录桂演" onClose={onClose}>
      <LoginForm onDone={onClose} />
    </Modal>
  );
}
export function AdminLogin() {
  return (
    <div className="login-page">
      <div className="login-intro">
        <a href="/h5" className="back-link">
          <ArrowLeft size={16} />
          用户端
        </a>
        <span className="login-brand">桂演</span>
        <h1>
          连接广西好戏
          <br />
          与每一份热爱
        </h1>
        <p>广西演艺资源平台 · 运营管理中心</p>
        <img src="/images/performance.png" alt="民族歌舞演出示意图" />
      </div>
      <section className="login-box">
        <div className="login-mark">
          <ShieldCheck size={28} />
        </div>
        <h2>欢迎登录管理后台</h2>
        <p className="muted">管理资源、协作与运营数据</p>
        <LoginForm admin />
      </section>
    </div>
  );
}
