# Vercel与Neon部署说明

> 小组当前集中测试入口已迁移至阿里云ECS，见 [ECS部署与维护](ECS_DEPLOYMENT.md)。下述Vercel/Neon环境继续保留，但与阿里云数据库各自独立，不自动同步，请勿混用测试地址。

- H5：https://guiyan-demo.vercel.app/h5
- 管理后台：https://guiyan-demo.vercel.app/admin
- 小程序网页预览：https://guiyan-demo.vercel.app/mini
- 健康与版本：https://guiyan-demo.vercel.app/api/health

线上使用 Vercel Functions 与 Neon PostgreSQL，H5、管理后台和网页预览共用线上数据库。本地不设置 `DATABASE_URL` 时继续使用 SQLite，组员照旧运行 `npm ci`、`npm run dev`，不需要获取云数据库密码。

## 小组在线测试

- 组员分别使用 `visitor1` 至 `visitor8`，密码均为 `demo123`；也可以注册各自的演示账号。
- 管理员演示账号为 `admin / admin123`，仅用于本项目的模拟业务测试。
- 线上数据由所有测试人员共同使用。不要把他人刚产生的订单、库存或审核记录误认为程序自行改变。
- 支付、身份认证、AI、渠道同步等业务仍为模拟；数据库中的保存、审核、库存和订单状态更新是真实持久化。
- 测试反馈注明页面、账号、步骤、预期结果、实际结果、截图和代码版本。`/api/health` 提供数据库类型与版本标识。
- 原生微信小程序仍需单独编译测试；网页 `/mini` 是预览页面。小程序可在 `miniprogram/app.js` 把 `baseUrl` 改为实际线上网站根地址后联调。真机及正式发布需要按微信要求配置合法域名。

## 部署配置

Vercel 项目根目录设置为 `guiyan-demo`，使用 Node.js 22、Vite、构建命令 `npm run build`、输出目录 `dist`。`vercel.json` 将 `/api/*` 路由交给同一个 Node 函数，其余页面支持直接打开和刷新。

数据库通过 Vercel Marketplace 的 Neon Free 计划提供，区域为新加坡。`DATABASE_URL` 由集成注入服务端环境变量。数据库凭据不进入前端、小程序或Git仓库。

首次连接时创建数据表并填充模拟数据；数据库已有用户时不会重新填充或清空。重新部署、函数休眠和重启不应重置业务记录。本地 SQLite 和线上 PostgreSQL 是各自独立的数据，不自动互相同步。

写请求在单一数据库连接的事务内完成；通过事务级锁串行处理小组演示中的写操作，避免多实例间重复占用档期、重复取消恢复库存等问题。读取采用一致性快照，响应在事务结束后发送。此方案面向小规模协作演示。

## 维护者操作

本节在仓库根目录执行。仅维护者需要 Vercel CLI 和数据库连接信息。

```powershell
vercel link --project guiyan-demo --scope zhouders-projects
vercel env pull .env.local --environment production --scope zhouders-projects
node --env-file=.env.local guiyan-demo/scripts/init-postgres.mjs
node --env-file=.env.local guiyan-demo/scripts/test-postgres.mjs
```

PostgreSQL 测试使用独立的 `test_guiyan_*` schema，结束后清理，不修改共享测试环境的业务表。需要集成提供的 `DATABASE_URL_UNPOOLED` 来设置测试 schema。

```powershell
npm --prefix guiyan-demo test
npm --prefix guiyan-demo run check:mini
npm --prefix guiyan-demo run build
```

检查通过后提交并推送代码，由 Vercel 的 Git 集成部署。每次发布后验证健康接口、登录、预约、后台审核、模拟支付和订单状态。

`.env.local`、`.vercel/` 与本地数据库均被忽略。不要把环境文件、连接字符串或登录令牌放进提交、截图或飞书文档。免费计划有额度限制，可在 Vercel 与 Neon 控制台查看使用情况；本项目未启用付费套餐。
