#!/usr/bin/env node

/**
 * 建置前檢查腳本
 * 在建置前檢查專案狀態和設定
 */

const fs = require('fs');
const path = require('path');
const { checkNodeVersion } = require('./check-node-version.cjs');

function checkNodeModules() {
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    return { passed: false, message: 'node_modules 不存在，請執行: npm install' };
  }
  return { passed: true, message: '✓ 依賴已安裝' };
}

function checkEnvVars() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    return { passed: false, message: '.env.local 不存在，請執行: npm run setup-env' };
  }
  
  // 簡單檢查必要的環境變數是否存在
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const hasSupabaseUrl = envContent.includes('NEXT_PUBLIC_SUPABASE_URL') && 
                         !envContent.includes('NEXT_PUBLIC_SUPABASE_URL=請填入');
  const hasSupabaseKey = envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY') && 
                         !envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=請填入');
  
  if (hasSupabaseUrl && hasSupabaseKey) {
    return { passed: true, message: '✓ 環境變數設定正確' };
  } else {
    return { passed: false, message: '⚠️  環境變數不完整，請執行: npm run setup-env' };
  }
}

function checkBuildConfig() {
  const viteConfigPath = path.join(__dirname, '..', 'vite.config.ts');
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  if (!fs.existsSync(viteConfigPath)) {
    return { passed: false, message: 'vite.config.ts 不存在' };
  }
  
  if (!fs.existsSync(packageJsonPath)) {
    return { passed: false, message: 'package.json 不存在' };
  }
  
  return { passed: true, message: '✓ 建置配置檔案存在' };
}

function main() {
  console.log('🔍 執行建置前檢查...\n');
  
  const checks = [
    { name: 'Node.js 版本', check: () => {
      const result = checkNodeVersion();
      return {
        passed: result.valid,
        message: result.valid ? `✓ Node.js 版本: ${result.version || process.version}` : `✗ Node.js 版本不符合要求`
      };
    }},
    { name: '專案依賴', check: checkNodeModules },
    { name: '環境變數', check: checkEnvVars },
    { name: '建置配置', check: checkBuildConfig }
  ];
  
  let allPassed = true;
  checks.forEach(({ name, check }) => {
    try {
      const result = check();
      console.log(`${result.passed ? '✓' : '✗'} ${name}: ${result.message}`);
      if (!result.passed) {
        allPassed = false;
      }
    } catch (error) {
      console.error(`✗ ${name}: 檢查時發生錯誤 - ${error.message}`);
      allPassed = false;
    }
  });
  
  console.log('');
  if (allPassed) {
    console.log('✅ 所有檢查通過，可以開始建置！');
    process.exit(0);
  } else {
    console.log('❌ 部分檢查未通過，請修正後再建置');
    process.exit(1);
  }
}

// 執行主函數
if (require.main === module) {
  main();
}

module.exports = { main, checkNodeModules, checkEnvVars, checkBuildConfig };
