# 🛠️ CLI 自動化環境整合方案

## 📋 問題分析

### 當前問題

1. **分散的 CLI 工具設定**
   - 每個步驟都需要單獨檢查 CLI 工具是否安裝
   - 缺乏統一的環境檢查機制
   - 重複的安裝和登入步驟分散在各個步驟中

2. **手動操作繁瑣**
   - 需要手動檢查每個 CLI 工具版本
   - 需要手動安裝缺失的工具
   - 需要手動登入/連接各個服務

3. **缺乏環境一致性**
   - 不同步驟可能使用不同版本的 CLI 工具
   - 缺乏統一的環境變數管理
   - 無法快速驗證所有工具是否正確設定

### 用戶需求

- ✅ 統一的自動化環境建置步驟
- ✅ 自動檢查所有需要的 CLI 工具
- ✅ 自動安裝缺失的工具
- ✅ 自動檢查登入/連接狀態
- ✅ 提供統一的管理介面

---

## 🔍 現有 CLI 工具分析

### 系統中使用的 CLI 工具

根據步驟分析，系統中使用了以下 CLI 工具：

| CLI 工具 | 使用場景 | 安裝方式 | 登入/連接方式 | 使用頻率 |
|---------|---------|---------|-------------|---------|
| **Supabase CLI** | 資料庫操作、Migration、Edge Functions | `npm install -g supabase` | `npx supabase login`<br>`npx supabase link` | ⭐⭐⭐⭐⭐ 極高 |
| **npm/npx** | 套件管理、執行腳本 | 內建於 Node.js | 不需要登入 | ⭐⭐⭐⭐⭐ 極高 |
| **GitHub CLI (gh)** | GitHub 操作（可能用於 CI/CD） | `brew install gh`<br>`npm install -g gh` | `gh auth login` | ⭐⭐ 低（未來可能需要） |
| **n8n CLI** | n8n 工作流程管理（未來可能） | `npm install -g n8n` | `n8n user:credentials` | ⭐ 極低（目前未使用） |
| **Deno** | Edge Functions 執行環境 | 內建於 Supabase Edge Functions | 不需要登入 | ⭐⭐⭐ 中 |
| **Git** | 版本控制 | 內建於系統 | `git config` | ⭐⭐⭐⭐ 高 |

### 詳細使用情況

#### 1. Supabase CLI（最高優先級）

**使用頻率**：出現在 30+ 個步驟中

**常見命令**：
```bash
npx supabase --version              # 檢查版本
npx supabase login                  # 登入
npx supabase link --project-ref     # 連接專案
npx supabase db execute --query     # 執行 SQL
npx supabase functions deploy       # 部署函數
npx supabase secrets set            # 設定環境變數
```

**需要檢查的狀態**：
- ✅ CLI 是否已安裝
- ✅ 是否已登入
- ✅ 是否已連接專案
- ✅ Project Reference 是否正確

#### 2. npm/npx（基礎工具）

**使用頻率**：出現在所有步驟中

**常見命令**：
```bash
npm install                         # 安裝套件
npm run build                       # 建置專案
npx supabase ...                    # 執行 Supabase CLI
```

**需要檢查的狀態**：
- ✅ Node.js 版本是否符合要求
- ✅ npm 版本是否足夠新
- ✅ 專案依賴是否已安裝

#### 3. GitHub CLI（未來可能使用）

**使用頻率**：目前未使用，但可能用於 CI/CD

**潛在使用場景**：
- GitHub Actions 自動化
- Issue 和 PR 管理
- 自動部署

**需要檢查的狀態**：
- ✅ CLI 是否已安裝
- ✅ 是否已登入
- ✅ 是否有適當的權限

#### 4. n8n CLI（目前未使用，但可能未來需要）

**使用頻率**：目前未使用

**潛在使用場景**：
- 工作流程管理
- 自動化測試
- 批次操作

**需要檢查的狀態**：
- ✅ CLI 是否已安裝（如果需要的話）
- ✅ 是否已連接到 n8n 實例

---

## 🎯 解決方案設計

### 方案一：統一的環境建置步驟（推薦）

#### 概念

建立一個新的步驟（步驟 61：CLI 自動化環境建置），用於統一管理所有 CLI 工具。

#### 功能設計

##### 1. 環境檢查（Diagnostic）

