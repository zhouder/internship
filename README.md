# 桂演毕业实习项目

本仓库用于八人小组协作，包含H5用户端、管理后台、原生微信小程序、共用API、模拟数据初始化程序，以及老师提供的原始材料。

应用源码位于 [`guiyan-demo/`](guiyan-demo/)。原始Word、Excel及`back_up/`为参考资料；协作时保留原件，正式材料另行整理。

## 组员从这里开始

阿里云集中测试：[H5用户端](http://120.24.109.101/h5) · [管理后台](http://120.24.109.101/admin) · [小程序网页预览](http://120.24.109.101/mini)。每人使用自己的演示账号，线上记录共同保存。部署与更新方法见 [ECS维护说明](guiyan-demo/docs/ECS_DEPLOYMENT.md)。当前为HTTP模拟演示环境，正式对外服务需处理备案、域名及HTTPS。

协作入口：[飞书文档与权限设置](guiyan-demo/docs/COLLABORATION_LINKS.md)。先登记分工、领取任务，再按对应模块修改代码和填写验收记录。

1. 阅读 [GitHub零基础协作指南](guiyan-demo/docs/GITHUB_GUIDE.md)。
2. 按 [项目运行说明](guiyan-demo/README.md) 启动Demo。
3. 在 [八人分工](guiyan-demo/docs/TEAM.md) 中确认自己的责任。
4. 按 [成果里程碑](guiyan-demo/docs/ROADMAP.md) 推进，用 [验收与问题模板](guiyan-demo/docs/ISSUES.md) 反馈。
5. 对照 [29项功能与模拟边界](guiyan-demo/docs/FEATURES.md) 核对功能；正式设计文档应与最终代码保持一致。

## 快速运行

需要Node.js 22.13或更高版本。在仓库根目录打开终端：

```powershell
npm --prefix guiyan-demo ci
npm --prefix guiyan-demo run dev
```

H5：`http://localhost:5173/h5`；后台：`http://localhost:5173/admin`。原生小程序在微信开发者工具导入 `guiyan-demo/miniprogram`。

普通用户：`demo / demo123`；管理员：`admin / admin123`。这些仅为公开演示账号。支付、AI、渠道同步、版权、物流等外部能力均为模拟，不产生真实交易。

## 协作规则

- 按优先级、依赖与验收成果推进，不固定按七天分配任务。
- 每项修改从最新`main`建立任务分支，测试后提交PR，由集成人检查合并。
- 修改共用接口、数据库结构、依赖或公共样式前先协调。
- 各自运行自己的模拟数据库，不提交`data/`、`node_modules/`、`dist/`或私有配置。
- 阿里云集中测试使用服务器上的共享PostgreSQL；本地仍各自使用SQLite。原Vercel/Neon环境保留，两个环境不自动同步，组员测试时统一使用阿里云入口。详见 [ECS维护说明](guiyan-demo/docs/ECS_DEPLOYMENT.md) 与 [原Vercel部署说明](guiyan-demo/docs/DEPLOYMENT.md)。
- 云文档记录需求、负责人、测试与正式材料；GitHub保存代码和版本记录。没有成员姓名时先用1至8号占位，不把模板记录当成已完成工作。
