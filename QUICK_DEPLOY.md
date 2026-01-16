# 🚀 快速部署指南（推薦方式）

## ✅ 使用 Cloudflare Dashboard Git 整合（最簡單）

這個方式**不需要**設定 GitHub Secrets 或 GitHub Actions，直接在 Cloudflare Dashboard 設定一次即可。

## 📋 設定步驟（只需 5 分鐘）

### 步驟 1：前往 Cloudflare Dashboard

前往：https://dash.cloudflare.com

### 步驟 2：建立 Pages 專案

1. 點擊左側選單的 **Workers & Pages**
2. 點擊 **Create application**
3. 選擇 **Pages**
4. 點擊 **Connect to Git**

### 步驟 3：連接 GitHub 倉庫

1. 選擇 **GitHub** 作為 Git 提供者
2. 如果還沒授權，點擊 **Authorize Cloudflare** 授權
3. 選擇倉庫：`sky770825/Ddbug-Runbook`
4. 點擊 **Begin setup**

### 步驟 4：設定建置配置

在設定頁面填入以下資訊：

**Project name:**
```
ddbug-runbook
```

**Production branch:**
```
main
```

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

**Framework preset:**
```
Vite (或選擇 None)
```

**Node.js version:**
```
20
```

### 步驟 5：設定環境變數

點擊 **Add variable** 添加環境變數：

| Variable name | Value |
|--------------|-------|
| `CF_PAGES` | `1` |
| `NODE_ENV` | `production` |

### 步驟 6：儲存並部署

點擊 **Save and Deploy**

等待 2-5 分鐘，建置完成後網站就可以訪問了！

## 🎉 完成！

設定完成後，每次您推送代碼到 `main` 分支，Cloudflare 會自動：
- ✅ 檢測變更
- ✅ 執行建置
- ✅ 部署網站

**完全自動化，不需要任何額外設定！**

## 🌐 部署網址

部署成功後，網站將可在以下網址訪問：

**https://ddbug-runbook.pages.dev**

## 📊 查看部署狀態

前往：https://dash.cloudflare.com/82ebeb1d91888e83e8e1b30eeb33d3c3/pages/view/ddbug-runbook

您可以查看：
- 部署歷史
- 建置日誌
- 部署狀態

## 🔄 如果已經有專案

如果 Cloudflare Pages 專案已經存在：

1. 前往專案頁面
2. 點擊 **Settings** > **Builds & deployments**
3. 更新建置配置（參考步驟 4）
4. 點擊 **Save**
5. 點擊 **Retry deployment** 重新部署

## ✅ 優點

- ✅ **不需要**設定 GitHub Secrets
- ✅ **不需要**設定 GitHub Actions
- ✅ 設定一次，之後自動運作
- ✅ 所有部署都在 Cloudflare Dashboard 中管理
- ✅ 可以直接查看建置日誌和部署狀態

## 🆚 與 GitHub Actions 的對比

| 項目 | Cloudflare Dashboard | GitHub Actions |
|------|---------------------|----------------|
| 設定複雜度 | ⭐ 簡單 | ⭐⭐⭐⭐ 複雜 |
| 需要 Secrets | ❌ 不需要 | ✅ 需要 |
| 自動化 | ✅ 完全自動 | ✅ 完全自動 |
| 管理位置 | Cloudflare Dashboard | GitHub Actions |

## 📝 注意事項

- 首次部署可能需要 2-5 分鐘
- 建置過程會自動執行，不需要手動操作
- 如果建置失敗，可以在 Cloudflare Dashboard 查看詳細日誌

## 🆘 如果遇到問題

### 建置失敗

1. 前往 Cloudflare Dashboard > 專案 > Deployments
2. 點擊失敗的部署查看建置日誌
3. 檢查錯誤訊息
4. 確認建置命令和環境變數是否正確

### 網站打不開

1. 確認部署狀態為 "Success"
2. 等待幾分鐘讓 DNS 更新
3. 清除瀏覽器快取後再試

## 🎯 總結

**最簡單的部署方式：**
1. 在 Cloudflare Dashboard 連接 GitHub 倉庫
2. 設定建置命令：`npm ci && CF_PAGES=1 npm run build`
3. 完成！

之後每次推送代碼都會自動部署，完全不需要手動操作！
