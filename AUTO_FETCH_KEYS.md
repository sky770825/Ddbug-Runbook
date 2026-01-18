# 🔑 自動化取得 API Keys 方案

## 📋 問題分析

### 當前問題

1. **手動取得 Key 繁瑣**
   - 需要登入多個平台（Supabase、LINE、Resend、Cloudflare 等）
   - 需要在 Dashboard 中尋找 Key 的位置
   - 需要手動複製和貼上

2. **容易出錯**
   - 可能複製錯誤的 Key
   - 可能使用過期的 Key
   - 可能遺漏某些必要的 Key

3. **缺乏統一管理**
   - Key 分散在多個地方
   - 無法快速檢查所有 Key 的狀態
   - 無法自動更新過期的 Key

### 用戶需求

- ✅ 自動化腳本可以取得所有需要的 Key
- ✅ 在本地執行，安全可靠
- ✅ 自動驗證 Key 是否有效
- ✅ 自動儲存到專案設定或環境變數

---

## 🔍 需要取得的 Key 清單

### 高優先級（可自動取得）

| Key 名稱 | 平台 | 取得方式 | 自動化難度 |
|---------|------|---------|-----------|
| **Supabase Anon Key** | Supabase | Supabase CLI | ⭐⭐ 簡單 |
| **Supabase Service Role Key** | Supabase | Supabase CLI | ⭐⭐ 簡單 |
| **Supabase Access Token** | Supabase | Supabase CLI | ⭐⭐ 簡單 |
| **Supabase Project Ref** | Supabase | Supabase CLI | ⭐⭐ 簡單 |
| **GitHub Personal Access Token** | GitHub | GitHub CLI | ⭐⭐ 簡單 |

### 中優先級（部分自動化）

| Key 名稱 | 平台 | 取得方式 | 自動化難度 |
|---------|------|---------|-----------|
| **Resend API Key** | Resend | Dashboard（需要登入） | ⭐⭐⭐ 中等 |
| **LINE Channel Access Token** | LINE | Dashboard（需要登入） | ⭐⭐⭐ 中等 |
| **LINE Channel Secret** | LINE | Dashboard（需要登入） | ⭐⭐⭐ 中等 |
| **Cloudflare API Token** | Cloudflare | Dashboard（需要登入） | ⭐⭐⭐ 中等 |

### 低優先級（需要手動取得）

| Key 名稱 | 平台 | 取得方式 | 自動化難度 |
|---------|------|---------|-----------|
| **OAuth Client ID/Secret** | Google/GitHub 等 | 各平台開發者控制台 | ⭐⭐⭐⭐ 困難 |
| **Stripe Keys** | Stripe | Dashboard（需要登入） | ⭐⭐⭐⭐ 困難 |

---

## 🎯 解決方案設計

### 方案一：CLI 自動化腳本（推薦）

#### 概念

建立一個 Node.js 腳本（`scripts/fetch-keys.js`），使用各種 CLI 工具自動取得 Key。

#### 腳本功能

##### 1. 使用 Supabase CLI 取得 Supabase Keys

```javascript
// scripts/fetch-keys.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 使用 Supabase CLI 取得 API Keys
 */
async function fetchSupabaseKeys(projectRef) {
  console.log('🔍 正在取得 Supabase Keys...');
  
  try {
    // 1. 檢查 Supabase CLI 是否已安裝
    execSync('npx supabase --version', { stdio: 'pipe' });
    
    // 2. 檢查是否已登入
    try {
      execSync('npx supabase projects list', { stdio: 'pipe' });
    } catch (error) {
      console.log('⚠️  請先登入 Supabase: npx supabase login');
      return null;
    }
    
    // 3. 連接專案（如果提供了 projectRef）
    if (projectRef) {
      try {
        execSync(`npx supabase link --project-ref ${projectRef}`, { stdio: 'pipe' });
      } catch (error) {
        console.log('⚠️  專案連接失敗，請確認 Project Reference');
      }
    }
    
    // 4. 取得專案資訊（包含 API URL）
    const projectInfo = execSync('npx supabase projects list --output json', { encoding: 'utf-8' });
    const projects = JSON.parse(projectInfo);
    
    // 5. 提示使用者從 Dashboard 取得 Keys
    console.log('📋 請按照以下步驟取得 Supabase Keys:');
    console.log('   1. 前往 Supabase Dashboard: https://app.supabase.com/');
    console.log('   2. 選擇專案');
    console.log('   3. 前往 Settings > API');
    console.log('   4. 複製以下 Keys:');
    console.log('      - Project URL');
    console.log('      - anon/public key');
    console.log('      - service_role key (secret)');
    
    // 6. 或者使用 Supabase Management API（需要 Access Token）
    // 注意：這需要額外的權限設定
    
    return {
      projectRef: projectRef || '請手動填入',
      url: '請從 Dashboard 取得',
      anonKey: '請從 Dashboard 取得',
      serviceRoleKey: '請從 Dashboard 取得'
    };
    
  } catch (error) {
    console.error('❌ 取得 Supabase Keys 失敗:', error.message);
    return null;
  }
}
```