**自動檢查所有 CLI 工具**：
```bash
【Cursor 自動化指令】檢查自動化環境設定

請自動執行以下檢查：

1. 檢查 Supabase CLI：
   npx supabase --version || echo "未安裝"
   npx supabase projects list || echo "未登入或未連接"

2. 檢查 Node.js 和 npm：
   node --version
   npm --version
   npm list --depth=0 || echo "依賴未安裝"

3. 檢查 GitHub CLI（可選）：
   gh --version || echo "未安裝"
   gh auth status || echo "未登入"

4. 檢查 Git：
   git --version
   git config user.name || echo "未設定"
   git config user.email || echo "未設定"

5. 檢查專案環境變數：
   # 檢查 .env 檔案是否存在
   # 檢查必要的環境變數是否已設定
```

##### 2. 自動安裝和設定（Fix）

**自動安裝缺失的工具**：
```bash
【Cursor 自動化指令】自動建置自動化環境

請自動執行以下操作：

1. 安裝 Supabase CLI（如果未安裝）：
   npm install -g supabase || echo "安裝失敗"

2. 登入 Supabase（如果需要）：
   npx supabase login || echo "請手動登入"

3. 連接 Supabase 專案（如果未連接）：
   npx supabase link --project-ref {{supabase_ref}} || echo "請確認 Project Reference"

4. 安裝 GitHub CLI（如果需要）：
   # macOS
   brew install gh || echo "請手動安裝"
   # 或其他系統
   npm install -g gh || echo "請手動安裝"

5. 登入 GitHub CLI（如果需要）：
   gh auth login || echo "請手動登入"

6. 設定 Git（如果未設定）：
   git config --global user.name "{{git_user_name}}" || true
   git config --global user.email "{{git_user_email}}" || true

7. 安裝專案依賴（如果未安裝）：
   npm install || echo "安裝依賴失敗"

8. 檢查環境變數設定：
   # 提供環境變數檢查清單
   # 提示缺少的環境變數
```

##### 3. 驗證設定（Verify）

**驗證所有工具是否正確設定**：
```bash
【Cursor 自動化指令】驗證自動化環境設定

請自動執行以下驗證：

1. 驗證 Supabase CLI：
   npx supabase --version && echo "✓ Supabase CLI 已安裝"
   npx supabase projects list && echo "✓ Supabase 已登入" || echo "✗ Supabase 未登入"

2. 驗證 Node.js 環境：
   node --version && echo "✓ Node.js 已安裝"
   npm --version && echo "✓ npm 已安裝"

3. 驗證 GitHub CLI（如果需要的話）：
   gh --version && echo "✓ GitHub CLI 已安裝"
   gh auth status && echo "✓ GitHub CLI 已登入" || echo "✗ GitHub CLI 未登入"

4. 驗證 Git 設定：
   git config user.name && echo "✓ Git user.name 已設定"
   git config user.email && echo "✓ Git user.email 已設定"

5. 驗證專案依賴：
   npm list --depth=0 && echo "✓ 專案依賴已安裝" || echo "✗ 專案依賴未完整安裝"

6. 產生環境報告：
   # 顯示所有工具狀態
   # 標示缺少的設定
   # 提供下一步建議
```

#### 步驟設計

**步驟 61：CLI 自動化環境建置**

```typescript
{
  id: 61,
  title: "CLI 自動化環境建置",
  shortTitle: "環境建置",
  purpose: "統一管理所有 CLI 工具（Supabase、GitHub、npm 等），自動檢查安裝狀態、登入狀態，提供統一的環境設定。",
  badge: "critical",
  category: "development",
  keywords: ["cli", "automation", "environment", "setup", "supabase", "github", "npm", "tools"],
  checklist: [
    { id: "61-1", label: "檢查 Supabase CLI 安裝和登入狀態", completed: false },
    { id: "61-2", label: "檢查 Node.js 和 npm 版本", completed: false },
    { id: "61-3", label: "檢查 GitHub CLI（如果需要）", completed: false },
    { id: "61-4", label: "檢查 Git 設定", completed: false },
    { id: "61-5", label: "驗證所有工具設定正確", completed: false },
  ],
  prompts: [
    {
      id: "p61-1",
      title: "1. 檢查自動化環境狀態",
      description: "自動檢查所有 CLI 工具的安裝和設定狀態",
      keywords: ["check", "status", "version", "login"],
      variables: [
        {
          key: "supabase_ref",
          label: "Supabase Project Reference",
          placeholder: "例如：abcdefghijklmnop",
          description: "您的 Supabase 專案 Reference ID（可選，如果需要自動連接）"
        },
        {
          key: "git_user_name",
          label: "Git 使用者名稱",
          placeholder: "例如：Your Name",
          description: "Git 使用者名稱（可選，如果需要自動設定）"
        },
        {
          key: "git_user_email",
          label: "Git 使用者 Email",
          placeholder: "例如：your@email.com",
          description: "Git 使用者 Email（可選，如果需要自動設定）"
        }
      ],
      prompts: {
        diagnostic: `【Cursor 自動化指令】檢查自動化環境設定

