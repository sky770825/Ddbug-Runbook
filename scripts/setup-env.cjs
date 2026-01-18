#!/usr/bin/env node

/**
 * 自動設定環境變數腳本
 * 從 .automation-keys.json 讀取 Keys 並生成 .env.local 檔案
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

/**
 * 讀取自動取得的 Keys
 */
function loadKeys() {
  const keysPath = path.join(process.cwd(), '.automation-keys.json');
  
  if (!fs.existsSync(keysPath)) {
    console.log('⚠️  .automation-keys.json 不存在');
    console.log('   請先執行: npm run fetch-keys');
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
    includeOptional = true,
    environment = 'development'
  } = options;
  
  let content = `# ============================================
# 環境變數設定檔
# 生成時間: ${new Date().toISOString()}
# 環境: ${environment}
# 使用 npm run setup-env 自動生成
# ============================================
\n`;
  
  // Supabase（必需）
  content += '# ============================================\n';
  content += '# Supabase（必需）\n';
  content += '# ============================================\n\n';
  
  const supabaseUrl = keys.supabase_url || (keys.supabase_ref ? `https://${keys.supabase_ref}.supabase.co` : '請填入');
  const supabaseAnonKey = keys.supabase_anon_key || '請填入';
  const supabaseServiceRoleKey = keys.supabase_service_role_key || '請填入';
  const supabaseAccessToken = keys.supabase_access_token || '請填入';
  
  content += `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}\n`;
  content += `# Supabase 專案 URL\n\n`;
  
  content += `NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey}\n`;
  content += `# Supabase Anon Key（公開）\n\n`;
  
  content += `SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceRoleKey}\n`;
  content += `# Supabase Service Role Key（僅後端使用）\n\n`;
  
  content += `SUPABASE_ACCESS_TOKEN=${supabaseAccessToken}\n`;
  content += `# Supabase CLI Access Token\n\n`;
  
  // Edge Functions 使用
  content += `# Edge Functions 使用（自動從上面生成）\n`;
  content += `SUPABASE_URL=${supabaseUrl}\n`;
  content += `SUPABASE_ANON_KEY=${supabaseAnonKey}\n\n`;
  
  // 應用程式設定
  content += '# ============================================\n';
  content += '# 應用程式設定\n';
  content += '# ============================================\n\n';
  
  content += `NODE_ENV=${process.env.NODE_ENV || 'development'}\n`;
  content += `# Node.js 環境\n\n`;
  
  const cronSecret = keys.cron_secret || generateRandomSecret();
  content += `CRON_SECRET=${cronSecret}\n`;
  content += `# Cron 任務驗證密鑰（自動生成）\n\n`;
  
  const jwtSecret = keys.jwt_secret || generateRandomSecret();
  content += `# JWT_SECRET=${jwtSecret}\n`;
  content += `# JWT 簽名密鑰（自動生成，如需要請取消註解）\n\n`;
  
  // 第三方服務（可選）
  if (includeOptional) {
    content += '# ============================================\n';
    content += '# 第三方服務（可選）\n';
    content += '# ============================================\n\n';
    
    if (keys.resend_api_key) {
      content += `RESEND_API_KEY=${keys.resend_api_key}\n`;
      content += `# Resend API Key（Email 服務）\n\n`;
    } else {
      content += `# RESEND_API_KEY=re_xxxxx\n`;
      content += `# Resend API Key（Email 服務）\n\n`;
    }
    
    if (keys.line_channel_access_token) {
      content += `LINE_CHANNEL_ACCESS_TOKEN=${keys.line_channel_access_token}\n`;
      content += `# LINE Channel Access Token\n\n`;
    } else {
      content += `# LINE_CHANNEL_ACCESS_TOKEN=xxxxx\n`;
      content += `# LINE Channel Access Token\n\n`;
    }
    
    if (keys.line_channel_secret) {
      content += `LINE_CHANNEL_SECRET=${keys.line_channel_secret}\n`;
      content += `# LINE Channel Secret\n\n`;
    } else {
      content += `# LINE_CHANNEL_SECRET=xxxxx\n`;
      content += `# LINE Channel Secret\n\n`;
    }
    
    if (keys.redis_url) {
      content += `REDIS_URL=${keys.redis_url}\n`;
      content += `# Redis 服務 URL\n\n`;
    } else {
      content += `# REDIS_URL=https://xxx.upstash.io\n`;
      content += `# Redis 服務 URL\n\n`;
    }
    
    if (keys.redis_token) {
      content += `REDIS_TOKEN=${keys.redis_token}\n`;
      content += `# Redis 認證 Token\n\n`;
    } else {
      content += `# REDIS_TOKEN=xxxxx\n`;
      content += `# Redis 認證 Token\n\n`;
    }
    
    if (keys.cloudflare_api_token) {
      content += `CLOUDFLARE_API_TOKEN=${keys.cloudflare_api_token}\n`;
      content += `# Cloudflare API Token（CI/CD）\n\n`;
    } else {
      content += `# CLOUDFLARE_API_TOKEN=xxxxx\n`;
      content += `# Cloudflare API Token（CI/CD）\n\n`;
    }
    
    if (keys.cloudflare_account_id) {
      content += `CLOUDFLARE_ACCOUNT_ID=${keys.cloudflare_account_id}\n`;
      content += `# Cloudflare Account ID（CI/CD）\n\n`;
    } else {
      content += `# CLOUDFLARE_ACCOUNT_ID=xxxxx\n`;
      content += `# Cloudflare Account ID（CI/CD）\n\n`;
    }
  }
  
  return content;
}

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
  envContent.split('\n').forEach((line) => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  // 檢查必需變數
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  requiredVars.forEach(key => {
    if (!envVars[key] || envVars[key] === '請填入') {
      errors.push(`缺少必需變數: ${key}`);
    }
  });
  
  // 檢查格式
  if (envVars.NEXT_PUBLIC_SUPABASE_URL && !envVars.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://')) {
    warnings.push('NEXT_PUBLIC_SUPABASE_URL 格式可能有誤（應以 https:// 開頭）');
  }
  
  if (envVars.RESEND_API_KEY && !envVars.RESEND_API_KEY.startsWith('re_')) {
    warnings.push('RESEND_API_KEY 格式可能有誤（應以 re_ 開頭）');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    envVars
  };
}

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
  
  // 如果檔案已存在，詢問是否覆蓋
  if (fs.existsSync(envPath) && !options.force) {
    console.log('⚠️  .env.local 已存在');
    console.log('   使用 --force 參數可以強制覆蓋');
    console.log('   或手動編輯 .env.local 檔案');
    return { valid: false, skipped: true };
  }
  
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
    projectRef = keys.supabase_ref;
  }
  
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
    
    let setCount = 0;
    Object.entries(secrets).forEach(([key, value]) => {
      if (value && value !== '請填入') {
        try {
          execSync(`npx supabase secrets set ${key}=${value}`, { stdio: 'pipe' });
          console.log(`   ✓ ${key} 已設定`);
          setCount++;
        } catch (error) {
          console.log(`   ✗ ${key} 設定失敗`);
        }
      }
    });
    
    if (setCount > 0) {
      console.log(`✓ Supabase Secrets 設定完成（${setCount} 個）`);
    } else {
      console.log('⚠️  沒有可設定的 Secrets');
    }
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
      'NEXT_PUBLIC_SUPABASE_URL': keys.supabase_url || (keys.supabase_ref ? `https://${keys.supabase_ref}.supabase.co` : null),
      'NEXT_PUBLIC_SUPABASE_ANON_KEY': keys.supabase_anon_key,
      'SUPABASE_ACCESS_TOKEN': keys.supabase_access_token,
      'CLOUDFLARE_API_TOKEN': keys.cloudflare_api_token,
      'CLOUDFLARE_ACCOUNT_ID': keys.cloudflare_account_id
    };
    
    let setCount = 0;
    Object.entries(secrets).forEach(([key, value]) => {
      if (value && value !== '請填入') {
        try {
          execSync(`gh secret set ${key} --body "${value}"`, { stdio: 'pipe' });
          console.log(`   ✓ ${key} 已設定`);
          setCount++;
        } catch (error) {
          console.log(`   ✗ ${key} 設定失敗`);
        }
      }
    });
    
    if (setCount > 0) {
      console.log(`✓ GitHub Secrets 設定完成（${setCount} 個）`);
    } else {
      console.log('⚠️  沒有可設定的 Secrets');
    }
  } catch (error) {
    console.error('❌ GitHub Secrets 設定失敗:', error.message);
    console.log('   請確認已安裝 GitHub CLI: brew install gh');
  }
}

