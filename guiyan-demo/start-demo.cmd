@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22.13 或更高版本。
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
call npm run build
if errorlevel 1 exit /b 1
echo H5：http://localhost:3001/h5
echo 管理后台：http://localhost:3001/admin
echo 请保持本窗口运行，按 Ctrl+C 可停止服务。
call npm start