請自動執行以下檢查：

1. 檢查 Supabase CLI：
   npx supabase --version || echo "✗ Supabase CLI 未安裝"
   npx supabase projects list 2>&1 | head -5 || echo "✗ Supabase 未登入或未連接"

2. 檢查 Node.js 和 npm：
   node --version || echo "✗ Node.js 未安裝"
   npm --version || echo "✗ npm 未安裝"
   npm list --depth=0 2>&1 | head -20 || echo "✗ 專案依賴可能未完整安裝"

3. 檢查 GitHub CLI（可選）：
   gh --version 2>&1 || echo "✗ GitHub CLI 未安裝"
   gh auth status 2>&1 || echo "✗ GitHub CLI 未登入"

4. 檢查 Git 設定：
   git --version || echo "✗ Git 未安裝"
   git config user.name || echo "✗ Git user.name 未設定"
   git config user.email || echo "✗ Git user.email 未設定"

5. 檢查專案環境變數：
   # 檢查 .env 檔案
   test -f .env && echo "✓ .env 檔案存在" || echo "✗ .env 檔案不存在"
   # 檢查必要的環境變數（根據專案需求）

6. 產生環境報告：
   echo "=== 自動化環境檢查報告 ==="
   echo "Supabase CLI: $(npx supabase --version 2>&1 | head -1 || echo '未安裝')"
   echo "Node.js: $(node --version 2>&1 || echo '未安裝')"
   echo "npm: $(npm --version 2>&1 || echo '未安裝')"
   echo "Git: $(git --version 2>&1 | head -1 || echo '未安裝')"
   echo "GitHub CLI: $(gh --version 2>&1 | head -1 || echo '未安裝')"`,
        fix: `【Cursor 自動化指令】自動建置自動化環境

請自動執行以下操作：

1. 安裝 Supabase CLI（如果未安裝）：
   if ! command -v supabase &> /dev/null && ! command -v npx &> /dev/null; then
     echo "需要先安裝 Node.js 和 npm"
   else
     npx supabase --version || npm install -g supabase
     echo "✓ Supabase CLI 安裝完成"
   fi

2. 登入 Supabase（如果需要）：
   npx supabase login || echo "⚠️ 請手動執行: npx supabase login"

3. 連接 Supabase 專案（如果提供了 Project Reference）：
   if [ -n "{{supabase_ref}}" ]; then
     npx supabase link --project-ref {{supabase_ref}} || echo "⚠️ 請確認 Project Reference 是否正確"
   else
     echo "ℹ️ 未提供 Supabase Project Reference，跳過自動連接"
   fi

4. 檢查 Node.js 和 npm（如果未安裝，提示安裝）：
   node --version || echo "⚠️ 請安裝 Node.js: https://nodejs.org/"
   npm --version || echo "⚠️ 請安裝 npm（通常包含在 Node.js 中）"

5. 安裝專案依賴（如果未安裝）：
   if [ ! -d "node_modules" ]; then
     npm install && echo "✓ 專案依賴安裝完成" || echo "✗ 專案依賴安裝失敗"
   else
     echo "✓ 專案依賴已存在"
   fi

6. 安裝 GitHub CLI（如果需要）：
   # macOS
   if [[ "$OSTYPE" == "darwin"* ]]; then
     if ! command -v gh &> /dev/null; then
       brew install gh || echo "⚠️ 請手動安裝: brew install gh"
     fi
   else
     npm install -g gh || echo "⚠️ 請手動安裝 GitHub CLI"
   fi

7. 登入 GitHub CLI（如果需要）：
   gh auth login || echo "⚠️ 請手動執行: gh auth login"

8. 設定 Git（如果未設定且提供了資訊）：
   if [ -n "{{git_user_name}}" ]; then
     git config --global user.name "{{git_user_name}}" || true
   fi
   if [ -n "{{git_user_email}}" ]; then
     git config --global user.email "{{git_user_email}}" || true
   fi

9. 產生設定報告：
   echo "=== 自動化環境建置報告 ==="
   echo "請檢查上述輸出，確認所有工具是否正確設定"`,
        verify: `【Cursor 自動化指令】驗證自動化環境設定

