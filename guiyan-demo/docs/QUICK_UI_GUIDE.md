# UI方案快速应用指南

## 方案A：最小改动（推荐）⭐

在 PowerShell 或 CMD 中执行：

```bash
cd D:\internship\guiyan-demo

# 备份原文件
copy src\styles.css src\styles.backup.css

# 追加优化补丁
type docs\ui-patch.css >> src\styles.css

# 完成！刷新浏览器查看效果
```

## 方案B：完整升级

```bash
cd D:\internship\guiyan-demo

# 备份原文件
copy src\styles.css src\styles.backup.css

# 替换为优化版
copy src\styles-optimized.css src\styles.css

# 完成！刷新浏览器查看效果
```

## 恢复原版

```bash
cd D:\internship\guiyan-demo

# 从备份恢复
copy src\styles.backup.css src\styles.css

# 完成！
```

---

## 📝 注意事项

1. **先启动开发服务器**
   ```bash
   npm run dev
   ```

2. **应用方案后刷新浏览器**
   - 按 F5 刷新
   - 或 Ctrl+Shift+R 强制刷新（清除缓存）

3. **访问这些页面查看效果**
   - http://localhost:5173/admin （管理后台）
   - http://localhost:5173/h5 （H5移动端）
   - http://localhost:5173/web （电脑网页）

---

## 🎨 快速对比关键效果

### 在管理后台首页查看：
1. **KPI卡片**
   - 鼠标悬停在"总交易额"等卡片上
   - 方案A/B：卡片会上浮并加深阴影

2. **主按钮**
   - 点击"导出报表"按钮
   - 方案A/B：按钮有上浮和下沉动画

3. **资源卡片**
   - 进入"演艺资源"页面
   - 鼠标悬停在资源卡片上
   - 方案A/B：卡片整体上浮

### 在H5移动端查看：
1. 打开浏览器开发者工具（F12）
2. 切换到移动设备模拟（Ctrl+Shift+M）
3. 点击任何按钮
4. 方案A/B：按钮会有缩小反馈

---

## ❓ 如果遇到问题

### 问题1：找不到文件
**解决**：确保在 `guiyan-demo` 目录下执行命令

### 问题2：样式没变化
**解决**：
1. 强制刷新浏览器（Ctrl+Shift+R）
2. 检查是否启动了开发服务器
3. 查看浏览器控制台是否有CSS错误

### 问题3：想恢复原样
**解决**：
```bash
copy src\styles.backup.css src\styles.css
```
