#!/usr/bin/env node

/**
 * Cloudflare Pages 自動化部署腳本
 * 提供完整的部署流程，包含檢查、建置、部署和狀態查詢
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 預設設定
const DEFAULT_CONFIG = {
  projectName: 'ddbug-runbook',
  outputDir: 'dist',
  buildCommand: 'npm run build',
  branch: 'main'
};

/**
 * 檢查 Wrangler 是否已安裝
 */
function checkWrangler() {
  try {
    execSync('npx wrangler --version', { stdio: 'pipe' });
    console.log('✓ Wrangler CLI 已安裝');
    return true;
  } catch (error) {
    console.error('❌ Wrangler 未安裝');
    console.log('📋 解決方案：');
    console.log('   1. 安裝 Wrangler: npm install -D wrangler');
    console.log('   2. 或使用 npx: npx wrangler --version');
    return false;
  }
}

/**
 * 檢查是否已登入 Cloudflare
 */
function checkCloudflareLogin() {
  try {
    execSync('npx wrangler whoami', { stdio: 'pipe' });
    console.log('✓ Cloudflare CLI 已登入');
    return true;
  } catch (error) {
    console.log('⚠️  尚未登入 Cloudflare');
    console.log('📋 解決方案：');
    console.log('   請執行: npx wrangler login');
    console.log('   這會開啟瀏覽器進行認證');
    return false;
  }
}

/**
 * 檢查輸出目錄是否存在
 */
function checkOutputDir(outputDir) {
  const distPath = path.join(process.cwd(), outputDir);
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    if (files.length > 0) {
      console.log(`✓ 輸出目錄存在且包含檔案 (${files.length} 個檔案)`);
      return true;
    } else {
      console.log(`⚠️  輸出目錄存在但為空`);
      return false;
    }
  } else {
    console.log(`✗ 輸出目錄不存在: ${outputDir}`);
    return false;
  }
}

/**
 * 建置專案
 */
function buildProject(buildCommand) {
  console.log('\n📦 正在建置專案...');
  console.log(`   執行命令: ${buildCommand}\n`);
  
  try {
    execSync(buildCommand, { 
      stdio: 'inherit',
      env: { ...process.env, CF_PAGES: '1' }
    });
    console.log('\n✓ 建置完成');
    return true;
  } catch (error) {
    console.error('\n❌ 建置失敗');
    console.log('📋 請檢查錯誤訊息並修正後重試');
    return false;
  }
}

/**
 * 部署到 Cloudflare Pages
 */
function deployToCloudflare(options = {}) {
  const {
    projectName = DEFAULT_CONFIG.projectName,
    buildCommand = DEFAULT_CONFIG.buildCommand,
    outputDir = DEFAULT_CONFIG.outputDir,
    branch = DEFAULT_CONFIG.branch,
    skipBuild = false
  } = options;
  
  console.log('🚀 開始部署到 Cloudflare Pages...\n');
  
  // 1. 檢查 Wrangler
  if (!checkWrangler()) {
    return false;
  }
  
  // 2. 檢查登入狀態
  if (!checkCloudflareLogin()) {
    return false;
  }
  
  // 3. 建置專案（如果未跳過）
  if (!skipBuild) {
    if (!buildProject(buildCommand)) {
      return false;
    }
  }
  
  // 4. 檢查輸出目錄
  if (!checkOutputDir(outputDir)) {
    console.log('\n📋 請先執行建置: npm run build');
    return false;
  }
  
  // 5. 部署到 Cloudflare Pages
  console.log(`\n📤 正在部署到 Cloudflare Pages...`);
  console.log(`   專案名稱: ${projectName}`);
  console.log(`   輸出目錄: ${outputDir}`);
  console.log(`   分支: ${branch}\n`);
  
  try {
    const deployCommand = `npx wrangler pages deploy ${outputDir} --project-name=${projectName} --branch=${branch}`;
    execSync(deployCommand, {
      stdio: 'inherit'
    });
    
    console.log('\n✅ 部署完成！\n');
    
    // 6. 顯示部署資訊
    console.log('📋 部署資訊:');
    console.log(`   專案名稱: ${projectName}`);
    console.log(`   部署網址: https://${projectName}.pages.dev`);
    console.log(`   查看部署: https://dash.cloudflare.com > Workers & Pages > ${projectName}`);
    console.log(`   部署狀態: npm run deploy:status\n`);
    
    return true;
  } catch (error) {
    console.error('\n❌ 部署失敗');
    console.log('📋 可能的問題：');
    console.log('   1. 專案名稱是否正確？');
    console.log('   2. 是否已正確登入 Cloudflare？');
    console.log('   3. 檢查錯誤訊息以取得更多資訊');
    return false;
  }
}

