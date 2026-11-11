import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/index.mjs";
let server, base, admin, user;
async function request(route, { token, method = "GET", body } = {}) {
  const response = await fetch(base + "/api" + route, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get("content-type") || "";
  return {
    status: response.status,
    data: type.includes("json") ? await response.json() : await response.text(),
  };
}
before(async () => {
  server = await createApp({ dbFile: ":memory:" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = "http://127.0.0.1:" + server.address().port;
  admin = (
    await request("/login", {
      method: "POST",
      body: { username: "admin", password: "admin123" },
    })
  ).data.token;
  user = (
    await request("/login", {
      method: "POST",
      body: { username: "demo", password: "demo123" },
    })
  ).data.token;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});
test("普通用户在引导数据中能看到自己的画像与标签", async () => {
  const r = await request("/bootstrap", { token: user });
  assert.equal(r.status, 200);
  const p = r.data.ownProfile;
  assert.ok(p, "普通用户应返回 ownProfile");
  assert.equal(p.username, "demo");
  assert.ok(Array.isArray(p.tags) && p.tags.length >= 3, "应包含自动标签");
  assert.ok(typeof p.spent === "number", "应包含消费金额");
  assert.ok(p.portrait && "priceBand" in p.portrait, "应包含票价偏好画像");
  assert.ok(
    typeof p.favorite_count === "number" && typeof p.view_count === "number",
    "应包含收藏与浏览计数",
  );
});
test("管理员引导数据不含自己的画像（画像仅面向普通用户）", async () => {
  const r = await request("/bootstrap", { token: admin });
  assert.equal(r.status, 200);
  assert.equal(r.data.ownProfile, null);
  assert.ok(Array.isArray(r.data.profiles), "管理员仍可见全量画像列表");
});
test("未登录引导数据不携带任何画像", async () => {
  const r = await request("/bootstrap");
  assert.equal(r.status, 200);
  assert.equal(r.data.ownProfile, null);
  assert.deepEqual(r.data.profiles, []);
});
test("推荐结果附带得分，浏览资源后画像的浏览计数增加", async () => {
  const r = await request("/bootstrap", { token: user });
  const recs = r.data.recommendations;
  assert.ok(Array.isArray(recs) && recs.length > 0, "登录用户应获得推荐");
  for (const rec of recs)
    assert.ok(
      typeof rec.resourceId === "number" && typeof rec.score === "number",
      "推荐项应包含资源编号与得分",
    );
  const before = r.data.ownProfile.view_count;
  const first = r.data.resources.find((x) => x.status === "published");
  const view = await request(`/resources/${first.id}/view`, {
    token: user,
    method: "POST",
  });
  assert.equal(view.status, 200);
  const after = (
    await request("/bootstrap", { token: user })
  ).data.ownProfile.view_count;
  assert.equal(after, before + 1, "浏览一次后浏览计数加一");
});
