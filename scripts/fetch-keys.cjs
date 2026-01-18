#!/usr/bin/env node

/**
 * 自動取得 API Keys 腳本
 * 使用各種 CLI 工具自動取得或提示取得 API Keys
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * 使用 Supabase CLI 取得 Supabase Keys
 */
async function fetchSupabaseKeys(projectRef) {
  console.log('🔍 正在取得 Supabase Keys...');
  
  try {
    // 1. 檢查 Supabase CLI 是否已安裝
    try {
      execSync('npx supabase --version', { stdio: 'pipe' });
    } catch (error) {
      console.log('⚠️  Supabase CLI 未安裝，請安裝: npm install -g supabase');
      return null;
    }
    
    // 2. 檢查是否已登入
    try {
      execSync('npx supabase projects list', { stdio: 'pipe' });
      console.log('✓ Supabase CLI 已登入');
    } catch (error) {
      console.log('⚠️  請先登入 Supabase: npx supabase login');
      return null;
    }
    
    // 3. 連接專案（如果提供了 projectRef）
    if (projectRef) {
      try {
        execSync(`npx supabase link --project-ref ${projectRef}`, { stdio: 'pipe' });
        console.log(`✓ 已連接 Supabase 專案: ${projectRef}`);
      } catch (error) {
        console.log('⚠️  專案連接失敗，請確認 Project Reference');
      }
    }
    
    // 4. 提示使用者從 Dashboard 取得 Keys
    console.log('\n📋 請按照以下步驟取得 Supabase Keys:');
    console.log('   1. 前往 Supabase Dashboard: https://app.supabase.com/');
    console.log('   2. 選擇專案');
    console.log('   3. 前往 Settings > API');
    console.log('   4. 複製以下 Keys:');
    console.log('      - Project URL');
    console.log('      - anon/public key');
    console.log('      - service_role key (secret)');
    
    // 5. 互動式輸入
    const url = await question('\n請貼上 Supabase URL (或按 Enter 跳過): ');
    const anonKey = await question('請貼上 Supabase Anon Key (或按 Enter 跳過): ');
    const serviceRoleKey = await question('請貼上 Supabase Service Role Key (或按 Enter 跳過): ');
    
    return {
      supabase_ref: projectRef || '',
      supabase_url: url.trim() || null,
      supabase_anon_key: anonKey.trim() || null,
      supabase_service_role_key: serviceRoleKey.trim() || null
    };
    
  } catch (error) {
    console.error('❌ 取得 Supabase Keys 失敗:', error.message);
    return null;
  }
}

/**
 * 使用 GitHub CLI 取得 GitHub Token
 */
async function fetchGitHubToken() {
  console.log('\n🔍 正在取得 GitHub Token...');
  
  try {
    // 1. 檢查 GitHub CLI 是否已安裝
    try {
      execSync('gh --version', { stdio: 'pipe' });
    } catch (error) {
      console.log('⚠️  GitHub CLI 未安裝（可選）');
      return null;
    }
    
    // 2. 檢查是否已登入
    try {
      const authStatus = execSync('gh auth status', { encoding: 'utf-8' });
      if (authStatus.includes('Logged in')) {
        console.log('✓ GitHub CLI 已登入');
        
        // 3. 提示建立 Personal Access Token
        console.log('\n📋 請按照以下步驟建立 Personal Access Token:');
        console.log('   1. 前往: https://github.com/settings/tokens');
        console.log('   2. 點擊 "Generate new token (classic)"');
        console.log('   3. 選擇需要的權限（repo, workflow 等）');
        console.log('   4. 複製生成的 Token');
        
        const token = await question('\n請貼上 GitHub Personal Access Token (或按 Enter 跳過): ');
        
        return {
          github_token: token.trim() || null,
          scopes: ['repo', 'workflow']
        };
      }
    } catch (error) {
      console.log('⚠️  請先登入 GitHub: gh auth login');
      return null;
    }
    
  } catch (error) {
    console.log('⚠️  GitHub CLI 未安裝（可選）');
    return null;
  }
}

/**
 * 互動式取得其他平台的 Keys
 */