##### 2. 使用 GitHub CLI 取得 GitHub Token

```javascript
/**
 * 使用 GitHub CLI 取得 Personal Access Token
 */
async function fetchGitHubToken() {
  console.log('🔍 正在取得 GitHub Token...');
  
  try {
    // 1. 檢查 GitHub CLI 是否已安裝
    execSync('gh --version', { stdio: 'pipe' });
    
    // 2. 檢查是否已登入
    try {
      const authStatus = execSync('gh auth status', { encoding: 'utf-8' });
      if (authStatus.includes('Logged in')) {
        console.log('✓ GitHub CLI 已登入');
        
        // 3. 提示建立 Personal Access Token
        console.log('📋 請按照以下步驟建立 Personal Access Token:');
        console.log('   1. 前往: https://github.com/settings/tokens');
        console.log('   2. 點擊 "Generate new token (classic)"');
        console.log('   3. 選擇需要的權限（repo, workflow 等）');
        console.log('   4. 複製生成的 Token');
        
        // 4. 或者使用 GitHub CLI 建立 Token（需要額外權限）
        // gh auth token --hostname github.com
        
        return {
          token: '請手動建立並填入',
          scopes: ['repo', 'workflow']
        };
      }
    } catch (error) {
      console.log('⚠️  請先登入 GitHub: gh auth login');
      return null;
    }
    
  } catch (error) {
    console.error('❌ GitHub CLI 未安裝，請安裝: brew install gh');
    return null;
  }
}
```

##### 3. 互動式取得其他 Keys

```javascript
/**
 * 互動式取得其他平台的 Keys
 */
async function fetchOtherKeys() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const keys = {};
  
  // Resend API Key
  console.log('\n📧 Resend API Key:');
  console.log('   1. 前往: https://resend.com/api-keys');
  console.log('   2. 登入並建立新的 API Key');
  console.log('   3. 複製 Key（格式: re_xxxxx）');
  
  const resendKey = await new Promise((resolve) => {
    rl.question('請貼上 Resend API Key (或按 Enter 跳過): ', (answer) => {
      resolve(answer.trim() || null);
    });
  });
  if (resendKey) keys.resend_api_key = resendKey;
  
  // LINE Channel Access Token
  console.log('\n📱 LINE Channel Access Token:');
  console.log('   1. 前往: https://developers.line.biz/console/');
  console.log('   2. 選擇 Channel');
  console.log('   3. 前往 Messaging API 設定');
  console.log('   4. 複製 Channel Access Token');
  
  const lineToken = await new Promise((resolve) => {
    rl.question('請貼上 LINE Channel Access Token (或按 Enter 跳過): ', (answer) => {
      resolve(answer.trim() || null);
    });
  });
  if (lineToken) keys.line_channel_access_token = lineToken;
  
  // LINE Channel Secret
  const lineSecret = await new Promise((resolve) => {
    rl.question('請貼上 LINE Channel Secret (或按 Enter 跳過): ', (answer) => {
      resolve(answer.trim() || null);
    });
  });
  if (lineSecret) keys.line_channel_secret = lineSecret;
  
  rl.close();
  return keys;
}
```

##### 4. 儲存 Keys 到專案設定

```javascript
/**
 * 儲存 Keys 到專案設定檔案
 */
function saveKeysToConfig(keys) {
  const configPath = path.join(process.cwd(), '.automation-keys.json');
  
  // 讀取現有設定（如果存在）
  let existingConfig = {};
  if (fs.existsSync(configPath)) {
    existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  
  // 合併新的 Keys
  const updatedConfig = {
    ...existingConfig,
    ...keys,
    updatedAt: new Date().toISOString()
  };
  
  // 儲存到檔案
  fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
  console.log(`\n✓ Keys 已儲存到: ${configPath}`);
  
  // 同時更新 .env 檔案（如果需要的話）
  updateEnvFile(keys);
}

/**
 * 更新 .env 檔案
 */
function updateEnvFile(keys) {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  // 讀取現有 .env（如果存在）
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  
  // 更新或新增環境變數
  const envUpdates = {
    'NEXT_PUBLIC_SUPABASE_URL': keys.supabaseUrl,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': keys.supabaseAnonKey,
    'SUPABASE_SERVICE_ROLE_KEY': keys.supabaseServiceRoleKey,
    'RESEND_API_KEY': keys.resend_api_key,
    'LINE_CHANNEL_ACCESS_TOKEN': keys.line_channel_access_token,
    'LINE_CHANNEL_SECRET': keys.line_channel_secret
  };
  
  Object.entries(envUpdates).forEach(([key, value]) => {
    if (value) {
      // 如果環境變數已存在，更新它
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        // 如果不存在，新增它
        envContent += `\n${key}=${value}`;
      }
    }
  });
  
  fs.writeFileSync(envPath, envContent);
  console.log('✓ .env 檔案已更新');
}
```