/**
 * 主函數：自動設定環境變數
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    local: args.includes('--local') || !args.includes('--no-local'),
    supabase: args.includes('--supabase'),
    github: args.includes('--github'),
    force: args.includes('--force'),
    validate: args.includes('--validate') !== false
  };
  
  console.log('🚀 開始自動設定環境變數...\n');
  
  // 1. 讀取 Keys
  const keys = loadKeys();
  if (Object.keys(keys).length === 0 && options.local) {
    console.log('⚠️  未找到任何 Keys');
    console.log('   建議先執行: npm run fetch-keys');
    console.log('   或手動建立 .env.local 檔案');
  }
  
  // 2. 設定本地環境變數
  if (options.local) {
    console.log('📝 正在生成本地環境變數檔案...');
    const validation = setupLocalEnv(keys, { force: options.force });
    
    if (validation.valid) {
      console.log('✅ 本地環境變數設定完成！');
    } else if (!validation.skipped) {
      console.log('❌ 本地環境變數設定有誤，請檢查上述錯誤');
    }
  }
  
  // 3. 設定 Supabase Secrets
  if (options.supabase) {
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
  console.log('   2. 填入缺失的環境變數（如有）');
  console.log('   3. 重啟開發伺服器: npm run dev');
}

// 執行主函數
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 執行過程發生錯誤:', error);
    process.exit(1);
  });
}

module.exports = {
  generateEnvContent,
  validateEnvFile,
  setupLocalEnv,
  setupSupabaseSecrets,
  setupGitHubSecrets,
  loadKeys
};
