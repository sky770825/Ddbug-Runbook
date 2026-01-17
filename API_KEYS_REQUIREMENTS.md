# 🔑 需要額外輸入 API、Key、Token 等功能清單

## 📋 總覽

以下列出所有需要額外輸入 API Key、Token、Secret、User ID 等資訊的功能及其對應的提示詞（Prompt）。

---

## 1. **步驟 1：RLS 政策阻擋存取**

### Prompt: p1-4 - 使用 service_role 繞過測試

**需要的資訊：**
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key（用於後端繞過 RLS 測試）

**位置：**
- `src/data/stepsData.ts` 第 224-256 行

**說明：**
- 用於測試時暫時繞過 RLS
- ⚠️ 僅在後端使用，不可暴露到前端

---

## 2. **步驟 3：網站安全性檢查**

### Prompt: p3-2 - 環境變數與敏感資料管理

**需要的資訊：**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key（公開）
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key（僅後端）
- `STRIPE_PUBLISHABLE_KEY` - Stripe 公開 Key（如使用）
- `STRIPE_SECRET_KEY` - Stripe 私密 Key（僅後端）
- `JWT_SECRET` - JWT 簽名密鑰（僅後端）

**位置：**
- `src/data/stepsData.ts` 第 1518-1570 行

**說明：**
- 檢查環境變數是否正確設定
- 區分公開和私密 Key 的使用場景

---

## 3. **步驟 5：環境變數檢查**

### Prompt: p5-1 - 列出需要的環境變數

**需要的資訊：**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key（僅後端）

**位置：**
- `src/data/stepsData.ts` 第 2668-2680 行

### Prompt: p5-2 - GitHub Actions Secrets

**需要的資訊：**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 專案 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key
- `SUPABASE_ACCESS_TOKEN` - Supabase CLI Access Token（用於 CLI 操作）

**位置：**
- `src/data/stepsData.ts` 第 2715-2747 行

**說明：**
- 用於 GitHub Actions CI/CD 流程
- 需要在 GitHub Repository Settings > Secrets 中設定

---

## 4. **步驟 7：Supabase Authentication 自動化設定**

### Prompt: p7-1 - 自動設定 Email/Password 登入

**需要的資訊：**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key（用於前端登入）

**位置：**
- `src/data/stepsData.ts` 第 1834-1885 行

### Prompt: p7-3 - OAuth 登入自動設定

**需要的資訊：**
- **OAuth Provider Client ID** - 從對應平台取得（Google、GitHub、Apple 等）
- **OAuth Provider Client Secret** - 從對應平台取得

**位置：**
- `src/data/stepsData.ts` 第 1996-2045 行

**說明：**
- 需要在 Supabase Dashboard > Authentication > Providers 中設定
- 每個 OAuth Provider 都需要各自的 Client ID 和 Client Secret

---

## 5. **步驟 8：Supabase Realtime 即時同步**

### Prompt: p8-1 - 啟用 Realtime

**需要的資訊：**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key（用於建立 Realtime 連線）

**位置：**
- `src/data/stepsData.ts` 第 2071-2112 行

**說明：**
- 使用 Anon Key 建立 Realtime 訂閱
- 需要 User ID（`auth.uid()`）用於過濾訂閱內容

---

## 6. **步驟 9：Supabase Edge Functions 自動化部署**

### Prompt: p9-2 - 部署 Edge Function 與設定環境變數

**需要的資訊：**
- `{{resend_api_key}}` - Resend API Key（用於 Email 功能）
- `SUPABASE_ANON_KEY` - Supabase Anon Key（Edge Function 內部使用）
- `YOUR_ANON_KEY` - 用於測試 Edge Function 的 Authorization Header

**位置：**
- `src/data/stepsData.ts` 第 2349-2397 行

**說明：**
- 使用 `npx supabase secrets set RESEND_API_KEY={{resend_api_key}}` 設定
- 可在專案設定中填入 `resend_api_key` 變數

### Prompt: p9-3 - 定時任務（Cron Jobs）

**需要的資訊：**
- `{{cron_secret}}` - Cron Secret（用於驗證定時任務請求）
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key（用於後端操作）

**位置：**
- `src/data/stepsData.ts` 第 2404-2476 行

**說明：**
- 使用 `npx supabase secrets set CRON_SECRET={{cron_secret}}` 設定
- 可在專案設定中填入 `cron_secret` 變數

---

## 7. **步驟 11：CRM 客戶資料管理**

### Prompt: p11-1 - 客戶資料表設計