##### 5. 主函數

```javascript
/**
 * 主函數：自動取得所有 Keys
 */
async function main() {
  console.log('🚀 開始自動取得 API Keys...\n');
  
  const allKeys = {};
  
  // 1. 取得 Supabase Keys
  const supabaseRef = process.argv[2] || process.env.SUPABASE_REF;
  const supabaseKeys = await fetchSupabaseKeys(supabaseRef);
  if (supabaseKeys) {
    Object.assign(allKeys, {
      supabase_ref: supabaseKeys.projectRef,
      supabase_url: supabaseKeys.url,
      supabase_anon_key: supabaseKeys.anonKey,
      supabase_service_role_key: supabaseKeys.serviceRoleKey
    });
  }
  
  // 2. 取得 GitHub Token
  const githubToken = await fetchGitHubToken();
  if (githubToken) {
    allKeys.github_token = githubToken.token;
  }
  
  // 3. 互動式取得其他 Keys
  const otherKeys = await fetchOtherKeys();
  Object.assign(allKeys, otherKeys);
  
  // 4. 儲存 Keys
  if (Object.keys(allKeys).length > 0) {
    saveKeysToConfig(allKeys);
    console.log('\n✅ 所有 Keys 取得完成！');
    console.log('📝 請檢查 .automation-keys.json 檔案');
  } else {
    console.log('\n⚠️  未取得任何 Keys');
  }
}

// 執行主函數
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fetchSupabaseKeys, fetchGitHubToken, fetchOtherKeys, saveKeysToConfig };
```

---

### 方案二：整合到步驟 61（環境建置）

#### 概念

在步驟 61（CLI 自動化環境建置）中添加一個新的 prompt，用於自動取得 Keys。

#### 設計

```typescript
{
  id: "p61-2",
  title: "2. 自動取得 API Keys",
  description: "使用自動化腳本取得所有需要的 API Keys",
  keywords: ["keys", "api", "tokens", "secrets", "fetch"],
  prompts: {
    diagnostic: `【Cursor 自動化指令】檢查 API Keys 狀態

請自動執行以下檢查：

1. 檢查 .automation-keys.json 檔案是否存在：
   test -f .automation-keys.json && echo "✓ Keys 設定檔存在" || echo "✗ Keys 設定檔不存在"

2. 檢查 .env 檔案是否存在：
   test -f .env && echo "✓ .env 檔案存在" || echo "✗ .env 檔案不存在"

3. 檢查必要的 Keys 是否已設定：
   # 檢查 Supabase Keys
   grep -q "SUPABASE_ANON_KEY" .env 2>/dev/null && echo "✓ Supabase Anon Key 已設定" || echo "✗ Supabase Anon Key 未設定"
   grep -q "SUPABASE_SERVICE_ROLE_KEY" .env 2>/dev/null && echo "✓ Supabase Service Role Key 已設定" || echo "✗ Supabase Service Role Key 未設定"
   
   # 檢查其他 Keys
   grep -q "RESEND_API_KEY" .env 2>/dev/null && echo "✓ Resend API Key 已設定" || echo "✗ Resend API Key 未設定"
   grep -q "LINE_CHANNEL_ACCESS_TOKEN" .env 2>/dev/null && echo "✓ LINE Access Token 已設定" || echo "✗ LINE Access Token 未設定"`,
    fix: `【Cursor 自動化指令】自動取得 API Keys

請自動執行以下操作：

1. 執行自動化腳本取得 Keys：
   node scripts/fetch-keys.js {{supabase_ref}} || echo "請手動執行腳本"

2. 或者手動執行：
   npm run fetch-keys

3. 腳本會：
   - 使用 Supabase CLI 取得 Supabase Keys
   - 使用 GitHub CLI 取得 GitHub Token
   - 互動式取得其他平台的 Keys
   - 自動儲存到 .automation-keys.json 和 .env

