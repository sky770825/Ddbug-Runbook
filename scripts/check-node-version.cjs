#!/usr/bin/env node

/**
 * Node.js 版本檢查腳本
 * 檢查當前 Node.js 版本是否符合 .nvmrc 要求
 */

const fs = require('fs');
const path = require('path');

const NVMRC_PATH = path.join(__dirname, '..', '.nvmrc');
const CURRENT_NODE_VERSION = process.version;

function readNvmrc() {
  try {
    if (fs.existsSync(NVMRC_PATH)) {
      const content = fs.readFileSync(NVMRC_PATH, 'utf-8').trim();
      return content;
    }
  } catch (error) {
    // 如果讀取失敗，返回 null
  }
  return null;
}

function parseVersion(version) {
  // 移除 'v' 前綴
  const cleanVersion = version.replace(/^v/, '');
  // 只取主版本號（例如：20.11.0 -> 20）
  const majorVersion = parseInt(cleanVersion.split('.')[0], 10);
  return majorVersion;
}

function checkNodeVersion() {
  const requiredVersion = readNvmrc();
  
  if (!requiredVersion) {
    console.log('⚠️  未找到 .nvmrc 檔案，跳過版本檢查');
    return { valid: true, warning: true };
  }
  
  const requiredMajor = parseVersion(requiredVersion);
  const currentMajor = parseVersion(CURRENT_NODE_VERSION);
  
  if (currentMajor !== requiredMajor) {
    console.error('❌ Node.js 版本不符合要求！');
    console.error(`   當前版本: ${CURRENT_NODE_VERSION}`);
    console.error(`   要求版本: ${requiredVersion} (主版本 ${requiredMajor})`);
    console.error('');
    console.error('📋 解決方案：');
    console.error('   1. 使用 nvm 切換版本:');
    console.error(`      nvm install ${requiredVersion}`);
    console.error(`      nvm use ${requiredVersion}`);
    console.error('');
    console.error('   2. 或手動安裝 Node.js:');
    console.error(`      前往: https://nodejs.org/ 下載 Node.js ${requiredMajor}.x`);
    console.error('');
    return { valid: false, required: requiredVersion, current: CURRENT_NODE_VERSION };
  }
  
  console.log(`✓ Node.js 版本符合要求: ${CURRENT_NODE_VERSION} (要求: ${requiredVersion})`);
  return { valid: true, version: CURRENT_NODE_VERSION };
}

// 如果直接執行此腳本
if (require.main === module) {
  const result = checkNodeVersion();
  process.exit(result.valid ? 0 : 1);
}

module.exports = { checkNodeVersion, parseVersion };
