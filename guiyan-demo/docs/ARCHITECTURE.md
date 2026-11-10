# 架构与数据说明

当前H5手机端、电脑网站和管理后台均使用 React 与 Vite，共用Node HTTP业务接口。本地使用SQLite，阿里云线上使用PostgreSQL；原Vercel/Neon环境独立保留。支付、AI和渠道等业务对接仍为模拟；数据库连接信息仅在服务端配置。部署方式见 [ECS部署说明](ECS_DEPLOYMENT.md)。历史原生小程序源码保留供参考。

```mermaid
flowchart LR
  H[H5用户端] --> A[Node HTTP业务接口]
  M[电脑网页端] --> A
  B[管理后台] --> A
  A --> D[(本地SQLite 或 线上PostgreSQL)]
  A --> R[规则分析与模拟AI]
  A --> S[模拟支付和渠道同步]
```

## 业务规则

- 角色为普通用户、资源合作方和管理员。后台写资源、审核、查看全量订单和统计均需管理员。
- 用户只能操作自己的订单。管理员能够审核和处理退款纠纷。
- 场馆与设备资源按天独占，同一天存在未取消、未退款订单时拒绝重复预约。
- 普通资源提交预约时扣减可用库存，取消或退款后释放库存。写请求使用数据库事务；线上通过事务级锁串行执行写操作，在读取状态前加锁，防止多实例并发造成超卖、档期冲突和重复恢复库存。
- 金额用整数分保存，展示时转换为元。
- 评论与需求审核通过后才公开；用户可以看到自己尚未公开的内容。
- 标签来自订单数量和已支付金额，推荐优先展示用户选择的兴趣分类。

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> confirmed: 管理员确认
  pending --> cancelled: 用户取消或管理员驳回
  confirmed --> cancelled: 用户取消
  confirmed --> paid: 模拟支付
  paid --> completed: 确认完成和模拟结算
  paid --> refund_requested: 申请退款
  paid --> disputed: 提交申诉
  refund_requested --> refunded: 管理员同意
  disputed --> refunded: 管理员退款
  disputed --> completed: 调解后完成
```

## 数据表

| 表 | 用途 |
|---|---|
| users | 账号、密码哈希、角色、基础属性、偏好、演示认证状态 |
| sessions | 随机会话令牌、用户、有效期 |
| resources | 10类资源、价格、库存、容量、标签、扩展元数据、上下架、浏览量 |
| orders | 预约日期、数量、金额、渠道、订单状态、模拟托管、售后原因 |
| demands | 合作需求、预算、分类、城市、审核状态 |
| comments | 综合评分、质量/服务/价值分项JSON、评论、回复、审核状态 |
| messages | 站内通知、私信、已读状态 |
| favorites | 用户与资源的收藏关联 |
| events | 资源浏览等本地事件 |
| audit_logs | 登录、资源变更、订单、同步与审核操作记录 |
| settings | 库存阈值等演示配置 |

实体和字段定义以 `server/schema.mjs` 的建表语句为准；`server/catalog-content.mjs`提供可重复安全执行的内容扩充。正式数据库设计文档可依据这些真实实现填写。

## 主要API

| 路径 | 方法 | 用途 |
|---|---|---|
| /api/login、/api/register、/api/logout | POST | 模拟账号认证 |
| /api/bootstrap | GET | 按角色返回页面数据 |
| /api/resources | POST | 管理员新增资源 |
| /api/resources/:id | PATCH | 管理员编辑、上下架 |
| /api/resources/:id/view | POST | 浏览事件 |
| /api/resources/:id/sync | POST | 模拟剧目三渠道发布 |
| /api/availability | GET | 查询资源占用日期 |
| /api/orders | POST | 提交预约 |
| /api/orders/:id | PATCH | 状态机操作 |
| /api/orders/:id/contract | GET | 模拟服务或授权协议 |
| /api/demands、/api/comments | POST | 提交待审核内容 |
| /api/moderate | POST | 管理员审核或回复 |
| /api/favorites | POST | 收藏切换 |
| /api/profile | PATCH | 资料、兴趣和演示认证 |
| /api/messages、/api/messages/read | POST | 私信、通知与已读 |
| /api/analytics | GET | 日周月季度聚合及预警 |
| /api/alerts | POST | 模拟五类异常及处理 |
| /api/export | GET | CSV订单导出 |
| /api/sync | POST | 模拟渠道订单汇聚 |
| /api/ai | POST | 规则客服、运营分析、模板文案 |
| /api/settings | PATCH | 管理员修改阈值 |

认证头为 `Authorization: Bearer <演示会话令牌>`。所有SQL使用参数化查询；表名只来自服务端固定白名单。

## 后续对接

目前内部API真实执行数据库读写，外部服务全部模拟。若以后接入微信登录、支付、短信或AI，应在服务端新增适配层，保留现有前端与业务状态机；真实API密钥不能放入H5或小程序源码。任何真实支付或版权交易都超出当前Demo范围。