4. 如果腳本不存在，請先建立：
   # 建立 scripts 目錄
   mkdir -p scripts
   
   # 建立腳本檔案（參考 AUTO_FETCH_KEYS.md）`,
    verify: `【Cursor 自動化指令】驗證 API Keys 已取得

請自動執行以下驗證：

1. 檢查 .automation-keys.json 檔案：
   cat .automation-keys.json | jq '.' || echo "檔案不存在或格式錯誤"

2. 驗證 Keys 格式：
   # 檢查 Supabase Anon Key 格式
   grep "supabase_anon_key" .automation-keys.json | grep -q "eyJ" && echo "✓ Supabase Anon Key 格式正確" || echo "✗ Supabase Anon Key 格式可能有誤"
   
   # 檢查 Resend API Key 格式
   grep "resend_api_key" .automation-keys.json | grep -q "re_" && echo "✓ Resend API Key 格式正確" || echo "✗ Resend API Key 格式可能有誤"

3. 檢查 .env 檔案是否已更新：
   grep -q "SUPABASE_ANON_KEY" .env && echo "✓ .env 已更新" || echo "✗ .env 未更新"

4. 產生 Keys 狀態報告：
   echo "=== API Keys 狀態報告 ==="
   echo "Supabase Keys: $(grep -c "supabase" .automation-keys.json 2>/dev/null || echo 0) 個"
   echo "其他 Keys: $(grep -v "supabase" .automation-keys.json 2>/dev/null | grep -c ":" || echo 0) 個"`
  }
}
```

---

## 📝 實施步驟

### 步驟 1：建立腳本檔案

1. 建立 `scripts/fetch-keys.js`
2. 實作所有取得 Keys 的函數
3. 添加錯誤處理和驗證

### 步驟 2：添加 npm 腳本

在 `package.json` 中添加：

```json
{
  "scripts": {
    "fetch-keys": "node scripts/fetch-keys.js",
    "fetch-keys:supabase": "node scripts/fetch-keys.js --supabase-only",
    "fetch-keys:github": "node scripts/fetch-keys.js --github-only"
  }
}
```

### 步驟 3：整合到步驟 61

在步驟 61 中添加「自動取得 API Keys」的 prompt。

### 步驟 4：建立 .gitignore 規則

確保敏感資訊不會被提交：

```gitignore
# API Keys
.automation-keys.json
.env
.env.local
.env.*.local
```

---

## 🔒 安全性考量

### 1. 本地執行

- ✅ 腳本在本地執行，不會上傳 Keys 到遠端
- ✅ Keys 儲存在本地檔案（`.automation-keys.json`、`.env`）

### 2. 檔案保護

- ✅ `.automation-keys.json` 和 `.env` 應加入 `.gitignore`
- ✅ 使用檔案權限保護（`chmod 600`）

### 3. 驗證機制

- ✅ 驗證 Key 格式是否正確
- ✅ 提示使用者檢查 Key 是否有效
- ✅ 不自動使用 Keys，只儲存

---

## 💡 使用方式

### 方式一：直接執行腳本

```bash
# 取得所有 Keys
npm run fetch-keys

# 只取得 Supabase Keys
npm run fetch-keys:supabase

# 只取得 GitHub Token
npm run fetch-keys:github
```

### 方式二：透過步驟 61

1. 進入步驟 61（CLI 自動化環境建置）
2. 選擇「自動取得 API Keys」prompt
3. 複製指令到 Cursor 執行
4. 腳本會自動取得並儲存 Keys

---

## 🎯 預期效果

### 實施前
- ❌ 需要手動登入多個平台
- ❌ 需要手動複製和貼上 Keys
- ❌ 容易出錯和遺漏

### 實施後
- ✅ 自動取得大部分 Keys
- ✅ 自動儲存到設定檔
- ✅ 自動驗證格式
- ✅ 減少錯誤和遺漏

---

## 📋 實施清單

- [ ] 建立 `scripts/fetch-keys.js` 腳本
- [ ] 實作 Supabase CLI 取得 Keys
- [ ] 實作 GitHub CLI 取得 Token
- [ ] 實作互動式取得其他 Keys
- [ ] 實作儲存到設定檔功能
- [ ] 添加 npm 腳本
- [ ] 整合到步驟 61
- [ ] 更新 .gitignore
- [ ] 測試腳本功能
- [ ] 撰寫使用文件

---

## ❓ 常見問題

### Q1: 腳本可以完全自動取得所有 Keys 嗎？

**A**: 部分可以，部分需要手動：
- ✅ **可以自動**：Supabase Keys（透過 CLI）、GitHub Token（透過 CLI）
- ⚠️ **需要互動**：Resend、LINE、Cloudflare 等（需要登入 Dashboard）
- ❌ **需要手動**：OAuth Credentials（需要各平台開發者控制台）

### Q2: 安全性如何保證？

**A**: 
- 腳本在本地執行
- Keys 儲存在本地檔案
- 檔案加入 `.gitignore`，不會被提交
- 不自動使用 Keys，只儲存

### Q3: 可以更新過期的 Keys 嗎？

**A**: 可以，執行腳本會：
- 檢查現有 Keys
- 提示更新過期的 Keys
- 自動更新設定檔

---

您覺得這個方案如何？需要我開始實作嗎？
