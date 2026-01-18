# ☁️ Cloudflare CLI (Wrangler) 自動化整合方案

## 📋 問題分析

### 當前問題

1. **Cloudflare CLI 設定分散**
   - 需要手動安裝 Wrangler
   - 需要手動登入 Cloudflare
   - 需要手動取得 API Token 和 Account ID
   - 部署流程需要多個步驟

2. **缺乏統一管理**
   - Cloudflare API Token 需要手動取得
   - Account ID 需要手動查找
   - 部署命令分散在多個地方

3. **環境變數設定複雜**
   - `CLOUDFLARE_API_TOKEN` 需要設定到 GitHub Secrets
   - `CLOUDFLARE_ACCOUNT_ID` 需要設定到 GitHub Secrets
   - 本地部署也需要這些資訊

---

## 🔍 Cloudflare CLI 使用場景

### 系統中的使用情況

根據步驟分析，系統中 Cloudflare 用於：

| 功能 | 使用場景 | CLI 命令 |
|------|---------|---------|
| **Cloudflare Pages 部署** | 自動部署網站 | `wrangler pages deploy` |
| **專案管理** | 建立和管理 Pages 專案 | `wrangler pages project create` |
| **環境變數設定** | 設定 Pages 環境變數 | `wrangler pages secret put` |
| **部署狀態檢查** | 查看部署歷史和狀態 | `wrangler pages deployment list` |
| **建置日誌查看** | 查看建置和部署日誌 | `wrangler pages deployment tail` |

### 需要的認證資訊

| 資訊 | 取得方式 | 用途 |
|------|---------|------|
| **Cloudflare API Token** | Dashboard > Profile > API Tokens | CLI 認證、GitHub Actions |
| **Cloudflare Account ID** | Dashboard 右側邊欄 | CLI 操作、GitHub Actions |
| **專案名稱** | Pages 專案設定 | 部署目標 |

---

## 🎯 解決方案設計

### 方案一：整合到步驟 61（環境建置）

#### 概念

在步驟 61（CLI 自動化環境建置）中添加 Cloudflare CLI 的檢查和設定。

#### 設計

```typescript
// 在步驟 61 中添加 Cloudflare CLI 檢查
{
  id: "p61-4",
  title: "4. Cloudflare CLI (Wrangler) 設定",
  description: "檢查和設定 Cloudflare CLI 用於 Pages 部署",
  keywords: ["cloudflare", "wrangler", "pages", "deploy", "cli"],
  prompts: {
    diagnostic: `【Cursor 自動化指令】檢查 Cloudflare CLI 設定

請自動執行以下檢查：

1. 檢查 Wrangler 是否已安裝：
   npx wrangler --version || echo "✗ Wrangler 未安裝"

2. 檢查是否已登入：
   npx wrangler whoami 2>&1 || echo "✗ 未登入 Cloudflare"

3. 檢查 Cloudflare API Token（如果已設定）：
   echo $CLOUDFLARE_API_TOKEN | head -c 10 && echo "..." || echo "✗ CLOUDFLARE_API_TOKEN 未設定"

4. 檢查 Cloudflare Account ID（如果已設定）：
   echo $CLOUDFLARE_ACCOUNT_ID || echo "✗ CLOUDFLARE_ACCOUNT_ID 未設定"

5. 檢查 Pages 專案（如果已連接）：
   npx wrangler pages project list 2>&1 | head -10 || echo "✗ 無法列出專案（可能需要登入）"`,
    fix: `【Cursor 自動化指令】自動設定 Cloudflare CLI

請自動執行以下操作：

1. 安裝 Wrangler（如果未安裝）：
   npm install -g wrangler || npm install -D wrangler
   echo "✓ Wrangler 安裝完成"

2. 登入 Cloudflare（如果需要）：
   npx wrangler login || echo "⚠️  請手動執行: npx wrangler login"
   # 這會開啟瀏覽器進行認證

