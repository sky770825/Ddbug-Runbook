# Cloudflare Pages 部署說明

## 問題診斷

如果您在 Cloudflare Workers 中看到建置失敗，這是因為：

1. **錯誤的平台**：這個專案是 React SPA，應該使用 **Cloudflare Pages** 而不是 **Cloudflare Workers**
2. **缺少配置**：需要正確的建置配置

## 解決方案

### 方法 1：使用 Cloudflare Pages（推薦）

1. **前往 Cloudflare Dashboard**
   - 登入 https://dash.cloudflare.com
   - 選擇您的帳號

2. **建立 Pages 專案**
   - 點擊左側選單的 **Workers & Pages**
   - 點擊 **Create application** > **Pages** > **Connect to Git**

3. **連接 GitHub 倉庫**
   - 選擇 **GitHub** 作為 Git 提供者
   - 授權 Cloudflare 訪問您的 GitHub
   - 選擇倉庫：`sky770825/Ddbug-Runbook`
   - 點擊 **Begin setup**

4. **設定建置配置**
   - **Project name**: `ddbug-runbook`
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (留空)
   - **Framework preset**: `Vite` (或選擇 None)

5. **環境變數（可選）**
   - 如果需要，可以添加環境變數
   - 例如：`NODE_VERSION=20`

6. **儲存並部署**
   - 點擊 **Save and Deploy**
   - 等待建置完成

### 方法 2：使用 Wrangler CLI

如果您想使用 CLI 部署：

```bash
# 安裝 Wrangler
npm install -g wrangler

# 登入 Cloudflare
wrangler login

# 部署到 Cloudflare Pages
wrangler pages deploy dist --project-name=ddbug-runbook
```

## 建置配置

專案已包含以下配置檔案：

- `wrangler.toml` - Cloudflare Pages 配置
- `.cloudflare/pages.json` - Pages 建置設定

## 常見問題

### 1. 建置失敗：找不到模組
**解決方案**：確保 `package.json` 包含所有依賴，執行 `npm install`

### 2. 建置失敗：Node 版本不匹配
**解決方案**：在 Cloudflare Pages 設定中指定 Node.js 版本為 20

### 3. 路由 404 錯誤
**解決方案**：已在 `vite.config.ts` 和 `App.tsx` 中設定正確的 base path

### 4. 靜態資源載入失敗
**解決方案**：檢查 `vite.config.ts` 中的 `base` 設定

## 部署後的網址

部署成功後，您的網站將可在以下網址訪問：

**https://ddbug-runbook.pages.dev**

（實際網址可能因專案名稱而異）

## 檢查建置日誌

如果建置失敗，請檢查：

1. Cloudflare Dashboard > Workers & Pages > 您的專案 > Builds
2. 點擊失敗的建置查看詳細日誌
3. 常見錯誤：
   - 缺少依賴：檢查 `package.json`
   - 建置命令錯誤：確認 `npm run build` 可以正常執行
   - 輸出目錄錯誤：確認建置輸出在 `dist` 目錄

## 自動部署

連接 GitHub 後，每次推送到 `main` 分支都會自動觸發建置和部署。
