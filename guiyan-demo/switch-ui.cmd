@echo off
cls
echo ========================================
echo   桂演平台 UI 方案预览工具
echo ========================================
echo.
echo 当前可选方案:
echo.
echo [1] 原始版本 - 当前线上样式
echo [2] 方案A - 最小改动
echo [3] 方案B - 完整升级
echo [0] 恢复备份
echo.
set /p choice="请输入数字选择方案 (0-3): "

if "%choice%"=="0" goto restore
if "%choice%"=="1" goto original
if "%choice%"=="2" goto patchA
if "%choice%"=="3" goto fullB

echo.
echo 无效选择
pause
exit

:original
echo.
echo 正在切换到原始版本...
if exist src\styles.backup.css (
    copy /Y src\styles.backup.css src\styles.css
    echo 完成
) else (
    echo 未找到备份文件
)
goto done

:patchA
echo.
echo 正在应用方案A...
if not exist src\styles.backup.css (
    echo 正在备份原始文件...
    copy /Y src\styles.css src\styles.backup.css
)
if not exist docs\ui-patch.css (
    echo 错误: 找不到 docs\ui-patch.css 文件
    pause
    exit
)
copy /Y src\styles.backup.css src\styles.css
type docs\ui-patch.css >> src\styles.css
echo 完成
goto done

:fullB
echo.
echo 正在应用方案B...
if not exist src\styles.backup.css (
    echo 正在备份原始文件...
    copy /Y src\styles.css src\styles.backup.css
)
if not exist src\styles-optimized.css (
    echo 错误: 找不到 src\styles-optimized.css 文件
    pause
    exit
)
copy /Y src\styles-optimized.css src\styles.css
echo 完成
goto done

:restore
echo.
echo 正在恢复备份...
if exist src\styles.backup.css (
    copy /Y src\styles.backup.css src\styles.css
    echo 完成
) else (
    echo 错误: 未找到备份文件
)
goto done

:done
echo.
echo ========================================
echo   操作完成
echo   刷新浏览器即可查看效果
echo   http://localhost:5173/admin
echo ========================================
echo.
pause
