# 🔧 修復 Bun 安裝錯誤

## 📋 錯誤說明

Cloudflare Pages 嘗試使用 `bun install` 安裝依賴，但專案使用的是 `npm`。

**錯誤訊息：**
```
bun install v1.2.15
Outdated lockfile version: failed to parse lockfile: 'bun.lockb'
error: lockfile had changes, but lockfile is frozen
```

## ✅ 解決方案

### 方案 1：在 Cloudflare Dashboard 中明確指定使用 npm（推薦）

在 Cloudflare Dashboard 中設定：

1. **前往**: https://dash.cloudflare.com/82ebeb1d91888e83e8e1b30eeb33d3c3/pages/view/ddbug-runbook
2. **點擊**: Settings > Builds & deployments
3. **設定安裝命令**:
   ```
   Install command: npm ci
   ```
4. **確認建置命令**:
   ```
   Build command: npm ci && CF_PAGES=1 npm run build
   ```
5. **點擊**: Save

### 方案 2：刪除 bun.lockb 檔案（如果不需要）

如果專案不需要 bun，可以刪除 `bun.lockb` 檔案：

```bash
rm bun.lockb
git add bun.lockb
git commit -m "Remove bun.lockb, use npm only"
git push origin main
```

### 方案 3：在 package.json 中指定 packageManager

在 `package.json` 中添加：

```json
{
  "packageManager": "npm@10.9.2"
}
```

## 🎯 推薦步驟

### 在 Cloudflare Dashboard 中設定

1. **前往專案設定**: Settings > Builds & deployments
2. **設定安裝命令**: `npm ci`
3. **確認建置命令**: `npm ci && CF_PAGES=1 npm run build`
4. **儲存設定**
5. **重新部署**

## 📝 已更新的配置

已更新 `.cloudflare/pages.json` 添加 `"packageManager": "npm"`，但 Cloudflare Dashboard 中的設定優先級更高。

**請在 Cloudflare Dashboard 中確認安裝命令設定為 `npm ci`。**

## ✅ 驗證

設定完成後，重新部署應該會：

1. ✅ 使用 `npm ci` 安裝依賴
2. ✅ 不再嘗試使用 `bun install`
3. ✅ 建置成功完成

## 🔍 檢查清單

請在 Cloudflare Dashboard 中確認：

- [ ] **Install command**: `npm ci`
- [ ] **Build command**: `npm ci && CF_PAGES=1 npm run build`
- [ ] **Node.js version**: `20`
- [ ] **Build output directory**: `dist`

## 🐛 如果仍然失敗

如果設定後仍然失敗，請檢查：

1. **建置日誌**：查看具體的錯誤訊息
2. **安裝命令**：確認是否使用 `npm ci`
3. **lockfile**：確認 `package-lock.json` 存在且正確
