# 🔧 修復建置命令問題

## 📋 問題說明

建置日誌顯示：
```
Executing user command: CF_PAGES=1
Finished
Error: Output directory "dist" not found.
```

**問題**：建置命令只執行了 `CF_PAGES=1`（設定環境變數），沒有執行實際的建置命令 `npm run build`。

## ✅ 解決方案

### 在 Cloudflare Dashboard 中修正建置命令

1. **前往**: https://dash.cloudflare.com/82ebeb1d91888e83e8e1b30eeb33d3c3/pages/view/ddbug-runbook
2. **點擊**: Settings > Builds & deployments
3. **檢查建置命令設定**

#### 正確的設定應該是：

**Build command:**
```
npm ci && CF_PAGES=1 npm run build
```

**或者分開設定：**

**Install command:**
```
npm ci
```

**Build command:**
```
CF_PAGES=1 npm run build
```

⚠️ **重要**：建置命令必須包含 `npm run build`，不能只有 `CF_PAGES=1`

### 常見錯誤設定

❌ **錯誤 1**: 只有環境變數
```
CF_PAGES=1
```
這只會設定環境變數，不會執行建置。

❌ **錯誤 2**: 缺少 npm run build
```
npm ci && CF_PAGES=1
```
這只會安裝依賴和設定環境變數，不會建置。

✅ **正確**: 完整的建置命令
```
npm ci && CF_PAGES=1 npm run build
```
這會安裝依賴、設定環境變數，然後執行建置。

## 🎯 完整設定檢查清單

請在 Cloudflare Dashboard 中確認：

### Build settings

- [ ] **Build command**: `npm ci && CF_PAGES=1 npm run build`
  - 或者分開設定：
  - [ ] **Install command**: `npm ci`
  - [ ] **Build command**: `CF_PAGES=1 npm run build`
- [ ] **Build output directory**: `dist`
- [ ] **Root directory**: `/` (留空)
- [ ] **Node.js version**: `20`
- [ ] **Framework preset**: `Vite` 或 `None`

### Environment variables

- [ ] `CF_PAGES` = `1`（可選，因為已在建置命令中設定）
- [ ] `NODE_ENV` = `production`

## 📝 設定步驟

### 方法 1：單一建置命令（推薦）

1. 前往 Settings > Builds & deployments
2. 設定 **Build command**:
   ```
   npm ci && CF_PAGES=1 npm run build
   ```
3. 確認 **Build output directory**: `dist`
4. 點擊 **Save**

### 方法 2：分開設定安裝和建置命令

1. 前往 Settings > Builds & deployments
2. 設定 **Install command**:
   ```
   npm ci
   ```
3. 設定 **Build command**:
   ```
   CF_PAGES=1 npm run build
   ```
4. 確認 **Build output directory**: `dist`
5. 點擊 **Save**

## ✅ 驗證

設定完成後，重新部署應該會：

1. ✅ 執行 `npm ci` 安裝依賴
2. ✅ 執行 `CF_PAGES=1 npm run build` 建置專案
3. ✅ 產生 `dist` 目錄
4. ✅ 部署成功

## 🔍 檢查建置日誌

設定完成後，檢查建置日誌應該會看到：

```
Installing project dependencies: npm clean-install
added 533 packages...
Executing user command: npm ci && CF_PAGES=1 npm run build
vite v5.4.19 building for production...
✓ built in X.XXs
```

而不是只有：
```
Executing user command: CF_PAGES=1
```

## 🐛 如果仍然失敗

如果設定後仍然失敗，請檢查：

1. **建置日誌**：查看實際執行的命令
2. **建置命令**：確認包含 `npm run build`
3. **環境變數**：確認 `CF_PAGES=1` 已設定
4. **輸出目錄**：確認設定為 `dist`

## 📊 預期結果

正確設定後，建置日誌應該顯示：

1. ✅ 安裝依賴：`npm ci` 或 `npm clean-install`
2. ✅ 執行建置：`CF_PAGES=1 npm run build`
3. ✅ 建置成功：`✓ built in X.XXs`
4. ✅ 找到輸出目錄：`dist`
5. ✅ 部署成功