請自動執行以下驗證：

1. 驗證 Supabase CLI：
   SUPABASE_VERSION=$(npx supabase --version 2>&1 | head -1)
   if [ -n "$SUPABASE_VERSION" ]; then
     echo "✓ Supabase CLI 已安裝: $SUPABASE_VERSION"
   else
     echo "✗ Supabase CLI 未安裝"
   fi
   
   if npx supabase projects list 2>&1 | grep -q "Projects"; then
     echo "✓ Supabase 已登入"
   else
     echo "✗ Supabase 未登入，請執行: npx supabase login"
   fi

2. 驗證 Node.js 環境：
   NODE_VERSION=$(node --version 2>&1)
   NPM_VERSION=$(npm --version 2>&1)
   if [ -n "$NODE_VERSION" ]; then
     echo "✓ Node.js 已安裝: $NODE_VERSION"
   else
     echo "✗ Node.js 未安裝"
   fi
   if [ -n "$NPM_VERSION" ]; then
     echo "✓ npm 已安裝: $NPM_VERSION"
   else
     echo "✗ npm 未安裝"
   fi

3. 驗證 GitHub CLI（如果已安裝）：
   GH_VERSION=$(gh --version 2>&1 | head -1)
   if [ -n "$GH_VERSION" ]; then
     echo "✓ GitHub CLI 已安裝: $GH_VERSION"
     if gh auth status 2>&1 | grep -q "Logged in"; then
       echo "✓ GitHub CLI 已登入"
     else
       echo "⚠️ GitHub CLI 未登入（可選）"
     fi
   else
     echo "ℹ️ GitHub CLI 未安裝（可選工具）"
   fi

4. 驗證 Git 設定：
   GIT_VERSION=$(git --version 2>&1)
   GIT_NAME=$(git config user.name 2>&1)
   GIT_EMAIL=$(git config user.email 2>&1)
   
   if [ -n "$GIT_VERSION" ]; then
     echo "✓ Git 已安裝: $GIT_VERSION"
   else
     echo "✗ Git 未安裝"
   fi
   
   if [ -n "$GIT_NAME" ]; then
     echo "✓ Git user.name 已設定: $GIT_NAME"
   else
     echo "⚠️ Git user.name 未設定"
   fi
   
   if [ -n "$GIT_EMAIL" ]; then
     echo "✓ Git user.email 已設定: $GIT_EMAIL"
   else
     echo "⚠️ Git user.email 未設定"
   fi

5. 驗證專案依賴：
   if [ -d "node_modules" ]; then
     echo "✓ 專案依賴已安裝"
     npm list --depth=0 2>&1 | head -10
   else
     echo "✗ 專案依賴未安裝，請執行: npm install"
   fi

6. 產生最終報告：
   echo ""
   echo "=== 環境驗證完成 ==="
   echo "請確認所有必要的工具都已正確設定"
   echo "如有缺失，請參考上述輸出進行修正"`
      }
    }
  ],
  nextSteps: [1, 4, 7, 9], // RLS、Migration、Auth、Edge Functions
  workflowChains: [
    {
      id: "env-setup-supabase",
      name: "環境建置 → Supabase 設定流程",
      description: "完成環境建置後，開始設定 Supabase 功能",
      steps: [61, 1, 7, 9],
      tags: ["環境建置", "Supabase", "初始化"]
    }
  ]
}
```

---

### 方案二：環境配置文件（進階方案）

#### 概念

建立一個配置文件（`.automation-env.json`）來管理所有 CLI 工具的設定。

#### 配置文件結構

```json
{
  "cliTools": {
    "supabase": {
      "required": true,
      "version": "latest",
      "installation": "npm install -g supabase",
      "loginCommand": "npx supabase login",
      "linkCommand": "npx supabase link --project-ref {{supabase_ref}}",
      "projectRef": "{{supabase_ref}}"
    },
    "github": {
      "required": false,
      "version": "latest",
      "installation": "brew install gh",
      "loginCommand": "gh auth login",
      "scopes": ["repo", "workflow"]
    },
    "npm": {
      "required": true,
      "minVersion": "8.0.0",
      "checkCommand": "npm --version"
    },
    "node": {
      "required": true,
      "minVersion": "18.0.0",
      "checkCommand": "node --version"
    },
    "git": {
      "required": true,
      "config": {
        "user.name": "{{git_user_name}}",
        "user.email": "{{git_user_email}}"
      }
    }
  },
  "environmentVariables": {
    "required": [
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY"
    ],
    "optional": [
      "SUPABASE_SERVICE_ROLE_KEY",
      "RESEND_API_KEY",
      "LINE_CHANNEL_ACCESS_TOKEN"
    ]
  },
  "projectDependencies": {
    "checkOnSetup": true,
    "autoInstall": true
  }
}
```

