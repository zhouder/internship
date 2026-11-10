# 阿里云 ECS 部署与维护

服务器：Ubuntu 22.04 x86_64，2核4GB，40GB系统盘。Nginx提供网页并转发API，Node.js 22运行后端，PostgreSQL保存共享测试数据。应用和数据库只监听服务器回环地址，公网入口为Nginx。

## 页面入口

- H5：`http://120.24.109.101/h5`
- 管理后台：`http://120.24.109.101/admin`
- 小程序网页预览：`http://120.24.109.101/mini`
- 健康与发布版本：`http://120.24.109.101/api/health`

这是HTTP演示环境，不输入真实个人信息或复用个人密码。绑定域名、办理相应备案并配置HTTPS后再用于正式对外服务；中国内地服务器直接用IP对外提供网站也不能作为免备案方案。

账号：`visitor1`至`visitor8`，密码`demo123`；管理员`admin / admin123`；供应商`supplier / demo123`。支付、认证、AI和外部渠道仍为模拟业务。

`/mini`是网页预览，原生微信小程序没有因此自动上线。`miniprogram/app.js`中的`baseUrl`已指向阿里云共享测试API；在微信开发者工具导入`miniprogram`目录即可进行开发联调，当前项目配置`urlCheck: false`仅适用于开发调试。若需本地后端联调，将`baseUrl`改回`http://127.0.0.1:3001`。真机与正式发布需按微信规则使用合法HTTPS域名。

## 目录与服务

| 项目 | 位置或名称 |
| --- | --- |
| 每次发布的代码 | `/opt/guiyan/releases/发布编号` |
| 当前代码软链接 | `/opt/guiyan/current` |
| 数据库连接环境文件 | `/etc/guiyan/demo.env`，仅root可读，不提交Git |
| 应用服务 | `guiyan.service`，用户guiyan运行，开机启动，故障自动重启 |
| 反向代理 | `/etc/nginx/sites-available/guiyan` |
| 数据库 | PostgreSQL，库名guiyan，仅本机连接 |
| 备份 | `/var/backups/guiyan/`，每日03:30左右，保留约7天 |

## 更新项目（维护者执行）

在仓库根目录打开PowerShell，先拉取并检查组员已合并的代码，运行本地检查，然后发布：

```powershell
npm --prefix guiyan-demo test
npm --prefix guiyan-demo run check:mini
npm --prefix guiyan-demo run build
powershell -ExecutionPolicy Bypass -File .\guiyan-demo\deploy\ecs\deploy.ps1 -Server 120.24.109.101 -KeyPath "D:\mydownload\_shenzhen.pem"
```

脚本上传当前工作区的应用源码，在Linux服务器执行`npm ci`和构建，生成独立发布目录并重启服务。不自动提交Git、不覆盖数据库。发布编号含Git版本和上传包哈希，能够区分本地尚未提交的代码。后端健康检查失败时会恢复上一代码目录；数据库结构回滚需单独评估。

首次安装运行`deploy/ecs/install.sh`。新实例初始化用随机数据库密码，后续安装保留环境文件。不要将SSH私钥、环境文件或数据备份上传到公开仓库。

## 排查与备份

```powershell
ssh -i "D:\mydownload\_shenzhen.pem" root@120.24.109.101
```

连接后执行：

```bash
systemctl status guiyan nginx postgresql --no-pager
journalctl -u guiyan -n 50 --no-pager
curl -f http://127.0.0.1:3001/api/health
systemctl start guiyan-backup.service
systemctl list-timers guiyan-backup.timer
ls -lh /var/backups/guiyan
```

备份与数据库位于同一台服务器，不能抵御整台服务器或系统盘被删除。重要演示前将备份另存本机，并在释放实例前导出代码版本与数据。按量付费实例的停机、释放与存储/流量费用以阿里云实际账单为准。

## 迁移边界

本次从原Neon数据库复制模拟用户、资源、订单等业务记录，保留账号和密码散列；不复制登录会话，用户需重新登录。`import-snapshot.mjs`只允许写入空数据库，不覆盖已有数据。

迁移完成后，阿里云数据库和原Vercel/Neon数据库各自独立，不自动同步。小组集中测试应统一使用同一套地址，避免在两个环境分别提交后误以为数据丢失。
