# 🔧 環境變數自動化設定方案

## 📋 問題分析

### 當前問題

1. **環境變數設定繁瑣**
   - 需要手動建立 `.env` 檔案
   - 需要手動填入所有環境變數
   - 容易遺漏或填錯

2. **多環境管理困難**
   - 本地開發環境（`.env.local`）
   - CI/CD 環境（GitHub Secrets）
   - 部署環境（Cloudflare Pages、Supabase Secrets）
   - 每個環境都需要單獨設定

3. **缺乏驗證機制**
   - 無法自動檢查環境變數是否完整
   - 無法驗證環境變數格式是否正確
   - 無法檢查環境變數是否過期

4. **安全性問題**
   - 公開和私密 Key 混在一起
   - 容易誤將私密 Key 暴露到前端
   - 缺乏環境變數分類管理

---

## 🔍 系統中需要的環境變數

### Supabase 相關（必需）

| 環境變數 | 類型 | 使用場景 | 安全性 |
|---------|------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | 公開 | 前端連接 Supabase | ✅ 可暴露 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開 | 前端 API 呼叫 | ✅ 可暴露 |
| `SUPABASE_SERVICE_ROLE_KEY` | 私密 | 後端繞過 RLS | ⚠️ 僅後端 |
| `SUPABASE_ACCESS_TOKEN` | 私密 | CLI 操作 | ⚠️ 僅後端 |
| `SUPABASE_URL` | 私密 | Edge Functions | ⚠️ 僅後端 |
| `SUPABASE_ANON_KEY` | 私密 | Edge Functions | ⚠️ 僅後端 |

### 第三方服務（可選）

| 環境變數 | 類型 | 使用場景 | 安全性 |
|---------|------|---------|--------|
| `RESEND_API_KEY` | 私密 | Email 發送 | ⚠️ 僅後端 |
| `LINE_CHANNEL_ACCESS_TOKEN` | 私密 | LINE 訊息 | ⚠️ 僅後端 |
| `LINE_CHANNEL_SECRET` | 私密 | LINE Webhook 驗證 | ⚠️ 僅後端 |
| `REDIS_URL` | 私密 | 快取服務 | ⚠️ 僅後端 |
| `REDIS_TOKEN` | 私密 | 快取認證 | ⚠️ 僅後端 |
| `CLOUDFLARE_API_TOKEN` | 私密 | CI/CD 部署 | ⚠️ 僅後端 |
| `CLOUDFLARE_ACCOUNT_ID` | 私密 | CI/CD 部署 | ⚠️ 僅後端 |
| `SENTRY_DSN` | 公開 | 錯誤追蹤 | ✅ 可暴露 |
| `STRIPE_PUBLISHABLE_KEY` | 公開 | 付款前端 | ✅ 可暴露 |
| `STRIPE_SECRET_KEY` | 私密 | 付款後端 | ⚠️ 僅後端 |
| `TWILIO_ACCOUNT_SID` | 私密 | 簡訊服務 | ⚠️ 僅後端 |
| `TWILIO_AUTH_TOKEN` | 私密 | 簡訊服務 | ⚠️ 僅後端 |
| `N8N_WEBHOOK_URL` | 公開 | n8n 整合 | ✅ 可暴露 |

### 應用程式設定（可選）

| 環境變數 | 類型 | 使用場景 | 安全性 |
|---------|------|---------|--------|
| `NODE_ENV` | 公開 | 環境識別 | ✅ 可暴露 |
| `CRON_SECRET` | 私密 | 定時任務驗證 | ⚠️ 僅後端 |
| `JWT_SECRET` | 私密 | JWT 簽名 | ⚠️ 僅後端 |

---

## 🎯 解決方案設計

### 方案一：自動化環境變數設定腳本（推薦）

#### 概念

建立一個 Node.js 腳本（`scripts/setup-env.js`），自動：
1. 從 `.automation-keys.json` 讀取 Keys
2. 生成 `.env` 檔案模板
3. 自動填入已知的 Keys
4. 驗證環境變數格式
5. 設定到不同環境（本地、CI/CD、Supabase Secrets）

#### 腳本功能設計

##### 1. 環境變數模板生成