#### 使用方式

1. 系統讀取 `.automation-env.json` 配置
2. 根據配置自動檢查所有工具
3. 自動安裝缺失的工具
4. 自動設定環境變數
5. 產生環境報告

---

## 📊 方案比較

| 特性 | 方案一：統一步驟 | 方案二：配置文件 |
|------|---------------|----------------|
| **實施難度** | ⭐⭐ 低 | ⭐⭐⭐⭐ 高 |
| **使用者友善度** | ⭐⭐⭐⭐⭐ 極高 | ⭐⭐⭐ 中 |
| **靈活性** | ⭐⭐⭐ 中 | ⭐⭐⭐⭐⭐ 極高 |
| **維護性** | ⭐⭐⭐⭐ 高 | ⭐⭐⭐ 中 |
| **推薦度** | ⭐⭐⭐⭐⭐ 推薦 | ⭐⭐⭐ 進階 |

---

## 🎯 建議實施方案

### 階段一：實施方案一（統一步驟）

1. **立即實施**：建立步驟 61（CLI 自動化環境建置）
2. **優點**：
   - 快速實施
   - 使用者友善
   - 符合現有系統架構
3. **實施時間**：1-2 小時

### 階段二：優化（可選）

1. **未來考慮**：實施方案二（配置文件）
2. **適用場景**：
   - 需要更複雜的環境管理
   - 多個專案需要不同配置
   - 需要版本控制和分享配置

---

## 💡 使用建議

### 對於初次使用者

1. **先執行步驟 61**：檢查和設定自動化環境
2. **確認所有工具已安裝**：檢查輸出報告
3. **完成登入/連接**：根據提示完成設定
4. **再執行其他步驟**：確保環境已準備好

### 對於進階使用者

1. **定期執行步驟 61**：檢查環境是否有變更
2. **使用變數設定**：預先填入 Supabase Project Reference 等資訊
3. **整合到 CI/CD**：在部署前檢查環境

---

## 🔗 相關步驟

### 步驟 61 可以連結到：

- **步驟 1**：RLS 政策（需要 Supabase CLI）
- **步驟 4**：SQL Migration（需要 Supabase CLI）
- **步驟 7**：Authentication（需要 Supabase CLI）
- **步驟 9**：Edge Functions（需要 Supabase CLI）
- **步驟 19**：Cloudflare Pages 部署（可能需要 GitHub CLI）
- **步驟 30-31**：CI/CD（可能需要 GitHub CLI）

---

## ❓ 常見問題

### Q1: 如果某個 CLI 工具不需要怎麼辦？

**A**: 步驟中會標記哪些工具是可選的，只檢查需要的工具。

### Q2: 自動安裝會修改系統設定嗎？

**A**: 
- 安裝工具：只安裝到當前專案或全域（需要權限）
- 登入操作：需要使用者手動確認（基於安全性）
- Git 設定：只設定全域設定（不影響其他專案）

### Q3: 如何自訂檢查項目？

**A**: 可以修改步驟中的 prompts，添加或移除檢查項目。

---

## 📝 實施清單

- [ ] 建立步驟 61：CLI 自動化環境建置
- [ ] 添加診斷、修正、驗證三個 prompts
- [ ] 添加必要的變數（supabase_ref、git_user_name 等）
- [ ] 測試步驟功能
- [ ] 更新相關步驟的 nextSteps，連結到步驟 61
- [ ] 建立工作流程鏈（環境建置 → Supabase 設定）

---

## 🎉 預期效果

### 實施前
- ❌ 需要在每個步驟中單獨檢查 CLI 工具
- ❌ 重複的安裝和登入步驟
- ❌ 缺乏統一的環境管理

### 實施後
- ✅ 統一的環境檢查和設定
- ✅ 自動安裝缺失的工具
- ✅ 清晰的環境狀態報告
- ✅ 提高使用者體驗
- ✅ 減少設定錯誤

---

## 💬 建議

**建議採用方案一（統一步驟）**，因為：
1. **快速實施**：符合現有系統架構
2. **使用者友善**：簡單易懂的步驟
3. **靈活擴展**：未來可以輕鬆添加更多工具
4. **維護容易**：集中管理所有環境檢查

您覺得這個方案如何？需要調整哪些部分？
