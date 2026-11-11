# 桂演平台 UI 方案切换工具
# 使用方法：右键 -> 使用 PowerShell 运行

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  桂演平台 UI 方案预览工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "当前可选方案：" -ForegroundColor Yellow
Write-Host ""
Write-Host "[1] 原始版本 - 当前线上样式"
Write-Host "[2] 方案A - 最小改动（推荐）" -ForegroundColor Green
Write-Host "[3] 方案B - 完整升级"
Write-Host "[0] 恢复备份"
Write-Host ""

$choice = Read-Host "请输入数字选择方案 (0-3)"

switch ($choice) {
    "1" {
        Write-Host "`n正在切换到原始版本..." -ForegroundColor Yellow
        if (Test-Path "src\styles.backup.css") {
            Copy-Item "src\styles.backup.css" "src\styles.css" -Force
            Write-Host "✓ 完成！" -ForegroundColor Green
        } else {
            Write-Host "✗ 未找到备份文件" -ForegroundColor Red
        }
    }
    "2" {
        Write-Host "`n正在应用方案A..." -ForegroundColor Yellow
        if (-not (Test-Path "src\styles.backup.css")) {
            Write-Host "正在备份原始文件..." -ForegroundColor Gray
            Copy-Item "src\styles.css" "src\styles.backup.css" -Force
        }
        if (Test-Path "docs\ui-patch.css") {
            Copy-Item "src\styles.backup.css" "src\styles.css" -Force
            Get-Content "docs\ui-patch.css" | Add-Content "src\styles.css"
            Write-Host "✓ 完成！已追加优化补丁" -ForegroundColor Green
        } else {
            Write-Host "✗ 找不到 docs\ui-patch.css 文件" -ForegroundColor Red
        }
    }
    "3" {
        Write-Host "`n正在应用方案B..." -ForegroundColor Yellow
        if (-not (Test-Path "src\styles.backup.css")) {
            Write-Host "正在备份原始文件..." -ForegroundColor Gray
            Copy-Item "src\styles.css" "src\styles.backup.css" -Force
        }
        if (Test-Path "src\styles-optimized.css") {
            Copy-Item "src\styles-optimized.css" "src\styles.css" -Force
            Write-Host "✓ 完成！已切换到全新设计系统" -ForegroundColor Green
        } else {
            Write-Host "✗ 找不到 src\styles-optimized.css 文件" -ForegroundColor Red
        }
    }
    "0" {
        Write-Host "`n正在恢复备份..." -ForegroundColor Yellow
        if (Test-Path "src\styles.backup.css") {
            Copy-Item "src\styles.backup.css" "src\styles.css" -Force
            Write-Host "✓ 完成！已恢复到原始版本" -ForegroundColor Green
        } else {
            Write-Host "✗ 未找到备份文件" -ForegroundColor Red
        }
    }
    default {
        Write-Host "`n✗ 无效选择" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  操作完成！" -ForegroundColor Cyan
Write-Host "  刷新浏览器即可查看效果" -ForegroundColor Yellow
Write-Host "  http://localhost:5173/admin" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "按回车键退出"