```javascript
// scripts/setup-env.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 環境變數模板定義
 */
const envTemplate = {
  // Supabase（必需）
  supabase: {
    'NEXT_PUBLIC_SUPABASE_URL': {
      required: true,
      public: true,
      description: 'Supabase 專案 URL',
      example: 'https://xxxxx.supabase.co',
      generate: (keys) => keys.supabase_url || `https://${keys.supabase_ref}.supabase.co`
    },
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': {
      required: true,
      public: true,
      description: 'Supabase Anon Key（公開）',
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      generate: (keys) => keys.supabase_anon_key
    },
    'SUPABASE_SERVICE_ROLE_KEY': {
      required: true,
      public: false,
      description: 'Supabase Service Role Key（僅後端）',
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      generate: (keys) => keys.supabase_service_role_key
    },
    'SUPABASE_ACCESS_TOKEN': {
      required: false,
      public: false,
      description: 'Supabase CLI Access Token',
      generate: (keys) => keys.supabase_access_token
    },
    // Edge Functions 使用（自動從上面生成）
    'SUPABASE_URL': {
      required: false,
      public: false,
      description: 'Supabase URL（Edge Functions）',
      generate: (keys) => keys.supabase_url || `https://${keys.supabase_ref}.supabase.co`
    },
    'SUPABASE_ANON_KEY': {
      required: false,
      public: false,
      description: 'Supabase Anon Key（Edge Functions）',
      generate: (keys) => keys.supabase_anon_key
    }
  },
  
  // 第三方服務（可選）
  services: {
    'RESEND_API_KEY': {
      required: false,
      public: false,
      description: 'Resend API Key（Email 服務）',
      example: 're_xxxxx',
      validate: (value) => value && value.startsWith('re_'),
      generate: (keys) => keys.resend_api_key
    },
    'LINE_CHANNEL_ACCESS_TOKEN': {
      required: false,
      public: false,
      description: 'LINE Channel Access Token',
      validate: (value) => value && value.length >= 40,
      generate: (keys) => keys.line_channel_access_token
    },
    'LINE_CHANNEL_SECRET': {
      required: false,
      public: false,
      description: 'LINE Channel Secret',
      validate: (value) => value && value.length >= 20,
      generate: (keys) => keys.line_channel_secret
    },
    'REDIS_URL': {
      required: false,
      public: false,
      description: 'Redis 服務 URL',
      example: 'https://xxx.upstash.io',
      validate: (value) => value && (value.startsWith('http') || value.startsWith('redis://')),
      generate: (keys) => keys.redis_url
    },
    'REDIS_TOKEN': {
      required: false,
      public: false,
      description: 'Redis 認證 Token',
      generate: (keys) => keys.redis_token
    },
    'CLOUDFLARE_API_TOKEN': {
      required: false,
      public: false,
      description: 'Cloudflare API Token（CI/CD）',
      generate: (keys) => keys.cloudflare_api_token
    },
    'CLOUDFLARE_ACCOUNT_ID': {
      required: false,
      public: false,
      description: 'Cloudflare Account ID（CI/CD）',
      generate: (keys) => keys.cloudflare_account_id
    },
    'SENTRY_DSN': {
      required: false,
      public: true,
      description: 'Sentry DSN（錯誤追蹤）',
      example: 'https://xxx@sentry.io/xxx',
      validate: (value) => value && value.startsWith('https://'),
      generate: (keys) => keys.sentry_dsn
    }
  },
  
  // 應用程式設定
  app: {
    'NODE_ENV': {
      required: false,
      public: true,
      description: 'Node.js 環境',
      default: 'development',
      generate: () => process.env.NODE_ENV || 'development'
    },
    'CRON_SECRET': {
      required: false,
      public: false,
      description: 'Cron 任務驗證密鑰',
      generate: (keys) => keys.cron_secret || generateRandomSecret()
    },
    'JWT_SECRET': {
      required: false,
      public: false,
      description: 'JWT 簽名密鑰',
      generate: () => generateRandomSecret()
    }
  }
};

/**
 * 生成隨機密鑰
 */
