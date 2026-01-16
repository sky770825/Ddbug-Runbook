# GitHub Pages 部署說明

## 自動部署設定

專案已配置 GitHub Actions 自動部署到 GitHub Pages。

### 部署流程

1. **自動觸發**：當您推送代碼到 `main` 分支時，GitHub Actions 會自動：
   - 安裝依賴
   - 建置專案
   - 部署到 GitHub Pages

2. **手動觸發**：您也可以在 GitHub 上手動觸發部署：
   - 前往 Actions 標籤
   - 選擇 "Deploy to GitHub Pages" workflow
   - 點擊 "Run workflow"

### 啟用 GitHub Pages

首次部署需要啟用 GitHub Pages：

1. 前往您的 GitHub 倉庫：https://github.com/sky770825/Ddbug-Runbook
2. 點擊 **Settings** 標籤
3. 在左側選單中找到 **Pages**
4. 在 **Source** 部分：
   - 選擇 **GitHub Actions** 作為來源
5. 儲存設定

### 訪問您的網站

部署完成後，您的網站將可在以下網址訪問：

**https://sky770825.github.io/Ddbug-Runbook/**

### 檢查部署狀態

- 前往 **Actions** 標籤查看部署進度
- 綠色勾號表示部署成功
- 紅色叉號表示部署失敗（可查看日誌）

### 注意事項

- 首次部署可能需要幾分鐘時間
- 部署後可能需要等待幾分鐘才能訪問網站
- 如果遇到 404 錯誤，請確認 GitHub Pages 已正確啟用
