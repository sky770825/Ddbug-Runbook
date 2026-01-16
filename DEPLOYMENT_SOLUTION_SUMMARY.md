# 📋 Cloudflare Pages 部署問題解決過程總結

## 🎯 問題概述

在部署 React 專案到 Cloudflare Pages 時遇到的一系列問題，包括建置錯誤、套件管理器衝突、環境變數設定等。

## 📊 解決過程時間線

### 問題 1：Error 522 - Connection timed out

**症狀**：網站無法訪問，顯示 Error 522

**原因**：
- Cloudflare Pages 專案可能尚未建立
- 建置配置不正確
- 建置失敗導致部署未完成

**解決方案**：
1. 在 Cloudflare Dashboard 中建立 Pages 專案
2. 連接 GitHub 倉庫
3. 設定正確的建置配置

---

### 問題 2：建置命令錯誤

**症狀**：建置日誌顯示 `Executing user command: CF_PAGES=1`，但沒有建置輸出，出現 `Error: Output directory "dist" not found`

**原因**：建置命令只設定了環境變數，沒有執行實際的建置命令

**錯誤設定**：
```
Build command: CF_PAGES=1
```

**正確設定**：
```
Build command: npm ci && CF_PAGES=1 npm run build
```

**解決方案**：
1. 在 Cloudflare Dashboard 中修正建置命令
2. 確保建置命令包含 `npm run build`
3. 重新部署

---

### 問題 3：套件管理器衝突（npm vs bun）

**症狀**：建置日誌顯示 `bun install` 失敗，錯誤訊息：
```
bun install v1.2.15
Outdated lockfile version: failed to parse lockfile: 'bun.lockb'
error: lockfile had changes, but lockfile is frozen
```

**原因**：
- 專案中同時存在 `package-lock.json` (npm) 和 `bun.lockb` (bun)
- Cloudflare Pages 自動偵測到 `bun.lockb` 並嘗試使用 bun
- 但專案實際使用 npm

**解決方案**：
1. **方案 A（推薦）**：刪除不需要的 `bun.lockb`
   ```bash
   rm bun.lockb
   git add bun.lockb
   git commit -m "Remove bun.lockb, project uses npm only"
   git push origin main
   ```

2. **方案 B**：在 Cloudflare Dashboard 中明確指定 npm
   - Install command: `npm ci`
   - Build command: `npm ci && CF_PAGES=1 npm run build`

3. **方案 C**：在 `.cloudflare/pages.json` 中指定
   ```json
   {
     "packageManager": "npm",
     "installCommand": "npm ci"
   }
   ```

---

### 問題 4：GitHub Actions 與 Cloudflare Dashboard 衝突

**症狀**：GitHub Actions 執行失敗，錯誤訊息：
```
Error: Input required and not supplied: accountId
```

**原因**：
- 同時使用兩種部署方式：
  1. Cloudflare Dashboard Git 整合（已設定）
  2. GitHub Actions（缺少 Secrets）
- 每次推送會觸發兩次部署
- GitHub Actions 需要設定 Secrets 但未設定

**解決方案**：
1. **推薦方案**：禁用 GitHub Actions，只使用 Cloudflare Dashboard
   ```bash
   git mv .github/workflows/cloudflare-pages.yml .github/workflows/cloudflare-pages.yml.disabled
   git commit -m "Disable GitHub Actions, use Cloudflare Dashboard Git integration"
   git push origin main
   ```

2. **優點**：
   - ✅ 不需要設定 GitHub Secrets
   - ✅ 設定更簡單
   - ✅ 避免重複部署
   - ✅ 所有部署都在 Cloudflare Dashboard 中管理

---

### 問題 5：環境變數與 Base Path 設定

**症狀**：網站可以訪問但資源載入失敗，或使用錯誤的 base path

**原因**：
- Cloudflare Pages 應該使用根路徑 `/`
- GitHub Pages 使用子路徑 `/Ddbug-Runbook/`
- 環境變數 `CF_PAGES=1` 未正確設定

**解決方案**：
1. 在 Cloudflare Dashboard 中設定環境變數：
   - `CF_PAGES` = `1`
   - `NODE_ENV` = `production`

