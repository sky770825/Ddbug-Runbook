#!/usr/bin/env node

/**
 * 專案套餐自動化腳本
 * 一站式自動化所有 CLI 工具的安裝、配置和串接
 * 適用於新專案和現有專案
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

// CLI 工具配置
const CLI_TOOLS = {
  supabase: {
    name: 'Supabase CLI',
    checkCommand: 'npx supabase --version',
    installCommand: 'npm install -g supabase || npm install -D supabase',
    loginCommand: 'npx supabase login',
    required: true,
    description: '用於 Supabase 資料庫和 Edge Functions 管理'
  },
  github: {
    name: 'GitHub CLI',
    checkCommand: 'gh --version',
    installCommand: {
      darwin: 'brew install gh',
      linux: 'curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && sudo apt update && sudo apt install gh',
      win32: 'winget install --id GitHub.cli'
    },
    loginCommand: 'gh auth login',
    required: false,
    description: '用於 GitHub 操作和 CI/CD'
  },
  cloudflare: {
    name: 'Cloudflare CLI (Wrangler)',
    checkCommand: 'npx wrangler --version',
    installCommand: 'npm install -D wrangler || npm install -g wrangler',
    loginCommand: 'npx wrangler login',
    required: false,
    description: '用於 Cloudflare Pages 和 Workers 部署'
  },
  node: {
    name: 'Node.js',
    checkCommand: 'node --version',
    installCommand: null, // 需要手動安裝
    required: true,
    description: 'Node.js 執行環境'
  },
  npm: {
    name: 'npm',
    checkCommand: 'npm --version',
    installCommand: null, // 通常與 Node.js 一起安裝
    required: true,
    description: 'Node.js 套件管理器'
  },
  git: {
    name: 'Git',
    checkCommand: 'git --version',
    installCommand: null, // 需要手動安裝
    required: true,
    description: '版本控制系統'
  }
};

/**
 * 檢查 CLI 工具是否已安裝
 */
function checkCLITool(toolKey) {
  const tool = CLI_TOOLS[toolKey];
  if (!tool) return { installed: false, error: 'Unknown tool' };
  
  try {
    execSync(tool.checkCommand, { stdio: 'pipe' });
    return { installed: true, tool };
  } catch (error) {
    return { installed: false, tool };
  }
}

/**
 * 安裝 CLI 工具
 */
async function installCLITool(toolKey) {
  const tool = CLI_TOOLS[toolKey];
  if (!tool || !tool.installCommand) {
    console.log(`⚠️  ${tool.name} 需要手動安裝`);
    if (toolKey === 'node') {
      console.log('   請前往: https://nodejs.org/');
    } else if (toolKey === 'git') {
      console.log('   請前往: https://git-scm.com/');
    }
    return false;
  }
  
  try {
    let installCmd = tool.installCommand;
    
    // 處理平台特定的安裝命令
    if (typeof installCmd === 'object') {
      const platform = process.platform;
      installCmd = installCmd[platform] || installCmd.darwin;
    }
    
    if (!installCmd) {
      console.log(`⚠️  ${tool.name} 無法自動安裝，請手動安裝`);
      return false;
    }
    
    console.log(`📦 正在安裝 ${tool.name}...`);
    execSync(installCmd, { stdio: 'inherit' });
    console.log(`✓ ${tool.name} 安裝完成`);
    return true;
  } catch (error) {
    console.error(`❌ ${tool.name} 安裝失敗:`, error.message);
    return false;
  }
}

/**
 * 檢查所有 CLI 工具
 */
function checkAllCLITools() {
  console.log('🔍 檢查 CLI 工具狀態...\n');
  
  const results = {};
  let allInstalled = true;
  
  Object.keys(CLI_TOOLS).forEach(toolKey => {
    const result = checkCLITool(toolKey);
    results[toolKey] = result;
    
    if (result.installed) {
      console.log(`✓ ${result.tool.name} 已安裝`);
    } else {
      const isRequired = result.tool?.required || false;
      const status = isRequired ? '✗' : '⚠️';
      console.log(`${status} ${result.tool?.name || toolKey} 未安裝${isRequired ? ' (必需)' : ' (可選)'}`);
      if (isRequired) {
        allInstalled = false;
      }
    }
  });
  
  console.log('');
  return { results, allInstalled };
}

/**
 * 安裝缺失的 CLI 工具
 */
async function installMissingCLITools(results) {
  const missingTools = Object.entries(results)
    .filter(([key, result]) => !result.installed && result.tool?.installCommand);
  
  if (missingTools.length === 0) {
    return true;
  }
  
  console.log(`📦 發現 ${missingTools.length} 個未安裝的工具，開始安裝...\n`);
  
  for (const [toolKey, result] of missingTools) {
    const tool = result.tool;
    const isRequired = tool.required || false;
    
    if (!isRequired) {
      const answer = await question(`是否要安裝 ${tool.name}？(y/n，按 Enter 跳過): `);
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log(`⏭️  跳過 ${tool.name}\n`);
        continue;
      }
    }
    
    await installCLITool(toolKey);
    console.log('');
  }
  
  return true;
}

/**
 * 登入 CLI 工具
 */
