# 🔧 修復重複部署問題

## 📋 問題說明

您現在有**兩種部署方式**同時運作：

1. **Cloudflare Dashboard Git 整合**（已設定，推薦）
   - ✅ 不需要 GitHub Secrets
   - ✅ 自動部署
   - ✅ 設定簡單

2. **GitHub Actions**（也在執行）
   - ❌ 需要 GitHub Secrets
   - ❌ 目前缺少 `CLOUDFLARE_ACCOUNT_ID`
   - ⚠️ 導致錯誤

## 🎯 解決方案

### 方案 1：禁用 GitHub Actions（推薦）

既然您已經設定了 Cloudflare Dashboard 的 Git 整合，可以禁用 GitHub Actions 避免重複部署。

#### 步驟 1：重命名 Workflow 檔案

將 workflow 檔案重命名，GitHub Actions 就不會執行：

```bash
mv .github/workflows/cloudflare-pages.yml .github/workflows/cloudflare-pages.yml.disabled
```

或者直接刪除：

```bash
rm .github/workflows/cloudflare-pages.yml
```

#### 優點

- ✅ 只使用 Cloudflare Dashboard 的 Git 整合
- ✅ 不需要設定 GitHub Secrets
- ✅ 避免重複部署
- ✅ 更簡單直接

### 方案 2：設定 GitHub Secrets（如果想保留 GitHub Actions）

如果您想同時使用兩種方式，需要設定 GitHub Secrets。

#### 步驟 1：取得 Cloudflare Account ID

1. 前往：https://dash.cloudflare.com
2. 在右側邊欄找到 **Account ID**
3. 複製 Account ID

#### 步驟 2：在 GitHub 設定 Secret

1. 前往：https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions
2. 點擊 **New repository secret**
3. 設定：
   - **Name**: `CLOUDFLARE_ACCOUNT_ID`
   - **Secret**: 貼上您的 Account ID
4. 點擊 **Add secret**

#### 步驟 3：同時檢查 API Token

確認 `CLOUDFLARE_API_TOKEN` 也已設定：

1. 在 Secrets 頁面檢查是否存在 `CLOUDFLARE_API_TOKEN`
2. 如果不存在，請設定：
   - 前往：https://dash.cloudflare.com/profile/api-tokens
   - 建立新的 Token
   - 在 GitHub 添加 Secret

#### 注意

如果同時使用兩種方式，每次推送會觸發**兩次部署**：
- Cloudflare Dashboard 自動部署
- GitHub Actions 自動部署

這可能會造成混淆。

## 💡 推薦方案

**建議使用方案 1：禁用 GitHub Actions**

原因：
- ✅ 您已經設定了 Cloudflare Dashboard 的 Git 整合
- ✅ 不需要設定 GitHub Secrets
- ✅ 避免重複部署
- ✅ 更簡單直接

## 🔄 執行方案 1（推薦）

讓我幫您禁用 GitHub Actions：

```bash
# 重命名 workflow 檔案（保留備份）
mv .github/workflows/cloudflare-pages.yml .github/workflows/cloudflare-pages.yml.disabled
git add .github/workflows/
git commit -m "Disable GitHub Actions, use Cloudflare Dashboard Git integration instead"
git push origin main
```

這樣之後：
- ✅ 只使用 Cloudflare Dashboard 的 Git 整合
- ✅ 不會再出現 accountId 錯誤
- ✅ 每次推送代碼自動部署（通過 Cloudflare Dashboard）

## 📊 對比

| 項目 | Cloudflare Dashboard | GitHub Actions |
|------|---------------------|----------------|
| 設定複雜度 | ⭐ 簡單 | ⭐⭐⭐⭐ 複雜 |
| 需要 Secrets | ❌ 不需要 | ✅ 需要 |
| 自動化 | ✅ 完全自動 | ✅ 完全自動 |
| 推薦 | ✅ 是 | ⚠️ 不推薦（如果已用 Dashboard） |

## ✅ 確認

請告訴我您想使用哪個方案：

1. **方案 1**：禁用 GitHub Actions（推薦）
2. **方案 2**：設定 GitHub Secrets 保留 GitHub Actions

我可以幫您執行選擇的方案。