2. 確認建置命令包含環境變數：
   ```
   Build command: npm ci && CF_PAGES=1 npm run build
   ```

3. 驗證 `vite.config.ts` 配置：
   ```typescript
   const isCloudflarePages = process.env.CF_PAGES || process.env.CF_PAGES_BRANCH;
   const base = isCloudflarePages ? '/' : (process.env.NODE_ENV === 'production' ? '/Ddbug-Runbook/' : '/');
   ```

---

## ✅ 最終解決方案

### Cloudflare Dashboard 完整設定

**建置設定**：
- **Build command**: `npm ci && CF_PAGES=1 npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (留空)
- **Node.js version**: `20`
- **Framework preset**: `Vite` 或 `None`

**環境變數**：
- `CF_PAGES` = `1`
- `NODE_ENV` = `production`

**部署方式**：
- ✅ 使用 Cloudflare Dashboard Git 整合（推薦）
- ❌ 禁用 GitHub Actions（避免衝突）

---

## 📝 關鍵學習點

### 1. 建置命令必須完整

❌ **錯誤**：只有環境變數
```
CF_PAGES=1
```

✅ **正確**：包含實際建置命令
```
npm ci && CF_PAGES=1 npm run build
```

### 2. 套件管理器要明確

- 如果專案使用 npm，刪除 `bun.lockb`
- 在 Cloudflare Dashboard 中明確指定 `npm ci`
- 避免自動偵測錯誤

### 3. 避免重複部署

- 選擇一種部署方式（推薦 Cloudflare Dashboard）
- 避免同時使用 GitHub Actions 和 Cloudflare Dashboard
- 簡化設定和維護

### 4. 環境變數很重要

- `CF_PAGES=1` 確保使用正確的 base path
- 在建置命令中設定或作為環境變數
- 驗證建置輸出中的資源路徑

---

## 🎯 問題排查清單整合

所有解決過程已整理成問題排查清單中的步驟 19：「Cloudflare Pages 部署問題」

### 包含的 Prompt：

1. **建置命令錯誤診斷**
   - 診斷：檢查建置日誌和命令設定
   - 修正：設定正確的建置命令
   - 驗證：確認建置成功

2. **套件管理器衝突（npm vs bun）**
   - 診斷：檢查 lockfile 檔案
   - 修正：刪除不需要的檔案或明確指定
   - 驗證：確認使用正確的套件管理器

3. **Error 522 連線逾時**
   - 診斷：檢查部署狀態和建置日誌
   - 修正：建立專案或修正配置
   - 驗證：確認網站可以訪問

4. **GitHub Actions 與 Cloudflare Dashboard 衝突**
   - 診斷：檢查部署方式
   - 修正：選擇一種方式並禁用另一種
   - 驗證：確認只有一種部署方式運作

5. **環境變數與 Base Path 設定**
   - 診斷：檢查環境變數和資源路徑
   - 修正：設定正確的環境變數
   - 驗證：確認 base path 正確

---

## 📚 相關文件

- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) - 快速部署指南
- [DASHBOARD_SETUP.md](./DASHBOARD_SETUP.md) - Dashboard 設定指南
- [FIX_BUILD_COMMAND.md](./FIX_BUILD_COMMAND.md) - 建置命令修復
- [FIX_BUN_ERROR.md](./FIX_BUN_ERROR.md) - Bun 錯誤修復
- [ERROR_522_FIX.md](./ERROR_522_FIX.md) - Error 522 修復
- [CLOUDFLARE_DEPLOY_FIX.md](./CLOUDFLARE_DEPLOY_FIX.md) - 部署問題修復

---

## 🎉 最終結果

✅ **成功部署到 Cloudflare Pages**
- 網站可以正常訪問
- 自動部署正常運作
- 所有問題已解決
- 解決過程已整理成問題排查清單

✅ **新增問題排查步驟**
- 步驟 ID: 19
- 分類: 部署問題
- 包含 5 個詳細的 Prompt
- 每個 Prompt 都有診斷、修正、驗證三個階段
