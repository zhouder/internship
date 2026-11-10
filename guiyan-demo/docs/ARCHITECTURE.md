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
- 演出、非遗、文旅、数字演出和艺人按日期独立配额，预约占用当天名额；文创和版权扣减总库存；服务类不扣商品库存。取消/退款成功按原订单库存模式释放，兼容历史记录。写请求使用数据库事务；线上通过事务级锁串行执行写操作，防止并发超卖和重复恢复。迁移口径见[指标与库存口径](METRICS.md)。
- 金额用整数分保存，展示时转换为元。
- 评论与需求审核通过后才公开；用户可以看到自己尚未公开的内容。
- 标签按后台可配置规则计算，结合有效付费金额、有效付费次数、消费时间与行为；命名分群保存条件，画像快照按日手动保存。推荐结合兴趣、浏览、收藏、有效购买与同城信号，显示原因。

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
  refund_requested --> paid: 管理员拒绝并说明原因
  disputed --> refunded: 管理员退款
  disputed --> paid: 管理员驳回申诉并说明原因
  disputed --> completed: 调解后完成
```

## 数据表

| 表 | 用途 |
|---|---|
| users | 账号、密码哈希、角色、基础属性、偏好、演示认证状态 |
| sessions | 随机会话令牌、用户、有效期 |
| resources | 10类资源、价格、库存、容量、标签、扩展元数据、上下架、浏览量 |
| orders | 预约日期、数量、金额、渠道、订单状态、模拟托管、售后申请与处理原因、支付/退款时间及估算标志、库存模式 |
| demands | 合作需求、预算、分类、城市、审核状态 |
| comments | 综合评分、质量/服务/价值分项JSON、评论、回复、审核状态 |
| messages | 站内通知、双向私信、审核与单条已读状态、关联订单 |
| profile_snapshots | 每用户每天一份画像快照，保存当时消费指标、规则标签与建议 |
| favorites | 用户与资源的收藏关联 |
| events | 资源浏览等本地事件 |
| audit_logs | 登录、资源变更、订单、同步与审核操作记录 |
| settings | 库存阈值等演示配置 |

实体定义以 `server/schema.mjs` 及 `server/review-upgrade.mjs` 中的增量字段为准；SQLite和PostgreSQL适配器均执行幂等升级。`server/catalog-content.mjs`提供可重复安全执行的内容扩充。正式数据库设计文档应同时记录基础结构和增量字段。

## 主要API

| 路径 | 方法 | 用途 |
|---|---|---|
| /api/login、/api/register、/api/logout | POST | 模拟账号认证 |
| /api/bootstrap | GET | 按角色返回页面数据 |
| /api/resources | POST | 管理员新增资源 |
| /api/resources/:id | PATCH | 管理员编辑、上下架 |
| /api/resources/:id/view | POST | 浏览事件 |
| /api/resources/:id/sync | POST | 模拟剧目三渠道发布 |
| /api/availability | GET | 查询占用日期、指定日期余量与库存模式 |
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
| /api/recommendations | GET | 本人推荐或管理员按用户试算 |
| /api/profiles/snapshot | POST | 管理员保存当日画像快照 |
| /api/profiles/:id/history | GET | 管理员读取画像快照历史 |
| /api/segments/notify | POST | 管理员按保存的分群条件发送模拟站内通知 |

认证头为 `Authorization: Bearer <演示会话令牌>`。所有SQL使用参数化查询；表名只来自服务端固定白名单。

## 后续对接

目前内部API真实执行数据库读写，外部服务全部模拟。若以后接入微信登录、支付、短信或AI，应在服务端新增适配层，保留现有前端与业务状态机；真实API密钥不能放入H5或小程序源码。任何真实支付或版权交易都超出当前Demo范围。