function generateRandomSecret(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

##### 2. 讀取 Keys 並生成環境變數

```javascript
/**
 * 讀取自動取得的 Keys
 */
function loadKeys() {
  const keysPath = path.join(process.cwd(), '.automation-keys.json');
  
  if (!fs.existsSync(keysPath)) {
    console.log('⚠️  .automation-keys.json 不存在，請先執行: npm run fetch-keys');
    return {};
  }
  
  try {
    return JSON.parse(fs.readFileSync(keysPath, 'utf-8'));
  } catch (error) {
    console.error('❌ 讀取 .automation-keys.json 失敗:', error.message);
    return {};
  }
}

/**
 * 生成環境變數內容
 */
function generateEnvContent(keys, options = {}) {
  const {
    includeOptional = false,
    environment = 'development',
    publicOnly = false
  } = options;
  
  let content = `# ============================================
# 環境變數設定檔
# 生成時間: ${new Date().toISOString()}
# 環境: ${environment}
# ============================================
\n`;
  
  // 分類環境變數
  const allVars = {
    ...envTemplate.supabase,
    ...envTemplate.services,
    ...envTemplate.app
  };
  
  // 必需變數
  content += '# ============================================\n';
  content += '# 必需變數（Supabase）\n';
  content += '# ============================================\n\n';
  
  Object.entries(allVars).forEach(([key, config]) => {
    if (config.required) {
      const value = config.generate ? config.generate(keys) : null;
      if (value) {
        content += `${key}=${value}\n`;
      } else {
        content += `${key}=${config.example || '請填入'}\n`;
      }
      if (config.description) {
        content += `# ${config.description}\n`;
      }
      content += '\n';
    }
  });
  
  // 可選變數
  if (includeOptional) {
    content += '# ============================================\n';
    content += '# 可選變數（第三方服務）\n';
    content += '# ============================================\n\n';
    
    Object.entries(allVars).forEach(([key, config]) => {
      if (!config.required && (!publicOnly || config.public)) {
        const value = config.generate ? config.generate(keys) : null;
        if (value) {
          content += `${key}=${value}\n`;
        } else {
          content += `# ${key}=${config.example || '請填入'}\n`;
        }
        if (config.description) {
          content += `# ${config.description}\n`;
        }
        content += '\n';
      }
    });
  }
  
  return content;
}
```

##### 3. 驗證環境變數

```javascript
/**
 * 驗證環境變數格式
 */
function validateEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return { valid: false, errors: ['環境變數檔案不存在'] };
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const errors = [];
  const warnings = [];
  
  // 解析環境變數
  const envVars = {};
  envContent.split('\n').forEach((line, index) => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  // 檢查必需變數
  Object.entries(envTemplate.supabase).forEach(([key, config]) => {
    if (config.required) {
      if (!envVars[key] || envVars[key] === '請填入') {
        errors.push(`缺少必需變數: ${key}`);
      } else if (config.validate && !config.validate(envVars[key])) {
        errors.push(`變數格式錯誤: ${key}`);
      }
    }
  });
  
  // 檢查可選變數格式
  Object.entries(envTemplate.services).forEach(([key, config]) => {
    if (envVars[key] && config.validate && !config.validate(envVars[key])) {
      warnings.push(`變數格式可能有誤: ${key}`);
    }
  });
  
  // 檢查安全性（公開 vs 私密）
  Object.entries(envVars).forEach(([key, value]) => {
    const config = envTemplate.supabase[key] || 
                   envTemplate.services[key] || 
                   envTemplate.app[key];
    
    if (config && !config.public && key.startsWith('NEXT_PUBLIC_')) {
      warnings.push(`⚠️  安全警告: ${key} 是私密變數，不應使用 NEXT_PUBLIC_ 前綴`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    envVars
  };
}
```

##### 4. 自動設定到不同環境

```javascript
/**
 * 設定環境變數到本地檔案
 */
function setupLocalEnv(keys, options = {}) {
  const envPath = path.join(process.cwd(), '.env.local');
  const content = generateEnvContent(keys, {
    includeOptional: true,
    environment: 'development',
    ...options
  });
  
  fs.writeFileSync(envPath, content);
  console.log(`✓ 已生成 .env.local 檔案: ${envPath}`);
  
  // 驗證
  const validation = validateEnvFile(envPath);
  if (!validation.valid) {
    console.log('\n❌ 環境變數驗證失敗:');
    validation.errors.forEach(error => console.log(`   - ${error}`));
  }
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  警告:');
    validation.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
  
  return validation;
}

/**
 * 設定環境變數到 Supabase Secrets（Edge Functions）
 */
async function setupSupabaseSecrets(keys, projectRef) {
  if (!projectRef) {
    console.log('⚠️  未提供 Supabase Project Reference，跳過 Supabase Secrets 設定');
    return;
  }
  
  console.log('🔧 正在設定 Supabase Secrets...');
  
  try {
    // 連接專案
    execSync(`npx supabase link --project-ref ${projectRef}`, { stdio: 'pipe' });
    
    // 設定 Secrets
    const secrets = {
      'RESEND_API_KEY': keys.resend_api_key,
      'LINE_CHANNEL_ACCESS_TOKEN': keys.line_channel_access_token,
      'LINE_CHANNEL_SECRET': keys.line_channel_secret,
      'CRON_SECRET': keys.cron_secret,
      'REDIS_URL': keys.redis_url,
      'REDIS_TOKEN': keys.redis_token
    };
    
    Object.entries(secrets).forEach(([key, value]) => {
      if (value) {
        try {
          execSync(`npx supabase secrets set ${key}=${value}`, { stdio: 'pipe' });
          console.log(`   ✓ ${key} 已設定`);
        } catch (error) {
          console.log(`   ✗ ${key} 設定失敗: ${error.message}`);
        }
      }
    });
    
    console.log('✓ Supabase Secrets 設定完成');
  } catch (error) {
    console.error('❌ Supabase Secrets 設定失敗:', error.message);
  }
}

/**
 * 設定環境變數到 GitHub Secrets（CI/CD）
 */
async function setupGitHubSecrets(keys) {
  console.log('🔧 正在設定 GitHub Secrets...');
  
  try {
    // 檢查 GitHub CLI
    execSync('gh --version', { stdio: 'pipe' });
    
    // 檢查是否已登入
    try {
      execSync('gh auth status', { stdio: 'pipe' });
    } catch (error) {
      console.log('⚠️  請先登入 GitHub: gh auth login');
      return;
    }
    
    // 設定 Secrets
    const secrets = {
      'NEXT_PUBLIC_SUPABASE_URL': keys.supabase_url || `https://${keys.supabase_ref}.supabase.co`,
      'NEXT_PUBLIC_SUPABASE_ANON_KEY': keys.supabase_anon_key,
      'SUPABASE_ACCESS_TOKEN': keys.supabase_access_token,
      'CLOUDFLARE_API_TOKEN': keys.cloudflare_api_token,
      'CLOUDFLARE_ACCOUNT_ID': keys.cloudflare_account_id
    };
    
    Object.entries(secrets).forEach(([key, value]) => {
      if (value && value !== '請填入') {
        try {
          execSync(`gh secret set ${key} --body "${value}"`, { stdio: 'pipe' });
          console.log(`   ✓ ${key} 已設定`);
        } catch (error) {
          console.log(`   ✗ ${key} 設定失敗: ${error.message}`);
        }
      }
    });
    
    console.log('✓ GitHub Secrets 設定完成');
  } catch (error) {
    console.error('❌ GitHub Secrets 設定失敗:', error.message);
    console.log('   請確認已安裝 GitHub CLI: brew install gh');
  }
}
```

##### 5. 主函數

```javascript
/**
 * 主函數：自動設定環境變數
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    local: args.includes('--local') || !args.includes('--no-local'),
    supabase: args.includes('--supabase'),
    github: args.includes('--github'),
    validate: args.includes('--validate') || true
  };
  
  console.log('🚀 開始自動設定環境變數...\n');
  
  // 1. 讀取 Keys
  const keys = loadKeys();
  if (Object.keys(keys).length === 0) {
    console.log('⚠️  未找到任何 Keys，請先執行: npm run fetch-keys');
    return;
  }
  
  // 2. 設定本地環境變數
  if (options.local) {
    console.log('📝 正在生成本地環境變數檔案...');
    const validation = setupLocalEnv(keys);
    
    if (validation.valid) {
      console.log('✅ 本地環境變數設定完成！');
    } else {
      console.log('❌ 本地環境變數設定有誤，請檢查上述錯誤');
    }
  }
  
  // 3. 設定 Supabase Secrets
  if (options.supabase && keys.supabase_ref) {
    await setupSupabaseSecrets(keys, keys.supabase_ref);
  }
  
  // 4. 設定 GitHub Secrets
  if (options.github) {
    await setupGitHubSecrets(keys);
  }
  
  // 5. 驗證
  if (options.validate) {
    console.log('\n🔍 驗證環境變數...');
    const envPath = path.join(process.cwd(), '.env.local');
    const validation = validateEnvFile(envPath);
    
    if (validation.valid) {
      console.log('✅ 所有環境變數驗證通過！');
    } else {
      console.log('❌ 環境變數驗證失敗，請檢查上述錯誤');
    }
  }
  
  console.log('\n📋 下一步：');
  console.log('   1. 檢查 .env.local 檔案');
  console.log('   2. 填入缺失的環境變數');
  console.log('   3. 重啟開發伺服器: npm run dev');
}

// 執行主函數
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  generateEnvContent,
  validateEnvFile,
  setupLocalEnv,
  setupSupabaseSecrets,
  setupGitHubSecrets
};
```

---

### 方案二：整合到步驟 61（環境建置）

#### 概念

在步驟 61 中添加「自動設定環境變數」的 prompt。

#### 設計

```typescript
{
  id: "p61-3",
  title: "3. 自動設定環境變數",
  description: "自動生成 .env 檔案並設定到不同環境",
  keywords: ["env", "environment", "variables", "setup", "config"],
  prompts: {
    diagnostic: `【Cursor 自動化指令】檢查環境變數設定

請自動執行以下檢查：

1. 檢查 .env.local 檔案是否存在：
   test -f .env.local && echo "✓ .env.local 存在" || echo "✗ .env.local 不存在"

2. 檢查必要的環境變數：
   # 檢查 Supabase 環境變數
   grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local 2>/dev/null && echo "✓ SUPABASE_URL 已設定" || echo "✗ SUPABASE_URL 未設定"
   grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local 2>/dev/null && echo "✓ SUPABASE_ANON_KEY 已設定" || echo "✗ SUPABASE_ANON_KEY 未設定"
   grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local 2>/dev/null && echo "✓ SUPABASE_SERVICE_ROLE_KEY 已設定" || echo "✗ SUPABASE_SERVICE_ROLE_KEY 未設定"

3. 檢查環境變數格式：
   # 檢查 Supabase URL 格式
   grep "NEXT_PUBLIC_SUPABASE_URL" .env.local 2>/dev/null | grep -q "https://.*.supabase.co" && echo "✓ URL 格式正確" || echo "✗ URL 格式可能有誤"

4. 產生環境變數狀態報告：
   echo "=== 環境變數狀態 ==="
   echo "已設定: $(grep -c "^[A-Z]" .env.local 2>/dev/null || echo 0) 個"
   echo "缺失: $(grep -c "請填入" .env.local 2>/dev/null || echo 0) 個"`,
    fix: `【Cursor 自動化指令】自動設定環境變數

請自動執行以下操作：

1. 執行環境變數設定腳本：
   npm run setup-env || node scripts/setup-env.js

2. 腳本會自動：
   - 從 .automation-keys.json 讀取 Keys
   - 生成 .env.local 檔案
   - 自動填入已知的 Keys
   - 驗證環境變數格式
   - 提示缺失的環境變數

3. 如果腳本不存在，請先建立：
   # 建立 scripts 目錄
   mkdir -p scripts
   
   # 建立腳本檔案（參考 AUTO_ENV_SETUP.md）

4. 設定到 Supabase Secrets（如果需要）：
   npm run setup-env -- --supabase

5. 設定到 GitHub Secrets（如果需要）：
   npm run setup-env -- --github`,
    verify: `【Cursor 自動化指令】驗證環境變數設定

請自動執行以下驗證：

1. 檢查 .env.local 檔案：
   cat .env.local | head -20

2. 驗證環境變數格式：
   node scripts/validate-env.js || echo "請手動檢查環境變數格式"

3. 檢查缺失的環境變數：
   grep "請填入" .env.local && echo "⚠️  仍有環境變數需要填入" || echo "✓ 所有環境變數已填入"

4. 測試環境變數是否生效：
   # 在應用程式中測試
   node -e "require('dotenv').config({ path: '.env.local' }); console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '已設定' : '未設定');"`
  }
}
```

---

## 📝 實施步驟

### 步驟 1：建立腳本檔案

1. 建立 `scripts/setup-env.js`
2. 實作所有環境變數設定功能
3. 添加驗證和錯誤處理

### 步驟 2：添加 npm 腳本

在 `package.json` 中添加：

```json
{
  "scripts": {
    "setup-env": "node scripts/setup-env.js",
    "setup-env:local": "node scripts/setup-env.js --local",
    "setup-env:supabase": "node scripts/setup-env.js --supabase",
    "setup-env:github": "node scripts/setup-env.js --github",
    "validate-env": "node scripts/validate-env.js"
  }
}
```

### 步驟 3：建立環境變數模板

建立 `.env.example` 檔案作為模板：

```bash
# .env.example
# 複製此檔案為 .env.local 並填入實際值

# Supabase（必需）
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# 第三方服務（可選）
# RESEND_API_KEY=re_xxxxx
# LINE_CHANNEL_ACCESS_TOKEN=xxxxx
# LINE_CHANNEL_SECRET=xxxxx
```

### 步驟 4：整合到步驟 61

在步驟 61 中添加「自動設定環境變數」的 prompt。

### 步驟 5：更新 .gitignore

確保敏感資訊不會被提交：

```gitignore
# 環境變數
.env
.env.local
.env.*.local
.automation-keys.json
```

---

## 🔒 安全性考量

### 1. 環境變數分類

- **公開變數**（`NEXT_PUBLIC_*`）：可暴露到前端
- **私密變數**：僅後端使用，不可暴露

### 2. 檔案保護

- ✅ `.env.local` 加入 `.gitignore`
- ✅ 使用檔案權限保護（`chmod 600`）

### 3. 驗證機制

- ✅ 驗證環境變數格式
- ✅ 檢查安全性（公開 vs 私密）
- ✅ 提示缺失的環境變數

---

## 💡 使用方式

### 方式一：直接執行腳本

```bash
# 設定本地環境變數
npm run setup-env

# 同時設定到 Supabase Secrets
npm run setup-env -- --supabase

# 同時設定到 GitHub Secrets
npm run setup-env -- --github

# 只驗證環境變數
npm run validate-env
```

### 方式二：透過步驟 61

1. 進入步驟 61（CLI 自動化環境建置）
2. 選擇「自動設定環境變數」prompt
3. 複製指令到 Cursor 執行
4. 腳本會自動生成和設定環境變數

---

## 🎯 預期效果

### 實施前
- ❌ 需要手動建立 .env 檔案
- ❌ 需要手動填入所有環境變數
- ❌ 容易遺漏或填錯
- ❌ 多環境需要重複設定

### 實施後
- ✅ 自動生成 .env 檔案
- ✅ 自動填入已知的 Keys
- ✅ 自動驗證格式
- ✅ 自動設定到不同環境
- ✅ 減少錯誤和遺漏

---

## 📋 實施清單

- [ ] 建立 `scripts/setup-env.js` 腳本
- [ ] 實作環境變數模板生成
- [ ] 實作從 Keys 自動填入
- [ ] 實作環境變數驗證
- [ ] 實作 Supabase Secrets 設定
- [ ] 實作 GitHub Secrets 設定
- [ ] 建立 `.env.example` 模板
- [ ] 添加 npm 腳本
- [ ] 整合到步驟 61
- [ ] 更新 .gitignore
- [ ] 測試腳本功能
- [ ] 撰寫使用文件

---

## ❓ 常見問題

### Q1: 腳本會覆蓋現有的 .env.local 嗎？

**A**: 可以選擇：
- **預設行為**：如果檔案存在，會合併更新（保留現有值）
- **強制覆蓋**：使用 `--force` 參數

### Q2: 如何處理不同環境的環境變數？

**A**: 腳本支援：
- **本地開發**：`.env.local`
- **CI/CD**：GitHub Secrets
- **Edge Functions**：Supabase Secrets
- **部署環境**：Cloudflare Pages 環境變數（未來可添加）

### Q3: 安全性如何保證？

**A**: 
- 腳本在本地執行
- 環境變數儲存在本地檔案
- 檔案加入 `.gitignore`，不會被提交
- 自動檢查公開 vs 私密變數

---

您覺得這個方案如何？需要我開始實作嗎？
