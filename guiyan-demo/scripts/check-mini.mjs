import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
const root = path.resolve("miniprogram"),
  app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
const valid = new Set(app.pages);
assert.equal(valid.size, app.pages.length);
for (const entry of app.pages) {
  const base = path.join(root, entry);
  for (const ext of [".js", ".wxml", ".json"])
    assert.ok(fs.existsSync(base + ext), entry + ext + " 缺失");
  const js = fs.readFileSync(base + ".js", "utf8");
  new vm.Script(js, { filename: entry + ".js" });
  JSON.parse(fs.readFileSync(base + ".json", "utf8"));
  const wxml = fs.readFileSync(base + ".wxml", "utf8");
  assert.ok(
    !/{{[^}]*\.(slice|map|filter|includes|toFixed)\(/.test(wxml),
    entry + " 含WXML不支持的方法调用",
  );
  let page;
  vm.runInNewContext(js, {
    Page: (p) => (page = p),
    require: () => ({}),
    console,
  });
  assert.ok(page, entry + " 没有注册Page");
  const handlers = [
    ...wxml.matchAll(
      /(?:bind|catch)(?:tap|input|change|confirm|submit)="([\w]+)"/g,
    ),
  ].map((m) => m[1]);
  for (const h of handlers)
    assert.equal(typeof page[h], "function", entry + " 缺少事件处理器 " + h);
}
for (const tab of app.tabBar.list)
  assert.ok(valid.has(tab.pagePath), "导航指向不存在的页面");
console.log(
  `原生小程序静态检查通过：${app.pages.length}个页面，配置、JS语法、WXML表达式和事件处理器完整。该检查不代替微信运行时编译。`,
);
