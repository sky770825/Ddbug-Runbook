# 📊 n8n 串接 Google Sheets API 完整解決方案

## 📋 問題分析

### 當前問題
- ❌ 整個串接流程需要手動處理
- ❌ OAuth 認證設定複雜
- ❌ 需要多次手動操作（Google Cloud Console + n8n 設定）
- ❌ 容易出現設定錯誤（Redirect URI、Scope 等）

### 問題根源
1. **OAuth 2.0 認證流程複雜** - 需要 Google Cloud Console 和 n8n 兩邊設定
2. **多步驟手動操作** - 沒有自動化工具
3. **設定容易出錯** - Redirect URI、Scope、API 啟用等
4. **文檔分散** - 資訊分散在多個地方

---

## 🎯 解決方案總覽

### 方案一：完整手動設定指南（基礎方案）
- 提供詳細的逐步設定指南
- 包含所有必要的設定步驟
- 適合初次使用或需要完全控制的情況

### 方案二：n8n 自動化設定工作流程（進階方案）
- 建立 n8n 工作流程來自動化部分設定
- 減少手動操作步驟
- 適合需要重複設定的情況

### 方案三：使用 Service Account（企業方案）
- 使用 Service Account 代替 OAuth
- 不需要使用者授權
- 適合自動化場景

### 方案四：建立設定檢查工具（最佳實踐）
- 建立診斷工具檢查設定是否正確
- 自動驗證所有必要設定
- 提供錯誤修正建議

---

## 📝 方案一：完整手動設定指南

### 第一部分：Google Cloud Console 設定

#### 步驟 1：建立或選擇專案
```
1. 前往 https://console.cloud.google.com/
2. 建立新專案或選擇現有專案
3. 記下專案 ID（後續會用到）
```

#### 步驟 2：啟用必要的 API
```
需要啟用的 API：
✅ Google Sheets API
✅ Google Drive API（因為 Sheets 檔案存在 Drive 中）

操作步驟：
1. 前往 APIs & Services > Library
2. 搜尋 "Google Sheets API" > Enable
3. 搜尋 "Google Drive API" > Enable
```

#### 步驟 3：設定 OAuth 同意畫面
```
1. 前往 APIs & Services > OAuth consent screen

2. 選擇應用程式類型：
   - Internal（僅限 Google Workspace 內部使用者）
   - External（公開使用，需要驗證）

3. 填寫應用程式資訊：
   - App name: n8n Google Sheets Integration
   - User support email: 您的 Email
   - Developer contact information: 您的 Email

4. 設定 Scopes（權限範圍）：
   - https://www.googleapis.com/auth/spreadsheets
   - https://www.googleapis.com/auth/drive.readonly
   （或 https://www.googleapis.com/auth/drive 如果需要寫入）

5. 如果是 External 應用程式：
   - 添加測試使用者（開發階段）
   - 或提交驗證（生產環境）
```

#### 步驟 4：建立 OAuth 2.0 客戶端憑證
```
1. 前往 APIs & Services > Credentials

2. 點擊 "Create Credentials" > "OAuth client ID"

3. 選擇應用程式類型：Web application

4. 設定名稱：n8n Google Sheets

5. 設定 Authorized redirect URIs：
   
   如果是 n8n Cloud：
   https://YOUR_N8N_DOMAIN/rest/oauth2-credential/callback
   
   如果是 Self-hosted（本地）：
   http://localhost:5678/rest/oauth2-credential/callback
   
   如果是 Self-hosted（伺服器）：
   https://your-n8n-domain.com/rest/oauth2-credential/callback

6. 點擊 "Create"

7. 複製並保存：
   - Client ID
   - Client Secret
   （這些資訊只會顯示一次，請妥善保存）
```

---

### 第二部分：n8n 設定

#### 步驟 1：建立 Google Sheets 憑證
```
1. 在 n8n 中前往 Credentials > New credentials

2. 選擇 "Google Sheets OAuth2 API" 或 "Google OAuth2 API"

3. 填寫資訊：
   - Credential Name: Google Sheets API
   - Client ID: 從 Google Cloud Console 複製
   - Client Secret: 從 Google Cloud Console 複製
   - OAuth Redirect URL: 確認與 Google Console 中設定的一致

4. 設定 Scopes（如果需要自訂）：
   - https://www.googleapis.com/auth/spreadsheets
   - https://www.googleapis.com/auth/drive.readonly

5. 點擊 "Connect" 或 "Authenticate"

6. 會跳出 Google 授權畫面，選擇要授權的 Google 帳號

7. 確認權限後，n8n 會自動完成認證
```

