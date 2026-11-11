import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/api.js";

test("客户端保留HTTP状态、拒绝HTML错误页，并清理真正过期的当前会话", async () => {
  const previous = {
    fetch: globalThis.fetch,
    window: globalThis.window,
    location: globalThis.location,
    localStorage: globalThis.localStorage,
  };
  const tokens = new Map([["guiyan.user.v1", "session-old"]]);
  globalThis.location = { pathname: "/web" };
  globalThis.localStorage = {
    getItem: (key) => tokens.get(key) ?? null,
    setItem: (key, value) => tokens.set(key, value),
    removeItem: (key) => tokens.delete(key),
  };
  globalThis.window = new EventTarget();
  let expired = 0;
  window.addEventListener("guiyan:session-expired", () => expired++);
  try {
    globalThis.fetch = async () =>
      Response.json({ error: "座位已被预约" }, { status: 409 });
    await assert.rejects(
      api("/orders"),
      (e) => e.status === 409 && e.message === "座位已被预约",
    );
    globalThis.fetch = async () =>
      new Response("<html>bad gateway</html>", { status: 502 });
    await assert.rejects(
      api("/bootstrap"),
      (e) => e.status === 502 && !e.message.includes("<html>"),
    );
    let finish;
    globalThis.fetch = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const stale = api("/orders");
    localStorage.setItem("guiyan.user.v1", "session-new");
    finish(Response.json({ error: "请先登录" }, { status: 401 }));
    await assert.rejects(stale);
    assert.equal(localStorage.getItem("guiyan.user.v1"), "session-new");
    assert.equal(expired, 0);
    globalThis.fetch = async () =>
      Response.json({ error: "请先登录" }, { status: 401 });
    await assert.rejects(api("/orders"));
    assert.equal(localStorage.getItem("guiyan.user.v1"), null);
    assert.equal(expired, 1);
    localStorage.setItem("guiyan.user.v1", "session-valid");
    await assert.rejects(
      api("/login", {
        method: "POST",
        body: { username: "demo", password: "wrong" },
      }),
    );
    assert.equal(localStorage.getItem("guiyan.user.v1"), "session-valid");
    assert.equal(expired, 1);
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await assert.rejects(api("/bootstrap"), /无法连接服务/);
    globalThis.fetch = async (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        ),
      );
    await assert.rejects(api("/bootstrap", { timeoutMs: 5 }), /请求超时/);
  } finally {
    Object.assign(globalThis, previous);
  }
});
