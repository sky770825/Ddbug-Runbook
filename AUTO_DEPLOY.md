# 自動化部署設定指南

## 已完成的自動化配置

專案已配置兩種自動化部署方式：

### 1. GitHub Actions 自動部署到 Cloudflare Pages

已建立 `.github/workflows/cloudflare-pages.yml`，當您推送代碼到 `main` 分支時會自動部署。

#### 設定步驟（只需設定一次）：

1. **取得 Cloudflare API Token**
   - 前往：https://dash.cloudflare.com/profile/api-tokens
   - 點擊 **Create Token**
   - 使用 **Edit Cloudflare Workers** 模板
   - 或自訂權限：
     - Account: Cloudflare Pages: Edit
     - Zone: 不需要（Pages 不需要 Zone）
   - 複製生成的 Token

2. **取得 Cloudflare Account ID**
   - 前往：https://dash.cloudflare.com
   - 在右側邊欄找到 **Account ID**
   - 複製 Account ID

3. **在 GitHub 設定 Secrets**
   - 前往：https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions
   - 點擊 **New repository secret**
   - 添加以下兩個 secrets：
     - `CLOUDFLARE_API_TOKEN` = 您的 API Token
     - `CLOUDFLARE_ACCOUNT_ID` = 您的 Account ID

4. **完成！**
   - 之後每次推送到 `main` 分支都會自動部署
   - 查看部署狀態：https://github.com/sky770825/Ddbug-Runbook/actions

### 2. 本地 CLI 部署（可選）

如果您想從本地部署：

```bash
# 安裝依賴（如果還沒安裝）
npm install

# 登入 Cloudflare（首次需要）
npx wrangler login

# 建置並部署
npm run deploy:cf
```

## 自動化流程

### GitHub Actions 流程

1. **觸發**：推送到 `main` 分支
2. **建置**：執行 `npm ci` 和 `npm run build`
3. **部署**：自動部署到 Cloudflare Pages
4. **完成**：網站自動更新

### 部署網址

部署成功後，網站將可在以下網址訪問：

**https://ddbug-runbook.pages.dev**

## 檢查部署狀態

### GitHub Actions
- 前往：https://github.com/sky770825/Ddbug-Runbook/actions
- 查看 "Deploy to Cloudflare Pages" workflow

### Cloudflare Dashboard
- 前往：https://dash.cloudflare.com
- Workers & Pages > ddbug-runbook
- 查看部署歷史和狀態

## 故障排除

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

## 手動觸發部署

如果需要手動觸發部署：

1. 前往：https://github.com/sky770825/Ddbug-Runbook/actions
2. 選擇 "Deploy to Cloudflare Pages"
3. 點擊 "Run workflow"
4. 選擇分支（通常是 `main`）
5. 點擊 "Run workflow"

## 注意事項

- 首次部署可能需要幾分鐘
- 部署後可能需要等待幾分鐘才能訪問網站
- 如果遇到 404，請確認 Cloudflare Pages 專案已正確建立
