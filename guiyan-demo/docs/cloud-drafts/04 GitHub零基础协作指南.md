# GitHub零基础小组协作指南

代码仓库：https://github.com/zhouder/internship

目标是让每个人独立修改自己的业务模块，经检查后合并成一个可运行版本。本指南优先使用GitHub Desktop图形界面，同时提供命令行速查。

## 开始前准备

1. 每个人使用自己的GitHub账号，由仓库负责人在仓库设置的协作者页面发邀请；收到后接受邀请。没有接受邀请时，能浏览公开代码不等于有权推送。
2. 安装GitHub Desktop并登录自己的账号；安装Node.js 22.13或更高版本。
3. 原生小程序测试人员安装微信开发者工具。网页中的小程序预览不能代替原生测试。
4. 在分工表登记姓名、GitHub用户名和负责模块。不要共用GitHub账号，不要把密码或令牌发到群里。

## 第一次拉取项目

GitHub Desktop中选择 **File → Clone repository**，在URL页填写 `https://github.com/zhouder/internship.git`，选择本地保存位置并点击 **Clone**。如果GitHub页已经列出该仓库，也可直接选中它。

克隆完成后选择 **Repository → Open in…** 打开编辑器，或 **Show in Explorer** 查看文件。在仓库根目录打开终端，执行：

```powershell
npm --prefix guiyan-demo ci
npm --prefix guiyan-demo run dev
```

终端出现本地地址后，用浏览器打开H5和管理后台。服务运行时保持终端开启，停止时按Ctrl+C。若已经在`guiyan-demo`目录里，可直接使用 `npm ci` 和 `npm run dev`。

`Clone`只需要做一次，后续更新使用Fetch和Pull，不需要反复下载ZIP或重新克隆。

## 每次开始一个任务

1. 确认上一任务的改动已提交，工作区没有不清楚归属的修改。
2. 将 **Current branch** 切换为 `main`。
3. 点击 **Fetch origin**；如果出现 **Pull origin**，点击它，把远程更新拉到本地。
4. 从`main`新建一个任务分支。建议名称：`feat/resource-search`、`fix/order-stock`、`docs/database-fields`。名称简短、能说明任务即可。
5. 切换到新分支后再修改代码。`main`作为统一可运行版本，组内约定不直接在上面开发。

分支是修改的独立版本，不是另一个GitHub账号。每个独立任务建立一个分支；不要让一个分支长期包含多个不相关任务。

## 修改与本地测试

资源负责人修改资源相关页面和逻辑，交易负责人修改交易相关页面和逻辑。涉及 `server/index.mjs`、`server/db.mjs`、`src/App.jsx`、`src/styles.css`、`src/state.jsx`、`src/ui.jsx`、`package.json` 等共用文件时，先说明改动范围，避免同时改同一处。后续若拆分模块，以最新目录为准。

在仓库根目录执行：

```powershell
npm --prefix guiyan-demo test
npm --prefix guiyan-demo run check:mini
npm --prefix guiyan-demo run build
```

再亲自操作受影响流程。后端测试通过不能代替页面操作，网页通过也不能自动算作原生小程序通过。写明测试端、账号、步骤、预期与实际结果，附必要截图。

如果依赖发生变化，先和集成人协调，再一起提交`package.json`和`package-lock.json`。不要把运行数据库、安装依赖目录或构建结果提交进仓库。

## 提交与推送

1. 回到GitHub Desktop的 **Changes** 页，逐个查看修改差异，只勾选本任务相关文件。
2. 在Summary填写清楚的说明，例如“修复设备预约取消后库存未恢复”。描述可补充原因和测试方法。
3. 点击 **Commit to 当前分支**。这一步只保存到本地Git历史，其他人还看不到。
4. 第一次推送分支点击 **Publish branch**；以后点击 **Push origin**。这一步才把提交同步到GitHub。
5. 在GitHub网页确认自己的分支出现最新提交。

