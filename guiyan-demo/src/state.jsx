import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { api, tokenKey } from "./api";
const Context = createContext(null);
export function Provider({ children }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const next = await api("/bootstrap");
    setData(next);
    setError("");
    return next;
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
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
    setBusy(true);
    try {
      const result = await api(path, { method, body });
      await refresh();
      if (message || result.message) setToast(message || result.message);
      return result;
    } catch (e) {
      setToast(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function login(username, password) {
    try {
      const r = await api("/login", {
        method: "POST",
        body: { username, password },
      });
      localStorage.setItem(tokenKey(), r.token);
      await refresh();
      return true;
    } catch (e) {
      setToast(e.message);
      return false;
    }
  }
  async function logout() {
    await api("/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem(tokenKey());
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
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
