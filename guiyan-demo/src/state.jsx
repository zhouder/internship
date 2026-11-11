import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { api, tokenKey } from "./api";
const Context = createContext(null);
export function Provider({ children }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [connectionLost, setConnectionLost] = useState(false);
  const generation = useRef(0),
    currentData = useRef(null),
    pendingActions = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current,
      key = tokenKey(),
      identity = localStorage.getItem(key);
    try {
      const next = await api("/bootstrap");
      if (
        request === generation.current &&
        identity === localStorage.getItem(key)
      ) {
        if (identity && !next.user) localStorage.removeItem(key);
        currentData.current = next;
        setData(next);
        setError("");
        setConnectionLost(false);
      }
      return next;
    } catch (e) {
      if (
        request === generation.current &&
        identity === localStorage.getItem(key)
      ) {
        if (currentData.current) setConnectionLost(true);
        else setError(e.message);
      }
      throw e;
    }
  }, []);
  useEffect(() => {
    refresh().catch(() => {});
    const expired = () => {
      generation.current++;
      currentData.current = null;
      setData(null);
      setError("");
      setToast("登录已过期，请重新登录");
      refresh().catch(() => {});
    };
    window.addEventListener("guiyan:session-expired", expired);
    return () => window.removeEventListener("guiyan:session-expired", expired);
  }, [refresh]);
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh().catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(id);
  }, [toast]);
  async function action(path, body, message, method = "POST") {
    pendingActions.current++;
    setBusy(true);
    try {
      const result = await api(path, { method, body });
      try {
        await refresh();
        if (message || result.message) setToast(message || result.message);
      } catch {
        setToast(
          "操作已成功，但页面数据刷新失败；请恢复网络后刷新，勿重复提交",
        );
      }
      return result;
    } catch (e) {
      if (e.status === 409) await refresh().catch(() => {});
      setToast(e.message);
      return null;
    } finally {
      pendingActions.current--;
      setBusy(pendingActions.current > 0);
    }
  }
  async function login(username, password) {
    try {
      const r = await api("/login", {
        method: "POST",
        body: { username, password },
      });
      localStorage.setItem(tokenKey(), r.token);
      generation.current++;
      currentData.current = null;
      setData(null);
      setError("");
      await refresh();
      return true;
    } catch (e) {
      setToast(e.message);
      return false;
    }
  }
  async function logout() {
    const request = api("/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem(tokenKey());
    generation.current++;
    currentData.current = null;
    setData(null);
    setError("");
    setConnectionLost(false);
    await request;
    await refresh();
  }
  return (
    <Context.Provider
      value={{
        data,
        error,
        toast,
        setToast,
        busy,
        refresh,
        action,
        login,
        logout,
      }}
    >
      {children}
      {connectionLost ? (
        <div className="connection-note" role="status">
          暂时无法刷新，当前显示上次数据。
          <button
            className="text-button"
            onClick={() => refresh().catch(() => {})}
          >
            重试
          </button>
        </div>
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
