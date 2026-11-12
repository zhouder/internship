import test, {before, after} from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import pg from "pg";
import {openPostgresStore} from "../server/postgres.mjs";
import {openSqliteStore} from "../server/database.mjs";
import {createApp} from "../server/index.mjs";
let server, database, base, admin, user, pool, schema;
async function request(path, token, body, method = body ? "POST" : "GET") {
  const r = await fetch(base + "/api" + path, {method, headers:{...(token ? {Authorization:"Bearer " + token} : {}), ...(body ? {"Content-Type":"application/json"} : {})}, body:body ? JSON.stringify(body) : undefined});
  return {status:r.status, data:r.headers.get("content-type")?.includes("json") ? await r.json() : await r.text()};
}
async function resource(category, extra = {}) {
  const r = await request("/resources", admin, {name:"台账回归-"+category,category,city:"南宁",price:18000,stock:8,capacity:200,unit:"项",description:"隔离测试资源",tags:["定制标签"],meta:{},...extra});
  assert.equal(r.status,200,JSON.stringify(r.data)); return r.data.id;
}
before(async () => {
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    if (url.searchParams.get("sslmode") === "require") url.searchParams.set("sslmode", "verify-full");
    pool = new pg.Pool({connectionString:url.toString()}); schema = `test_ledger_${Date.now()}_${process.pid}`;
    await pool.query(`CREATE SCHEMA "${schema}"`);
    database = await openPostgresStore(url.toString(), {poolOptions:{options:`-c search_path=${schema}`}});
  } else database = await openSqliteStore(":memory:");
  server = await createApp({database, aiOptions:{apiKey:""}}); server.listen(0,"127.0.0.1"); await once(server,"listening");
  base = "http://127.0.0.1:" + server.address().port;
  admin = (await request("/login", null, {username:"admin",password:"admin123"})).data.token;
  user = (await request("/login", null, {username:"demo",password:"demo123"})).data.token;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) {assert.match(schema,/^test_ledger_\d+_\d+$/); await pool.query(`DROP SCHEMA "${schema}" CASCADE`); await pool.end();}
});

test("统计导出逐项匹配当前图表周期，订单明细导出保持独立", async () => {
  assert.equal((await request("/export?period=week",user)).status,403);
  assert.equal((await request("/export?period=bad",admin)).status,400);
  for (const period of ["day","week","month","quarter"]) {
    const stats = (await request("/analytics?period="+period,admin)).data;
    const exported = await request("/export?period="+period,admin);
    assert.equal(exported.status,200);
    const rows = exported.data.replace(/^\uFEFF/,"").split("\r\n").slice(1).map(line => [...line.matchAll(/"((?:[^\"]|\"\")*)"/g)].map(m => m[1].replaceAll('""','"')));
    assert.deepEqual(rows.map(r => [r[1],r[2],Number(r[3]),r[4]]),stats.series.map(s => [s.date,s.label,s.count,(s.amount/100).toFixed(2)]));
  }
  assert.match((await request("/export",admin)).data,/订单编号/);
});

test("场馆容量、城市和单位可维护，已有交易或关联剧目的分类受保护", async () => {
  assert.equal((await request("/resources",admin,{name:"无容量场馆",category:"venue",city:"南宁",price:1,unit:"场",description:"测试",stock:1,capacity:0})).status,400);
  const id = await resource("venue");
  assert.equal((await request("/resources/"+id,admin,{capacity:250,city:"桂林",unit:"场"},"PATCH")).status,200);
  let item = (await request("/bootstrap",admin)).data.resources.find(r => r.id===id);
  assert.equal(item.capacity,250); assert.equal(item.city,"桂林"); assert.equal(item.unit,"场");
  assert.equal((await request("/resources/"+id,admin,{capacity:-1},"PATCH")).status,400);
  assert.equal((await request("/resources/"+id,admin,{category:"show",stock:10},"PATCH")).status,200);
  item = (await request("/bootstrap",admin)).data.resources.find(r => r.id===id);
  assert.equal(item.category,"show"); assert.equal(item.inventory_mode,"date"); assert.equal(item.daily_capacity,10);
  assert.ok(item.tags.includes("演出剧目")); assert.ok(!item.tags.includes("演出场馆")); assert.ok(item.tags.includes("定制标签"));
  const order = await request("/orders",user,{resourceId:id,date:"2099-04-01",quantity:1}); assert.equal(order.status,200);
  assert.equal((await request("/resources/"+id,admin,{unit:"张"},"PATCH")).status,200);
  assert.equal((await request("/bootstrap",admin)).data.orders.find(o => o.id===order.data.id).unit,"场");
  assert.equal((await request("/resources/"+id,admin,{category:"creative",price:1},"PATCH")).status,409);
  item = (await request("/bootstrap",admin)).data.resources.find(r => r.id===id); assert.equal(item.price,18000);
  const venue = await resource("venue"); await resource("show",{meta:{venueId:venue}});
  assert.equal((await request("/resources/"+venue,admin,{category:"service"},"PATCH")).status,409);
});

