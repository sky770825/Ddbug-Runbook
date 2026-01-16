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
  },
  // public 目錄中的檔案會自動複製到 dist
  publicDir: 'public',
  };
});
