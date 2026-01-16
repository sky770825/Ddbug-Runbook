#!/bin/bash

echo "🚀 Cloudflare Pages 自動化部署設定"
echo "=================================="
echo ""

# 檢查 wrangler 是否已登入
if ! wrangler whoami &>/dev/null; then
    echo "📝 需要先登入 Cloudflare..."
    echo "   正在開啟瀏覽器進行登入..."
    wrangler login
fi

# 取得帳號資訊
echo ""
echo "📋 取得 Cloudflare 帳號資訊..."
ACCOUNT_ID=$(wrangler whoami 2>/dev/null | grep -oP 'Account ID: \K[^\s]+' || echo "")

if [ -z "$ACCOUNT_ID" ]; then
    echo "❌ 無法取得 Account ID，請手動設定"
    echo ""
    echo "請前往以下網址取得資訊："
    echo "1. Account ID: https://dash.cloudflare.com (右側邊欄)"
    echo "2. API Token: https://dash.cloudflare.com/profile/api-tokens"
    exit 1
fi

echo "✅ Account ID: $ACCOUNT_ID"
echo ""

# 建立 Pages 專案（如果不存在）
echo "🔧 檢查 Cloudflare Pages 專案..."
echo "   專案名稱: ddbug-runbook"
echo ""

# 建置專案
echo "📦 建置專案..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 建置失敗，請檢查錯誤訊息"
    exit 1
fi

echo ""
echo "✅ 建置成功！"
echo ""

# 嘗試部署
echo "🚀 部署到 Cloudflare Pages..."
echo "   如果專案不存在，將會自動建立"
echo ""

wrangler pages deploy dist --project-name=ddbug-runbook

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 部署成功！"
    echo ""
    echo "🌐 您的網站網址："
    echo "   https://ddbug-runbook.pages.dev"
    echo ""
    echo "📝 接下來請在 GitHub 設定 Secrets："
    echo "   1. 前往: https://github.com/sky770825/Ddbug-Runbook/settings/secrets/actions"
    echo "   2. 新增 Secret: CLOUDFLARE_API_TOKEN"
    echo "   3. 新增 Secret: CLOUDFLARE_ACCOUNT_ID = $ACCOUNT_ID"
    echo ""
    echo "   取得 API Token: https://dash.cloudflare.com/profile/api-tokens"
    echo "   使用 'Edit Cloudflare Workers' 模板或自訂 Pages 權限"
else
    echo ""
    echo "⚠️  部署可能需要手動設定"
    echo "   請查看 AUTO_DEPLOY.md 了解詳細步驟"
fi
