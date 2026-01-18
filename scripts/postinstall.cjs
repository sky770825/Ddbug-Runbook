#!/usr/bin/env node

/**
 * 安裝後檢查腳本
 * 在 npm install 後自動執行，檢查專案狀態
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkNodeModules() {
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('❌ node_modules 目錄不存在，請執行: npm install');
    return false;
  }
  console.log('✓ 依賴已安裝');
  return true;
}

function checkEnvFile() {
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (!fs.existsSync(envLocalPath)) {
    console.log('');
    console.log('⚠️  .env.local 檔案不存在');
    if (fs.existsSync(envExamplePath)) {
      console.log('📋 建議步驟：');
      console.log('   1. 複製 .env.example 為 .env.local:');
      console.log('      cp .env.example .env.local');
      console.log('   2. 填入實際的 API Keys 和設定值');
      console.log('   3. 或使用自動化腳本: npm run setup-env');
    }
    return false;
  }
  console.log('✓ .env.local 檔案存在');
  return true;
}

function checkPackageJson() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json 不存在');
    return false;
  }
  console.log('✓ package.json 存在');
  return true;
}

function checkScripts() {
  const scriptsPath = path.join(__dirname);
  if (!fs.existsSync(scriptsPath)) {
    console.log('⚠️  scripts 目錄不存在');
    return false;
  }
  console.log('✓ scripts 目錄存在');
  return true;
}

function main() {
  console.log('🔍 執行安裝後檢查...\n');
  
  const checks = [
    { name: 'package.json', check: checkPackageJson },
    { name: '依賴安裝', check: checkNodeModules },
    { name: 'scripts 目錄', check: checkScripts },
    { name: '環境變數檔案', check: checkEnvFile },
  ];
  
  let allPassed = true;
  checks.forEach(({ name, check }) => {
    try {
      const result = check();
      if (!result) {
        allPassed = false;
      }
    } catch (error) {
      console.error(`❌ 檢查 ${name} 時發生錯誤:`, error.message);
      allPassed = false;
    }
  });
  
  console.log('');
  if (allPassed) {
    console.log('✅ 所有檢查通過！');
    console.log('');
    console.log('📋 下一步：');
    console.log('   1. 設定環境變數: npm run setup-env');
    console.log('   2. 健康檢查: npm run health');
    console.log('   3. 啟動開發伺服器: npm run dev');
  } else {
    console.log('⚠️  部分檢查未通過，請參考上述提示進行修正');
  }
}

// 執行主函數
if (require.main === module) {
  main();
}

module.exports = { checkNodeModules, checkEnvFile, checkPackageJson, checkScripts };
