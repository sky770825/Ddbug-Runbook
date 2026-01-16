import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 判斷部署環境
  // Cloudflare Pages 會設定 CF_PAGES 環境變數，使用根路徑
  // GitHub Pages 使用子路徑
  const isCloudflarePages = process.env.CF_PAGES || process.env.CF_PAGES_BRANCH;
  const base = isCloudflarePages ? '/' : (process.env.NODE_ENV === 'production' ? '/Ddbug-Runbook/' : '/');
  
  return {
    base,
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // 確保建置輸出正確
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // 生產環境移除 console 語句
    minify: 'esbuild',
    // 手動分割 bundle 以優化快取和載入效能
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // 將 node_modules 中的第三方庫分離
          if (id.includes('node_modules')) {
            // React 核心庫
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            // UI 庫 (Radix UI)
            if (id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            // 動畫和工具庫
            if (id.includes('framer-motion') || id.includes('@tanstack/react-query') || id.includes('zod')) {
              return 'vendor-utils';
            }
            // 其他第三方庫
            return 'vendor-other';
          }
          // 將大型資料檔案分離
          if (id.includes('stepsData')) {
            return 'data-steps';
          }
        },
      },
    },
  },
  // public 目錄中的檔案會自動複製到 dist
  publicDir: 'public',
  };
});
