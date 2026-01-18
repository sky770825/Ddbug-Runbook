#!/usr/bin/env node

/**
 * 驗證環境變數腳本
 * 檢查環境變數是否完整且格式正確
 */

const fs = require('fs');
const path = require('path');
const { validateEnvFile } = require('./setup-env.cjs');

function main() {
  const envPath = path.join(process.cwd(), '.env.local');
  
  console.log('🔍 驗證環境變數...\n');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local 檔案不存在');
    console.log('   請執行: npm run setup-env');
    process.exit(1);
  }
  
  const validation = validateEnvFile(envPath);
  
  if (validation.valid) {
    console.log('✅ 所有環境變數驗證通過！\n');
    
    // 顯示已設定的變數數量
    const setCount = Object.keys(validation.envVars).length;
    console.log(`📊 統計：`);
    console.log(`   - 已設定變數: ${setCount} 個`);
    
    // 檢查必需變數
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];
    
    const missingRequired = requiredVars.filter(key => 
      !validation.envVars[key] || validation.envVars[key] === '請填入'
    );
    
    if (missingRequired.length === 0) {
      console.log(`   - 必需變數: ✅ 完整`);
    } else {
      console.log(`   - 必需變數: ⚠️  缺少 ${missingRequired.length} 個`);
      console.log(`     缺少: ${missingRequired.join(', ')}`);
    }
    
    process.exit(0);
  } else {
    console.error('❌ 環境變數驗證失敗：\n');
    validation.errors.forEach(error => {
      console.error(`   - ${error}`);
    });
    
    if (validation.warnings.length > 0) {
      console.log('\n⚠️  警告：');
      validation.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }
    
    console.log('\n📋 建議：');
    console.log('   1. 檢查 .env.local 檔案');
    console.log('   2. 填入缺失的環境變數');
    console.log('   3. 或執行: npm run fetch-keys 取得 Keys');
    console.log('   4. 然後執行: npm run setup-env 重新生成');
    
    process.exit(1);
  }
}

// 執行主函數
if (require.main === module) {
  main();
}

module.exports = { main };