test("全局库存商品无需日期，下单取消只改变商品总库存；服务仍需日期", async () => {
  const id = await resource("creative");
  const order = await request("/orders",user,{resourceId:id,quantity:2}); assert.equal(order.status,200);
  let boot = (await request("/bootstrap",user)).data;
  assert.equal(boot.resources.find(r => r.id===id).stock,6);
  assert.equal(boot.orders.find(o => o.id===order.data.id).stock_mode,"global");
  assert.equal((await request("/orders/"+order.data.id,user,{action:"cancel"},"PATCH")).status,200);
  boot = (await request("/bootstrap",user)).data; assert.equal(boot.resources.find(r => r.id===id).stock,8);
  const service = await resource("service"); assert.equal((await request("/orders",user,{resourceId:service,quantity:1})).status,400);
});

test("单会话已读只修改本人的对应联系人消息", async () => {
  const supplier = (await request("/login",null,{username:"supplier",password:"demo123"})).data.token;
  const uid = (await request("/bootstrap",user)).data.user.id;
  const aid = (await request("/bootstrap",admin)).data.user.id;
  await request("/messages",admin,{to:uid,content:"台账会话A"}); await request("/messages",supplier,{to:uid,content:"台账会话B"});
  assert.equal((await request("/messages/read",user,{peerId:aid})).status,200);
  const messages = (await request("/bootstrap",user)).data.messages;
  assert.equal(Number(messages.find(m => m.content==="台账会话A").is_read),1);
  assert.equal(Number(messages.find(m => m.content==="台账会话B").is_read),0);
});

test("画像读取钱包和实际模拟支付方式，分群趋势使用快照当日分母", async () => {
  await request("/demo/wallet/recharge",user,{amount:100000});
  const id = await resource("creative"); const order = await request("/orders",user,{resourceId:id,quantity:1}); assert.equal(order.status,200);
  assert.equal((await request("/orders/"+order.data.id,admin,{action:"confirm"},"PATCH")).status,200);
  assert.equal((await request("/orders/"+order.data.id,user,{action:"pay",paymentMethod:"balance"},"PATCH")).status,200);
  const boot = (await request("/bootstrap",admin)).data;
  const uid = (await request("/bootstrap",user)).data.user.id;
  const profile = boot.profiles.find(p => p.id===uid);
  assert.equal(profile.portrait.balance,(await request("/bootstrap",user)).data.benefits.balance);
  assert.ok(profile.portrait.paymentMethods.some(m => m.name==="模拟余额" && m.count>0)); assert.ok(profile.portrait.frequency30d>0);
  await request("/profiles/snapshot",admin,{});
  await database.prepare("INSERT INTO profile_snapshots(user_id,snapshot_date,data) VALUES(?,?,?)").run(uid,"2001-01-01",JSON.stringify({...profile,tags:["历史样本"]}));
  const old = (await request("/segments/history?tag="+encodeURIComponent("历史样本"),admin)).data.series.find(s => s.date==="2001-01-01");
  assert.deepEqual(old,{date:"2001-01-01",count:1,total:1,coverage:100});
  assert.equal((await request("/segments/history",user)).status,403);
});

test("召回演示样本仅管理员可加，重复操作不重复创建或改写原订单", async () => {
  const before = (await request("/bootstrap",admin)).data.orders;
  assert.equal((await request("/demo/recall-samples",user,{})).status,403);
  assert.equal((await request("/demo/recall-samples",admin,{})).data.added,2);
  assert.equal((await request("/demo/recall-samples",admin,{})).data.added,0);
  const boot = (await request("/bootstrap",admin)).data;
  const samples = boot.profiles.filter(p => p.username.startsWith("demo_recall_"));
  assert.equal(samples.length,2); assert.ok(samples.every(p => p.days_since_payment>=120 && p.tags.includes("沉默用户")));
  assert.deepEqual(boot.orders.filter(o => before.some(b => b.id===o.id)),before);
  assert.equal(boot.orders.length,before.length+2);
});

test("近期趋势不被历史召回样本拉长，补零周期完整且导出与显示同范围", async () => {
  assert.equal((await request("/analytics?range=bad",admin)).status,400);
  assert.equal((await request("/export?period=week&range=bad",admin)).status,400);
  const all = (await request("/analytics",admin)).data;
  assert.ok(all.series.length>30);
  for (const [period,length] of [["day",30],["week",8],["month",12],["quarter",8]]) {
    const stats = (await request(`/analytics?period=${period}&range=recent`,admin)).data;
    assert.equal(stats.series.length,length);
    assert.equal(stats.trendWindow.end,stats.today);
    assert.ok(stats.trendWindow.start>all.trendWindow.start || period==="month" || period==="quarter");
    assert.equal(stats.kpis.revenue,all.kpis.revenue);
    assert.ok(stats.series.some(s => s.amount===0));
    const exported = (await request(`/export?period=${period}&range=recent`,admin)).data;
    const rows = exported.replace(/^\uFEFF/,"").split("\r\n").slice(1).map(line => [...line.matchAll(/"((?:[^\"]|\"\")*)"/g)].map(m => m[1].replaceAll('""','"')));
    assert.deepEqual(rows.map(r => [r[1],r[2],Number(r[3]),r[4]]), stats.series.map(s => [s.date,s.label,s.count,(s.amount/100).toFixed(2)]));
    assert.ok(rows.every(r => r[6].includes(stats.trendWindow.label)));
  }
});
