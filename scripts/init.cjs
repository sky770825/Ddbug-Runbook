#!/usr/bin/env node

/**
 * 專案初始化腳本
 * 自動化專案初始化流程
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { checkNodeVersion } = require('./check-node-version');
const { checkNodeModules, checkEnvFile } = require('./postinstall');

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function checkNode() {
  console.log('🔍 檢查 Node.js 版本...');
  const result = checkNodeVersion();
  if (!result.valid) {
    console.error('\n❌ Node.js 版本不符合要求，請先切換版本');
    return false;
  }
  return true;
}

async function installDependencies() {
  console.log('\n📦 檢查依賴...');
  
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    console.log('✓ 依賴已安裝');
    return true;
  }
  
  console.log('⚠️  依賴未安裝，開始安裝...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✓ 依賴安裝完成');
    return true;
  } catch (error) {
    console.error('❌ 依賴安裝失敗');
    return false;
  }
}

async function checkCLITools() {
  console.log('\n🔍 檢查 CLI 工具...');
  
  const tools = [
    { name: 'Supabase CLI', command: 'npx supabase --version', optional: false },
    { name: 'Git', command: 'git --version', optional: false },
    { name: 'GitHub CLI', command: 'gh --version', optional: true },
    { name: 'Cloudflare CLI', command: 'npx wrangler --version', optional: true },
  ];
  
  const results = [];
  for (const tool of tools) {
    try {
      execSync(tool.command, { stdio: 'pipe' });
      console.log(`✓ ${tool.name} 已安裝`);
      results.push({ ...tool, installed: true });
    } catch (error) {
      if (tool.optional) {
        console.log(`⚠️  ${tool.name} 未安裝（可選）`);
      } else {
        console.log(`⚠️  ${tool.name} 未安裝`);
      }
      results.push({ ...tool, installed: false });
    }
  }
  
  return results;
}

async function setupEnvFile() {
  console.log('\n📝 檢查環境變數檔案...');
  
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (fs.existsSync(envLocalPath)) {
    console.log('✓ .env.local 已存在');
    return true;
  }
  
  if (fs.existsSync(envExamplePath)) {
    console.log('⚠️  .env.local 不存在');
    const answer = await question('是否要從 .env.example 建立 .env.local？(y/n): ');
    
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      try {
        fs.copyFileSync(envExamplePath, envLocalPath);
        console.log('✓ 已建立 .env.local（從 .env.example）');
        console.log('📋 請編輯 .env.local 填入實際的 API Keys');
        return true;
      } catch (error) {
        console.error('❌ 建立 .env.local 失敗:', error.message);
        return false;
      }
    }
  } else {
    console.log('⚠️  .env.example 不存在，無法自動建立 .env.local');
  }
  
  return false;
}

async function suggestNextSteps(cliTools) {
  console.log('\n📋 初始化完成！下一步建議：');
  console.log('');
  
  const missingTools = cliTools.filter(t => !t.installed && !t.optional);
  if (missingTools.length > 0) {
    console.log('1. 安裝缺失的 CLI 工具：');
    missingTools.forEach(tool => {
      if (tool.name === 'Supabase CLI') {
        console.log('   npm install -g supabase');
      } else if (tool.name === 'Git') {
        console.log('   請安裝 Git: https://git-scm.com/');
      }
    });
    console.log('');
  }
  
  console.log('2. 設定環境變數：');
  console.log('   npm run setup-env');
  console.log('');
  
  console.log('3. 健康檢查：');
  console.log('   npm run health');
  console.log('');
  
  console.log('4. 啟動開發伺服器：');
  console.log('   npm run dev');
  console.log('');
  
  console.log('💡 提示：');
  console.log('   - 使用 npm run fetch-keys 可以自動取得部分 API Keys');
  console.log('   - 使用步驟 61 可以統一建置自動化環境');
}

async function main() {
  console.log('🚀 開始專案初始化...\n');
  
  // 1. 檢查 Node.js 版本
  const nodeOk = await checkNode();
  if (!nodeOk) {
    process.exit(1);
  }
  
  // 2. 安裝依賴
  const depsOk = await installDependencies();
  if (!depsOk) {
    console.error('\n❌ 依賴安裝失敗，請檢查錯誤訊息');
    process.exit(1);
  }
  
  // 3. 檢查 CLI 工具
  const cliTools = await checkCLITools();
  
  // 4. 設定環境變數檔案
  await setupEnvFile();
  
  // 5. 建議下一步
  await suggestNextSteps(cliTools);
  
  rl.close();
  
  console.log('✅ 初始化完成！');
}

// 執行主函數
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 初始化過程發生錯誤:', error);
    rl.close();
    process.exit(1);
  });
}

module.exports = { main };