#### 步驟 2：測試連線
```
1. 建立新的 Workflow

2. 添加 Google Sheets 節點

3. 選擇剛建立的憑證

4. 選擇操作：Read > Get Many（讀取資料）

5. 填寫 Spreadsheet ID（從 Google Sheets URL 取得）

6. 執行測試，確認可以正常讀取資料
```

---

## 🔧 方案二：n8n 自動化設定工作流程

### 工作流程設計

#### 工作流程 1：Google Sheets 設定檢查器
```
功能：自動檢查 Google Sheets API 設定是否正確

節點流程：
1. Manual Trigger（手動觸發）
2. Function 節點（檢查設定）
   - 檢查 Client ID 是否存在
   - 檢查 Client Secret 是否存在
   - 檢查 Redirect URI 是否設定
3. HTTP Request 節點（測試 API 連線）
   - 測試 Google Sheets API 是否可存取
4. IF 節點（判斷結果）
   - 如果成功 → 顯示成功訊息
   - 如果失敗 → 顯示錯誤訊息和修正建議
```

#### 工作流程 2：自動化資料同步
```
功能：自動同步資料到 Google Sheets

節點流程：
1. Webhook 節點（接收資料）
2. Function 節點（資料處理）
   - 格式化資料
   - 驗證資料格式
3. Google Sheets 節點（寫入資料）
   - Operation: Append
   - 自動新增資料列
4. Error Trigger（錯誤處理）
   - 如果寫入失敗，發送通知
```

---

## 🏢 方案三：使用 Service Account（企業方案）

### 優點
- ✅ 不需要使用者授權
- ✅ 適合自動化場景
- ✅ 更安全（不需要使用者互動）
- ✅ Token 不會過期（除非手動撤銷）

### 設定步驟

#### 步驟 1：建立 Service Account
```
1. 前往 Google Cloud Console > APIs & Services > Credentials

2. 點擊 "Create Credentials" > "Service account"

3. 填寫資訊：
   - Service account name: n8n-sheets-service
   - Service account ID: n8n-sheets-service
   - Description: Service account for n8n Google Sheets integration

4. 點擊 "Create and Continue"

5. 選擇角色（可選）：
   - Editor（如果需要完整權限）
   - 或自訂角色

6. 點擊 "Done"
```

#### 步驟 2：建立金鑰
```
1. 點擊剛建立的 Service Account

2. 前往 "Keys" 標籤

3. 點擊 "Add Key" > "Create new key"

4. 選擇 JSON 格式

5. 下載 JSON 金鑰檔案（妥善保存，只會顯示一次）
```

#### 步驟 3：在 n8n 中使用 Service Account
```
1. 在 n8n 中建立新憑證

2. 選擇 "Google Service Account" 類型

3. 上傳 JSON 金鑰檔案或貼上 JSON 內容

4. 保存憑證

5. 在 Google Sheets 中分享試算表給 Service Account Email
   （Service Account Email 格式：service-account-name@project-id.iam.gserviceaccount.com）
```

---

## 🛠️ 方案四：設定檢查工具

### 診斷檢查清單

#### Google Cloud Console 檢查
```javascript
// 檢查項目
const checks = {
  projectExists: true,           // 專案是否存在
  sheetsApiEnabled: true,         // Google Sheets API 是否啟用
  driveApiEnabled: true,          // Google Drive API 是否啟用
  oauthConsentScreen: true,       // OAuth 同意畫面是否設定
  oauthCredentials: true,         // OAuth 憑證是否建立
  redirectUri: true,             // Redirect URI 是否正確
  scopes: true                   // Scopes 是否設定正確
};
```

#### n8n 設定檢查
```javascript
// 檢查項目
const n8nChecks = {
  credentialExists: true,         // 憑證是否存在
  clientId: true,               // Client ID 是否設定
  clientSecret: true,            // Client Secret 是否設定
  redirectUri: true,             // Redirect URI 是否匹配
  authentication: true,          // 是否已認證
  tokenValid: true              // Token 是否有效
};
```

---

## 🚨 常見問題與解決方案

### 問題 1：Redirect URI 不匹配
**錯誤訊息**：
```
Error 400: redirect_uri_mismatch
```

**解決方案**：
1. 確認 Google Cloud Console 中的 Redirect URI 與 n8n 中的完全一致
2. 檢查協議（http vs https）
3. 檢查域名和路徑是否完全匹配
4. 確認沒有多餘的空格或特殊字元

