#!/usr/bin/env node

/**
 * 完全自動化設定腳本
 * 整合所有自動化功能：系統串聯、API 串接、API 寫入自動化、自動化檢測
 * 
 * 使用方式：
 *   npm run auto-setup
 *   npm run auto-setup -- --skip-login
 *   npm run auto-setup -- --skip-keys
 *   npm run auto-setup -- --supabase-ref=xxxxx
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

// 解析命令列參數
const args = process.argv.slice(2);
const options = {
  skipLogin: args.includes('--skip-login'),
  skipKeys: args.includes('--skip-keys'),
  skipHealth: args.includes('--skip-health'),
  supabaseRef: args.find(arg => arg.startsWith('--supabase-ref='))?.split('=')[1] || null,
  autoInstall: args.includes('--auto-install') || true,
  silent: args.includes('--silent')
};

// 執行結果記錄
const results = {
  cliTools: {},
  apiKeys: {},
  environment: {},
  health: {},
  errors: []
};

/**
 * 輸出訊息（支援 silent 模式）
 */
function log(message, type = 'info') {
  if (options.silent && type !== 'error') return;
  
  const prefix = {
    info: 'ℹ️ ',
    success: '✓',
    error: '❌',
    warning: '⚠️ ',
    step: '📋'
  }[type] || '';
  
  console.log(`${prefix} ${message}`);
}

/**
 * 執行命令（安全模式）
 */
function execCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 步驟 1: 系統串聯 - 檢查和安裝 CLI 工具
 */
async function step1_SystemIntegration() {
  log('', 'step');
  log('='.repeat(60), 'step');
  log('步驟 1: 系統串聯 - CLI 工具檢查和安裝', 'step');
  log('='.repeat(60), 'step');
  log('');

  const CLI_TOOLS = {
    supabase: {
      name: 'Supabase CLI',
      checkCommand: 'npx supabase --version',
      installCommand: 'npm install -g supabase || npm install -D supabase',
      required: true
    },
    node: {
      name: 'Node.js',
      checkCommand: 'node --version',
      installCommand: null,
      required: true
    },
    npm: {
      name: 'npm',
      checkCommand: 'npm --version',
      installCommand: null,
      required: true
    },
    git: {
      name: 'Git',
      checkCommand: 'git --version',
      installCommand: null,
      required: true
    },
    github: {
      name: 'GitHub CLI',
      checkCommand: 'gh --version',
      installCommand: process.platform === 'darwin' ? 'brew install gh' : 'npm install -g gh',
      required: false
    },
    cloudflare: {
      name: 'Cloudflare CLI (Wrangler)',
      checkCommand: 'npx wrangler --version',
      installCommand: 'npm install -D wrangler || npm install -g wrangler',
      required: false
    }
  };

  for (const [key, tool] of Object.entries(CLI_TOOLS)) {
    log(`檢查 ${tool.name}...`);
    
    const checkResult = execCommand(tool.checkCommand, { silent: true });
    
    if (checkResult.success) {
      log(`${tool.name} 已安裝`, 'success');
      results.cliTools[key] = { installed: true, status: 'ok' };
    } else {
      log(`${tool.name} 未安裝`, 'warning');
      results.cliTools[key] = { installed: false, status: 'missing' };
      
      // 自動安裝（如果允許且可安裝）
      if (options.autoInstall && tool.installCommand) {
        log(`正在安裝 ${tool.name}...`);
        const installResult = execCommand(tool.installCommand);
        
        if (installResult.success) {
          log(`${tool.name} 安裝完成`, 'success');
          results.cliTools[key].installed = true;
          results.cliTools[key].status = 'installed';
        } else {
          log(`${tool.name} 安裝失敗`, 'error');
          results.cliTools[key].status = 'failed';
          results.errors.push(`${tool.name} 安裝失敗`);
        }
      } else if (tool.required) {
        log(`${tool.name} 是必需的，請手動安裝`, 'error');
        results.errors.push(`${tool.name} 未安裝且無法自動安裝`);
      }
    }
  }
  
  log('');
  return results.cliTools;
}

/**
 * 步驟 2: 系統串聯 - 自動登入 CLI 工具
 */