提交前发现文件不该改，不要随意使用Discard Changes。先确认里面有没有需要保留的工作；不确定就找集成人一起处理。

## 创建合并申请 PR

在GitHub Desktop或仓库网页选择 **Create Pull Request**。确认 **base 为 main**、**compare 为自己的任务分支**。

PR填写：

- 解决的问题和关联任务/Issue编号。
- 修改哪些功能、是否影响接口和数据库。
- 运行了什么检查、亲测了什么流程。
- 相关截图、模拟范围与已知问题。

提交PR不等于合并。组内由你或指定集成人检查后执行Merge。检查未通过时，继续在原分支修改、提交和推送，同一个PR会更新，不需要重复创建PR。

## 合并之后

收到已合并通知后，切回`main`，执行 **Fetch origin → Pull origin**。确认本地已经包含新功能，再从最新版`main`开始下一个任务。

其他成员也要同步`main`，才能得到合并结果。没有合并的分支修改不会自动出现在大家的`main`里。

## 任务做到一半，main有更新怎么办

先将自己的改动提交到任务分支。然后切到`main`并Pull，回到任务分支，将`main`合并进当前分支；GitHub Desktop可使用 **Branch → Merge into current branch** 选择`main`，具体界面以当前版本为准。

发生冲突时GitHub会指出冲突文件。不要只按“保留我的”或“保留对方的”；需要理解两边的业务意图，找相关模块负责人或集成人处理，再运行受影响检查。不会处理时保留当前状态，提交问题说明，不要强制推送覆盖其他人的历史。

## 容易混淆的操作

| 操作 | 作用 |
|---|---|
| Clone | 第一次把仓库复制到本地 |
| Fetch | 查看远程有哪些新提交，不直接合并到当前代码 |
| Pull | 取得并合并远程更新 |
| Branch | 为一个任务建立独立修改版本 |
| Commit | 把选中的改动记录到本地历史 |
| Push | 把本地提交上传到远程分支 |
| PR | 请求检查和合并自己的分支 |
| Merge | 将分支改动合并到目标分支 |
| Issue | 记录任务或问题，本身不会修改代码 |

## 运行数据和代码如何协作

每个人的`localhost`指自己的电脑，SQLite数据库也是各自一份。推送代码不会同步其他人的订单或登录状态；首次启动通过初始化程序产生模拟数据。小组共同演示时使用集成人维护的同一个演示环境。

本仓库是公开仓库。真实API密钥、个人证件、私有配置等不得放入提交。现有账号是演示账号，不得改为个人真实密码。`data/`、`node_modules/`、`dist/`和小程序私有配置已设置忽略。

## 命令行速查

以下命令在仓库根目录执行，分支名按自己的任务修改。

首次拉取：

```powershell
git clone https://github.com/zhouder/internship.git
cd internship
```

新任务：

```powershell
git switch main
git pull --ff-only origin main
git switch -c feat/resource-search
```

查看、选择文件和提交：

```powershell
git status
git diff
git add guiyan-demo/src/pages/Resources.jsx
git commit -m "完善资源搜索与筛选"
git push -u origin feat/resource-search
```

首次推送后在GitHub网页创建PR。上面的`git add`只是一个示例，实际只添加本任务修改的文件。不要未经检查直接把所有文件加入提交。

合并后更新：

```powershell
git switch main
git pull --ff-only origin main
```

任务分支合并最新主线：

```powershell
git fetch origin
git merge origin/main
```

如果命令提示未提交修改、冲突或拒绝推送，先阅读提示和`git status`，保留改动，不使用`reset --hard`或强制推送尝试“修好”。

## 官方资料

- [克隆仓库](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop)
- [管理分支](https://docs.github.com/en/desktop/making-changes-in-a-branch/managing-branches-in-github-desktop)
- [创建PR](https://docs.github.com/en/desktop/collaborating-and-sharing-using-github-desktop/creating-an-issue-or-pull-request-from-github-desktop)
- [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow)