**需要的資訊：**
- `user_id` - 用戶 ID（透過 `auth.uid()` 取得）

**位置：**
- `src/data/stepsData.ts` 第 1977-2040 行

**說明：**
- User ID 用於 RLS 政策，確保用戶只能存取自己的資料

---

## 8. **步驟 12：Email 自動寄發設定**

### Prompt: p12-1 - Resend Email 服務設定

**需要的資訊：**
- `{{resend_api_key}}` - Resend API Key

**位置：**
- `src/data/stepsData.ts` 第 3074-3113 行

**說明：**
- 使用 `npx supabase secrets set RESEND_API_KEY={{resend_api_key}}` 設定
- 可在專案設定中填入 `resend_api_key` 變數

---

## 9. **步驟 13：LINE 訊息自動化**

### Prompt: p13-1 - LINE Messaging API 設定

**需要的資訊：**
- `{{line_channel_access_token}}` - LINE Channel Access Token
- `{{line_channel_secret}}` - LINE Channel Secret

**位置：**
- `src/data/stepsData.ts` 第 3274-3307 行

**說明：**
- 使用 `npx supabase secrets set LINE_CHANNEL_ACCESS_TOKEN={{line_channel_access_token}}` 設定
- 使用 `npx supabase secrets set LINE_CHANNEL_SECRET={{line_channel_secret}}` 設定
- 可在專案設定中填入 `line_channel_access_token` 和 `line_channel_secret` 變數

---

## 10. **步驟 18：部署問題排除**

### Prompt: p18-1 - Cloudflare Pages 部署設定

**需要的資訊：**
- `CLOUDFLARE_API_TOKEN` - Cloudflare API Token（用於 GitHub Actions）
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare Account ID（用於 GitHub Actions）

**位置：**
- `src/data/stepsData.ts` 第 5349-5384 行

**說明：**
- 需要在 GitHub Repository Settings > Secrets > Actions 中設定
- 用於自動化部署到 Cloudflare Pages

---

## 📊 變數對應表

| 變數名稱 | 對應的 Key/Token | 使用位置 | 是否可在專案設定中填入 |
|---------|-----------------|---------|---------------------|
| `resend_api_key` | Resend API Key | Edge Functions, Email 自動化 | ✅ 是 |
| `line_channel_access_token` | LINE Channel Access Token | LINE 訊息自動化 | ✅ 是 |
| `line_channel_secret` | LINE Channel Secret | LINE 訊息自動化 | ✅ 是 |
| `cron_secret` | Cron Secret | Edge Functions 定時任務 | ✅ 是 |
| `supabase_ref` | Supabase Project Ref | 多處使用 | ✅ 是 |
| `bucket_name` | Storage Bucket 名稱 | Storage 功能 | ✅ 是 |
| `table_name` | 資料表名稱 | RLS、查詢 | ✅ 是 |
| `field_name` | 欄位名稱 | RLS Policy | ✅ 是 |

---

## ⚠️ 注意事項

### 1. **環境變數 vs 專案設定變數**

- **環境變數**：需要在 `.env` 檔案或系統環境中設定
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ACCESS_TOKEN`

- **專案設定變數**：可在專案設定抽屜中填入，會自動替換到 prompts 中
  - `{{resend_api_key}}`
  - `{{line_channel_access_token}}`
  - `{{cron_secret}}`

### 2. **安全性分類**

- **公開 Key**（可暴露到前端）：
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `STRIPE_PUBLISHABLE_KEY`

- **私密 Key**（僅後端使用）：
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `JWT_SECRET`
  - `CRON_SECRET`
  - `RESEND_API_KEY`
  - `LINE_CHANNEL_SECRET`

### 3. **取得方式**

- **Supabase Keys**：Supabase Dashboard > Settings > API
- **OAuth Credentials**：對應平台（Google、GitHub 等）的開發者控制台
- **Resend API Key**：Resend Dashboard > API Keys
- **LINE Credentials**：LINE Developers Console
- **Cloudflare Credentials**：Cloudflare Dashboard > Profile > API Tokens

---

## 🔍 快速檢查清單

使用此功能前，請確認：

- [ ] 已取得所有需要的 API Keys/Tokens
- [ ] 已在專案設定中填入可填入的變數
- [ ] 已設定環境變數（`.env` 檔案）
- [ ] 已在 GitHub Secrets 中設定 CI/CD 需要的變數
- [ ] 已在 Supabase Secrets 中設定 Edge Functions 需要的變數
- [ ] 已確認公開和私密 Key 的使用場景正確