async function step2_AutoLogin() {
  if (options.skipLogin) {
    log('跳過登入步驟（使用 --skip-login）', 'warning');
    return;
  }

  log('', 'step');
  log('='.repeat(60), 'step');
  log('步驟 2: 系統串聯 - 自動登入 CLI 工具', 'step');
  log('='.repeat(60), 'step');
  log('');

  const loginTools = [
    {
      name: 'Supabase',
      checkCommand: 'npx supabase projects list',
      loginCommand: 'npx supabase login',
      required: true
    },
    {
      name: 'GitHub',
      checkCommand: 'gh auth status',
      loginCommand: 'gh auth login',
      required: false
    },
    {
      name: 'Cloudflare',
      checkCommand: 'npx wrangler whoami',
      loginCommand: 'npx wrangler login',
      required: false
    }
  ];

  for (const tool of loginTools) {
    log(`檢查 ${tool.name} 登入狀態...`);
    
    const checkResult = execCommand(tool.checkCommand, { silent: true });
    
    if (checkResult.success) {
      log(`${tool.name} 已登入`, 'success');
    } else {
      log(`${tool.name} 未登入`, 'warning');
      
      if (tool.required) {
        log(`需要登入 ${tool.name}，請在瀏覽器中完成認證...`);
        const loginResult = execCommand(tool.loginCommand);
        
        if (loginResult.success) {
          log(`${tool.name} 登入完成`, 'success');
        } else {
          log(`${tool.name} 登入失敗，請稍後手動登入`, 'error');
          results.errors.push(`${tool.name} 登入失敗`);
        }
      } else {
        log(`${tool.name} 未登入（可選）`, 'info');
      }
    }
  }
  
  log('');
}

/**
 * 步驟 3: API 串接 - 自動取得 API Keys
 */
async function step3_FetchAPIKeys() {
  if (options.skipKeys) {
    log('跳過 API Keys 取得步驟（使用 --skip-keys）', 'warning');
    return;
  }

  log('', 'step');
  log('='.repeat(60), 'step');
  log('步驟 3: API 串接 - 自動取得 API Keys', 'step');
  log('='.repeat(60), 'step');
  log('');

  const keysPath = path.join(process.cwd(), '.automation-keys.json');
  
  // 如果已存在 Keys 檔案，詢問是否重新取得
  if (fs.existsSync(keysPath)) {
    const answer = await question('已存在 .automation-keys.json，是否重新取得？(y/n，預設 n): ');
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      log('使用現有的 API Keys', 'info');
      return;
    }
  }

  // 載入 fetch-keys.cjs 模組
  const fetchKeysScript = path.join(__dirname, 'fetch-keys.cjs');
  
  if (fs.existsSync(fetchKeysScript)) {
    log('執行 fetch-keys 腳本...');
    try {
      // 使用 require 載入並執行
      const fetchKeys = require(fetchKeysScript);
      
      // 如果有 main 函數，執行它
      if (typeof fetchKeys === 'function') {
        await fetchKeys(options.supabaseRef);
      } else if (fetchKeys.main) {
        await fetchKeys.main(options.supabaseRef);
      } else {
        // 直接執行腳本
        execCommand(`node ${fetchKeysScript} ${options.supabaseRef || ''}`);
      }
      
      log('API Keys 取得完成', 'success');
    } catch (error) {
      log(`執行 fetch-keys 失敗: ${error.message}`, 'error');
      results.errors.push(`API Keys 取得失敗: ${error.message}`);
    }
  } else {
    log('fetch-keys.cjs 不存在，跳過', 'warning');
  }
  
  log('');
}

/**
 * 步驟 4: API 串接 - 自動設定環境變數
 */
async function step4_SetupEnvironment() {
  log('', 'step');
  log('='.repeat(60), 'step');
  log('步驟 4: API 串接 - 自動設定環境變數', 'step');
  log('='.repeat(60), 'step');
  log('');

  const setupEnvScript = path.join(__dirname, 'setup-env.cjs');
  
  if (fs.existsSync(setupEnvScript)) {
    log('執行 setup-env 腳本...');
    try {
      const setupEnv = require(setupEnvScript);
      
      if (typeof setupEnv === 'function') {
        await setupEnv();
      } else if (setupEnv.main) {
        await setupEnv.main();
      } else {
        execCommand(`node ${setupEnvScript}`);
      }
      
      log('環境變數設定完成', 'success');
      
      // 驗證環境變數
      const validateScript = path.join(__dirname, 'validate-env.cjs');
      if (fs.existsSync(validateScript)) {
        log('驗證環境變數...');
        execCommand(`node ${validateScript}`, { silent: true });
      }
    } catch (error) {
      log(`執行 setup-env 失敗: ${error.message}`, 'error');
      results.errors.push(`環境變數設定失敗: ${error.message}`);
    }
  } else {
    log('setup-env.cjs 不存在，跳過', 'warning');
  }
  
  log('');
}

/**
 * 步驟 5: API 寫入自動化 - 連接 Supabase 專案
 */
