# 🔧 Cloudflare Pages Error 522 修復指南

## 📋 錯誤說明

**Error 522: Connection timed out**

這表示 Cloudflare 無法連接到源服務器。在 Cloudflare Pages 的情況下，通常表示：

1. **部署尚未完成**：建置或部署仍在進行中
2. **建置失敗**：建置過程出現錯誤
3. **專案配置問題**：專案設定不正確
4. **專案不存在**：Cloudflare Pages 專案尚未建立

## 🔍 診斷步驟

### 步驟 1：檢查 Cloudflare Dashboard

1. 前往：https://dash.cloudflare.com/82ebeb1d91888e83e8e1b30eeb33d3c3/pages/view/ddbug-runbook

2. 檢查以下項目：
   - ✅ **部署狀態**：查看最新的部署是否成功
   - ✅ **建置日誌**：點擊部署查看詳細日誌
   - ✅ **專案狀態**：確認專案已正確建立

### 步驟 2：檢查 GitHub Actions

1. 前往：https://github.com/sky770825/Ddbug-Runbook/actions

2. 檢查最新的 workflow 執行：
   - ✅ 是否成功完成
   - ✅ 是否有錯誤訊息
   - ✅ 部署步驟是否成功

### 步驟 3：檢查專案是否存在

如果專案不存在，需要先建立：

1. 前往：https://dash.cloudflare.com
2. 點擊 **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**
3. 選擇 **GitHub**，選擇倉庫：`sky770825/Ddbug-Runbook`
4. 設定建置配置（參考 `DASHBOARD_SETUP.md`）

## 🛠️ 解決方案

### 方案 1：等待部署完成

如果部署正在進行中，請等待 2-5 分鐘後再試。

### 方案 2：檢查建置配置

確認 Cloudflare Dashboard 中的建置設定：

**Build command:**
```
npm ci && CF_PAGES=1 npm run build
```

**Build output directory:**
```
dist
```

**Node.js version:**
```
20
```

**Environment variables:**
- `CF_PAGES` = `1`
- `NODE_ENV` = `production`

### 方案 3：重新觸發部署

#### 方法 A：使用 GitHub Actions

1. 前往：https://github.com/sky770825/Ddbug-Runbook/actions
2. 選擇 **Deploy to Cloudflare Pages**
3. 點擊 **Run workflow**
4. 選擇 `main` 分支
5. 點擊 **Run workflow**

#### 方法 B：使用 Cloudflare Dashboard

1. 前往：https://dash.cloudflare.com/82ebeb1d91888e83e8e1b30eeb33d3c3/pages/view/ddbug-runbook
2. 點擊 **Retry deployment** 或 **Create deployment**
3. 選擇分支：`main`
4. 點擊 **Deploy**

### 方案 4：檢查 GitHub Secrets

如果使用 GitHub Actions，確認 Secrets 已正確設定：

1. 前往：https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions
2. 確認以下 secrets 存在：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

### 方案 5：手動建立專案（如果不存在）

如果專案不存在，需要手動建立：

1. 前往：https://dash.cloudflare.com
2. 點擊 **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**
3. 選擇 **GitHub**，授權後選擇倉庫：`sky770825/Ddbug-Runbook`
4. 設定：
   - **Project name**: `ddbug-runbook`
   - **Production branch**: `main`
   - **Build command**: `npm ci && CF_PAGES=1 npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (留空)
   - **Node.js version**: `20`
5. 環境變數：
   - `CF_PAGES` = `1`
   - `NODE_ENV` = `production`
6. 點擊 **Save and Deploy**

## 🔄 重新部署步驟

### 使用 GitHub Actions（推薦）

```bash
# 在本地執行
git commit --allow-empty -m "Retry deployment"
git push origin main
```

### 使用 Cloudflare Dashboard

1. 前往專案頁面
2. 點擊 **Retry deployment**
3. 等待部署完成

## ✅ 驗證部署成功

部署成功後，您應該看到：

1. ✅ Cloudflare Dashboard 顯示部署成功
2. ✅ GitHub Actions workflow 顯示 "Success"
3. ✅ 網站可以正常訪問（https://ddbug-runbook.pages.dev）
4. ✅ 不再出現 522 錯誤

## 📊 檢查清單

請確認以下項目：

- [ ] Cloudflare Pages 專案已建立
- [ ] 建置配置正確（Build command, Output directory, Node.js version）
- [ ] 環境變數已設定（CF_PAGES, NODE_ENV）
- [ ] GitHub Secrets 已設定（如果使用 GitHub Actions）
- [ ] 最新的部署狀態為 "Success"
- [ ] 建置日誌沒有錯誤

## 🆘 如果問題持續存在

如果嘗試以上方法後仍然出現 522 錯誤：

1. **檢查建置日誌**：查看是否有建置錯誤
2. **檢查專案設定**：確認所有設定都正確
3. **聯繫 Cloudflare 支援**：如果問題持續存在

## 📝 相關文件

- [DASHBOARD_SETUP.md](./DASHBOARD_SETUP.md) - Cloudflare Dashboard 設定指南
- [GITHUB_ACTIONS_GUIDE.md](./GITHUB_ACTIONS_GUIDE.md) - GitHub Actions 部署指南
- [AUTO_DEPLOY.md](./AUTO_DEPLOY.md) - 自動化部署設定指南