**正確格式範例**：
```
n8n Cloud: https://your-n8n-instance.com/rest/oauth2-credential/callback
Self-hosted: http://localhost:5678/rest/oauth2-credential/callback
```

---

### 問題 2：OAuth 同意畫面未發布
**錯誤訊息**：
```
Error 403: access_denied
```

**解決方案**：
1. 如果是 External 應用程式，需要：
   - 添加測試使用者（開發階段）
   - 或提交應用程式進行驗證（生產環境）

2. 添加測試使用者：
   - 前往 OAuth consent screen
   - 在 "Test users" 區塊添加您的 Google 帳號
   - 等待幾分鐘後重試

---

### 問題 3：API 未啟用
**錯誤訊息**：
```
Error 403: API not enabled
```

**解決方案**：
1. 確認已啟用 Google Sheets API
2. 確認已啟用 Google Drive API
3. 等待幾分鐘讓 API 啟用生效
4. 確認專案計費帳戶已設定（某些 API 需要）

---

### 問題 4：Scope 權限不足
**錯誤訊息**：
```
Error 403: insufficient permissions
```

**解決方案**：
1. 確認 OAuth consent screen 中已添加必要的 Scopes
2. 確認 n8n 憑證中設定的 Scopes 正確
3. 重新認證以獲取新的權限

**必要的 Scopes**：
```
讀取：https://www.googleapis.com/auth/spreadsheets.readonly
寫入：https://www.googleapis.com/auth/spreadsheets
完整：https://www.googleapis.com/auth/spreadsheets
Drive（如果需要）：https://www.googleapis.com/auth/drive.readonly
```

---

### 問題 5：Token 過期
**錯誤訊息**：
```
Error 401: invalid_token
```

**解決方案**：
1. 在 n8n 中重新認證
2. 前往 Credentials > 選擇憑證 > Reconnect
3. 確認 Google 帳號權限未被撤銷

---

## 📋 完整設定檢查清單

### Google Cloud Console 設定
- [ ] 專案已建立
- [ ] Google Sheets API 已啟用
- [ ] Google Drive API 已啟用
- [ ] OAuth consent screen 已設定
- [ ] 應用程式類型已選擇（Internal/External）
- [ ] 必要的 Scopes 已添加
- [ ] 測試使用者已添加（如果是 External）
- [ ] OAuth 2.0 客戶端已建立
- [ ] Client ID 已複製
- [ ] Client Secret 已複製
- [ ] Redirect URI 已正確設定

### n8n 設定
- [ ] Google Sheets 憑證已建立
- [ ] Client ID 已填入
- [ ] Client Secret 已填入
- [ ] Redirect URI 與 Google Console 一致
- [ ] Scopes 已正確設定
- [ ] 認證已完成（Connect 成功）
- [ ] 測試連線成功

---

## 🎯 推薦方案選擇

### 初次使用
**推薦：方案一（完整手動設定指南）**
- 了解完整流程
- 確保設定正確
- 適合學習和除錯

### 需要重複設定
**推薦：方案二（n8n 自動化設定工作流程）**
- 減少手動操作
- 提高效率
- 適合多個專案

### 企業自動化場景
**推薦：方案三（Service Account）**
- 不需要使用者互動
- 更安全可靠
- 適合生產環境

### 需要診斷問題
**推薦：方案四（設定檢查工具）**
- 快速找出問題
- 提供修正建議
- 適合除錯

---

## 📝 下一步行動

1. **選擇適合的方案** - 根據您的需求選擇
2. **按照步驟設定** - 逐步完成設定
3. **測試連線** - 確認可以正常讀寫資料
4. **建立工作流程** - 開始自動化您的流程

---

## 🔗 相關資源

- [Google Sheets API 文檔](https://developers.google.com/sheets/api)
- [n8n Google Sheets 文檔](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googlesheets/)
- [Google OAuth 2.0 指南](https://developers.google.com/identity/protocols/oauth2)

---

## 💡 最佳實踐建議

1. **使用環境變數** - 將 Client ID 和 Secret 存在環境變數中
2. **定期檢查 Token** - 設定提醒檢查 Token 是否過期
3. **錯誤處理** - 在工作流程中添加錯誤處理節點
4. **日誌記錄** - 記錄所有 API 操作以便除錯
5. **權限最小化** - 只授予必要的權限（Scopes）

---

## ❓ 需要協助？

如果您在設定過程中遇到問題，請提供：
1. 錯誤訊息
2. 設定步驟（到哪一步）
3. n8n 版本（Cloud 或 Self-hosted）
4. 使用的方案（OAuth 或 Service Account）

我可以根據您的具體情況提供更詳細的協助。
