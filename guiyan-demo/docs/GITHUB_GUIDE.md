# GitHub零基础协作指南

## 1. 克隆项目（只做一次）

```powershell
git clone https://github.com/zhouder/internship.git
cd internship
```

下面的命令都在 `internship` 文件夹中执行。

## 2. 创建自己的分支

把 `zhangsan` 换成自己的姓名拼音；每个新任务换一个分支名，例如 `feat/zhangsan-search`。

```powershell
git switch main
git pull --ff-only origin main
git switch -c feat/zhangsan
```

然后修改自己负责的代码。

## 3. 提交并推送

先检查修改，只提交本任务的内容；提交前亲自测试修改的功能。

```powershell
git status
git diff
git add .
git commit -m "说明自己修改了什么"
git push -u origin HEAD
```

推送后，在GitHub仓库点击 **Compare & pull request**，目标分支选 `main`，提交PR，由组长检查合并。`push`只是上传自己的分支，不等于合并。

合并后，其他人用下面两条命令获取更新；切换前先提交自己分支上的修改。

```powershell
git switch main
git pull --ff-only origin main
```

## 4. 启动项目

```powershell
npm --prefix guiyan-demo ci
npm --prefix guiyan-demo run dev
```

- H5： http://localhost:5173/h5
- 电脑网站： http://localhost:5173/web
- 管理后台： http://localhost:5173/admin
- 停止服务：按 `Ctrl+C`。

首次运行或依赖有变化时执行 `npm ci`，平时直接执行上面的 `npm run dev` 命令即可（保留 `--prefix guiyan-demo`）。

提醒：需提前安装Git和Node.js 22.13或更高版本，并接受仓库邀请。首次提交若提示没有身份信息，按提示用 `git config --global user.name "你的名字"` 和 `git config --global user.email "你的GitHub邮箱"` 配置；首次推送按提示登录GitHub。遇到冲突先找组长，不要强制推送。