async function step5_ConnectSupabase() {
  if (!options.supabaseRef) {
    log('未提供 Supabase Project Reference，跳過連接步驟', 'info');
    return;
  }

  log('', 'step');
  log('='.repeat(60), 'step');
  log('步驟 5: API 寫入自動化 - 連接 Supabase 專案', 'step');
  log('='.repeat(60), 'step');
  log('');

  log(`連接 Supabase 專案: ${options.supabaseRef}`);
  const linkResult = execCommand(`npx supabase link --project-ref ${options.supabaseRef}`, { silent: true });
  
  if (linkResult.success) {
    log('Supabase 專案連接成功', 'success');
  } else {
    log('Supabase 專案連接失敗，請確認 Project Reference 是否正確', 'error');
    results.errors.push('Supabase 專案連接失敗');
  }
  
  log('');
}

/**
 * 步驟 6: 自動化檢測 - 執行健康檢查
 */
async function step6_HealthCheck() {
  if (options.skipHealth) {
    log('跳過健康檢查步驟（使用 --skip-health）', 'warning');
    return;
  }

  log('', 'step');
  log('='.repeat(60), 'step');
  log('步驟 6: 自動化檢測 - 執行健康檢查', 'step');
  log('='.repeat(60), 'step');
  log('');

  const healthScript = path.join(__dirname, 'health-check.cjs');
  
  if (fs.existsSync(healthScript)) {
    log('執行健康檢查...');
    try {
      const healthCheck = require(healthScript);
      
      if (healthCheck.main) {
        await healthCheck.main();
      } else {
        execCommand(`node ${healthScript}`);
      }
      
      log('健康檢查完成', 'success');
    } catch (error) {
      log(`健康檢查失敗: ${error.message}`, 'error');
      results.errors.push(`健康檢查失敗: ${error.message}`);
    }
  } else {
    log('health-check.cjs 不存在，跳過', 'warning');
  }
  
  log('');
}

/**
 * 產生完整報告
 */
function generateReport() {
  log('', 'step');
  log('='.repeat(60), 'step');
  log('自動化設定完成報告', 'step');
  log('='.repeat(60), 'step');
  log('');

  // CLI 工具狀態
  log('CLI 工具狀態:', 'info');
  Object.entries(results.cliTools).forEach(([key, value]) => {
    const status = value.installed ? '✓ 已安裝' : '✗ 未安裝';
    log(`  ${status}: ${key}`);
  });
  log('');

  // 錯誤報告
  if (results.errors.length > 0) {
    log('錯誤報告:', 'error');
    results.errors.forEach((error, index) => {
      log(`  ${index + 1}. ${error}`, 'error');
    });
    log('');
  }

  // 下一步建議
  log('下一步建議:', 'info');
  log('  1. 檢查上述錯誤並修正');
  log('  2. 執行 npm run health 進行完整健康檢查');
  log('  3. 執行 npm run validate-env 驗證環境變數');
  log('  4. 開始開發: npm run dev');
  log('');

  // 使用說明
  log('使用說明:', 'info');
  log('  npm run auto-setup              # 完整自動化設定');
  log('  npm run auto-setup -- --skip-login    # 跳過登入步驟');
  log('  npm run auto-setup -- --skip-keys     # 跳過 API Keys 取得');
  log('  npm run auto-setup -- --supabase-ref=xxxxx  # 指定 Supabase Project Reference');
  log('');
}

/**
 * 主函數
 */
async function main() {
  console.log('');
  log('🚀 完全自動化設定腳本', 'step');
  log('整合：系統串聯、API 串接、API 寫入自動化、自動化檢測', 'step');
  log('');

  try {
    // 步驟 1: 系統串聯 - CLI 工具
    await step1_SystemIntegration();
    
    // 步驟 2: 系統串聯 - 自動登入
    await step2_AutoLogin();
    
    // 步驟 3: API 串接 - 取得 Keys
    await step3_FetchAPIKeys();
    
    // 步驟 4: API 串接 - 設定環境變數
    await step4_SetupEnvironment();
    
    // 步驟 5: API 寫入自動化 - 連接 Supabase
    await step5_ConnectSupabase();
    
    // 步驟 6: 自動化檢測 - 健康檢查
    await step6_HealthCheck();
    
    // 產生報告
    generateReport();
    
    // 根據結果決定退出碼
    if (results.errors.length > 0) {
      process.exit(1);
    } else {
      log('✅ 所有步驟完成！', 'success');
      process.exit(0);
    }
  } catch (error) {
    log(`執行過程發生錯誤: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// 執行主函數
if (require.main === module) {
  main();
}

module.exports = {
  main,
  step1_SystemIntegration,
  step2_AutoLogin,
  step3_FetchAPIKeys,
  step4_SetupEnvironment,
  step5_ConnectSupabase,
  step6_HealthCheck
};