/**
 * 檢查部署狀態
 */
function checkDeploymentStatus(projectName = DEFAULT_CONFIG.projectName) {
  console.log(`🔍 檢查專案 ${projectName} 的部署狀態...\n`);
  
  try {
    // 檢查 Wrangler
    if (!checkWrangler()) {
      return;
    }
    
    // 檢查登入狀態
    if (!checkCloudflareLogin()) {
      return;
    }
  
    // 取得部署列表
    console.log('📋 最近的部署記錄:\n');
    try {
      const output = execSync(`npx wrangler pages deployment list --project-name=${projectName}`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log(output);
      
      if (!output.trim()) {
        console.log('⚠️  沒有找到部署記錄');
        console.log('   專案可能尚未部署，請先執行: npm run deploy:cloudflare');
      }
    } catch (error) {
      console.error('❌ 無法取得部署狀態');
      console.log('📋 可能的問題：');
      console.log(`   1. 專案名稱 "${projectName}" 是否正確？`);
      console.log('   2. 專案是否已建立？');
      console.log('   3. 請確認專案在 Cloudflare Dashboard 中存在');
    }
    
    // 取得專案資訊
    console.log('\n📋 專案資訊:');
    try {
      const projectInfo = execSync(`npx wrangler pages project list`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      if (projectInfo.includes(projectName)) {
        console.log(`✓ 專案 "${projectName}" 已存在`);
      } else {
        console.log(`⚠️  專案 "${projectName}" 尚未建立`);
        console.log('   首次部署時會自動建立專案');
      }
    } catch (error) {
      console.log('⚠️  無法取得專案列表');
    }
    
  } catch (error) {
    console.error('❌ 檢查過程發生錯誤:', error.message);
  }
}

/**
 * 顯示使用說明
 */
function showUsage() {
  console.log('Cloudflare Pages 自動化部署工具\n');
  console.log('使用方法:');
  console.log('  npm run deploy:cloudflare        # 部署到 Cloudflare Pages');
  console.log('  npm run deploy:status            # 檢查部署狀態');
  console.log('  node scripts/deploy-cloudflare.cjs deploy    # 部署');
  console.log('  node scripts/deploy-cloudflare.cjs status    # 查詢狀態\n');
  
  console.log('選項:');
  console.log('  --skip-build                     # 跳過建置步驟（使用現有的 dist 目錄）');
  console.log('  --project-name=<name>            # 指定專案名稱（預設: ddbug-runbook）');
  console.log('  --output-dir=<dir>               # 指定輸出目錄（預設: dist）');
  console.log('  --branch=<branch>                # 指定分支（預設: main）\n');
  
  console.log('範例:');
  console.log('  node scripts/deploy-cloudflare.cjs deploy --skip-build');
  console.log('  node scripts/deploy-cloudflare.cjs deploy --project-name=my-project\n');
}

/**
 * 解析命令列參數
 */
function parseArgs(args) {
  const options = { ...DEFAULT_CONFIG };
  
  args.forEach(arg => {
    if (arg === '--skip-build') {
      options.skipBuild = true;
    } else if (arg.startsWith('--project-name=')) {
      options.projectName = arg.split('=')[1];
    } else if (arg.startsWith('--output-dir=')) {
      options.outputDir = arg.split('=')[1];
    } else if (arg.startsWith('--branch=')) {
      options.branch = arg.split('=')[1];
    }
  });
  
  return options;
}

/**
 * 主函數
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'deploy') {
    const options = parseArgs(args.slice(1));
    const success = deployToCloudflare(options);
    process.exit(success ? 0 : 1);
  } else if (command === 'status') {
    const options = parseArgs(args.slice(1));
    checkDeploymentStatus(options.projectName);
  } else if (command === 'help' || command === '--help' || command === '-h') {
    showUsage();
  } else {
    console.log('❌ 未知的命令:', command || '(無)');
    console.log('');
    showUsage();
    process.exit(1);
  }
}

// 執行主函數
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 執行過程發生錯誤:', error);
    process.exit(1);
  });
}

module.exports = {
  deployToCloudflare,
  checkDeploymentStatus,
  checkWrangler,
  checkCloudflareLogin,
  buildProject
};
