# Cloudflare Pages 建置修復

## 問題診斷

從建置日誌看到：
```
No build command specified. Skipping build step.
Error: Output directory "dist" not found.
```

**原因**：Cloudflare Pages 讀取了 `wrangler.toml`，但沒有找到建置命令，所以跳過了建置步驟，導致 `dist` 目錄不存在。

## 已修復

✅ 在 `wrangler.toml` 中添加了建置命令：
```toml
[build]
command = "npm ci && CF_PAGES=1 npm run build"
cwd = "."

[build.environment_variables]
CF_PAGES = "1"
NODE_ENV = "production"
```

## 建置流程

現在 Cloudflare Pages 會：

1. ✅ 讀取 `wrangler.toml`
2. ✅ 執行建置命令：`npm ci && CF_PAGES=1 npm run build`
3. ✅ 設定環境變數：`CF_PAGES=1` 和 `NODE_ENV=production`
4. ✅ 在 `dist` 目錄中找到建置輸出
5. ✅ 部署網站

## 驗證

所有修復已推送到 GitHub，Cloudflare Pages 會自動重新建置。

### 檢查建置狀態

1. 前往：https://dash.cloudflare.com/82ebeb1d91888e83e8e1b30eeb33d3c3/pages/view/ddbug-runbook
2. 查看最新的建置日誌
3. 應該看到：
   - ✅ 執行建置命令
   - ✅ 建置成功
   - ✅ 找到 `dist` 目錄

## 如果建置仍然失敗

請檢查：

1. **Node.js 版本**
   - 確認 Cloudflare Pages 使用 Node.js 20
   - 可在 Dashboard 中設定，或使用 `.nvmrc` 檔案

2. **建置命令**
   - 確認使用：`npm ci && CF_PAGES=1 npm run build`
   - 已在 `wrangler.toml` 中設定

3. **環境變數**
   - `CF_PAGES=1` - 確保使用正確的 base path
   - `NODE_ENV=production` - 生產環境建置

## 部署網址

建置成功後，網站將可在以下網址訪問：

**https://ddbug-runbook.pages.dev**