async function fetchOtherKeys() {
  const keys = {};
  
  // Resend API Key
  console.log('\n📧 Resend API Key:');
  console.log('   1. 前往: https://resend.com/api-keys');
  console.log('   2. 登入並建立新的 API Key');
  console.log('   3. 複製 Key（格式: re_xxxxx）');
  
  const resendKey = await question('請貼上 Resend API Key (或按 Enter 跳過): ');
  if (resendKey.trim()) keys.resend_api_key = resendKey.trim();
  
  // LINE Channel Access Token
  console.log('\n📱 LINE Channel Access Token:');
  console.log('   1. 前往: https://developers.line.biz/console/');
  console.log('   2. 選擇 Channel');
  console.log('   3. 前往 Messaging API 設定');
  console.log('   4. 複製 Channel Access Token');
  
  const lineToken = await question('請貼上 LINE Channel Access Token (或按 Enter 跳過): ');
  if (lineToken.trim()) keys.line_channel_access_token = lineToken.trim();
  
  // LINE Channel Secret
  const lineSecret = await question('請貼上 LINE Channel Secret (或按 Enter 跳過): ');
  if (lineSecret.trim()) keys.line_channel_secret = lineSecret.trim();
  
  // Cloudflare API Token
  console.log('\n☁️  Cloudflare API Token:');
  console.log('   1. 前往: https://dash.cloudflare.com/profile/api-tokens');
  console.log('   2. 點擊 "Create Token"');
  console.log('   3. 使用 "Edit Cloudflare Workers" 模板');
  console.log('   4. 複製 Token');
  
  const cloudflareToken = await question('請貼上 Cloudflare API Token (或按 Enter 跳過): ');
  if (cloudflareToken.trim()) keys.cloudflare_api_token = cloudflareToken.trim();
  
  // Cloudflare Account ID
  console.log('\n☁️  Cloudflare Account ID:');
  console.log('   1. 前往: https://dash.cloudflare.com');
  console.log('   2. 在右側邊欄找到 Account ID');
  console.log('   3. 複製 Account ID');
  
  const cloudflareAccountId = await question('請貼上 Cloudflare Account ID (或按 Enter 跳過): ');
  if (cloudflareAccountId.trim()) keys.cloudflare_account_id = cloudflareAccountId.trim();
  
  return keys;
}

/**
 * 儲存 Keys 到專案設定檔案
 */
function saveKeysToConfig(keys) {
  const configPath = path.join(process.cwd(), '.automation-keys.json');
  
  // 讀取現有設定（如果存在）
  let existingConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (error) {
      console.log('⚠️  讀取現有設定失敗，將建立新檔案');
    }
  }
  
  // 過濾掉 null 值
  const filteredKeys = Object.fromEntries(
    Object.entries(keys).filter(([_, value]) => value !== null && value !== '')
  );
  
  // 合併新的 Keys
  const updatedConfig = {
    ...existingConfig,
    ...filteredKeys,
    updatedAt: new Date().toISOString()
  };
  
  // 儲存到檔案
  fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
  console.log(`\n✓ Keys 已儲存到: ${configPath}`);
  
  return updatedConfig;
}

/**
 * 主函數：自動取得所有 Keys
 */
async function main() {
  const args = process.argv.slice(2);
  const projectRef = args[0] || process.env.SUPABASE_REF;
  
  console.log('🚀 開始自動取得 API Keys...\n');
  
  const allKeys = {};
  
  // 1. 取得 Supabase Keys
  const supabaseKeys = await fetchSupabaseKeys(projectRef);
  if (supabaseKeys) {
    Object.assign(allKeys, supabaseKeys);
  }
  
  // 2. 取得 GitHub Token
  const githubToken = await fetchGitHubToken();
  if (githubToken) {
    Object.assign(allKeys, githubToken);
  }
  
  // 3. 互動式取得其他 Keys
  const otherKeys = await fetchOtherKeys();
  Object.assign(allKeys, otherKeys);
  
  // 4. 儲存 Keys
  if (Object.keys(allKeys).length > 0) {
    const savedConfig = saveKeysToConfig(allKeys);
    console.log('\n✅ 所有 Keys 取得完成！');
    console.log(`📝 已儲存 ${Object.keys(savedConfig).length - 1} 個 Keys（不含 updatedAt）`);
    console.log('\n📋 下一步：');
    console.log('   1. 檢查 .automation-keys.json 檔案');
    console.log('   2. 執行 npm run setup-env 設定環境變數');
  } else {
    console.log('\n⚠️  未取得任何 Keys');
    console.log('   請手動執行或檢查 CLI 工具是否已安裝和登入');
  }
  
  rl.close();
}

// 執行主函數
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 執行過程發生錯誤:', error);
    rl.close();
    process.exit(1);
  });
}

module.exports = { fetchSupabaseKeys, fetchGitHubToken, fetchOtherKeys, saveKeysToConfig };
