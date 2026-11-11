import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
  build: {
    // 简化的代码分割策略
    rollupOptions: {
      output: {
        manualChunks: {
          // 第三方库
          'vendor': ['react', 'react-dom', 'lucide-react'],
          // 管理后台
          'admin': ['./src/pages/Dashboard.jsx', './src/pages/Resources.jsx']
        }
      }
    },
    // 使用esbuild压缩（更快）
    minify: 'esbuild',
    // 分块大小警告阈值
    chunkSizeWarningLimit: 600
  }
});
