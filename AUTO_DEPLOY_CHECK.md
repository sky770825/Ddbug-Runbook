# 🔍 GitHub Actions 自動化檢查指南

## 📋 問題：為什麼沒有辦法自動 API 自動化？

GitHub Actions 自動部署需要滿足以下條件才能正常運作。

## ✅ 自動化觸發條件

### 1. Workflow 檔案存在

✅ 已確認：`.github/workflows/cloudflare-pages.yml` 存在

### 2. 觸發條件設定

Workflow 會在以下情況自動觸發：
- ✅ 推送到 `main` 分支
- ✅ 手動觸發（workflow_dispatch）

### 3. GitHub Secrets 必須設定

⚠️ **這是關鍵！** 如果 Secrets 沒有設定，部署會失敗。

需要設定的 Secrets：
- `CLOUDFLARE_API_TOKEN` - Cloudflare API Token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare Account ID

## 🔍 檢查步驟

### 步驟 1：檢查 GitHub Secrets 是否設定

1. 前往：https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions
2. 確認以下 Secrets 是否存在：
   - [ ] `CLOUDFLARE_API_TOKEN`
   - [ ] `CLOUDFLARE_ACCOUNT_ID`

如果沒有設定，請按照以下步驟設定：

#### 取得 Cloudflare API Token

1. 前往：https://dash.cloudflare.com/profile/api-tokens
2. 點擊 **Create Token**
3. 使用 **Edit Cloudflare Workers** 模板，或自訂權限：
   - **Account**: `Cloudflare Pages: Edit`
   - **Zone**: 不需要（Pages 不需要 Zone）
4. 複製生成的 Token（只會顯示一次）

#### 取得 Cloudflare Account ID

1. 前往：https://dash.cloudflare.com
2. 在右側邊欄找到 **Account ID**
3. 複製 Account ID

#### 在 GitHub 設定 Secrets

1. 前往：https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions
2. 點擊 **New repository secret**
3. 添加：
   - Name: `CLOUDFLARE_API_TOKEN`
   - Secret: 您的 API Token
4. 再次點擊 **New repository secret**
5. 添加：
   - Name: `CLOUDFLARE_ACCOUNT_ID`
   - Secret: 您的 Account ID

### 步驟 2：檢查 GitHub Actions 是否執行

1. 前往：https://github.com/sky770825/Ddbug-Runbook/actions
2. 查看是否有 "Deploy to Cloudflare Pages" workflow
3. 檢查最新的執行：
   - ✅ 如果顯示 "Success"：自動化正常運作
   - ❌ 如果顯示 "Failed"：點擊查看錯誤訊息
   - ⏳ 如果顯示 "In progress"：正在執行中

### 步驟 3：檢查 Workflow 是否被觸發

如果推送到 `main` 分支後沒有自動觸發：

1. **檢查分支名稱**
   - 確認推送的分支是 `main`（不是 `master` 或其他名稱）

2. **檢查 Workflow 檔案路徑**
   - 確認檔案位於：`.github/workflows/cloudflare-pages.yml`
   - 確認檔案語法正確（YAML 格式）

3. **檢查權限**
   - 確認 GitHub Actions 已啟用
   - 前往：Settings > Actions > General
   - 確認 "Allow all actions and reusable workflows" 已啟用

## 🛠️ 測試自動化

### 方法 1：推送一個空提交測試

```bash
git commit --allow-empty -m "Test GitHub Actions auto deployment"
git push origin main
```

推送後，前往 GitHub Actions 頁面查看是否自動觸發。

### 方法 2：手動觸發 Workflow

1. 前往：https://github.com/sky770825/Ddbug-Runbook/actions
2. 選擇 **Deploy to Cloudflare Pages**
3. 點擊 **Run workflow**
4. 選擇分支：`main`
5. 點擊 **Run workflow**

## 🐛 常見問題

### Q1: Workflow 沒有自動觸發

**可能原因：**
- Secrets 沒有設定
- 推送的分支不是 `main`
- Workflow 檔案語法錯誤
- GitHub Actions 未啟用

**解決方案：**
- 檢查 Secrets 是否設定
- 確認推送的分支名稱
- 檢查 Workflow 檔案語法
- 確認 GitHub Actions 已啟用

### Q2: Workflow 執行但部署失敗

**可能原因：**
- Secrets 值錯誤
- API Token 權限不足
- Account ID 錯誤
- Cloudflare Pages 專案不存在

**解決方案：**
- 重新生成 API Token
- 確認 Token 有 Pages 的編輯權限
- 確認 Account ID 正確
- 在 Cloudflare Dashboard 中建立專案

### Q3: Workflow 顯示 "Success" 但網站打不開

**可能原因：**
- 建置配置不正確
- Base path 設定錯誤
- 環境變數未設定

**解決方案：**
- 檢查 Cloudflare Dashboard 中的建置配置
- 確認 `CF_PAGES=1` 已設定
- 參考 `CLOUDFLARE_DEPLOY_FIX.md`

## 📊 自動化流程圖

```
推送代碼到 main 分支
    ↓
GitHub Actions 自動觸發
    ↓
檢查 GitHub Secrets
    ↓
執行建置 (npm ci && npm run build)
    ↓
部署到 Cloudflare Pages
    ↓
網站自動更新
```

## ✅ 驗證自動化是否正常

### 檢查清單

- [ ] GitHub Secrets 已設定（CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID）
- [ ] Workflow 檔案存在（`.github/workflows/cloudflare-pages.yml`）
- [ ] 推送到 `main` 分支後自動觸發
- [ ] Workflow 執行成功
- [ ] Cloudflare Pages 部署成功
- [ ] 網站可以正常訪問

## 🚀 啟用自動化的完整步驟

### 1. 設定 GitHub Secrets（只需一次）

```bash
# 前往 GitHub 設定頁面
https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions

# 添加兩個 Secrets：
# 1. CLOUDFLARE_API_TOKEN = 您的 Cloudflare API Token
# 2. CLOUDFLARE_ACCOUNT_ID = 您的 Cloudflare Account ID
```

### 2. 測試自動化

```bash
# 推送一個空提交測試
git commit --allow-empty -m "Test auto deployment"
git push origin main
```

### 3. 檢查結果

1. 前往：https://github.com/sky770825/Ddbug-Runbook/actions
2. 查看 "Deploy to Cloudflare Pages" workflow
3. 確認執行成功

## 📝 相關文件

- [GITHUB_ACTIONS_GUIDE.md](./GITHUB_ACTIONS_GUIDE.md) - GitHub Actions 完整指南
- [AUTO_DEPLOY.md](./AUTO_DEPLOY.md) - 自動化部署設定指南
- [CLOUDFLARE_DEPLOY_FIX.md](./CLOUDFLARE_DEPLOY_FIX.md) - Cloudflare 部署問題修復

## 🎯 快速診斷

如果自動化沒有運作，請回答以下問題：

1. **GitHub Secrets 是否已設定？**
   - 前往：https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions
   - 確認 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 存在

2. **Workflow 是否有執行？**
   - 前往：https://github.com/sky770825/Ddbug-Runbook/actions
   - 查看是否有 "Deploy to Cloudflare Pages" 的執行記錄

3. **如果 Workflow 有執行，狀態是什麼？**
   - Success：自動化正常，但可能有其他問題
   - Failed：查看錯誤訊息
   - 沒有執行：檢查觸發條件和 Secrets
