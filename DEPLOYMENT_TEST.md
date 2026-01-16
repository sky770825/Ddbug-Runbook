# 🚀 自動化部署測試

## ✅ 已觸發部署

已推送一個空提交來觸發 GitHub Actions 自動部署。

## 📊 檢查部署狀態

### 1. GitHub Actions

前往以下網址查看部署狀態：

**https://github.com/sky770825/Ddbug-Runbook/actions**

您應該會看到：
- ✅ "Deploy to Cloudflare Pages" workflow 正在執行或已完成
- ✅ 點擊最新的執行查看詳細日誌

### 2. Cloudflare Dashboard

前往以下網址查看部署狀態：

**https://dash.cloudflare.com/82ebeb1d91888e83e8e1b30eeb33d3c3/pages/view/ddbug-runbook**

您應該會看到：
- ✅ 最新的部署正在進行或已完成
- ✅ 部署狀態為 "Success"

## 🔍 檢查項目

### 建置階段

在 GitHub Actions 日誌中，您應該看到：

1. ✅ **Checkout** - 成功檢出代碼
2. ✅ **Setup Node.js** - 成功設定 Node.js 20
3. ✅ **Install dependencies** - 成功執行 `npm ci`
4. ✅ **Build** - 成功執行 `npm run build`
   - 確認環境變數 `CF_PAGES=1` 已設定
   - 確認建置產生了 `dist` 目錄
5. ✅ **Deploy to Cloudflare Pages** - 成功部署

### 部署階段

在 Cloudflare Dashboard 中，您應該看到：

1. ✅ 建置命令執行成功
2. ✅ `dist` 目錄被找到
3. ✅ 部署成功完成
4. ✅ 網站可以正常訪問

## 🌐 部署網址

部署成功後，網站將可在以下網址訪問：

**https://ddbug-runbook.pages.dev**

## ⚠️ 如果部署失敗

### 檢查 GitHub Secrets

1. 前往：https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions
2. 確認以下 secrets 已設定：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

### 檢查建置日誌

1. 在 GitHub Actions 中查看詳細錯誤訊息
2. 確認建置步驟是否成功
3. 確認部署步驟的錯誤訊息

### 常見問題

#### 錯誤：`Authentication failed`

**原因**：API Token 無效或權限不足

**解決方案**：
- 重新生成 API Token
- 確認 Token 有 Pages 的編輯權限
- 確認 Token 已正確添加到 GitHub Secrets

#### 錯誤：`Project not found`

**原因**：Cloudflare Pages 專案不存在

**解決方案**：
- 首次部署會自動建立專案
- 如果仍然失敗，請在 Cloudflare Dashboard 中手動建立專案

#### 錯誤：`Failed: build output directory not found`

**原因**：建置沒有產生 `dist` 目錄

**解決方案**：
- 檢查建置日誌，確認 `npm run build` 成功執行
- 確認 `vite.config.ts` 中的 `outDir` 設定為 `dist`

## 📝 測試結果

請在以下位置查看測試結果：

1. **GitHub Actions**：https://github.com/sky770825/Ddbug-Runbook/actions
2. **Cloudflare Dashboard**：https://dash.cloudflare.com/82ebeb1d91888e83e8e1b30eeb33d3c3/pages/view/ddbug-runbook
3. **部署網址**：https://ddbug-runbook.pages.dev

## 🎉 成功指標

如果看到以下情況，表示部署成功：

- ✅ GitHub Actions workflow 顯示 "Success"
- ✅ Cloudflare Dashboard 顯示部署成功
- ✅ 網站可以正常訪問（https://ddbug-runbook.pages.dev）
- ✅ 網站功能正常運作
