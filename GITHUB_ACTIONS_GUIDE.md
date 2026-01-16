# GitHub Actions 自動部署指南

## 📋 概述

專案已配置 GitHub Actions 工作流程，可以自動將代碼部署到 Cloudflare Pages。

## 🔧 工作流程檔案

工作流程檔案位於：`.github/workflows/cloudflare-pages.yml`

### 觸發條件

- **自動觸發**：當代碼推送到 `main` 分支時
- **手動觸發**：在 GitHub Actions 頁面手動執行

### 工作流程步驟

1. **Checkout**：檢出代碼
2. **Setup Node.js**：設定 Node.js 20 環境
3. **Install dependencies**：執行 `npm ci` 安裝依賴
4. **Build**：執行 `npm run build` 建置專案
   - 環境變數：
     - `NODE_ENV=production`
     - `CF_PAGES=1`（確保使用正確的 base path）
5. **Deploy**：使用 `cloudflare/pages-action@v1` 部署到 Cloudflare Pages

## 🚀 設定步驟（只需一次）

### 1. 取得 Cloudflare API Token

1. 前往：https://dash.cloudflare.com/profile/api-tokens
2. 點擊 **Create Token**
3. 使用 **Edit Cloudflare Workers** 模板，或自訂權限：
   - **Account**: `Cloudflare Pages: Edit`
   - **Zone**: 不需要（Pages 不需要 Zone）
4. 複製生成的 Token（只會顯示一次，請妥善保存）

### 2. 取得 Cloudflare Account ID

1. 前往：https://dash.cloudflare.com
2. 在右側邊欄找到 **Account ID**
3. 複製 Account ID

### 3. 在 GitHub 設定 Secrets

1. 前往：https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions
2. 點擊 **New repository secret**
3. 添加以下兩個 secrets：

   | Secret name | Value |
   |------------|-------|
   | `CLOUDFLARE_API_TOKEN` | 您的 Cloudflare API Token |
   | `CLOUDFLARE_ACCOUNT_ID` | 您的 Cloudflare Account ID |

### 4. 完成！

設定完成後，每次推送到 `main` 分支都會自動觸發部署。

## 📊 查看部署狀態

### GitHub Actions

1. 前往：https://github.com/sky770825/Ddbug-Runbook/actions
2. 查看 "Deploy to Cloudflare Pages" workflow
3. 點擊最新的執行查看詳細日誌

### Cloudflare Dashboard

1. 前往：https://dash.cloudflare.com
2. 點擊 **Workers & Pages** > **ddbug-runbook**
3. 查看部署歷史和狀態

## 🔄 手動觸發部署

如果需要手動觸發部署：

1. 前往：https://github.com/sky770825/Ddbug-Runbook/actions
2. 選擇 **Deploy to Cloudflare Pages**
3. 點擊 **Run workflow**
4. 選擇分支（通常是 `main`）
5. 點擊 **Run workflow**

## 🎯 部署網址

部署成功後，網站將可在以下網址訪問：

**https://ddbug-runbook.pages.dev**

## ⚠️ 注意事項

### 首次部署

- 如果 Cloudflare Pages 專案不存在，GitHub Actions 會自動建立
- 首次部署可能需要幾分鐘
- 部署後可能需要等待幾分鐘才能訪問網站

### 建置環境

- 使用 Node.js 20
- 使用 `npm ci` 進行乾淨安裝
- 自動設定 `CF_PAGES=1` 確保使用正確的 base path

### 環境變數

工作流程自動設定以下環境變數：
- `NODE_ENV=production`
- `CF_PAGES=1`

這些變數確保建置時使用正確的配置。

## 🐛 故障排除

### 如果部署失敗

1. **檢查 GitHub Secrets**
   - 確認 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 已正確設定
   - Token 需要有 Pages 的編輯權限

2. **檢查建置日誌**
   - 在 GitHub Actions 中查看詳細錯誤訊息
   - 確認 `npm run build` 可以正常執行

3. **檢查 Cloudflare 專案**
   - 確認專案名稱 `ddbug-runbook` 正確
   - 如果專案不存在，首次部署會自動建立

4. **檢查環境變數**
   - 確認 `CF_PAGES=1` 已設定（已在 workflow 中設定）

### 常見錯誤

#### 錯誤：`Failed: build output directory not found`

**原因**：建置沒有產生 `dist` 目錄

**解決方案**：
- 檢查建置日誌，確認 `npm run build` 成功執行
- 確認 `vite.config.ts` 中的 `outDir` 設定為 `dist`

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

## 📝 工作流程檔案內容

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy to Cloudflare Pages
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          NODE_ENV: production
          CF_PAGES: '1'

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ddbug-runbook
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

## 🔗 相關文件

- [AUTO_DEPLOY.md](./AUTO_DEPLOY.md) - 自動化部署設定指南
- [DASHBOARD_SETUP.md](./DASHBOARD_SETUP.md) - Cloudflare Dashboard 設定指南
- [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md) - Cloudflare Pages 部署說明
