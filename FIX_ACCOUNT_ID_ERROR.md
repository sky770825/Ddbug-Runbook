# 🔧 修復 Error: Input required and not supplied: accountId

## 📋 錯誤說明

這個錯誤表示 GitHub Actions workflow 無法找到 `CLOUDFLARE_ACCOUNT_ID` Secret。

**原因**：GitHub Secrets 中的 `CLOUDFLARE_ACCOUNT_ID` 沒有設定或設定不正確。

## ✅ 解決方案

### 步驟 1：取得 Cloudflare Account ID

1. 前往：https://dash.cloudflare.com
2. 在右側邊欄找到 **Account ID**
3. 點擊複製 Account ID（格式類似：`82ebeb1d91888e83e8e1b30eeb33d3c3`）

### 步驟 2：在 GitHub 設定 Secret

1. 前往：https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions
2. 點擊 **New repository secret**
3. 設定：
   - **Name**: `CLOUDFLARE_ACCOUNT_ID`
   - **Secret**: 貼上您的 Cloudflare Account ID
4. 點擊 **Add secret**

### 步驟 3：同時檢查 API Token

確認 `CLOUDFLARE_API_TOKEN` 也已設定：

1. 在 Secrets 頁面檢查是否存在 `CLOUDFLARE_API_TOKEN`
2. 如果不存在，請設定：
   - 前往：https://dash.cloudflare.com/profile/api-tokens
   - 建立新的 Token（使用 "Edit Cloudflare Workers" 模板）
   - 在 GitHub 添加 Secret：
     - **Name**: `CLOUDFLARE_API_TOKEN`
     - **Secret**: 您的 API Token

### 步驟 4：重新觸發部署

設定完成後，重新觸發部署：

```bash
git commit --allow-empty -m "Retry deployment after setting secrets"
git push origin main
```

或手動觸發：

1. 前往：https://github.com/sky770825/Ddbug-Runbook/actions
2. 選擇 **Deploy to Cloudflare Pages**
3. 點擊 **Run workflow**
4. 選擇分支：`main`
5. 點擊 **Run workflow**

## 🔍 驗證 Secrets 是否設定

### 檢查方法

1. 前往：https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions
2. 確認以下 Secrets 存在：
   - ✅ `CLOUDFLARE_API_TOKEN`
   - ✅ `CLOUDFLARE_ACCOUNT_ID`

### 注意事項

- Secrets 的值不會顯示（只會顯示名稱）
- 如果 Secret 已存在但值錯誤，需要刪除後重新添加
- Secret 名稱必須完全匹配（大小寫敏感）

## 📝 完整的 Secrets 設定清單

| Secret Name | 說明 | 取得方式 |
|------------|------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | https://dash.cloudflare.com/profile/api-tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | https://dash.cloudflare.com（右側邊欄） |

## 🎯 快速設定步驟

### 1. 取得 Account ID

```
前往：https://dash.cloudflare.com
在右側邊欄找到 Account ID
複製 Account ID
```

### 2. 在 GitHub 設定

```
前往：https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions
點擊 New repository secret
Name: CLOUDFLARE_ACCOUNT_ID
Secret: 貼上 Account ID
點擊 Add secret
```

### 3. 重新部署

```bash
git commit --allow-empty -m "Retry after setting CLOUDFLARE_ACCOUNT_ID"
git push origin main
```

## ✅ 設定完成後

設定完成後，GitHub Actions 應該可以正常執行：

1. ✅ 不再出現 "Input required and not supplied: accountId" 錯誤
2. ✅ Workflow 可以成功執行
3. ✅ 自動部署到 Cloudflare Pages

## 🐛 如果仍然失敗

如果設定 Secrets 後仍然失敗，請檢查：

1. **Secret 名稱是否正確**
   - 必須是：`CLOUDFLARE_ACCOUNT_ID`（完全匹配，大小寫敏感）
   - 不能有空格或特殊字元

2. **Account ID 是否正確**
   - 格式應該是：32 個十六進位字元（例如：`82ebeb1d91888e83e8e1b30eeb33d3c3`）
   - 不包含空格或連字號

3. **Workflow 檔案是否正確**
   - 確認 `.github/workflows/cloudflare-pages.yml` 存在
   - 確認檔案語法正確

## 📊 相關文件

- [AUTO_DEPLOY_CHECK.md](./AUTO_DEPLOY_CHECK.md) - 自動化檢查指南
- [GITHUB_ACTIONS_GUIDE.md](./GITHUB_ACTIONS_GUIDE.md) - GitHub Actions 完整指南
