# Cloudflare Pages Dashboard 設定指南

## ⚠️ 重要：必須在 Dashboard 中設定建置命令

Cloudflare Pages 的 `wrangler.toml` **不支援** `[build]` 區塊。建置命令必須在 Cloudflare Dashboard 中手動設定。

## 設定步驟

### 1. 前往 Cloudflare Pages 專案設定

前往：https://dash.cloudflare.com/82ebeb1d91888e83e8e1b30eeb33d3c3/pages/view/ddbug-runbook

### 2. 點擊 Settings > Builds & deployments

### 3. 設定以下項目

#### Build settings

**Build command:**
```
npm ci && CF_PAGES=1 npm run build
```

**Build output directory:**
```
dist
```

**Root directory:**
```
/ (留空)
```

**Node.js version:**
```
20
```

#### Environment variables

點擊 **Add variable** 添加以下環境變數：

| Variable name | Value |
|--------------|-------|
| `CF_PAGES` | `1` |
| `NODE_ENV` | `production` |

### 4. 儲存設定

點擊 **Save** 儲存設定。

### 5. 重新部署

設定完成後，點擊 **Retry deployment** 或等待自動重新建置。

## 驗證設定

建置成功後，您應該看到：

1. ✅ 建置日誌顯示執行建置命令
2. ✅ 建置成功完成
3. ✅ 找到 `dist` 目錄
4. ✅ 部署成功

## 部署網址

**https://ddbug-runbook.pages.dev**

## 為什麼需要這樣設定？

Cloudflare Pages 的 `wrangler.toml` 只支援以下欄位：
- `name`
- `compatibility_date`
- `pages_build_output_dir`

建置命令和環境變數必須在 Dashboard 中設定，無法在 `wrangler.toml` 中配置。

## 自動化部署

如果您使用 GitHub Actions 自動部署，請參考 `.github/workflows/cloudflare-pages.yml`。

但對於首次設定，仍需要在 Dashboard 中完成上述設定。
