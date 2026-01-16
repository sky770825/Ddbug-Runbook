# 🔧 Cloudflare Pages 部署問題修復

## 📋 問題描述

- ✅ GitHub Pages 可以正常打開
- ❌ Cloudflare Pages 無法打開
- ❌ 一直無法順利部署

這表示專案本身是正常的，問題出在 Cloudflare Pages 的建置或部署配置。

## 🔍 診斷步驟

### 步驟 1：檢查 Cloudflare Dashboard 建置日誌

1. 前往：https://dash.cloudflare.com/82ebeb1d91888e83e8e1b30eeb33d3c3/pages/view/ddbug-runbook
2. 點擊 **Deployments** 標籤
3. 查看最新的部署：
   - 狀態是什麼？（Success / Failed / Building）
   - 點擊部署查看詳細日誌
   - 檢查建置步驟是否有錯誤

### 步驟 2：檢查建置配置

在 Cloudflare Dashboard 中確認：

**Settings > Builds & deployments**

確認以下設定：

| 項目 | 應該的值 |
|------|---------|
| **Build command** | `npm ci && CF_PAGES=1 npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` (留空) |
| **Node.js version** | `20` |

**Environment variables:**
- `CF_PAGES` = `1`
- `NODE_ENV` = `production`

### 步驟 3：檢查建置日誌中的錯誤

常見錯誤：

1. **"No build command specified"**
   - 解決：在 Dashboard 中設定 Build command

2. **"Output directory 'dist' not found"**
   - 解決：確認建置命令正確執行，產生 dist 目錄

3. **"Build failed"**
   - 解決：查看詳細錯誤訊息，通常是依賴或建置錯誤

4. **"Authentication failed"**
   - 解決：檢查 GitHub 連接是否正常

## 🛠️ 解決方案

### 方案 1：重新設定建置配置（推薦）

1. **前往 Cloudflare Dashboard**
   - https://dash.cloudflare.com/82ebeb1d91888e83e8e1b30eeb33d3c3/pages/view/ddbug-runbook

2. **點擊 Settings > Builds & deployments**

3. **更新建置設定**：
   ```
   Build command: npm ci && CF_PAGES=1 npm run build
   Build output directory: dist
   Root directory: / (留空)
   Node.js version: 20
   ```

4. **設定環境變數**：
   - 點擊 **Add variable**
   - `CF_PAGES` = `1`
   - `NODE_ENV` = `production`

5. **儲存並重新部署**

### 方案 2：使用 Wrangler CLI 手動部署（測試用）

如果 Dashboard 部署一直失敗，可以先用 CLI 測試：

```bash
# 安裝 Wrangler（如果還沒安裝）
npm install -g wrangler

# 登入 Cloudflare
npx wrangler login

# 建置專案
CF_PAGES=1 npm run build

# 部署到 Cloudflare Pages
npx wrangler pages deploy dist --project-name=ddbug-runbook
```

如果 CLI 部署成功，表示問題在 Dashboard 配置。

### 方案 3：刪除並重新建立專案

如果以上方法都不行，可以嘗試：

1. **刪除現有專案**（在 Cloudflare Dashboard 中）
2. **重新建立專案**：
   - Workers & Pages > Create application > Pages > Connect to Git
   - 選擇 GitHub，選擇倉庫：`sky770825/Ddbug-Runbook`
   - 設定建置配置（參考方案 1）
   - 點擊 Save and Deploy

### 方案 4：檢查 GitHub Actions 部署

如果使用 GitHub Actions：

1. 前往：https://github.com/sky770825/Ddbug-Runbook/actions
2. 查看 "Deploy to Cloudflare Pages" workflow
3. 確認：
   - Secrets 已正確設定（CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID）
   - 部署步驟是否成功
   - 是否有錯誤訊息

## 🔄 重新部署步驟

### 方法 A：在 Cloudflare Dashboard 中

1. 前往專案頁面
2. 點擊 **Create deployment**
3. 選擇分支：`main`
4. 點擊 **Deploy**
5. 等待建置完成（約 2-5 分鐘）

### 方法 B：使用 GitHub Actions

推送一個空提交觸發部署：

```bash
git commit --allow-empty -m "Retry Cloudflare Pages deployment"
git push origin main
```

## ✅ 驗證部署成功

部署成功後，您應該看到：

1. ✅ Cloudflare Dashboard 顯示部署狀態為 "Success"
2. ✅ 建置日誌顯示建置成功
3. ✅ 網站可以正常訪問（https://ddbug-runbook.pages.dev）
4. ✅ 不再出現 522 或 404 錯誤

## 🐛 常見問題排查

### Q1: 建置一直失敗

**檢查項目：**
- [ ] Node.js 版本是否為 20
- [ ] 建置命令是否正確
- [ ] 環境變數是否設定
- [ ] 建置日誌中的具體錯誤訊息

### Q2: 建置成功但網站打不開

**可能原因：**
- Base path 設定錯誤
- `_redirects` 檔案未正確部署
- 靜態資源路徑錯誤

**解決方案：**
- 確認 `CF_PAGES=1` 已設定
- 確認 `public/_redirects` 檔案存在
- 檢查 `dist/index.html` 中的資源路徑

### Q3: GitHub Pages 可以但 Cloudflare Pages 不行

**可能原因：**
- 建置配置不同
- 環境變數未設定
- Base path 設定錯誤

**解決方案：**
- 確認 Cloudflare Pages 使用 `CF_PAGES=1`
- 確認建置命令包含 `CF_PAGES=1`
- 確認環境變數已設定

## 📊 對比 GitHub Pages 和 Cloudflare Pages

| 項目 | GitHub Pages | Cloudflare Pages |
|------|-------------|------------------|
| Base path | `/Ddbug-Runbook/` | `/` |
| 建置命令 | `npm run build` | `npm ci && CF_PAGES=1 npm run build` |
| 環境變數 | 不需要 | `CF_PAGES=1` |
| 輸出目錄 | `dist` | `dist` |

## 🎯 快速修復檢查清單

請確認以下項目：

- [ ] Cloudflare Dashboard 中的建置命令：`npm ci && CF_PAGES=1 npm run build`
- [ ] 建置輸出目錄：`dist`
- [ ] Node.js 版本：`20`
- [ ] 環境變數 `CF_PAGES=1` 已設定
- [ ] 環境變數 `NODE_ENV=production` 已設定
- [ ] 最新的部署狀態為 "Success"
- [ ] 建置日誌沒有錯誤
- [ ] `public/_redirects` 檔案存在

## 📝 下一步

1. **檢查 Cloudflare Dashboard 建置日誌**
   - 查看具體的錯誤訊息
   - 確認建置步驟是否成功

2. **重新設定建置配置**
   - 按照方案 1 重新設定
   - 確保所有設定都正確

3. **重新部署**
   - 在 Dashboard 中點擊 "Retry deployment"
   - 或使用 GitHub Actions 觸發部署

4. **如果仍然失敗**
   - 請提供建置日誌中的具體錯誤訊息
   - 我可以根據錯誤訊息提供更具體的解決方案

## 🔗 相關文件

- [DASHBOARD_SETUP.md](./DASHBOARD_SETUP.md) - Dashboard 設定指南
- [ERROR_522_FIX.md](./ERROR_522_FIX.md) - Error 522 故障排除
- [GITHUB_ACTIONS_GUIDE.md](./GITHUB_ACTIONS_GUIDE.md) - GitHub Actions 指南