3. 取得 Cloudflare Account ID：
   # 方法一：從登入資訊取得
   npx wrangler whoami 2>&1 | grep -i "account" || echo "請從 Dashboard 取得 Account ID"
   
   # 方法二：提示使用者
   echo "📋 請按照以下步驟取得 Account ID:"
   echo "   1. 前往: https://dash.cloudflare.com"
   echo "   2. 在右側邊欄找到 Account ID"
   echo "   3. 複製 Account ID"

4. 取得 Cloudflare API Token（如果需要 CLI 認證）：
   echo "📋 請按照以下步驟建立 API Token:"
   echo "   1. 前往: https://dash.cloudflare.com/profile/api-tokens"
   echo "   2. 點擊 'Create Token'"
   echo "   3. 使用 'Edit Cloudflare Workers' 模板"
   echo "   4. 或自訂權限: Account > Cloudflare Pages > Edit"
   echo "   5. 複製生成的 Token"

5. 設定環境變數（可選）：
   # 如果提供了 Token 和 Account ID
   if [ -n "{{cloudflare_api_token}}" ] && [ -n "{{cloudflare_account_id}}" ]; then
     export CLOUDFLARE_API_TOKEN="{{cloudflare_api_token}}"
     export CLOUDFLARE_ACCOUNT_ID="{{cloudflare_account_id}}"
     echo "✓ 環境變數已設定"
   fi

6. 驗證設定：
   npx wrangler whoami && echo "✓ Cloudflare CLI 設定完成" || echo "✗ 請檢查登入狀態"`,
    verify: `【Cursor 自動化指令】驗證 Cloudflare CLI 設定

請自動執行以下驗證：

1. 驗證 Wrangler 版本：
   npx wrangler --version && echo "✓ Wrangler 已安裝"

2. 驗證登入狀態：
   npx wrangler whoami && echo "✓ 已登入 Cloudflare" || echo "✗ 未登入，請執行: npx wrangler login"

3. 列出 Pages 專案：
   npx wrangler pages project list 2>&1 | head -20 || echo "⚠️  無法列出專案（可能需要登入或建立專案）"

4. 檢查部署能力：
   # 檢查是否有必要的權限
   npx wrangler pages deployment list --project-name={{project_name}} 2>&1 | head -5 || echo "⚠️  無法檢查部署（專案可能不存在）"

5. 產生設定報告：
   echo "=== Cloudflare CLI 設定報告 ==="
   echo "Wrangler 版本: $(npx wrangler --version 2>&1 | head -1 || echo '未安裝')"
   echo "登入狀態: $(npx wrangler whoami 2>&1 | grep -q 'email' && echo '已登入' || echo '未登入')"
   echo "Account ID: ${CLOUDFLARE_ACCOUNT_ID:-未設定}"
   echo "API Token: ${CLOUDFLARE_API_TOKEN:+已設定}"`
  }
}
```

---

### 方案二：自動化取得 Cloudflare 認證資訊

#### 概念

擴充 `scripts/fetch-keys.js`，添加自動取得 Cloudflare API Token 和 Account ID 的功能。

#### 設計

