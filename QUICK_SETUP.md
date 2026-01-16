# 🚀 快速設定指南

## 自動化部署已配置完成！

專案已完全配置好自動化部署，您只需要完成最後一步：

## ⚡ 一鍵完成設定（推薦）

### 方法 1：使用自動化腳本

```bash
# 執行自動化設定腳本
./setup-cloudflare.sh
```

這個腳本會：
1. ✅ 檢查並登入 Cloudflare（如果需要）
2. ✅ 建置專案
3. ✅ 部署到 Cloudflare Pages
4. ✅ 顯示您需要的 GitHub Secrets 資訊

### 方法 2：手動設定 GitHub Secrets（用於自動部署）

如果您想使用 GitHub Actions 自動部署，請設定以下 Secrets：

1. **前往 GitHub Secrets 設定頁面**
   - https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions

2. **取得 Cloudflare API Token**
   - 前往：https://dash.cloudflare.com/profile/api-tokens
   - 點擊 **Create Token**
   - 使用 **Edit Cloudflare Workers** 模板
   - 或自訂權限：Account > Cloudflare Pages > Edit
   - 複製 Token

3. **取得 Cloudflare Account ID**
   - 前往：https://dash.cloudflare.com
   - 在右側邊欄找到 **Account ID**
   - 複製 Account ID

4. **在 GitHub 新增 Secrets**
   - 點擊 **New repository secret**
   - 新增 `CLOUDFLARE_API_TOKEN` = 您的 API Token
   - 新增 `CLOUDFLARE_ACCOUNT_ID` = 您的 Account ID

5. **完成！**
   - 之後每次推送到 `main` 分支都會自動部署
   - 查看：https://github.com/sky770825/Ddbug-Runbook/actions

## 📋 已完成的配置

✅ GitHub Actions workflow (`.github/workflows/cloudflare-pages.yml`)
✅ Cloudflare Pages 配置 (`wrangler.toml`)
✅ Vite 建置配置（支援 Cloudflare Pages）
✅ React Router 配置（支援 Cloudflare Pages）
✅ 部署腳本 (`npm run deploy:cf`)

## 🌐 部署後的網址

部署成功後，您的網站將可在以下網址訪問：

**https://ddbug-runbook.pages.dev**

## 🔍 檢查部署狀態

- **GitHub Actions**: https://github.com/sky770825/Ddbug-Runbook/actions
- **Cloudflare Dashboard**: https://dash.cloudflare.com > Workers & Pages > ddbug-runbook

## 💡 提示

- 首次部署可能需要 2-5 分鐘
- 部署後可能需要等待幾分鐘才能訪問網站
- 如果遇到問題，請查看建置日誌
