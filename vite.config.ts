import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Cloudflare Pages 使用根路徑，GitHub Pages 使用子路徑
  base: process.env.CF_PAGES ? '/' : (process.env.NODE_ENV === 'production' ? '/Ddbug-Runbook/' : '/'),
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
}));