```javascript
// scripts/fetch-keys.js 中添加

/**
 * 使用 Cloudflare CLI 取得認證資訊
 */
async function fetchCloudflareCredentials() {
  console.log('🔍 正在取得 Cloudflare 認證資訊...');
  
  try {
    // 1. 檢查 Wrangler 是否已安裝
    try {
      execSync('npx wrangler --version', { stdio: 'pipe' });
    } catch (error) {
      console.log('⚠️  Wrangler 未安裝，請安裝: npm install -g wrangler');
      return null;
    }
    
    // 2. 檢查是否已登入
    let whoamiOutput;
    try {
      whoamiOutput = execSync('npx wrangler whoami', { encoding: 'utf-8' });
      console.log('✓ Cloudflare CLI 已登入');
    } catch (error) {
      console.log('⚠️  請先登入 Cloudflare: npx wrangler login');
      return null;
    }
    
    // 3. 嘗試從 whoami 取得 Account ID（如果可能）
    let accountId = null;
    if (whoamiOutput) {
      // 嘗試解析 Account ID（Wrangler 可能不會直接顯示）
      const accountMatch = whoamiOutput.match(/account[:\s]+([a-f0-9]{32})/i);
      if (accountMatch) {
        accountId = accountMatch[1];
      }
    }
    
    // 4. 提示取得 Account ID
    if (!accountId) {
      console.log('📋 請按照以下步驟取得 Account ID:');
      console.log('   1. 前往: https://dash.cloudflare.com');
      console.log('   2. 在右側邊欄找到 Account ID');
      console.log('   3. 複製 Account ID');
    }
    
    // 5. 提示建立 API Token
    console.log('📋 請按照以下步驟建立 API Token:');
    console.log('   1. 前往: https://dash.cloudflare.com/profile/api-tokens');
    console.log('   2. 點擊 "Create Token"');
    console.log('   3. 使用 "Edit Cloudflare Workers" 模板');
    console.log('   4. 或自訂權限: Account > Cloudflare Pages > Edit');
    console.log('   5. 複製生成的 Token');
    
    return {
      accountId: accountId || '請手動填入',
      apiToken: '請手動建立並填入',
      whoami: whoamiOutput
    };
    
  } catch (error) {
    console.error('❌ 取得 Cloudflare 認證資訊失敗:', error.message);
    return null;
  }
}
```

---

### 方案三：自動化部署腳本

#### 概念

建立一個自動化部署腳本，整合 Cloudflare CLI 操作。

#### 設計

```javascript
// scripts/deploy-cloudflare.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 自動化部署到 Cloudflare Pages
 */
async function deployToCloudflare(options = {}) {
  const {
    projectName = 'ddbug-runbook',
    buildCommand = 'CF_PAGES=1 npm run build',
    outputDir = 'dist',
    branch = 'main'
  } = options;
  
  console.log('🚀 開始部署到 Cloudflare Pages...\n');
  
  try {
    // 1. 檢查 Wrangler
    try {
      execSync('npx wrangler --version', { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ Wrangler 未安裝，請安裝: npm install -g wrangler');
      return false;
    }
    
    // 2. 檢查登入狀態
    try {
      execSync('npx wrangler whoami', { stdio: 'pipe' });
      console.log('✓ Cloudflare CLI 已登入');
    } catch (error) {
      console.log('⚠️  請先登入: npx wrangler login');
      return false;
    }
    
    // 3. 建置專案
    console.log('📦 正在建置專案...');
    try {
      execSync(buildCommand, { stdio: 'inherit' });
      console.log('✓ 建置完成');
    } catch (error) {
      console.error('❌ 建置失敗');
      return false;
    }
    
    // 4. 檢查輸出目錄
    if (!fs.existsSync(outputDir)) {
      console.error(`❌ 輸出目錄不存在: ${outputDir}`);
      return false;
    }
    
    // 5. 部署到 Cloudflare Pages
    console.log(`📤 正在部署到 Cloudflare Pages (專案: ${projectName})...`);
    try {
      execSync(`npx wrangler pages deploy ${outputDir} --project-name=${projectName}`, {
        stdio: 'inherit'
      });
      console.log('✓ 部署完成！');
      
      // 6. 顯示部署資訊
      console.log('\n📋 部署資訊:');
      console.log(`   專案名稱: ${projectName}`);
      console.log(`   部署網址: https://${projectName}.pages.dev`);
      console.log(`   查看部署: https://dash.cloudflare.com > Workers & Pages > ${projectName}`);
      
      return true;
    } catch (error) {
      console.error('❌ 部署失敗');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 部署過程發生錯誤:', error.message);
    return false;
  }
}

/**
 * 檢查部署狀態
 */