async function loginCLITools() {
  console.log('🔐 檢查 CLI 工具登入狀態...\n');
  
  const loginChecks = [
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
  
  for (const tool of loginChecks) {
    try {
      execSync(tool.checkCommand, { stdio: 'pipe' });
      console.log(`✓ ${tool.name} 已登入`);
    } catch (error) {
      if (tool.required) {
        console.log(`⚠️  ${tool.name} 未登入，需要登入`);
        const answer = await question(`是否要現在登入 ${tool.name}？(y/n): `);
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          try {
            execSync(tool.loginCommand, { stdio: 'inherit' });
            console.log(`✓ ${tool.name} 登入完成\n`);
          } catch (loginError) {
            console.log(`✗ ${tool.name} 登入失敗，請稍後手動登入\n`);
          }
        }
      } else {
        console.log(`ℹ️  ${tool.name} 未登入（可選）\n`);
      }
    }
  }
}

/**
 * 執行專案初始化
 */
function runProjectInit() {
  console.log('🚀 執行專案初始化...\n');
  
  const initScript = path.join(__dirname, 'init.cjs');
  if (fs.existsSync(initScript)) {
    try {
      require(initScript);
    } catch (error) {
      console.log('⚠️  無法執行 init.cjs，請手動執行: npm run init');
    }
  } else {
    console.log('⚠️  init.cjs 不存在，跳過初始化');
  }
}

/**
 * 執行環境變數設定
 */
async function runEnvSetup() {
  console.log('📝 執行環境變數設定...\n');
  
  const keysScript = path.join(__dirname, 'fetch-keys.cjs');
  const setupScript = path.join(__dirname, 'setup-env.cjs');
  
  // 檢查是否需要取得 Keys
  const keysFile = path.join(process.cwd(), '.automation-keys.json');
  if (!fs.existsSync(keysFile)) {
    const answer = await question('是否要現在取得 API Keys？(y/n): ');
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      if (fs.existsSync(keysScript)) {
        try {
          require(keysScript);
        } catch (error) {
          console.log('⚠️  無法執行 fetch-keys.cjs');
        }
      }
    }
  }
  
  // 設定環境變數
  if (fs.existsSync(setupScript)) {
    try {
      require(setupScript);
    } catch (error) {
      console.log('⚠️  無法執行 setup-env.cjs，請手動執行: npm run setup-env');
    }
  }
}

/**
 * 執行健康檢查
 */
function runHealthCheck() {
  console.log('🏥 執行健康檢查...\n');
  
  const healthScript = path.join(__dirname, 'health-check.cjs');
  if (fs.existsSync(healthScript)) {
    try {
      require(healthScript);
    } catch (error) {
      console.log('⚠️  無法執行 health-check.cjs，請手動執行: npm run health');
    }
  }
}

/**
 * 產生專案套餐報告
 */
function generateBundleReport(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 專案套餐執行報告');
  console.log('='.repeat(60) + '\n');
  
  console.log('CLI 工具狀態:');
  Object.entries(results).forEach(([key, result]) => {
    const status = result.installed ? '✓ 已安裝' : '✗ 未安裝';
    const required = result.tool?.required ? ' (必需)' : ' (可選)';
    console.log(`  ${status}: ${result.tool?.name || key}${required}`);
  });
  
  console.log('\n📋 下一步建議:');
  console.log('  1. 確保所有必需的 CLI 工具已安裝並登入');
  console.log('  2. 執行 npm run init 進行專案初始化');
  console.log('  3. 執行 npm run fetch-keys 取得 API Keys');
  console.log('  4. 執行 npm run setup-env 設定環境變數');
  console.log('  5. 執行 npm run health 檢查專案狀態');
  console.log('');
}

/**
 * 主函數：執行完整的專案套餐
 */
async function main() {
  const args = process.argv.slice(2);
  const skipInstall = args.includes('--skip-install');
  const skipLogin = args.includes('--skip-login');
  const autoInstall = args.includes('--auto-install');
  
  console.log('🎯 專案套餐自動化系統');
  console.log('='.repeat(60));
  console.log('一站式自動化所有 CLI 工具的安裝、配置和串接\n');
  
  // 1. 檢查所有 CLI 工具
  const { results, allInstalled } = checkAllCLITools();
  
  // 2. 安裝缺失的工具（如果需要）
  if (!skipInstall && !allInstalled) {
    if (autoInstall) {
      // 自動安裝所有必需的工具
      for (const [toolKey, result] of Object.entries(results)) {
        if (!result.installed && result.tool?.required) {
          await installCLITool(toolKey);
        }
      }
    } else {
      await installMissingCLITools(results);
    }
    
    // 重新檢查
    const recheck = checkAllCLITools();
    Object.assign(results, recheck.results);
  }
  
  // 3. 登入 CLI 工具（如果需要）
  if (!skipLogin) {
    await loginCLITools();
  }
  
  // 4. 執行專案初始化（如果在新專案中）
  const packageJsonExists = fs.existsSync(path.join(process.cwd(), 'package.json'));
  if (packageJsonExists) {
    const answer = await question('\n是否要執行專案初始化？(y/n): ');
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      runProjectInit();
    }
  }
  
  // 5. 執行環境變數設定（如果需要的話）
  const envLocalExists = fs.existsSync(path.join(process.cwd(), '.env.local'));
  if (!envLocalExists) {
    const answer = await question('\n是否要設定環境變數？(y/n): ');
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      await runEnvSetup();
    }
  }
  
  // 6. 執行健康檢查
  const answer = await question('\n是否要執行健康檢查？(y/n): ');
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    runHealthCheck();
  }
  
  // 7. 產生報告
  generateBundleReport(results);
  
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

module.exports = {
  checkAllCLITools,
  installCLITool,
  installMissingCLITools,
  loginCLITools,
  runProjectInit,
  runEnvSetup,
  runHealthCheck
};
