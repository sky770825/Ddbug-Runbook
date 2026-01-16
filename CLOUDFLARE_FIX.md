# Cloudflare Pages 建置修復

## 已修復的問題

### 1. Base Path 配置
- ✅ 修正 `vite.config.ts` 以正確偵測 Cloudflare Pages 環境
- ✅ 在 Cloudflare Pages 建置時使用根路徑 `/`
- ✅ 在 GitHub Pages 建置時使用子路徑 `/Ddbug-Runbook/`

### 2. 環境變數設定
- ✅ 在 `.cloudflare/pages.json` 中設定 `CF_PAGES=1`
- ✅ 確保建置時使用正確的 base path

### 3. Node.js 版本
- ✅ 新增 `.nvmrc` 檔案指定 Node.js 20
- ✅ 在 `.cloudflare/pages.json` 中指定 `nodeVersion: "20"`

### 4. 路由重定向
- ✅ 新增 `_redirects` 檔案處理 SPA 路由
- ✅ 確保所有路由都正確導向 `index.html`

### 5. 建置命令
- ✅ 更新建置命令為 `npm ci && CF_PAGES=1 npm run build`
- ✅ 確保使用乾淨安裝和正確的環境變數

## 在 Cloudflare Dashboard 中的設定

請確認您的 Cloudflare Pages 專案設定如下：

### 建置設定
- **Build command**: `npm ci && CF_PAGES=1 npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (留空)
- **Node.js version**: `20`

### 環境變數（可選，已在配置中設定）
- `CF_PAGES` = `1`
- `NODE_ENV` = `production`

## 重新部署

1. **自動觸發**：推送已包含所有修復，Cloudflare 會自動重新建置
2. **手動觸發**：在 Cloudflare Dashboard 中點擊 "Retry deployment"

## 檢查建置日誌

如果建置仍然失敗，請檢查：

1. **Cloudflare Dashboard** > 您的專案 > Builds > 最新的建置
2. 查看建置日誌中的錯誤訊息
3. 確認：
   - Node.js 版本為 20
   - 建置命令正確執行
   - 輸出目錄為 `dist`

## 常見問題

### Q: 建置失敗，顯示找不到模組
**A**: 確認建置命令包含 `npm ci`（已在配置中）

### Q: 網站顯示 404 錯誤
**A**: 確認 `_redirects` 檔案已正確部署到 `dist` 目錄（已自動複製）

### Q: 靜態資源載入失敗
**A**: 確認 base path 設定正確（已修復）

## 驗證建置

本地測試 Cloudflare Pages 建置：

```bash
# 模擬 Cloudflare Pages 環境建置
CF_PAGES=1 npm run build

# 檢查 dist/index.html 中的路徑
# 應該使用 /assets/ 而不是 /Ddbug-Runbook/assets/
```

## 部署網址

部署成功後，網站將可在以下網址訪問：

**https://ddbug-runbook.pages.dev**