function checkDeploymentStatus(projectName) {
  console.log(`🔍 檢查專案 ${projectName} 的部署狀態...`);
  
  try {
    const output = execSync(`npx wrangler pages deployment list --project-name=${projectName}`, {
      encoding: 'utf-8'
    });
    console.log(output);
  } catch (error) {
    console.error('❌ 無法取得部署狀態:', error.message);
  }
}

/**
 * 主函數
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'deploy') {
    await deployToCloudflare();
  } else if (command === 'status') {
    const projectName = args[1] || 'ddbug-runbook';
    checkDeploymentStatus(projectName);
  } else {
    console.log('使用方法:');
    console.log('  node scripts/deploy-cloudflare.js deploy    # 部署到 Cloudflare Pages');
    console.log('  node scripts/deploy-cloudflare.js status    # 檢查部署狀態');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { deployToCloudflare, checkDeploymentStatus };
```

---

## 📝 整合到現有方案

### 1. 更新 CLI_AUTOMATION_ENVIRONMENT.md

添加 Cloudflare CLI 到環境建置步驟：

```markdown
### Cloudflare CLI (Wrangler)

**使用頻率**：中（部署相關）

**常見命令**：
```bash
npx wrangler --version              # 檢查版本
npx wrangler login                  # 登入
npx wrangler whoami                 # 檢查登入狀態
npx wrangler pages deploy           # 部署到 Pages
npx wrangler pages project list     # 列出專案
```

**需要檢查的狀態**：
- ✅ CLI 是否已安裝
- ✅ 是否已登入
- ✅ Account ID 是否已取得
- ✅ API Token 是否已建立（如果需要）
```

### 2. 更新 AUTO_FETCH_KEYS.md

添加 Cloudflare 認證資訊取得：

```markdown
### Cloudflare API Token 和 Account ID

**自動化程度**：部分自動化（需要手動建立 Token）

**取得方式**：
1. 使用 Cloudflare CLI 檢查登入狀態
2. 提示使用者取得 Account ID
3. 提示使用者建立 API Token
```

### 3. 更新 AUTO_ENV_SETUP.md

添加 Cloudflare 環境變數：

```markdown
### Cloudflare 相關

| 環境變數 | 類型 | 使用場景 | 安全性 |
|---------|------|---------|--------|
| `CLOUDFLARE_API_TOKEN` | 私密 | CI/CD 部署 | ⚠️ 僅後端 |
| `CLOUDFLARE_ACCOUNT_ID` | 私密 | CI/CD 部署 | ⚠️ 僅後端 |
```

---

## 🎯 使用方式

### 方式一：透過步驟 61

1. 進入步驟 61（CLI 自動化環境建置）
2. 選擇「Cloudflare CLI 設定」prompt
3. 複製指令到 Cursor 執行
4. 按照提示完成設定

### 方式二：直接執行腳本

```bash
# 檢查 Cloudflare CLI 狀態
npx wrangler whoami

# 部署到 Cloudflare Pages
npm run deploy:cloudflare

# 或使用自動化腳本
node scripts/deploy-cloudflare.js deploy
```

---

## 📋 實施清單

- [ ] 在步驟 61 中添加 Cloudflare CLI 檢查 prompt
- [ ] 更新 `scripts/fetch-keys.js` 添加 Cloudflare 認證取得
- [ ] 建立 `scripts/deploy-cloudflare.js` 自動化部署腳本
- [ ] 更新 `package.json` 添加部署腳本
- [ ] 更新 `CLI_AUTOMATION_ENVIRONMENT.md`
- [ ] 更新 `AUTO_FETCH_KEYS.md`
- [ ] 更新 `AUTO_ENV_SETUP.md`
- [ ] 測試 Cloudflare CLI 功能

---

## 💡 建議

**建議採用方案一 + 方案三的組合**：
1. **方案一**：整合到步驟 61，提供統一的環境檢查
2. **方案三**：建立自動化部署腳本，簡化部署流程

這樣可以：
- ✅ 統一管理所有 CLI 工具
- ✅ 自動化部署流程
- ✅ 減少手動操作

您覺得這個方案如何？需要我開始實作嗎？
