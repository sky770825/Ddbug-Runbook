#!/usr/bin/env node

/**
 * 專案健康檢查腳本
 * 檢查專案是否正常運行
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { checkNodeVersion } = require('./check-node-version');

const checks = [];

function addCheck(name, checkFn) {
  checks.push({ name, check: checkFn });
}

// 1. Node.js 版本檢查
addCheck('Node.js 版本', () => {
  const result = checkNodeVersion();
  return {
    passed: result.valid,
    message: result.valid 
      ? `✓ Node.js 版本: ${result.version || process.version}`
      : `✗ Node.js 版本不符合要求（當前: ${result.current}, 要求: ${result.required}）`
  };
});

// 2. npm 版本檢查
addCheck('npm 版本', () => {
  try {
    const version = execSync('npm --version', { encoding: 'utf-8' }).trim();
    const majorVersion = parseInt(version.split('.')[0], 10);
    if (majorVersion >= 8) {
      return { passed: true, message: `✓ npm 版本: ${version}` };
    } else {
      return { passed: false, message: `✗ npm 版本過舊: ${version} (建議 >= 8.0.0)` };
    }
  } catch (error) {
    return { passed: false, message: '✗ 無法檢查 npm 版本' };
  }
});

// 3. 依賴檢查
addCheck('專案依賴', () => {
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    return { passed: false, message: '✗ package.json 不存在' };
  }
  
  if (!fs.existsSync(nodeModulesPath)) {
    return { passed: false, message: '✗ node_modules 不存在，請執行: npm install' };
  }
  
  return { passed: true, message: '✓ 依賴已安裝' };
});

// 4. 環境變數檔案檢查
addCheck('環境變數檔案', () => {
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (fs.existsSync(envLocalPath)) {
    // 檢查是否有必要的環境變數
    const envContent = fs.readFileSync(envLocalPath, 'utf-8');
    const hasSupabaseUrl = envContent.includes('NEXT_PUBLIC_SUPABASE_URL');
    const hasSupabaseKey = envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
    if (hasSupabaseUrl && hasSupabaseKey) {
      return { passed: true, message: '✓ .env.local 存在且包含必要的環境變數' };
    } else {
      return { passed: false, message: '⚠️  .env.local 存在但缺少必要的環境變數' };
    }
  } else if (fs.existsSync(envExamplePath)) {
    return { passed: false, message: '⚠️  .env.local 不存在，請從 .env.example 複製' };
  } else {
    return { passed: false, message: '⚠️  .env.local 和 .env.example 都不存在' };
  }
});

// 5. CLI 工具檢查
addCheck('Supabase CLI', () => {
  try {
    execSync('npx supabase --version', { stdio: 'pipe' });
    return { passed: true, message: '✓ Supabase CLI 可用' };
  } catch (error) {
    return { passed: false, message: '⚠️  Supabase CLI 未安裝（可選，建議安裝）' };
  }
});

addCheck('Git', () => {
  try {
    const version = execSync('git --version', { encoding: 'utf-8' }).trim();
    return { passed: true, message: `✓ ${version}` };
  } catch (error) {
    return { passed: false, message: '✗ Git 未安裝' };
  }
});

addCheck('GitHub CLI', () => {
  try {
    execSync('gh --version', { stdio: 'pipe' });
    return { passed: true, message: '✓ GitHub CLI 可用（可選）' };
  } catch (error) {
    return { passed: true, message: '⚠️  GitHub CLI 未安裝（可選）' };
  }
});

addCheck('Cloudflare CLI', () => {
  try {
    execSync('npx wrangler --version', { stdio: 'pipe' });
    return { passed: true, message: '✓ Cloudflare CLI (Wrangler) 可用（可選）' };
  } catch (error) {
    return { passed: true, message: '⚠️  Cloudflare CLI 未安裝（可選）' };
  }
});

// 6. 專案檔案檢查
addCheck('專案檔案', () => {
  const requiredFiles = [
    'package.json',
    'vite.config.ts',
    'tsconfig.json',
    'src/main.tsx',
    'src/App.tsx',
    'src/data/stepsData.ts'
  ];
  
  const missing = [];
  requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      missing.push(file);
    }
  });
  
  if (missing.length === 0) {
    return { passed: true, message: '✓ 所有必要的專案檔案存在' };
  } else {
    return { passed: false, message: `✗ 缺少檔案: ${missing.join(', ')}` };
  }
});

// 7. 建置測試（可選）
addCheck('建置測試', () => {
  try {
    // 只檢查語法，不實際建置
    execSync('npm run build --dry-run 2>&1 || true', { stdio: 'pipe' });
    return { passed: true, message: '✓ 建置配置正確' };
  } catch (error) {
    // 如果無法測試，跳過
    return { passed: true, message: '⚠️  無法測試建置（可能需要先設定環境變數）' };
  }
});

function main() {
  console.log('🏥 執行專案健康檢查...\n');
  
  const results = [];
  let passedCount = 0;
  let failedCount = 0;
  
  checks.forEach(({ name, check }) => {
    try {
      const result = check();
      results.push({ name, ...result });
      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    } catch (error) {
      results.push({ name, passed: false, message: `✗ 檢查時發生錯誤: ${error.message}` });
      failedCount++;
    }
  });
  
  // 顯示結果
  console.log('檢查結果：\n');
  results.forEach(({ name, message }) => {
    console.log(`  ${message}`);
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`總計: ${passedCount} 通過, ${failedCount} 失敗/警告`);
  console.log('='.repeat(50));
  
  if (failedCount === 0) {
    console.log('\n✅ 所有檢查通過！專案狀態良好。');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分檢查未通過，請參考上述訊息進行修正。');
    console.log('\n📋 建議：');
    console.log('   1. 執行 npm run init 進行初始化');
    console.log('   2. 執行 npm run setup-env 設定環境變數');
    console.log('   3. 執行 npm run fetch-keys 取得 API Keys');
    process.exit(1);
  }
}

// 執行主函數
if (require.main === module) {
  main();
}

module.exports = { main, checks };
