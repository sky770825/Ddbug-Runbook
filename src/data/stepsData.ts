export type PromptTone = 'diagnostic' | 'fix' | 'verify';

export interface PromptVariable {
  key: string;
  label: string;
  placeholder: string;
  description?: string;
}

export interface Prompt {
  id: string;
  title: string;
  description: string;
  prompts: Record<PromptTone, string>;
  keywords: string[];
  variables?: PromptVariable[]; // 模組專屬變數定義
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface Step {
  id: number;
  title: string;
  shortTitle: string;
  purpose: string;
  badge: 'critical' | 'common' | 'advanced';
  category: 'supabase' | 'n8n' | 'security' | 'general' | 'backend' | 'crm' | 'email' | 'line' | 'frontend' | 'templates' | 'deployment' | 'monitoring' | 'database' | 'testing' | 'cicd' | 'api' | 'caching' | 'notifications' | 'integrations' | 'development' | 'mobile' | 'i18n' | 'business' | 'analytics' | 'documentation';
  keywords: string[];
  checklist: ChecklistItem[];
  prompts: Prompt[];
}

export const stepsData: Step[] = [
  {
    id: 1,
    title: "RLS 政策阻擋存取",
    shortTitle: "RLS 問題",
    purpose: "Row Level Security 導致 API 回傳空陣列、permission denied、或資料無法寫入。這是最常見的 Supabase 問題。",
    badge: "critical",
    category: "supabase",
    keywords: ["rls", "permission", "denied", "empty", "blocked", "policy"],
    checklist: [
      { id: "1-1", label: "確認用戶已登入 (auth.uid() 有值)", completed: false },
      { id: "1-2", label: "檢查 RLS 是否已啟用", completed: false },
      { id: "1-3", label: "確認 policy 條件正確", completed: false },
      { id: "1-4", label: "測試 service_role 繞過", completed: false },
      { id: "1-5", label: "檢查是否有 infinite recursion", completed: false },
    ],
    prompts: [
      {
        id: "p1-1",
        title: "1. 檢查 auth.uid() 是否有值",
        description: "首先確認用戶是否已正確登入，這是 RLS 最常見的問題根源",
        keywords: ["auth", "uid", "login", "session"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查用戶登入狀態

1. 在 Supabase SQL Editor 執行：
SELECT auth.uid() as current_user_id;

2. 如果回傳 null，表示用戶未登入。前端檢查方式：
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user?.id || 'NOT LOGGED IN');`,
          fix: `【Cursor 自動化指令】實作登入檢查與 API 呼叫保護

請在呼叫需要 RLS 的 API 前，自動加入以下檢查邏輯：

// 1. 檢查用戶是否已登入
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (!user) {
  // 自動導向登入頁或顯示登入 modal
  router.push('/login');
  // 或顯示 toast 提示
  toast.error('請先登入');
  return;
}

// 2. 現在可以安全呼叫需要 RLS 的 API
const { data, error } = await supabase
  .from('{{table_name}}')
  .select('*')
  .eq('{{field_name}}', user.id);

if (error) {
  console.error('RLS Error:', error);
  // 自動處理錯誤
}`,
          verify: `// 驗證修正是否生效
const { data: { user } } = await supabase.auth.getUser();
console.log('✓ User logged in:', user?.id);

const { data, error } = await supabase.from('{{table_name}}').select('*');
console.log('✓ Query result:', data?.length, 'rows');
console.log('✓ Error:', error);`
        }
      },
      {
        id: "p1-2",
        title: "2. 查看現有 RLS Policies",
        description: "確認表格是否有正確設定 policy，以及 policy 的條件是否符合預期",
        keywords: ["policy", "check", "list", "view"],
        prompts: {
          diagnostic: `-- 列出指定表格的所有 policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = '{{table_name}}';

-- 檢查 RLS 是否已啟用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = '{{table_name}}';`,
          fix: `【Cursor 自動化指令】自動建立完整的 RLS Policies

請根據表格結構自動生成以下 SQL，並在 Supabase SQL Editor 執行：

-- 1. 啟用 RLS（如果尚未啟用）
ALTER TABLE {{table_name}} ENABLE ROW LEVEL SECURITY;

-- 2. SELECT: 用戶只能讀取自己的資料
CREATE POLICY "Users can view own data"
  ON {{table_name}} FOR SELECT
  USING (auth.uid() = {{field_name}});

-- 3. INSERT: 用戶只能新增自己的資料
CREATE POLICY "Users can insert own data"
  ON {{table_name}} FOR INSERT
  WITH CHECK (auth.uid() = {{field_name}});

-- 4. UPDATE: 用戶只能更新自己的資料
CREATE POLICY "Users can update own data"
  ON {{table_name}} FOR UPDATE
  USING (auth.uid() = {{field_name}})
  WITH CHECK (auth.uid() = {{field_name}});

-- 5. DELETE: 用戶只能刪除自己的資料
CREATE POLICY "Users can delete own data"
  ON {{table_name}} FOR DELETE
  USING (auth.uid() = {{field_name}});

【注意】請在專案設定中填入 {{table_name}} 和 {{field_name}}，系統會自動替換。`,
          verify: `-- 驗證 policies 已正確建立
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = '{{table_name}}';

-- 應該看到 4 個 policies (SELECT, INSERT, UPDATE, DELETE)`
        }
      },
      {
        id: "p1-3",
        title: "3. 解決 Infinite Recursion 錯誤",
        description: "當 policy 中查詢同一張表格時會發生無限遞迴",
        keywords: ["infinite", "recursion", "loop", "function"],
        prompts: {
          diagnostic: `-- 錯誤訊息：
-- "infinite recursion detected in policy for relation"

-- 常見錯誤原因：policy 中查詢同一張表格
-- 例如：
CREATE POLICY "Admins can view all" ON profiles
FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  -- ❌ 這會造成 infinite recursion！
);`,
          fix: `-- 正確做法：使用 SECURITY DEFINER 函數

-- 1. 建立 security definer 函數
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = user_id
$$;

-- 2. 在 policy 中使用函數
CREATE POLICY "Admins can view all" ON profiles
FOR SELECT USING (
  public.get_user_role(auth.uid()) = 'admin'
);

-- 或使用更通用的 has_role 函數
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = _user_id AND role = _role
  )
$$;`,
          verify: `-- 測試函數是否正常運作
SELECT public.get_user_role(auth.uid());
SELECT public.has_role(auth.uid(), 'admin');

-- 測試 policy 是否生效（不應出現 recursion 錯誤）
SELECT * FROM profiles LIMIT 1;`
        }
      },
      {
        id: "p1-4",
        title: "4. 使用 service_role 繞過測試",
        description: "暫時使用 service_role key 繞過 RLS，確認問題確實出在 RLS",
        keywords: ["service", "role", "bypass", "admin"],
        prompts: {
          diagnostic: `// 使用 service_role key 建立 admin client（僅用於測試！）
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 注意：這會繞過所有 RLS
);

// 測試查詢
const { data, error } = await supabaseAdmin.from('your_table').select('*');
console.log('Admin query result:', data);

// 如果這樣能取得資料，確認問題在 RLS`,
          fix: `// ⚠️ service_role 只應在後端使用，永遠不要暴露到前端

// 正確做法：在 API route 或 Edge Function 中使用
// pages/api/admin-query.ts 或 app/api/admin-query/route.ts

import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data } = await supabase.from('your_table').select('*');
  return Response.json(data);
}`,
          verify: `// 確認問題根源
// 1. anon key 查詢失敗 → RLS 阻擋
// 2. service_role 查詢成功 → 資料存在，問題在 RLS 設定
// 3. service_role 也失敗 → 問題不在 RLS（可能是表格不存在或其他錯誤）`
        }
      }
    ]
  },
  {
    id: 2,
    title: "Supabase Storage 圖片串接",
    shortTitle: "Storage 串接",
    purpose: "圖片無法上傳、無法顯示、或存取權限問題。包含 bucket 設定與 RLS policies。",
    badge: "critical",
    category: "supabase",
    keywords: ["storage", "bucket", "image", "upload", "file", "public"],
    checklist: [
      { id: "2-1", label: "確認 bucket 已建立", completed: false },
      { id: "2-2", label: "檢查 bucket 是否為 public", completed: false },
      { id: "2-3", label: "設定 Storage RLS policies", completed: false },
      { id: "2-4", label: "確認上傳路徑正確（支援專案檔案直接介接）", completed: false },
      { id: "2-5", label: "測試圖片 URL 可存取", completed: false },
      { id: "2-6", label: "檢查照片導入分類建構", completed: false },
      { id: "2-7", label: "檢查會員資料轉移（建構、名稱、欄位）", completed: false },
    ],
    prompts: [
      {
        id: "p2-1",
        title: "1. 建立 Storage Bucket",
        description: "使用 SQL 建立儲存空間，設定公開或私有存取",
        keywords: ["bucket", "create", "public", "private"],
        prompts: {
          diagnostic: `-- 檢查現有的 buckets
SELECT id, name, public, created_at
FROM storage.buckets;

-- 檢查特定 bucket 的檔案
SELECT name, bucket_id, created_at
FROM storage.objects
WHERE bucket_id = '{{bucket_name}}'
LIMIT 10;`,
          fix: `-- 建立公開的 bucket（任何人可讀取）
INSERT INTO storage.buckets (id, name, public)
VALUES ('{{bucket_name}}', '{{bucket_name}}', true)
ON CONFLICT (id) DO NOTHING;

-- 建立私有的 bucket（需要認證才能讀取）
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('documents', 'documents', false)
-- ON CONFLICT (id) DO NOTHING;

-- 如果需要更新現有 bucket 為公開
UPDATE storage.buckets 
SET public = true 
WHERE id = '{{bucket_name}}';`,
          verify: `-- 確認 bucket 已建立且設定正確
SELECT id, name, public 
FROM storage.buckets 
WHERE id = '{{bucket_name}}';

-- 預期結果：
-- id: {{bucket_name}}, name: {{bucket_name}}, public: true`
        }
      },
      {
        id: "p2-2",
        title: "2. 設定 Storage RLS Policies",
        description: "控制誰可以上傳、讀取、刪除檔案",
        keywords: ["rls", "policy", "upload", "download"],
        prompts: {
          diagnostic: `-- 檢查 storage.objects 的現有 policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';`,
          fix: `-- 允許已登入用戶上傳檔案到自己的資料夾
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = '{{bucket_name}}' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 允許任何人讀取公開 bucket 的檔案
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = '{{bucket_name}}');

-- 允許用戶刪除自己的檔案
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = '{{bucket_name}}' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 允許用戶更新自己的檔案
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = '{{bucket_name}}' AND
  (storage.foldername(name))[1] = auth.uid()::text
);`,
          verify: `-- 驗證 policies 已建立
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- 應該看到 INSERT, SELECT, DELETE, UPDATE policies`
        }
      },
      {
        id: "p2-3",
        title: "3. 上傳檔案與取得 URL",
        description: "正確的檔案上傳流程與 URL 生成，支援專案檔案直接介接",
        keywords: ["upload", "url", "getPublicUrl", "signedUrl", "project", "file"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查 Storage 上傳問題

請自動執行以下檢查：

1. 檢查 bucket 是否存在：
   在 Supabase SQL Editor 執行：
   SELECT id, name, public FROM storage.buckets WHERE id = '{{bucket_name}}';

2. 檢查 Storage RLS policies：
   在 Supabase SQL Editor 執行：
   SELECT policyname, cmd FROM pg_policies 
   WHERE tablename = 'objects' AND schemaname = 'storage' 
   AND policyname LIKE '%{{bucket_name}}%';

3. 檢查專案檔案結構（判斷前端或後端）：
   - 檢查專案根目錄是否有 package.json
   - 檢查是否有 src/ 或 components/ 目錄（前端）
   - 檢查是否有 server/ 或 api/ 目錄（後端）
   - 檢查 public/ 或 assets/ 目錄中的圖片檔案

4. 常見錯誤分析：
   - "Bucket not found" → bucket 不存在，需要建立
   - "new row violates RLS" → Storage policy 問題，需要設定 RLS
   - "The resource already exists" → 檔案已存在，可設定 upsert: true`,
          fix: `【Cursor 自動化指令】自動實作完整的檔案上傳流程（支援專案檔案直接介接）

請自動建立以下上傳功能：

// 1. 判斷專案類型（前端或後端）
const detectProjectType = () => {
  // 檢查是否有前端框架標記（瀏覽器環境）
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const hasFrontendFramework = 
    isBrowser ||
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    (isBrowser && (
      document.querySelector('script[src*="react"]') ||
      document.querySelector('script[src*="vue"]') ||
      document.querySelector('script[src*="angular"]')
    ));
  
  // 檢查是否有後端標記（Node.js 環境）
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  const hasBackendFramework = 
    isNode ||
    (typeof require !== 'undefined' && typeof module !== 'undefined') ||
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'server');
  
  return {
    isFrontend: hasFrontendFramework && !hasBackendFramework,
    isBackend: hasBackendFramework,
    isBrowser,
    isNode
  };
};

// 2. 上傳檔案（直接介接專案檔案路徑）
const handleFileUpload = async (
  file: File | string, // 支援 File 物件或檔案路徑字串
  bucketName: string = '{{bucket_name}}',
  projectPath?: string // 專案內的相對路徑
) => {
  // 確保用戶已登入（如果需要）
  const { data: { user } } = await supabase.auth.getUser();
  
  // 判斷是檔案物件還是路徑字串
  let fileToUpload: File;
  let fileName: string;
  
  if (typeof file === 'string') {
    // 如果是路徑字串，需要從專案中讀取檔案
    // 前端：使用 fetch 讀取 public 目錄的檔案
    // 後端：使用 fs 讀取檔案系統
    const projectType = detectProjectType();
    
    if (projectType.isFrontend || projectType.isBrowser) {
      // 前端：從 public 目錄讀取
      try {
        const response = await fetch(file);
        if (!response.ok) {
          throw new Error(\`Failed to fetch file: \${file} (Status: \${response.status})\`);
        }
        const blob = await response.blob();
        const fileNameFromPath = file.split('/').pop() || file.split('\\\\').pop() || 'file';
        fileToUpload = new File([blob], fileNameFromPath, { type: blob.type });
        fileName = projectPath || file.replace(/^/?public//, '').replace(/^/+/g, '');
      } catch (error) {
        console.error('Failed to read file from path:', file, error);
        throw new Error(\`無法讀取檔案: \${file}\`);
      }
    } else if (projectType.isBackend || projectType.isNode) {
      // 後端：使用 Node.js fs（需要在後端環境執行）
      try {
        const fs = require('fs');
        const path = require('path');
        const mimeTypes = require('mime-types');
        
        // 檢查檔案是否存在
        if (!fs.existsSync(file)) {
          throw new Error(\`檔案不存在: \${file}\`);
        }
        
        const fileBuffer = fs.readFileSync(file);
        const fileStats = fs.statSync(file);
        const mimeType = mimeTypes.lookup(file) || 'application/octet-stream';
        const baseName = path.basename(file);
        
        // 在 Node.js 環境中，使用 Blob 或直接使用 Buffer
        // Supabase Storage 接受 Blob、File、ArrayBuffer 或 Buffer
        if (typeof Blob !== 'undefined') {
          fileToUpload = new File([fileBuffer], baseName, { type: mimeType });
        } else {
          // 如果 File API 不可用，使用 Blob
          fileToUpload = new Blob([fileBuffer], { type: mimeType }) as any;
        }
        
        fileName = projectPath || path.relative(process.cwd(), file).replace(/\\\\/g, '/');
      } catch (error) {
        console.error('Failed to read file from filesystem:', file, error);
        throw new Error(\`無法讀取檔案系統檔案: \${file}\`);
      }
    } else {
      throw new Error('無法判斷專案類型，請明確指定檔案路徑或使用 File 物件');
    }
  } else {
    // 已經是 File 物件
    fileToUpload = file;
    const fileExt = file.name.split('.').pop();
    fileName = projectPath || (user 
      ? \`\${user.id}/\${Date.now()}.\${fileExt}\`
      : \`uploads/\${Date.now()}.\${fileExt}\`);
  }

  // 上傳檔案
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(fileName, fileToUpload, {
      cacheControl: '3600',
      upsert: true  // 允許覆蓋同名檔案
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw uploadError;
  }

  // 2. 取得公開 URL（適用於 public bucket）
  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  // 3. 或取得簽名 URL（適用於 private bucket，有時效性）
  // const { data: signedData } = await supabase.storage
  //   .from(bucketName)
  //   .createSignedUrl(fileName, 3600); // 1 小時有效

  return { publicUrl, path: fileName };
};

// 使用範例：
// 1. 上傳檔案物件
const uploadAvatar = async (file: File) => {
  try {
    const { publicUrl } = await handleFileUpload(file, '{{bucket_name}}');
    // 更新用戶資料
    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);
    return publicUrl;
  } catch (error) {
    console.error('Failed to upload:', error);
  }
};

// 2. 直接介接專案檔案
const uploadProjectFile = async (filePath: string, category?: string) => {
  try {
    // 如果有分類，加入分類路徑
    const projectPath = category ? \`\${category}/\${filePath.split('/').pop()}\` : undefined;
    const { publicUrl } = await handleFileUpload(filePath, '{{bucket_name}}', projectPath);
    return publicUrl;
  } catch (error) {
    console.error('Failed to upload project file:', error);
  }
};`,
          verify: `【Cursor 自動化指令】驗證檔案上傳功能

請自動執行以下驗證：

1. 檢查 Storage 中是否有上傳的檔案：
   在 Supabase SQL Editor 執行：
   SELECT name, bucket_id, created_at 
   FROM storage.objects 
   WHERE bucket_id = '{{bucket_name}}' 
   ORDER BY created_at DESC 
   LIMIT 10;

2. 測試檔案 URL 存取性：
   - 取得最近上傳的檔案 URL
   - 使用 Supabase Storage API 檢查檔案是否存在
   - 驗證公開 URL 格式正確

3. 檢查上傳函數是否已建立：
   - 檢查專案中是否有 handleFileUpload 或類似函數
   - 確認函數支援專案檔案路徑介接
   - 確認函數支援分類路徑結構

4. 驗證結果：
   - 如果 Storage 中有檔案且 URL 可存取 → ✓ 上傳功能正常
   - 如果 Storage 中沒有檔案 → ✗ 需要檢查上傳函數或 RLS policy
   - 如果 URL 無法存取 → ✗ 檢查 bucket 是否為 public`
        }
      },
      {
        id: "p2-4",
        title: "4. 圖片無法顯示問題排查",
        description: "Debug 圖片載入失敗的常見原因",
        keywords: ["display", "broken", "cors", "403"],
        prompts: {
          diagnostic: `// 常見圖片無法顯示的原因：

// 1. Bucket 不是 public
// 檢查方式：
SELECT public FROM storage.buckets WHERE id = '{{bucket_name}}';

// 2. URL 格式錯誤
// 正確格式：
// https://[project-ref].supabase.co/storage/v1/object/public/[bucket]/[path]

// 3. 檔案路徑錯誤
// 檢查檔案是否存在：
SELECT name FROM storage.objects 
WHERE bucket_id = '{{bucket_name}}' AND name LIKE '%filename%';

// 4. CORS 問題（較少見，Supabase 預設處理）`,
          fix: `// 修正常見問題

// 1. 確保 bucket 是 public
UPDATE storage.buckets SET public = true WHERE id = '{{bucket_name}}';

// 2. 使用正確的 URL 生成方式
const { data: { publicUrl } } = supabase.storage
  .from('{{bucket_name}}')
  .getPublicUrl('path/to/image.png');

// 不要手動拼接 URL！

// 3. 圖片元件加入錯誤處理
<img 
  src={imageUrl} 
  alt="User avatar"
  onError={(e) => {
    console.error('Image load failed:', imageUrl);
    e.currentTarget.src = '/fallback-image.png';
  }}
/>`,
          verify: `【Cursor 自動化指令】驗證圖片顯示功能

請自動執行以下驗證：

1. 檢查最近上傳的圖片檔案：
   在 Supabase SQL Editor 執行：
   SELECT name, bucket_id, created_at 
   FROM storage.objects 
   WHERE bucket_id = '{{bucket_name}}' 
   ORDER BY created_at DESC 
   LIMIT 5;

2. 取得測試圖片的公開 URL：
   使用 Supabase Storage API 的 getPublicUrl 方法取得最近上傳圖片的 URL

3. 驗證 URL 格式正確：
   確認 URL 格式為：https://[project-ref].supabase.co/storage/v1/object/public/[bucket]/[path]

4. 檢查 bucket 是否為 public：
   在 Supabase SQL Editor 執行：
   SELECT id, name, public 
   FROM storage.buckets 
   WHERE id = '{{bucket_name}}';

驗證結果：
- 如果 bucket 的 public = true → ✓ 公開存取已啟用
- 如果 Storage 中有圖片檔案 → ✓ 檔案已上傳
- 如果 URL 格式正確 → ✓ URL 生成正常`
        }
      },
      {
        id: "p2-5",
        title: "5. 照片導入檢查與分類建構",
        description: "檢查專案內照片導入流程，包含分類系統的建構",
        keywords: ["import", "photo", "image", "category", "classification"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查照片導入相關設定

請自動執行以下檢查：

1. 檢查專案內照片檔案結構：
   - 檢查專案根目錄是否有 public/ 目錄（前端）
   - 檢查專案根目錄是否有 assets/ 或 static/ 目錄
   - 列出 public/ 或 assets/ 目錄中的所有圖片檔案（.jpg, .png, .gif 等）

2. 檢查照片分類表是否存在：
   在 Supabase SQL Editor 執行：
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'photo_categories';

3. 如果分類表存在，檢查分類資料：
   在 Supabase SQL Editor 執行：
   SELECT id, name, slug, display_order, created_at
   FROM photo_categories
   ORDER BY display_order;

4. 檢查 photos 資料表是否存在：
   在 Supabase SQL Editor 執行：
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'photos';

5. 檢查 Storage 中的照片分類結構：
   在 Supabase SQL Editor 執行：
   SELECT 
     (storage.foldername(name))[1] as category_folder,
     COUNT(*) as file_count,
     MIN(created_at) as first_upload,
     MAX(created_at) as last_upload
   FROM storage.objects
   WHERE bucket_id = '{{bucket_name}}'
   GROUP BY category_folder
   ORDER BY category_folder;`,
          fix: `【Cursor 自動化指令】自動建立照片導入與分類系統

// 1. 建立照片分類資料表
CREATE TABLE IF NOT EXISTS public.photo_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES photo_categories(id),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 建立預設分類
INSERT INTO photo_categories (name, slug, display_order) VALUES
  ('產品照片', 'products', 1),
  ('活動照片', 'events', 2),
  ('團隊照片', 'team', 3),
  ('其他', 'others', 99)
ON CONFLICT (slug) DO NOTHING;

// 2. 建立照片資料表（與 Storage 關聯）
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  category_id UUID REFERENCES photo_categories(id),
  
  -- Storage 資訊
  storage_path TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  bucket_name TEXT DEFAULT '{{bucket_name}}',
  
  -- 照片資訊
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  
  -- 分類與標籤
  tags TEXT[] DEFAULT '{}',
  
  -- 時間戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 建立索引
CREATE INDEX idx_photos_category ON photos(category_id);
CREATE INDEX idx_photos_user ON photos(user_id);
CREATE INDEX idx_photos_tags ON photos USING GIN(tags);
CREATE INDEX idx_photos_created ON photos(created_at DESC);

-- 啟用 RLS
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all photos"
  ON photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own photos"
  ON photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

// 3. 照片導入函數（包含分類建構）
const importPhotosWithCategory = async (
  files: File[] | string[], // 檔案陣列或路徑陣列
  categorySlug: string, // 分類 slug
  bucketName: string = '{{bucket_name}}'
) => {
  // 1. 取得或建立分類
  let { data: category, error: categoryError } = await supabase
    .from('photo_categories')
    .select('id, name, slug')
    .eq('slug', categorySlug)
    .single();

  if (categoryError || !category) {
    // 如果分類不存在，建立新分類
    const categoryName = categorySlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    const { data: newCategory, error: createError } = await supabase
      .from('photo_categories')
      .insert({
        name: categoryName,
        slug: categorySlug
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Failed to create category:', createError);
      throw createError;
    }
    category = newCategory;
  }

  // 2. 取得當前用戶
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // 3. 將路徑字串轉換為 File 物件（如果需要）
  const filePromises = files.map(async (file) => {
    if (typeof file === 'string') {
      // 使用 handleFileUpload 的邏輯來讀取檔案
      const projectType = detectProjectType();
      
      if (projectType.isFrontend || projectType.isBrowser) {
        const response = await fetch(file);
        const blob = await response.blob();
        return new File([blob], file.split('/').pop() || 'file', { type: blob.type });
      } else {
        const fs = require('fs');
        const path = require('path');
        const mimeTypes = require('mime-types');
        const fileBuffer = fs.readFileSync(file);
        const mimeType = mimeTypes.lookup(file) || 'application/octet-stream';
        return new File([fileBuffer], path.basename(file), { type: mimeType });
      }
    }
    return file;
  });

  const fileObjects = await Promise.all(filePromises);

  // 4. 批量上傳照片
  const uploadPromises = fileObjects.map(async (file, index) => {
    try {
      // 取得檔案副檔名
      const fileExt = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      
      // 上傳到 Storage（使用分類作為路徑）
      const fileName = \`\${categorySlug}/\${timestamp}-\${randomSuffix}-\${index}.\${fileExt}\`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error(\`Upload failed for file \${index} (\${file.name}):\`, uploadError);
        return { success: false, error: uploadError, file: file.name };
      }

      // 取得公開 URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      // 建立照片記錄
      const { data: photoData, error: photoError } = await supabase
        .from('photos')
        .insert({
          user_id: user.id,
          category_id: category.id,
          storage_path: fileName,
          storage_url: publicUrl,
          bucket_name: bucketName,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type
        })
        .select()
        .single();

      if (photoError) {
        console.error(\`Photo record creation failed for file \${index} (\${file.name}):\`, photoError);
        // 嘗試刪除已上傳的檔案
        await supabase.storage.from(bucketName).remove([fileName]);
        return { success: false, error: photoError, file: file.name };
      }

      return { success: true, data: photoData, file: file.name };
    } catch (error) {
      console.error(\`Error processing file \${index}:\`, error);
      return { success: false, error, file: typeof file === 'string' ? file : file.name };
    }
  });

  const results = await Promise.all(uploadPromises);
  
  // 統計結果
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(\`照片導入完成: 成功 \${successful.length} 筆, 失敗 \${failed.length} 筆\`);
  if (failed.length > 0) {
    console.error('失敗的檔案:', failed.map(f => ({ file: f.file, error: f.error })));
  }
  
  return {
    successful: successful.map(r => r.data),
    failed,
    total: results.length,
    successCount: successful.length,
    failCount: failed.length
  };
};

// 使用範例：
// 導入產品照片（從專案檔案路徑）
const productPhotosResult = await importPhotosWithCategory(
  ['/public/images/product1.jpg', '/public/images/product2.jpg'],
  'products'
);
console.log('導入結果:', productPhotosResult);
// 結果格式: { successful: [...], failed: [...], total: 2, successCount: 2, failCount: 0 }

// 導入活動照片（從 File 物件陣列）
const eventPhotosResult = await importPhotosWithCategory(
  [file1, file2, file3], // File 物件陣列
  'events'
);
console.log('成功導入:', eventPhotosResult.successful.length, '張照片');

// 混合使用（路徑和 File 物件）
const mixedPhotosResult = await importPhotosWithCategory(
  [
    '/public/images/banner.jpg', // 路徑字串
    fileObject, // File 物件
    './assets/logo.png' // 後端路徑
  ],
  'mixed'
);`,
          verify: `【Cursor 自動化指令】驗證照片導入與分類建構

請自動執行以下驗證檢查：

1. 檢查照片分類表是否建立：
   在 Supabase SQL Editor 執行：
   SELECT id, name, slug, display_order 
   FROM photo_categories 
   ORDER BY display_order;

2. 檢查各分類的照片數量：
   在 Supabase SQL Editor 執行：
   SELECT 
     pc.name as category_name,
     pc.slug as category_slug,
     COUNT(p.id) as photo_count
   FROM photo_categories pc
   LEFT JOIN photos p ON p.category_id = pc.id
   GROUP BY pc.id, pc.name, pc.slug
   ORDER BY photo_count DESC;

3. 檢查 photos 資料表是否建立：
   在 Supabase SQL Editor 執行：
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'photos' AND table_schema = 'public'
   ORDER BY ordinal_position;

4. 檢查 Storage 中的分類資料夾結構：
   在 Supabase SQL Editor 執行：
   SELECT 
     (storage.foldername(name))[1] as category_folder,
     COUNT(*) as file_count
   FROM storage.objects
   WHERE bucket_id = '{{bucket_name}}'
   GROUP BY category_folder
   ORDER BY category_folder;

5. 檢查照片資料完整性：
   在 Supabase SQL Editor 執行：
   SELECT 
     COUNT(*) as total_photos,
     COUNT(CASE WHEN storage_url IS NOT NULL THEN 1 END) as with_url,
     COUNT(CASE WHEN category_id IS NOT NULL THEN 1 END) as with_category,
     COUNT(CASE WHEN storage_url IS NULL OR category_id IS NULL THEN 1 END) as incomplete
   FROM photos;

驗證結果：
- 如果分類表存在且有分類 → ✓ 分類系統已建立
- 如果 photos 表存在且有資料 → ✓ 照片記錄已建立
- 如果 Storage 中有分類資料夾 → ✓ 檔案結構正確
- 如果所有照片都有 URL 和分類 → ✓ 資料完整性良好`
        }
      },
      {
        id: "p2-6",
        title: "6. 會員資料轉移檢查",
        description: "檢查會員資料的建構、成立名稱以及欄位等資訊的轉移",
        keywords: ["member", "user", "migration", "transfer", "schema", "field"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查會員資料轉移相關設定

請自動執行以下檢查：

1. 檢查現有會員資料表是否存在：
   在 Supabase SQL Editor 執行：
   SELECT table_name, table_schema
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND (table_name LIKE '%user%' OR table_name LIKE '%member%' OR table_name LIKE '%profile%')
   ORDER BY table_name;

2. 如果 members 表存在，檢查表結構：
   在 Supabase SQL Editor 執行：
   SELECT 
     column_name,
     data_type,
     is_nullable,
     column_default
   FROM information_schema.columns
   WHERE table_name = 'members' AND table_schema = 'public'
   ORDER BY ordinal_position;

3. 檢查會員資料數量與完整性：
   在 Supabase SQL Editor 執行：
   SELECT 
     COUNT(*) as total_members,
     COUNT(email) as members_with_email,
     COUNT(display_name) as members_with_display_name,
     COUNT(full_name) as members_with_full_name,
     COUNT(phone) as members_with_phone,
     COUNT(organization_name) as members_with_organization,
     COUNT(created_at) as members_with_timestamp
   FROM members;

4. 檢查 RLS 政策是否設定：
   在 Supabase SQL Editor 執行：
   SELECT policyname, cmd, qual
   FROM pg_policies
   WHERE tablename = 'members' AND schemaname = 'public';

5. 檢查欄位對應關係（如果需要從舊系統轉移）：
   - 檢查專案中是否有舊的會員資料來源（CSV、JSON、或其他資料表）
   - 對比舊資料結構與新 members 表的欄位對應關係`,
          fix: `【Cursor 自動化指令】自動建立會員資料轉移系統

// 1. 建立完整的會員資料表（包含所有必要欄位）
CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- 基本資訊
  email TEXT,
  display_name TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  
  -- 組織資訊
  organization_name TEXT, -- 成立名稱/公司名稱
  organization_type TEXT, -- 'company', 'individual', 'nonprofit', etc.
  organization_id TEXT, -- 統一編號/組織代碼
  
  -- 地址資訊
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'TW',
  
  -- 狀態與權限
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member', 'guest', 'moderator')),
  is_verified BOOLEAN DEFAULT false,
  
  -- 偏好設定
  language TEXT DEFAULT 'zh-TW',
  timezone TEXT DEFAULT 'Asia/Taipei',
  notification_preferences JSONB DEFAULT '{}',
  
  -- 時間戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ
);

-- 建立索引
CREATE INDEX idx_members_user_id ON members(user_id);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_organization ON members(organization_name);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_role ON members(role);
CREATE INDEX idx_members_created ON members(created_at DESC);

-- 建立更新時間觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 啟用 RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- RLS 政策
CREATE POLICY "Users can view own member data"
  ON members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own member data"
  ON members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own member data"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 管理員可以查看所有會員
CREATE POLICY "Admins can view all members"
  ON members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

// 2. 自動建立會員資料的觸發器（當用戶註冊時）
CREATE OR REPLACE FUNCTION public.handle_new_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.members (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.email
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_member ON auth.users;
CREATE TRIGGER on_auth_user_created_member
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_member();

// 3. 會員資料轉移函數（從舊系統或 CSV 導入）
const transferMemberData = async (
  memberData: Array<{
    email: string;
    display_name?: string;
    full_name?: string;
    phone?: string;
    organization_name?: string;
    organization_type?: string;
    organization_id?: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    status?: string;
    role?: string;
    language?: string;
    timezone?: string;
    // ... 其他欄位
  }>,
  options: {
    skipExisting?: boolean; // 跳過已存在的用戶
    updateExisting?: boolean; // 更新已存在的用戶
    batchSize?: number; // 批次處理大小
  } = {}
) => {
  const {
    skipExisting = false,
    updateExisting = true,
    batchSize = 10
  } = options;

  const results = {
    successful: [] as any[],
    failed: [] as Array<{ email: string; error: any }>,
    skipped: [] as string[]
  };

  // 批次處理
  for (let i = 0; i < memberData.length; i += batchSize) {
    const batch = memberData.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (data) => {
      try {
        // 驗證必要欄位
        if (!data.email || !data.email.includes('@')) {
          throw new Error('無效的 email 格式');
        }

        // 1. 檢查用戶是否已存在
        let { data: existingUser, error: userCheckError } = await supabase.auth.admin.getUserByEmail(data.email);
        
        if (userCheckError && userCheckError.message !== 'User not found') {
          throw new Error(\`檢查用戶時發生錯誤: \${userCheckError.message}\`);
        }
        
        let userId: string;
        
        if (!existingUser?.user) {
          // 2. 如果用戶不存在，建立新用戶
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: data.email,
            email_confirm: true,
            user_metadata: {
              display_name: data.display_name || data.full_name || data.email.split('@')[0],
              full_name: data.full_name,
              organization_name: data.organization_name
            }
          });
          
          if (createError) {
            throw new Error(\`建立用戶失敗: \${createError.message}\`);
          }
          
          userId = newUser.user.id;
        } else {
          userId = existingUser.user.id;
          
          // 如果設定跳過已存在的用戶
          if (skipExisting) {
            results.skipped.push(data.email);
            return { success: false, skipped: true, email: data.email };
          }
        }

        // 3. 更新或建立會員資料
        const memberDataToUpsert: any = {
          user_id: userId,
          email: data.email,
          display_name: data.display_name || data.full_name || data.email.split('@')[0],
          full_name: data.full_name,
          phone: data.phone,
          organization_name: data.organization_name,
          organization_type: data.organization_type,
          organization_id: data.organization_id,
          address: data.address,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
          country: data.country || 'TW',
          status: data.status || 'active',
          role: data.role || 'member',
          language: data.language || 'zh-TW',
          timezone: data.timezone || 'Asia/Taipei'
        };

        // 移除 undefined 值
        Object.keys(memberDataToUpsert).forEach(key => {
          if (memberDataToUpsert[key] === undefined) {
            delete memberDataToUpsert[key];
          }
        });

        const { data: member, error: memberError } = await supabase
          .from('members')
          .upsert(memberDataToUpsert, {
            onConflict: 'user_id'
          })
          .select()
          .single();

        if (memberError) {
          throw new Error(\`轉移會員資料失敗: \${memberError.message}\`);
        }

        return { success: true, data: member, email: data.email };
      } catch (error: any) {
        console.error(\`處理會員資料時發生錯誤 (\${data.email}):\`, error);
        return { 
          success: false, 
          error: error.message || error, 
          email: data.email 
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(result => {
      if (result.success) {
        results.successful.push(result.data);
      } else if (result.skipped) {
        // 已在上面處理
      } else {
        results.failed.push({
          email: result.email,
          error: result.error
        });
      }
    });

    // 顯示進度
    console.log(\`進度: \${Math.min(i + batchSize, memberData.length)} / \${memberData.length}\`);
  }

  // 顯示統計
  console.log(\`會員資料轉移完成:\`);
  console.log(\`  成功: \${results.successful.length} 筆\`);
  console.log(\`  失敗: \${results.failed.length} 筆\`);
  console.log(\`  跳過: \${results.skipped.length} 筆\`);
  
  if (results.failed.length > 0) {
    console.error('失敗的會員:', results.failed);
  }

  return results;
};

// 使用範例：
// 從 CSV 或舊系統導入會員資料
const memberData = [
  {
    email: 'user1@example.com',
    display_name: '使用者一',
    full_name: '使用者一',
    phone: '0912345678',
    organization_name: '測試公司',
    organization_type: 'company',
    organization_id: '12345678',
    address: '台北市信義區',
    city: '台北市',
    state: '台灣',
    postal_code: '110',
    country: 'TW'
  },
  {
    email: 'user2@example.com',
    display_name: '使用者二',
    full_name: '使用者二',
    organization_name: '另一家公司',
    organization_type: 'company'
  },
  // ... 更多會員資料
];

// 基本使用（更新已存在的用戶）
const result1 = await transferMemberData(memberData);
console.log('轉移結果:', result1);

// 跳過已存在的用戶
const result2 = await transferMemberData(memberData, {
  skipExisting: true,
  batchSize: 20 // 每批處理 20 筆
});

// 只新增，不更新已存在的用戶
const result3 = await transferMemberData(memberData, {
  skipExisting: true,
  updateExisting: false
});`,
          verify: `【Cursor 自動化指令】驗證會員資料轉移

請自動執行以下驗證檢查：

1. 檢查會員資料表結構：
   在 Supabase SQL Editor 執行：
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'members' AND table_schema = 'public'
   ORDER BY ordinal_position;

2. 檢查會員資料完整性：
   在 Supabase SQL Editor 執行：
   SELECT 
     COUNT(*) as total_members,
     COUNT(email) as with_email,
     COUNT(display_name) as with_display_name,
     COUNT(full_name) as with_full_name,
     COUNT(phone) as with_phone,
     COUNT(organization_name) as with_organization,
     COUNT(organization_id) as with_organization_id,
     COUNT(address) as with_address,
     COUNT(city) as with_city
   FROM members;

3. 檢查各欄位的填寫率百分比：
   在 Supabase SQL Editor 執行：
   SELECT 
     COUNT(*) as total,
     ROUND(COUNT(email) * 100.0 / COUNT(*), 1) as email_percentage,
     ROUND(COUNT(display_name) * 100.0 / COUNT(*), 1) as display_name_percentage,
     ROUND(COUNT(full_name) * 100.0 / COUNT(*), 1) as full_name_percentage,
     ROUND(COUNT(phone) * 100.0 / COUNT(*), 1) as phone_percentage,
     ROUND(COUNT(organization_name) * 100.0 / COUNT(*), 1) as organization_percentage
   FROM members;

4. 檢查組織資訊與統計：
   在 Supabase SQL Editor 執行：
   SELECT 
     organization_name,
     organization_type,
     COUNT(*) as member_count
   FROM members
   WHERE organization_name IS NOT NULL
   GROUP BY organization_name, organization_type
   ORDER BY member_count DESC;

5. 檢查資料品質（缺少必要欄位的記錄）：
   在 Supabase SQL Editor 執行：
   SELECT id, email, display_name, created_at
   FROM members
   WHERE email IS NULL OR display_name IS NULL
   LIMIT 10;

6. 檢查 RLS 政策是否正確設定：
   在 Supabase SQL Editor 執行：
   SELECT policyname, cmd, qual, with_check
   FROM pg_policies
   WHERE tablename = 'members' AND schemaname = 'public';

驗證結果判斷：
- 如果 members 表存在且有欄位定義 → ✓ 資料表結構正確
- 如果總會員數 > 0 → ✓ 資料已導入
- 如果 email 和 display_name 填寫率 > 90% → ✓ 資料品質良好
- 如果 RLS 政策存在且正確 → ✓ 安全性設定正確
- 如果有組織資料統計 → ✓ 組織資訊已導入`
        }
      }
    ]
  },
  {
    id: 3,
    title: "網站安全性檢查",
    shortTitle: "安全檢查",
    purpose: "確保網站設計符合安全最佳實踐，包含敏感資料保護、環境變數管理、輸入驗證等。",
    badge: "critical",
    category: "security",
    keywords: ["security", "pii", "sensitive", "validation", "xss", "injection"],
    checklist: [
      { id: "3-1", label: "敏感欄位使用 View 隱藏", completed: false },
      { id: "3-2", label: "環境變數正確分離 (public/private)", completed: false },
      { id: "3-3", label: "PII 資料有適當 RLS 保護", completed: false },
      { id: "3-4", label: "輸入驗證（前後端）", completed: false },
      { id: "3-5", label: "密碼/金鑰永不暴露於前端", completed: false },
      { id: "3-6", label: "Auth Redirect URL 已設定", completed: false },
    ],
    prompts: [
      {
        id: "p3-1",
        title: "1. 使用 View 隱藏敏感欄位",
        description: "建立 View 來排除密碼、API key 等敏感資料",
        keywords: ["view", "sensitive", "password", "hidden"],
        prompts: {
          diagnostic: `-- 檢查表格是否有敏感欄位
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public';

-- 敏感欄位範例：
-- password_hash, api_key, secret_token, ssn, credit_card...

-- ⚠️ 重要：即使有 RLS 限制存取的「行」
-- 用戶仍然可以讀取該行的「所有欄位」！`,
          fix: `-- 1. 建立排除敏感欄位的 View
CREATE VIEW public.users_public
WITH (security_invoker = on) AS
SELECT 
  id,
  email,
  display_name,
  avatar_url,
  created_at
  -- 排除: password_hash, api_key, secret_token
FROM public.users;

-- 2. 關鍵：基礎表格必須禁止直接 SELECT
CREATE POLICY "No direct access to users table"
ON public.users FOR SELECT
USING (false);  -- 禁止所有直接存取

-- 3. 在應用程式中只查詢 View
// ✓ 正確
const { data } = await supabase.from('users_public').select('*');

// ✗ 錯誤（應該被 RLS 阻擋）
const { data } = await supabase.from('users').select('*');`,
          verify: `-- 驗證 View 已建立且不包含敏感欄位
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users_public';

-- 測試直接存取基礎表格應該失敗
-- （使用 anon key，應回傳空陣列）
SELECT * FROM users LIMIT 1;

-- 測試 View 可以正常存取
SELECT * FROM users_public LIMIT 1;`
        }
      },
      {
        id: "p3-2",
        title: "2. 環境變數安全分離",
        description: "確保私密金鑰不會暴露到前端",
        keywords: ["env", "environment", "secret", "public"],
        prompts: {
          diagnostic: `# 環境變數規則：

# ✓ 前端可用（會打包進 bundle）
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...

# ✗ 僅後端（永遠不該在前端出現）
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=...
DATABASE_URL=...
JWT_SECRET=...

# 檢查前端 bundle 是否洩漏
# 在瀏覽器 DevTools > Sources 搜尋：
# - "service_role"
# - "secret"
# - 你的私密金鑰值`,
          fix: `// 正確的環境變數使用方式

// ✓ 前端可以使用
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ✗ 前端絕對不能使用
// const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 需要使用私密金鑰的操作，必須在後端執行
// 例如：API Route 或 Edge Function

// pages/api/admin-action.ts
export default async function handler(req, res) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // 只在後端使用
  );
  
  // 執行需要 admin 權限的操作...
}`,
          verify: `// 驗證私密金鑰未暴露

// 1. 檢查 .env.local 設定
cat .env.local | grep -v "^#" | grep -v "^$"

// 2. 確認私密金鑰不在前端程式碼中
grep -r "SERVICE_ROLE" src/
grep -r "SECRET_KEY" src/

// 3. 建置後檢查 bundle
npm run build
grep -r "your_secret_key_value" .next/`
        }
      },
      {
        id: "p3-3",
        title: "3. 輸入驗證與消毒",
        description: "防止 SQL Injection、XSS 等攻擊",
        keywords: ["validation", "sanitize", "xss", "injection", "zod"],
        prompts: {
          diagnostic: `// 檢查是否有未驗證的輸入

// ❌ 危險：直接使用用戶輸入
const { name } = req.body;
await supabase.from('users').insert({ name });

// ❌ 危險：直接渲染 HTML
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ❌ 危險：未驗證的 URL
window.location.href = req.query.redirect;`,
          fix: `// 使用 Zod 進行輸入驗證

import { z } from 'zod';

// 定義 schema
const contactSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "名稱不能為空")
    .max(100, "名稱最多 100 字元"),
  email: z.string()
    .trim()
    .email("請輸入有效的 Email")
    .max(255),
  message: z.string()
    .trim()
    .min(1, "訊息不能為空")
    .max(1000, "訊息最多 1000 字元"),
});

// 驗證輸入
const result = contactSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ 
    error: result.error.flatten() 
  });
}

// 使用驗證後的資料
const { name, email, message } = result.data;

// URL 參數使用 encodeURIComponent
const safeUrl = \`https://api.example.com?q=\${encodeURIComponent(userInput)}\`;`,
          verify: `// 驗證 checklist

// 1. 所有表單都使用 schema 驗證
// 2. 後端 API 也有驗證（不只依賴前端）
// 3. 不使用 dangerouslySetInnerHTML
// 4. URL redirect 使用白名單驗證

// 測試 XSS 防護
const maliciousInput = '<script>alert("xss")</script>';
// 應該被 escape 或拒絕`
        }
      },
      {
        id: "p3-4",
        title: "4. Auth Redirect URL 設定",
        description: "解決登入後 redirect 錯誤的問題",
        keywords: ["auth", "redirect", "url", "callback", "login"],
        prompts: {
          diagnostic: `// 常見錯誤：
// 1. "requested path is invalid"
// 2. 登入後跳轉到 localhost:3000
// 3. OAuth callback 失敗

// 這些通常是因為 Supabase 的 URL 設定問題`,
          fix: `// 在 Supabase Dashboard 設定：
// Authentication > URL Configuration

// 1. Site URL（主要網站 URL）
// 設定為你的正式網址：
https://your-app.vercel.app

// 2. Redirect URLs（允許的 redirect 目標）
// 加入所有需要的 URL：
https://your-app.vercel.app/**
https://your-preview-url.lovable.app/**
http://localhost:3000/**  // 開發用

// 3. 在程式碼中使用正確的 redirect
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: \`\${window.location.origin}/auth/callback\`
  }
});`,
          verify: `// 驗證 redirect 設定

// 1. 檢查 Supabase Dashboard 設定
// Authentication > URL Configuration

// 2. 測試登入流程
// - 使用 email/password 登入
// - 使用 OAuth 登入
// - 確認 redirect 正確

// 3. 檢查 console 無錯誤
console.log('Current origin:', window.location.origin);`
        }
      }
    ]
  },
  {
    id: 4,
    title: "SQL Migration 問題",
    shortTitle: "DB Migration",
    purpose: "執行 supabase db push 時發生錯誤，可能是 SQL 語法錯誤、重複定義、或外鍵約束問題。",
    badge: "common",
    category: "supabase",
    keywords: ["migration", "db", "push", "sql", "schema", "foreign"],
    checklist: [
      { id: "4-1", label: "檢查 SQL 語法", completed: false },
      { id: "4-2", label: "確認表格/欄位不重複", completed: false },
      { id: "4-3", label: "檢查外鍵參照順序", completed: false },
      { id: "4-4", label: "測試本地 db reset", completed: false },
    ],
    prompts: [
      {
        id: "p4-1",
        title: "1. 查看詳細錯誤訊息",
        description: "使用 debug 模式取得完整的錯誤資訊",
        keywords: ["debug", "error", "log", "verbose"],
        prompts: {
          diagnostic: `# 使用 debug 模式執行 db push
npx supabase db push --debug

# 常見錯誤訊息：
# "relation already exists" → 表格已存在
# "foreign key constraint" → 外鍵參照問題
# "syntax error" → SQL 語法錯誤
# "permission denied" → 權限問題

# 查看 migration 狀態
npx supabase migration list`,
          fix: `# 根據錯誤類型修正

# 1. "relation already exists"
# 修改 migration 使用 IF NOT EXISTS
CREATE TABLE IF NOT EXISTS your_table (...);

# 2. 重置並重新執行（開發環境）
npx supabase db reset

# 3. 修復特定 migration 後重新推送
npx supabase db push`,
          verify: `# 驗證 migration 成功
npx supabase migration list

# 檢查表格是否存在
npx supabase db execute --sql "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"`
        }
      },
      {
        id: "p4-2",
        title: "2. 外鍵約束錯誤",
        description: "確保參照的表格和欄位在建立外鍵時已存在",
        keywords: ["foreign", "key", "reference", "constraint"],
        prompts: {
          diagnostic: `-- 檢查外鍵參照是否有效
SELECT 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';`,
          fix: `-- 正確的外鍵建立順序

-- 1. 先建立被參照的表格
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL
);

-- 2. 再建立有外鍵的表格
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total DECIMAL(10,2)
);

-- 如果要修改現有表格，使用 ALTER TABLE
ALTER TABLE orders 
ADD CONSTRAINT fk_user 
FOREIGN KEY (user_id) REFERENCES users(id);`,
          verify: `-- 確認外鍵已正確建立
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'orders';`
        }
      },
      {
        id: "p4-3",
        title: "3. 類型生成與同步",
        description: "確保 TypeScript 類型與資料庫 schema 同步",
        keywords: ["types", "typescript", "generate", "sync"],
        prompts: {
          diagnostic: `# 檢查類型檔案是否過時
cat src/types/database.types.ts | head -20

# 類型錯誤通常表示 schema 已變更但類型未更新`,
          fix: `# 重新生成 TypeScript 類型

# 使用遠端資料庫
npx supabase gen types typescript --project-id {{supabase_ref}} > src/types/database.types.ts

# 或使用本地資料庫
npx supabase gen types typescript --local > src/types/database.types.ts

# 確保 Supabase client 使用類型
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);`,
          verify: `# 驗證類型正確
npx tsc --noEmit

# 應該沒有類型錯誤`
        }
      }
    ]
  },
  {
    id: 5,
    title: "n8n MCP 整合問題",
    shortTitle: "n8n 整合",
    purpose: "n8n 與 Lovable 的 MCP 連接問題，包含 workflow 不可見、觸發失敗等。",
    badge: "common",
    category: "n8n",
    keywords: ["n8n", "mcp", "workflow", "automation", "webhook"],
    checklist: [
      { id: "5-1", label: "啟用 n8n MCP access", completed: false },
      { id: "5-2", label: "Workflow 設定為 Available in MCP", completed: false },
      { id: "5-3", label: "連接 n8n connector 到 Lovable", completed: false },
      { id: "5-4", label: "測試 workflow 執行", completed: false },
    ],
    prompts: [
      {
        id: "p5-1",
        title: "1. 啟用 n8n MCP Access",
        description: "在 n8n 實例中開啟 MCP 存取功能",
        keywords: ["mcp", "enable", "access", "settings"],
        prompts: {
          diagnostic: `// 檢查 n8n MCP 是否已啟用

// 1. 前往 n8n 實例
// Settings → MCP access

// 2. 確認 "Enable MCP access" 已開啟

// 3. 複製 MCP URL
// 格式：https://my.app.n8n.cloud/mcp-server/http

// ⚠️ 注意：需要 instance owner 或 admin 權限`,
          fix: `// 啟用 MCP Access 步驟：

// 1. 登入 n8n 實例
//    前往 Settings → MCP access

// 2. Toggle "Enable MCP access" 開啟

// 3. 複製提供的 MCP URL
//    例如：https://your-instance.n8n.cloud/mcp-server/http

// 4. 在 Lovable 中連接
//    Project Settings → Connectors → n8n
//    貼上 MCP URL

// 權限問題：
// 如果看不到 MCP access 選項，
// 請確認你有 owner 或 admin 權限`,
          verify: `// 驗證 MCP 連接成功

// 1. 在 Lovable 中
//    Project Settings → Connectors
//    確認 n8n 顯示為 "Connected"

// 2. 測試 workflow 列表
//    AI 應該能看到你的 workflows`
        }
      },
      {
        id: "p5-2",
        title: "2. 設定 Workflow 可見性",
        description: "讓 workflow 可以透過 MCP 被存取",
        keywords: ["workflow", "visible", "available", "mcp"],
        prompts: {
          diagnostic: `// 常見問題：連接成功但看不到任何 workflow

// 原因：Workflow 需要個別設定為 MCP 可用

// 檢查方式：
// 1. 開啟 n8n workflow editor
// 2. 點擊 workflow 的 Settings
// 3. 確認 "Available in MCP" 是否開啟`,
          fix: `// 設定 Workflow 可透過 MCP 存取：

// 對於每個要暴露的 workflow：

// 1. 開啟 n8n，進入 workflow editor

// 2. 點擊右上角的 Settings（齒輪圖示）

// 3. 找到 "Available in MCP" toggle

// 4. 開啟 toggle

// 5. 儲存 workflow

// ⚠️ 重要：
// - 每個 workflow 都需要個別設定
// - 只暴露你希望 AI 使用的 workflows
// - 使用清晰的 workflow 名稱，方便 AI 辨識`,
          verify: `// 驗證 workflow 可見

// 1. 重新整理 Lovable 編輯器

// 2. 詢問 AI："列出可用的 n8n workflows"

// 3. 應該能看到你設定為 Available in MCP 的 workflows`
        }
      },
      {
        id: "p5-3",
        title: "3. Webhook 觸發問題",
        description: "解決 n8n webhook 觸發失敗的問題",
        keywords: ["webhook", "trigger", "cors", "post"],
        prompts: {
          diagnostic: `// Webhook 觸發失敗的常見原因：

// 1. CORS 問題
// 2. Webhook URL 格式錯誤
// 3. n8n workflow 未啟用
// 4. 請求格式錯誤

// 檢查 n8n Execution history
// 看看 webhook 是否有收到請求`,
          fix: `// 正確的 Webhook 呼叫方式（處理 CORS）

const handleTrigger = async () => {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: "no-cors", // 重要：處理 CORS
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        triggered_from: window.location.origin,
        data: yourData
      }),
    });

    // 注意：no-cors 模式下無法讀取 response
    toast({
      title: "請求已發送",
      description: "請檢查 n8n 執行歷史確認觸發成功",
    });
  } catch (error) {
    console.error("Webhook error:", error);
    toast({
      title: "錯誤",
      description: "Webhook 觸發失敗",
      variant: "destructive",
    });
  }
};`,
          verify: `// 驗證 Webhook 觸發

// 1. 在 n8n 中檢查 Executions
//    確認 workflow 有被觸發

// 2. 檢查執行結果是否正確

// 3. 如果沒有看到執行紀錄：
//    - 確認 workflow 已啟用（Active）
//    - 確認 webhook URL 正確
//    - 檢查瀏覽器 Network tab 是否有發送請求`
        }
      }
    ]
  },
  {
    id: 6,
    title: "環境變數設定問題",
    shortTitle: "ENV 問題",
    purpose: "環境變數未設定、格式錯誤、或 NEXT_PUBLIC_ 前綴遺漏，導致連線失敗或功能異常。",
    badge: "common",
    category: "general",
    keywords: ["env", "environment", "config", "missing", "undefined"],
    checklist: [
      { id: "6-1", label: "檢查 .env.local 檔案存在", completed: false },
      { id: "6-2", label: "確認 NEXT_PUBLIC_ 前綴正確", completed: false },
      { id: "6-3", label: "驗證環境變數值格式", completed: false },
      { id: "6-4", label: "重啟開發伺服器", completed: false },
      { id: "6-5", label: "GitHub Actions secrets 已設定", completed: false },
    ],
    prompts: [
      {
        id: "p6-1",
        title: "1. 列出必要的環境變數",
        description: "確認所有必要的環境變數都已設定",
        keywords: ["list", "required", "check"],
        prompts: {
          diagnostic: `# 檢查 .env.local 檔案
cat .env.local

# 必要的環境變數清單：
# NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6... (僅後端)

# 在程式中驗證
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);`,
          fix: `# 建立或更新 .env.local 檔案

# 1. 從 Supabase Dashboard 取得值
#    Settings > API > Project URL
#    Settings > API > anon public key
#    Settings > API > service_role key

# 2. 建立 .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://{{supabase_ref}}.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
EOF

# 3. 重啟開發伺服器
npm run dev`,
          verify: `// 在應用程式中驗證環境變數
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

requiredEnvVars.forEach(key => {
  const value = process.env[key];
  if (!value) {
    console.error(\`❌ Missing: \${key}\`);
  } else {
    console.log(\`✓ \${key}: \${value.substring(0, 20)}...\`);
  }
});`
        }
      },
      {
        id: "p6-2",
        title: "2. GitHub Actions Secrets",
        description: "設定 CI/CD 所需的環境變數",
        keywords: ["github", "actions", "secrets", "ci"],
        prompts: {
          diagnostic: `# 列出已設定的 secrets（使用 GitHub CLI）
gh secret list

# 必要的 secrets：
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_ACCESS_TOKEN (for CLI)
# - SUPABASE_PROJECT_ID`,
          fix: `# 設定 GitHub Secrets

# 方法 1: 使用 GitHub CLI
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "https://xxx.supabase.co"
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "your-anon-key"

# 方法 2: 透過 GitHub Web UI
# 1. 前往 Repository > Settings > Secrets and variables > Actions
# 2. 點擊 "New repository secret"
# 3. 輸入 Name 和 Value

# 在 workflow 中使用
env:
  NEXT_PUBLIC_SUPABASE_URL: \${ secrets.NEXT_PUBLIC_SUPABASE_URL }
  NEXT_PUBLIC_SUPABASE_ANON_KEY: \${ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}`,
          verify: `# 驗證 secrets 已設定
gh secret list

# 預期輸出：
# NEXT_PUBLIC_SUPABASE_URL      Updated 2024-01-15
# NEXT_PUBLIC_SUPABASE_ANON_KEY Updated 2024-01-15`
        }
      }
    ]
  },
  {
    id: 7,
    title: "Supabase Authentication 自動化設定",
    shortTitle: "Auth 自動化",
    purpose: "自動設定 Supabase Authentication，包含 Email/Password、OAuth、Magic Link 等登入方式，以及自動建立用戶資料表。",
    badge: "critical",
    category: "supabase",
    keywords: ["auth", "authentication", "login", "oauth", "magic", "link", "email", "password"],
    checklist: [
      { id: "7-1", label: "確認 Auth Providers 已啟用", completed: false },
      { id: "7-2", label: "設定 Email Templates", completed: false },
      { id: "7-3", label: "建立用戶資料表與 RLS", completed: false },
      { id: "7-4", label: "設定 Auth Hooks/Triggers", completed: false },
      { id: "7-5", label: "測試登入流程", completed: false },
    ],
    prompts: [
      {
        id: "p7-1",
        title: "1. 自動設定 Email/Password 登入",
        description: "啟用 Email/Password 認證並設定相關選項",
        keywords: ["email", "password", "signup", "login"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查 Auth 設定

1. 前往 Supabase Dashboard > Authentication > Providers
2. 確認 Email provider 是否已啟用
3. 檢查以下設定：
   - Enable email confirmations
   - Enable secure email change
   - Enable email signup`,
          fix: `【Cursor 自動化指令】自動設定 Email/Password 認證

請在 Supabase Dashboard 或使用 SQL 自動設定：

-- 1. 啟用 Email provider（在 Dashboard 中操作，或使用 Management API）
-- Authentication > Providers > Email > Enable

-- 2. 設定 Email Templates（在 Dashboard 中）
-- Authentication > Email Templates
-- 自訂以下模板：
--   - Confirm signup
--   - Magic Link
--   - Change Email Address
--   - Reset Password

-- 3. 前端實作登入/註冊功能
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 註冊
const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    emailRedirectTo: \`\${window.location.origin}/auth/callback\`
  }
});

// 登入
const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password'
});

// 登出
await supabase.auth.signOut();`,
          verify: `【Cursor 自動化指令】驗證 Auth 功能

// 1. 測試註冊流程
const testSignUp = async () => {
  const { data, error } = await supabase.auth.signUp({
    email: 'test@example.com',
    password: 'test123456'
  });
  console.log('Sign up:', { data, error });
};

// 2. 測試登入流程
const testSignIn = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'test123456'
  });
  console.log('Sign in:', { data, error });
};

// 3. 檢查當前用戶
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);`
        }
      },
      {
        id: "p7-2",
        title: "2. 自動建立用戶資料表與 RLS",
        description: "建立 profiles 表並設定自動觸發器",
        keywords: ["profile", "table", "trigger", "hook"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查用戶資料表

-- 檢查是否存在 profiles 表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'profiles';

-- 檢查是否有 auth.users 觸發器
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'auth' AND event_object_table = 'users';`,
          fix: `【Cursor 自動化指令】自動建立用戶資料表與觸發器

請在 Supabase SQL Editor 執行以下 SQL：

-- 1. 建立 profiles 表
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 啟用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. 建立 RLS Policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. 建立自動建立 profile 的觸發器函數
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 建立觸發器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`,
          verify: `【Cursor 自動化指令】驗證用戶資料表

-- 1. 檢查表是否建立
SELECT * FROM public.profiles LIMIT 1;

-- 2. 檢查觸發器是否運作
-- 註冊新用戶後，檢查 profiles 表是否自動建立記錄

-- 3. 前端測試
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  console.log('Profile:', profile);
}`
        }
      },
      {
        id: "p7-3",
        title: "3. OAuth 登入自動設定",
        description: "設定 Google、GitHub 等 OAuth providers",
        keywords: ["oauth", "google", "github", "social", "login"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查 OAuth 設定

1. 前往 Supabase Dashboard > Authentication > Providers
2. 檢查已啟用的 OAuth providers
3. 確認 Redirect URLs 已正確設定`,
          fix: `【Cursor 自動化指令】自動設定 OAuth 登入

1. 在 Supabase Dashboard 設定：
   - Authentication > Providers > Google/GitHub/etc
   - 啟用 provider
   - 填入 Client ID 和 Client Secret（從對應平台取得）
   - 設定 Redirect URL: https://{{supabase_ref}}.supabase.co/auth/v1/callback

2. 前端實作 OAuth 登入：
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google', // 或 'github', 'apple', etc.
  options: {
    redirectTo: \`\${window.location.origin}/auth/callback\`
  }
});

3. 處理 OAuth callback：
// pages/auth/callback.tsx 或 app/auth/callback/page.tsx
useEffect(() => {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      router.push('/dashboard');
    }
  });
}, []);`,
          verify: `【Cursor 自動化指令】測試 OAuth 登入

// 測試 OAuth 登入流程
const testOAuth = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/auth/callback'
    }
  });
  
  if (error) {
    console.error('OAuth error:', error);
  } else {
    console.log('OAuth redirect:', data.url);
  }
};`
        }
      }
    ]
  },
  {
    id: 8,
    title: "Supabase Realtime 訂閱自動化",
    shortTitle: "Realtime 自動化",
    purpose: "自動設定 Supabase Realtime 訂閱，實現即時資料同步、協作功能。",
    badge: "common",
    category: "supabase",
    keywords: ["realtime", "subscription", "websocket", "live", "sync", "collaboration"],
    checklist: [
      { id: "8-1", label: "確認 Realtime 已啟用", completed: false },
      { id: "8-2", label: "設定 Replication 設定", completed: false },
      { id: "8-3", label: "實作訂閱邏輯", completed: false },
      { id: "8-4", label: "處理連線狀態", completed: false },
      { id: "8-5", label: "測試即時更新", completed: false },
    ],
    prompts: [
      {
        id: "p8-1",
        title: "1. 啟用表格 Realtime",
        description: "在資料庫中啟用特定表格的 Realtime 功能",
        keywords: ["realtime", "enable", "replication"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查 Realtime 設定

-- 檢查哪些表格已啟用 Realtime
SELECT 
  schemaname,
  tablename,
  replica_identity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('{{table_name}}');

-- 檢查 replication 設定
SELECT * FROM pg_publication_tables;`,
          fix: `【Cursor 自動化指令】自動啟用表格 Realtime

請在 Supabase SQL Editor 執行：

-- 1. 啟用表格的 Realtime（方法一：使用 Dashboard）
-- Dashboard > Database > Replication > 選擇表格 > Enable

-- 2. 啟用表格的 Realtime（方法二：使用 SQL）
-- 首先建立 publication（如果不存在）
CREATE PUBLICATION supabase_realtime FOR TABLE {{table_name}};

-- 或將表格加入現有 publication
ALTER PUBLICATION supabase_realtime ADD TABLE {{table_name}};

-- 3. 設定 replica identity（用於 UPDATE/DELETE 事件）
ALTER TABLE {{table_name}} REPLICA IDENTITY FULL;

-- 4. 前端訂閱實作
const subscription = supabase
  .channel('{{channel_name}}')
  .on(
    'postgres_changes',
    {
      event: '*', // INSERT, UPDATE, DELETE
      schema: 'public',
      table: '{{table_name}}',
      filter: 'user_id=eq.' + userId // 可選：過濾條件
    },
    (payload) => {
      console.log('Change received!', payload);
      // 自動更新 UI
      if (payload.eventType === 'INSERT') {
        setItems(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setItems(prev => prev.map(item => 
          item.id === payload.new.id ? payload.new : item
        ));
      } else if (payload.eventType === 'DELETE') {
        setItems(prev => prev.filter(item => item.id !== payload.old.id));
      }
    }
  )
  .subscribe();

// 5. 清理訂閱（在組件卸載時）
return () => {
  subscription.unsubscribe();
};`,
          verify: `【Cursor 自動化指令】驗證 Realtime 訂閱

// 1. 測試訂閱是否正常連線
const testSubscription = () => {
  const channel = supabase.channel('test');
  
  channel
    .on('presence', { event: 'sync' }, () => {
      console.log('✓ Realtime connected');
    })
    .subscribe();
  
  // 2. 測試資料變更
  // 在另一個視窗修改資料，檢查是否收到更新
  setTimeout(() => {
    channel.unsubscribe();
  }, 5000);
};

// 3. 檢查連線狀態
const channel = supabase.channel('test');
channel.on('system', {}, (payload) => {
  console.log('System event:', payload);
  // SUBSCRIBED, JOINED, LEFT, etc.
});
channel.subscribe();`
        }
      },
      {
        id: "p8-2",
        title: "2. Presence 協作功能",
        description: "實作即時顯示線上用戶、游標位置等協作功能",
        keywords: ["presence", "collaboration", "online", "cursor"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查 Presence 設定

檢查是否已實作 Presence 功能：
- 是否有追蹤用戶上線狀態？
- 是否有顯示其他用戶的游標位置？
- 是否有協作編輯功能？`,
          fix: `【Cursor 自動化指令】自動實作 Presence 協作功能

// 1. 追蹤用戶上線狀態
const channel = supabase.channel('online-users')
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    console.log('Online users:', state);
    // 更新 UI 顯示線上用戶列表
    setOnlineUsers(Object.keys(state));
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('User joined:', key, newPresences);
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('User left:', key, leftPresences);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      // 發送當前用戶的 presence
      await channel.track({
        user_id: user.id,
        username: user.email,
        online_at: new Date().toISOString(),
        cursor: { x: 0, y: 0 } // 游標位置
      });
    }
  });

// 2. 追蹤游標位置（協作編輯）
const trackCursor = (x: number, y: number) => {
  channel.track({
    user_id: user.id,
    username: user.email,
    cursor: { x, y },
    updated_at: new Date().toISOString()
  });
};

// 3. 在文件編輯器中監聽滑鼠移動
document.addEventListener('mousemove', (e) => {
  trackCursor(e.clientX, e.clientY);
});

// 4. 清理（組件卸載時）
return () => {
  channel.untrack();
  channel.unsubscribe();
};`,
          verify: `【Cursor 自動化指令】測試 Presence 功能

// 1. 開啟多個瀏覽器視窗測試
// 2. 檢查是否能看到其他用戶的上線狀態
// 3. 檢查游標位置是否即時同步
// 4. 檢查用戶離開時是否正確移除`
        }
      }
    ]
  },
  {
    id: 9,
    title: "Supabase Edge Functions 自動化部署",
    shortTitle: "Edge Functions",
    purpose: "自動建立、部署和管理 Supabase Edge Functions，實作後端 API、webhooks、定時任務等。",
    badge: "common",
    category: "supabase",
    keywords: ["edge", "function", "deno", "deploy", "api", "webhook", "cron"],
    checklist: [
      { id: "9-1", label: "安裝 Supabase CLI", completed: false },
      { id: "9-2", label: "建立 Edge Function 專案結構", completed: false },
      { id: "9-3", label: "實作 Function 邏輯", completed: false },
      { id: "9-4", label: "設定環境變數與 Secrets", completed: false },
      { id: "9-5", label: "部署並測試 Function", completed: false },
    ],
    prompts: [
      {
        id: "p9-1",
        title: "1. 自動建立 Edge Function 專案",
        description: "建立 Edge Function 的專案結構與基本設定",
        keywords: ["create", "init", "structure", "deno"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查 Edge Functions 設定

1. 檢查是否已安裝 Supabase CLI：
npx supabase --version

2. 檢查專案結構：
ls -la supabase/functions/

3. 檢查是否已登入：
npx supabase login`,
          fix: `【Cursor 自動化指令】自動建立 Edge Function

1. 初始化 Supabase 專案（如果尚未初始化）：
npx supabase init

2. 建立新的 Edge Function：
npx supabase functions new {{function_name}}

3. 這會建立以下結構：
supabase/
  functions/
    {{function_name}}/
      index.ts

4. 基本 Edge Function 模板：
// supabase/functions/{{function_name}}/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 處理 CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 建立 Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // 取得請求資料
    const { data, error } = await req.json();

    // 實作你的邏輯
    const result = await supabaseClient
      .from("your_table")
      .select("*")
      .limit(10);

    return new Response(
      JSON.stringify({ data: result.data, error: result.error }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});`,
          verify: `【Cursor 自動化指令】驗證 Edge Function 結構

1. 檢查檔案是否建立：
ls -la supabase/functions/{{function_name}}/

2. 檢查語法：
deno check supabase/functions/{{function_name}}/index.ts

3. 本地測試（需要先啟動 Supabase）：
npx supabase functions serve {{function_name}}`
        }
      },
      {
        id: "p9-2",
        title: "2. 自動部署 Edge Function",
        description: "部署 Edge Function 到 Supabase 並設定環境變數",
        keywords: ["deploy", "secret", "environment", "variable"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查部署狀態

1. 檢查已部署的 Functions：
npx supabase functions list

2. 檢查環境變數：
npx supabase secrets list`,
          fix: `【Cursor 自動化指令】自動部署 Edge Function

1. 設定 Supabase 專案連結：
npx supabase link --project-ref {{supabase_ref}}

2. 設定 Secrets（環境變數）：
npx supabase secrets set RESEND_API_KEY={{resend_api_key}}

3. 部署 Function：
npx supabase functions deploy {{function_name}}

4. 或部署所有 Functions：
npx supabase functions deploy

5. 測試部署的 Function：
curl -i --location --request POST \\
  'https://{{supabase_ref}}.supabase.co/functions/v1/{{function_name}}' \\
  --header 'Authorization: Bearer YOUR_ANON_KEY' \\
  --header 'Content-Type: application/json' \\
  --data '{"key":"value"}'

6. 前端呼叫 Edge Function：
const { data, error } = await supabase.functions.invoke('{{function_name}}', {
  body: { key: 'value' }
});`,
          verify: `【Cursor 自動化指令】驗證部署成功

1. 檢查 Function 是否部署：
npx supabase functions list

2. 檢查 Function logs：
npx supabase functions logs your-function-name

3. 測試 Function 端點：
const testFunction = async () => {
  const { data, error } = await supabase.functions.invoke('your-function-name', {
    body: { test: true }
  });
  console.log('Function result:', { data, error });
};`
        }
      },
      {
        id: "p9-3",
        title: "3. 實作定時任務 (Cron Jobs)",
        description: "使用 Edge Functions 實作定時執行的任務",
        keywords: ["cron", "schedule", "task", "job"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查定時任務設定

檢查是否已有定時任務：
- 是否有需要定期執行的任務？
- 是否有資料清理、備份、通知等需求？`,
          fix: `【Cursor 自動化指令】自動實作定時任務

1. 建立定時任務 Edge Function：
// supabase/functions/cron-job/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // 驗證 Cron Secret（安全檢查）
  const authHeader = req.headers.get("authorization");
  if (authHeader !== \`Bearer \${Deno.env.get("CRON_SECRET")}\`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 執行定時任務邏輯
  // 例如：清理過期資料
  const { data, error } = await supabase
    .from("sessions")
    .delete()
    .lt("expires_at", new Date().toISOString());

  return new Response(
    JSON.stringify({ 
      success: true, 
      deleted: data?.length || 0,
      error 
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});

2. 部署 Function：
npx supabase functions deploy cron-job

3. 設定 Cron Secret：
npx supabase secrets set CRON_SECRET={{cron_secret}}

4. 在 Supabase Dashboard 設定 Cron：
- Database > Database Webhooks > New Webhook
- 或使用外部服務（如 n8n, GitHub Actions）定期呼叫 Function

5. 使用 GitHub Actions 自動執行（範例）：
# .github/workflows/cron.yml
name: Cron Job
on:
  schedule:
    - cron: '0 * * * *' # 每小時執行
jobs:
  cron:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
          run: |
            curl -X POST \\
              -H "Authorization: Bearer {{cron_secret}}" \\
              https://{{supabase_ref}}.supabase.co/functions/v1/cron-job`,
          verify: `【Cursor 自動化指令】測試定時任務

1. 手動觸發測試：
curl -X POST \\
  -H "Authorization: Bearer {{cron_secret}}" \\
  https://{{supabase_ref}}.supabase.co/functions/v1/cron-job

2. 檢查執行結果：
npx supabase functions logs cron-job

3. 確認任務是否按時執行（檢查 logs 時間戳）`
        }
      }
    ]
  },
  // ===== 後台管理串接 =====
  {
    id: 10,
    title: "後台 API 連線問題",
    shortTitle: "API 連線",
    purpose: "後台管理系統的 API 連線、資料同步、權限驗證問題排除。",
    badge: "critical",
    category: "backend",
    keywords: ["api", "connection", "backend", "auth", "token"],
    checklist: [
      { id: "10-1", label: "確認 API endpoint 正確", completed: false },
      { id: "10-2", label: "檢查 Authorization header", completed: false },
      { id: "10-3", label: "驗證 CORS 設定", completed: false },
      { id: "10-4", label: "確認 token 未過期", completed: false },
      { id: "10-5", label: "測試 API response 格式", completed: false },
    ],
    prompts: [
      {
        id: "p10-1",
        title: "1. 檢查 API 連線狀態",
        description: "診斷 API 連線問題，確認 endpoint 和認證設定",
        keywords: ["endpoint", "connection", "fetch", "axios"],
        prompts: {
          diagnostic: `// 檢查 API 連線狀態
const testApiConnection = async () => {
  try {
    const response = await fetch('YOUR_API_ENDPOINT/health', {
      method: 'GET',
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers));
    
    const data = await response.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Connection failed:', error);
  }
};`,
          fix: `// 建立可重用的 API client
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor - 自動加入 token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

// Response interceptor - 統一錯誤處理
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 過期，導向登入
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;`,
          verify: `// 驗證 API client 是否正常運作
import apiClient from './apiClient';

const testConnection = async () => {
  const { data } = await apiClient.get('/health');
  console.log('✓ API 連線成功:', data);
  
  const { data: user } = await apiClient.get('/me');
  console.log('✓ 認證有效:', user);
};`
        }
      },
      {
        id: "p10-2",
        title: "2. 資料同步問題",
        description: "前後端資料不一致、快取問題排除",
        keywords: ["sync", "cache", "stale", "refresh"],
        prompts: {
          diagnostic: `// 檢查資料同步狀態
// 1. 檢查 React Query / SWR 快取
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();
const cachedData = queryClient.getQueryData(['your-key']);
console.log('Cached data:', cachedData);

// 2. 比較前後端資料
const { data: frontendData } = useQuery(['data'], fetchData);
const { data: freshData } = await fetch('/api/data').then(r => r.json());
console.log('Frontend:', frontendData);
console.log('Backend:', freshData);`,
          fix: `// 解決資料同步問題

// 1. 強制重新取得資料
const queryClient = useQueryClient();
await queryClient.invalidateQueries(['your-key']);

// 2. 設定適當的 staleTime 和 refetchInterval
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 1000 * 60, // 1 分鐘後視為過期
  refetchOnWindowFocus: true,
  refetchInterval: 1000 * 30, // 每 30 秒自動刷新
});

// 3. 使用 optimistic updates
const mutation = useMutation({
  mutationFn: updateData,
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['data']);
    const previous = queryClient.getQueryData(['data']);
    queryClient.setQueryData(['data'], newData);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['data'], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries(['data']);
  },
});`,
          verify: `// 驗證資料同步正常
// 1. 修改資料後檢查是否即時更新
// 2. 重新整理頁面確認資料一致
// 3. 開啟 DevTools Network 檢查 API 呼叫頻率`
        }
      }
    ]
  },
  // ===== CRM 功能 =====
  {
    id: 11,
    title: "CRM 客戶資料管理",
    shortTitle: "CRM 管理",
    purpose: "客戶資料 CRUD、搜尋過濾、標籤分類、自動化流程設定。",
    badge: "common",
    category: "crm",
    keywords: ["crm", "customer", "contact", "lead", "pipeline"],
    checklist: [
      { id: "11-1", label: "客戶資料表結構正確", completed: false },
      { id: "11-2", label: "搜尋過濾功能正常", completed: false },
      { id: "11-3", label: "標籤/分類系統運作", completed: false },
      { id: "11-4", label: "自動化規則設定完成", completed: false },
      { id: "11-5", label: "資料匯入匯出功能", completed: false },
    ],
    prompts: [
      {
        id: "p11-1",
        title: "1. 客戶資料表設計",
        description: "建立完整的客戶資料表結構",
        keywords: ["table", "schema", "customer", "contact"],
        prompts: {
          diagnostic: `-- 檢查現有客戶資料表結構
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers' AND table_schema = 'public';

-- 檢查索引（影響搜尋效能）
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'customers';`,
          fix: `-- 建立完整的客戶資料表
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  -- 基本資訊
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  
  -- 分類與狀態
  status TEXT DEFAULT 'lead' CHECK (status IN ('lead', 'prospect', 'customer', 'churned')),
  tags TEXT[] DEFAULT '{}',
  
  -- 來源追蹤
  source TEXT, -- 'website', 'referral', 'ads', etc.
  
  -- 備註
  notes TEXT,
  
  -- 時間戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 建立搜尋索引
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_tags ON customers USING GIN(tags);
CREATE INDEX idx_customers_search ON customers USING GIN(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(company, ''))
);

-- 啟用 RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own customers"
ON customers FOR ALL
USING (auth.uid() = user_id);`,
          verify: `-- 驗證表結構
\\d customers

-- 測試新增客戶
INSERT INTO customers (user_id, name, email, status, tags)
VALUES (auth.uid(), '測試客戶', 'test@example.com', 'lead', ARRAY['VIP']);

-- 測試搜尋
SELECT * FROM customers WHERE name ILIKE '%測試%';`
        }
      },
      {
        id: "p11-2",
        title: "2. 進階搜尋與過濾",
        description: "實作客戶搜尋、多條件過濾功能",
        keywords: ["search", "filter", "query", "pagination"],
        prompts: {
          diagnostic: `// 檢查搜尋功能是否正常
const { data, error } = await supabase
  .from('customers')
  .select('*')
  .ilike('name', '%關鍵字%');

console.log('搜尋結果:', data?.length, '筆');
console.log('錯誤:', error);`,
          fix: `// 建立進階搜尋 hook
export function useCustomerSearch() {
  const [filters, setFilters] = useState({
    search: '',
    status: [],
    tags: [],
    dateRange: null
  });

  const { data, isLoading } = useQuery({
    queryKey: ['customers', filters],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' });

      // 關鍵字搜尋
      if (filters.search) {
        query = query.or(\`name.ilike.%\${filters.search}%,email.ilike.%\${filters.search}%,company.ilike.%\${filters.search}%\`);
      }

      // 狀態過濾
      if (filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      // 標籤過濾
      if (filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }

      // 日期範圍
      if (filters.dateRange) {
        query = query
          .gte('created_at', filters.dateRange.from)
          .lte('created_at', filters.dateRange.to);
      }

      return query.order('created_at', { ascending: false });
    }
  });

  return { data, isLoading, filters, setFilters };
}`,
          verify: `// 測試各種搜尋條件
const { data } = useCustomerSearch();

// 1. 測試關鍵字搜尋
setFilters({ search: 'test' });

// 2. 測試狀態過濾
setFilters({ status: ['lead', 'prospect'] });

// 3. 測試標籤過濾
setFilters({ tags: ['VIP'] });`
        }
      }
    ]
  },
  // ===== Email 自動化 =====
  {
    id: 12,
    title: "Email 自動寄發設定",
    shortTitle: "Email 自動化",
    purpose: "使用 Resend 設定自動信件寄發，包含 Edge Function、模板設計。",
    badge: "common",
    category: "email",
    keywords: ["email", "resend", "smtp", "template", "notification"],
    checklist: [
      { id: "12-1", label: "Resend 帳號已建立", completed: false },
      { id: "12-2", label: "Domain 已驗證", completed: false },
      { id: "12-3", label: "API Key 已設定為 secret", completed: false },
      { id: "12-4", label: "Edge Function 已部署", completed: false },
      { id: "12-5", label: "Email 模板已建立", completed: false },
    ],
    prompts: [
      {
        id: "p12-1",
        title: "1. Resend 設定與 API Key",
        description: "設定 Resend 帳號並取得 API Key",
        keywords: ["resend", "api", "key", "domain"],
        prompts: {
          diagnostic: `// 檢查 Resend API Key 是否設定
// 在 Supabase Dashboard > Edge Functions > Secrets 確認

// 或在 Edge Function 中測試
const apiKey = Deno.env.get("RESEND_API_KEY");
console.log("API Key exists:", !!apiKey);

// 測試 API 連線
const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${apiKey}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    from: "test@yourdomain.com",
    to: ["test@example.com"],
    subject: "Test",
    html: "<p>Test email</p>"
  })
});

console.log("Response:", response.status, await response.text());`,
          fix: `// 1. 前往 https://resend.com 註冊帳號
// 2. 在 https://resend.com/domains 驗證您的網域
// 3. 在 https://resend.com/api-keys 建立 API Key

// 4. 將 API Key 加入 Supabase Secrets
// Dashboard > Project Settings > Edge Functions > Secrets
// 或使用 CLI:
// supabase secrets set RESEND_API_KEY={{resend_api_key}}

// 5. 建立 Edge Function: supabase/functions/send-email/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "{{resend_api_key}}");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();

    const data = await resend.emails.send({
      from: "Your App <noreply@yourdomain.com>",
      to: [to],
      subject,
      html,
    });

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});`,
          verify: `// 測試寄送 Email
const { data, error } = await supabase.functions.invoke('send-email', {
  body: {
    to: 'your-email@example.com',
    subject: '測試信件',
    html: '<h1>Hello!</h1><p>這是測試信件</p>'
  }
});

console.log('Result:', data);
console.log('Error:', error);`
        }
      },
      {
        id: "p12-2",
        title: "2. React Email 模板設計",
        description: "使用 React Email 建立美觀的信件模板",
        keywords: ["template", "react-email", "design", "html"],
        prompts: {
          diagnostic: `// 檢查模板是否正確渲染
import { render } from '@react-email/render';
import { WelcomeEmail } from './_templates/welcome';

const html = render(<WelcomeEmail userName="Test User" />);
console.log('Generated HTML:', html);`,
          fix: `// 建立 React Email 模板
// supabase/functions/send-email/_templates/welcome.tsx

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface WelcomeEmailProps {
  userName: string;
  actionUrl?: string;
}

export const WelcomeEmail = ({ userName, actionUrl }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>歡迎加入我們！</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>歡迎，{userName}！</Heading>
        <Text style={text}>
          感謝您註冊我們的服務。我們很高興有您的加入！
        </Text>
        {actionUrl && (
          <Link href={actionUrl} style={button}>
            開始使用
          </Link>
        )}
        <Text style={footer}>
          如有任何問題，請隨時聯繫我們。
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = { backgroundColor: '#f6f9fc', padding: '40px 0' };
const container = { backgroundColor: '#ffffff', padding: '40px', borderRadius: '8px' };
const h1 = { color: '#333', fontSize: '24px' };
const text = { color: '#666', fontSize: '16px', lineHeight: '24px' };
const button = { 
  backgroundColor: '#5469d4', 
  color: '#fff', 
  padding: '12px 24px', 
  borderRadius: '6px',
  textDecoration: 'none',
  display: 'inline-block'
};
const footer = { color: '#999', fontSize: '14px', marginTop: '32px' };

export default WelcomeEmail;`,
          verify: `// 在 Edge Function 中使用模板
import { render } from 'npm:@react-email/render@0.0.12';
import WelcomeEmail from './_templates/welcome.tsx';

const html = render(
  <WelcomeEmail 
    userName="新用戶" 
    actionUrl="https://yourapp.com/dashboard" 
  />
);

await resend.emails.send({
  from: "noreply@yourdomain.com",
  to: ["user@example.com"],
  subject: "歡迎加入！",
  html,
});`
        }
      }
    ]
  },
  // ===== LINE 官方帳號 =====
  {
    id: 13,
    title: "LINE Webhook 設定",
    shortTitle: "LINE Webhook",
    purpose: "LINE 官方帳號的 Webhook 設定、訊息接收與自動回覆。",
    badge: "critical",
    category: "line",
    keywords: ["line", "webhook", "messaging", "bot", "official"],
    checklist: [
      { id: "13-1", label: "LINE Developers 帳號已建立", completed: false },
      { id: "13-2", label: "Channel 已建立並取得 Token", completed: false },
      { id: "13-3", label: "Webhook URL 已設定", completed: false },
      { id: "13-4", label: "Webhook 驗證成功", completed: false },
      { id: "13-5", label: "訊息接收測試通過", completed: false },
    ],
    prompts: [
      {
        id: "p13-1",
        title: "1. LINE Channel 設定",
        description: "建立 LINE Messaging API Channel 並取得認證資訊",
        keywords: ["channel", "token", "secret", "developers"],
        prompts: {
          diagnostic: `// 檢查 LINE 認證資訊是否設定
// 需要的環境變數：
// - LINE_CHANNEL_ACCESS_TOKEN
// - LINE_CHANNEL_SECRET

// 在 Edge Function 中檢查
const channelToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET");

console.log("Channel Token exists:", !!channelToken);
console.log("Channel Secret exists:", !!channelSecret);

// 測試 Token 是否有效
const response = await fetch("https://api.line.me/v2/bot/info", {
  headers: {
    "Authorization": \`Bearer \${channelToken}\`
  }
});
console.log("Bot info:", await response.json());`,
          fix: `// 1. 前往 https://developers.line.biz/ 
// 2. 建立 Provider > 建立 Messaging API Channel
// 3. 在 Channel 設定頁面取得：
//    - Channel secret (Basic settings)
//    - Channel access token (Messaging API > Issue)

// 4. 將認證資訊加入 Supabase Secrets
// supabase secrets set LINE_CHANNEL_ACCESS_TOKEN={{line_channel_access_token}}
// supabase secrets set LINE_CHANNEL_SECRET={{line_channel_secret}}

// 5. 建立 Webhook Edge Function
// supabase/functions/line-webhook/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET") || "{{line_channel_secret}}";
const channelToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "{{line_channel_access_token}}";

serve(async (req) => {
  // 驗證簽章
  const body = await req.text();
  const signature = req.headers.get("x-line-signature");
  
  const hash = createHmac("sha256", channelSecret)
    .update(body)
    .digest("base64");
    
  if (hash !== signature) {
    return new Response("Invalid signature", { status: 401 });
  }

  const { events } = JSON.parse(body);
  
  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      // 自動回覆
      await replyMessage(event.replyToken, [
        { type: "text", text: \`您說：\${event.message.text}\` }
      ]);
    }
  }

  return new Response("OK");
});

async function replyMessage(replyToken: string, messages: any[]) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${channelToken}\`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ replyToken, messages })
  });
}`,
          verify: `// 1. 部署 Edge Function
// supabase functions deploy line-webhook

// 2. 取得 Webhook URL
// https://<project-ref>.supabase.co/functions/v1/line-webhook

// 3. 在 LINE Developers Console 設定 Webhook URL
// Messaging API > Webhook settings > Webhook URL

// 4. 點擊 "Verify" 確認連線成功

// 5. 開啟 "Use webhook" 

// 6. 用手機傳送訊息測試`
        }
      },
      {
        id: "p13-2",
        title: "2. Flex Message 製作",
        description: "建立圖片式互動按鈕訊息",
        keywords: ["flex", "message", "button", "carousel", "bubble"],
        prompts: {
          diagnostic: `// Flex Message 結構檢查
// 使用 LINE Flex Message Simulator 驗證
// https://developers.line.biz/flex-simulator/

// 常見錯誤：
// - JSON 格式錯誤
// - 圖片 URL 不是 HTTPS
// - 按鈕 action 設定錯誤`,
          fix: `// Flex Message 範例 - 產品卡片
const flexMessage = {
  type: "flex",
  altText: "產品推薦",
  contents: {
    type: "bubble",
    hero: {
      type: "image",
      url: "https://example.com/product.jpg",
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "產品名稱",
          weight: "bold",
          size: "xl"
        },
        {
          type: "text",
          text: "NT$ 1,299",
          size: "lg",
          color: "#ff5551",
          margin: "md"
        },
        {
          type: "text",
          text: "產品描述文字...",
          size: "sm",
          color: "#999999",
          margin: "md",
          wrap: true
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          action: {
            type: "uri",
            label: "立即購買",
            uri: "https://yourstore.com/product/123"
          }
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "message",
            label: "詢問客服",
            text: "我想了解這個產品"
          }
        }
      ]
    }
  }
};

// 發送 Flex Message
await fetch("https://api.line.me/v2/bot/message/push", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${channelToken}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    to: userId,
    messages: [flexMessage]
  })
});`,
          verify: `// 測試 Flex Message
// 1. 使用 LINE Flex Message Simulator 預覽
// 2. 發送到測試群組確認顯示正確
// 3. 測試按鈕點擊動作`
        }
      },
      {
        id: "p13-3",
        title: "3. Rich Menu 設定",
        description: "建立圖片式選單，提供常用功能快捷",
        keywords: ["richmenu", "menu", "tap", "area"],
        prompts: {
          diagnostic: `// 檢查現有 Rich Menu
const response = await fetch("https://api.line.me/v2/bot/richmenu/list", {
  headers: {
    "Authorization": \`Bearer \${channelToken}\`
  }
});
const menus = await response.json();
console.log("Rich Menus:", menus);

// 檢查預設 Rich Menu
const defaultRes = await fetch(
  "https://api.line.me/v2/bot/user/all/richmenu",
  { headers: { "Authorization": \`Bearer \${channelToken}\` } }
);
console.log("Default Menu:", await defaultRes.json());`,
          fix: `// 1. 建立 Rich Menu
const richMenuData = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: "主選單",
  chatBarText: "選單",
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: "message", text: "查詢訂單" }
    },
    {
      bounds: { x: 833, y: 0, width: 834, height: 843 },
      action: { type: "uri", uri: "https://yourstore.com" }
    },
    {
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: { type: "message", text: "聯繫客服" }
    },
    {
      bounds: { x: 0, y: 843, width: 833, height: 843 },
      action: { type: "message", text: "最新優惠" }
    },
    {
      bounds: { x: 833, y: 843, width: 834, height: 843 },
      action: { type: "message", text: "會員資訊" }
    },
    {
      bounds: { x: 1667, y: 843, width: 833, height: 843 },
      action: { type: "message", text: "常見問題" }
    }
  ]
};

// 建立 Rich Menu
const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${channelToken}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(richMenuData)
});
const { richMenuId } = await createRes.json();

// 2. 上傳 Rich Menu 圖片 (2500x1686 或 2500x843)
const imageResponse = await fetch(
  \`https://api-data.line.me/v2/bot/richmenu/\${richMenuId}/content\`,
  {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${channelToken}\`,
      "Content-Type": "image/png"
    },
    body: imageBuffer // PNG or JPEG
  }
);

// 3. 設為預設選單
await fetch(
  \`https://api.line.me/v2/bot/user/all/richmenu/\${richMenuId}\`,
  {
    method: "POST",
    headers: { "Authorization": \`Bearer \${channelToken}\` }
  }
);`,
          verify: `// 驗證 Rich Menu 設定
// 1. 重新加入 LINE 官方帳號好友
// 2. 確認選單圖片顯示正確
// 3. 測試每個區塊的點擊動作`
        }
      }
    ]
  },
  {
    id: 14,
    title: "LINE LIFF 應用整合",
    shortTitle: "LIFF 整合",
    purpose: "在 LINE 內嵌網頁應用，取得用戶資訊、發送訊息。",
    badge: "advanced",
    category: "line",
    keywords: ["liff", "webapp", "inapp", "browser", "profile"],
    checklist: [
      { id: "14-1", label: "LIFF App 已建立", completed: false },
      { id: "14-2", label: "Endpoint URL 已設定", completed: false },
      { id: "14-3", label: "LIFF SDK 已整合", completed: false },
      { id: "14-4", label: "用戶登入功能正常", completed: false },
      { id: "14-5", label: "sendMessages 功能測試", completed: false },
    ],
    prompts: [
      {
        id: "p14-1",
        title: "1. LIFF 初始化設定",
        description: "在 React 應用中整合 LIFF SDK",
        keywords: ["liff", "init", "sdk", "react"],
        prompts: {
          diagnostic: `// 檢查 LIFF 初始化狀態
import liff from '@line/liff';

console.log("LIFF initialized:", liff.isInClient());
console.log("LIFF logged in:", liff.isLoggedIn());

if (liff.isLoggedIn()) {
  const profile = await liff.getProfile();
  console.log("User profile:", profile);
}`,
          fix: `// 1. 安裝 LIFF SDK
// npm install @line/liff

// 2. 建立 LIFF 初始化 hook
// src/hooks/useLiff.ts
import { useEffect, useState } from 'react';
import liff from '@line/liff';

export function useLiff() {
  const [isReady, setIsReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: import.meta.env.VITE_LIFF_ID });
        
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        
        const userProfile = await liff.getProfile();
        setProfile(userProfile);
        setIsReady(true);
      } catch (err) {
        console.error('LIFF init error:', err);
        setError(err);
      }
    };

    initLiff();
  }, []);

  const sendMessage = async (messages) => {
    if (!liff.isInClient()) {
      console.warn('sendMessages only works in LINE app');
      return;
    }
    await liff.sendMessages(messages);
  };

  const closeWindow = () => {
    if (liff.isInClient()) {
      liff.closeWindow();
    }
  };

  return { isReady, profile, error, liff, sendMessage, closeWindow };
}

// 3. 在 App 中使用
function App() {
  const { isReady, profile, sendMessage } = useLiff();

  if (!isReady) return <div>Loading...</div>;

  return (
    <div>
      <h1>歡迎，{profile?.displayName}</h1>
      <button onClick={() => sendMessage([
        { type: 'text', text: '我完成了操作！' }
      ])}>
        發送訊息
      </button>
    </div>
  );
}`,
          verify: `// 測試 LIFF 功能
// 1. 在 LINE App 中開啟 LIFF URL
//    line://app/{liff-id}
// 2. 確認自動登入
// 3. 確認可取得用戶資訊
// 4. 測試 sendMessages 功能`
        }
      }
    ]
  },
  {
    id: 15,
    title: "效能優化最佳實踐",
    shortTitle: "效能優化",
    purpose: "優化應用程式效能，包含樂觀更新、防抖節流、快取機制、React Query、圖片載入、非同步處理等 7 個關鍵優化方向。",
    badge: "advanced",
    category: "frontend",
    keywords: ["performance", "optimization", "cache", "debounce", "throttle", "react-query", "async"],
    checklist: [
      { id: "15-1", label: "樂觀更新優化", completed: false },
      { id: "15-2", label: "防抖（Debounce）與節流（Throttle）優化", completed: false },
      { id: "15-3", label: "伺服器快取優化機制", completed: false },
      { id: "15-4", label: "客戶端快取優化機制", completed: false },
      { id: "15-5", label: "React Query 優化", completed: false },
      { id: "15-6", label: "圖片載入優化", completed: false },
      { id: "15-7", label: "非同步處理技術", completed: false },
    ],
    prompts: [
      {
        id: "p15-1",
        title: "1. 樂觀更新優化",
        description: "在等待伺服器回應之前，先在畫面上顯示操作結果，讓使用者感覺操作立即生效，提升使用體驗",
        keywords: ["optimistic", "update", "ux", "immediate", "feedback"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查樂觀更新實作

// 檢查是否有實作樂觀更新
// 1. 按讚、收藏等操作是否立即更新 UI？
// 2. 是否在等待伺服器回應時顯示載入狀態？
// 3. 錯誤時是否有恢復原狀的機制？`,
          fix: `【Cursor 自動化指令】自動實作樂觀更新

// 樂觀更新是指在等待伺服器回應之前，先在畫面上顯示操作結果
// 讓使用者感覺操作立即生效，提升使用體驗

// 1. 使用 React Query 實作樂觀更新
import { useMutation, useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

const likeMutation = useMutation({
  mutationFn: async (postId: string) => {
    const { data, error } = await supabase
      .from('{{table_name}}')
      .update({ likes: supabase.raw('likes + 1') })
      .eq('id', postId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  // 樂觀更新：在請求發送前先更新 UI
  onMutate: async (postId) => {
    // 取消進行中的查詢
    await queryClient.cancelQueries(['posts', postId]);
    
    // 快取前一個狀態
    const previousPost = queryClient.getQueryData(['posts', postId]);
    
    // 樂觀更新：立即更新 UI
    queryClient.setQueryData(['posts', postId], (old: any) => ({
      ...old,
      likes: old.likes + 1,
      isLiked: true,
    }));
    
    return { previousPost };
  },
  // 錯誤時恢復原狀
  onError: (err, postId, context) => {
    queryClient.setQueryData(['posts', postId], context.previousPost);
    // 顯示錯誤訊息
    toast.error('操作失敗，請重試');
  },
  // 成功後重新取得資料確保一致性
  onSettled: (data, error, postId) => {
    queryClient.invalidateQueries(['posts', postId]);
  },
});

// 2. 在組件中使用
function LikeButton({ postId, initialLikes, isLiked }) {
  const likeMutation = useLikeMutation();
  
  const handleLike = () => {
    likeMutation.mutate(postId);
  };
  
  return (
    <button onClick={handleLike} disabled={likeMutation.isLoading}>
      {isLiked ? '❤️' : '🤍'} {likes}
    </button>
  );
}

// 3. 購物車加減商品範例
const addToCartMutation = useMutation({
  mutationFn: async (productId: string) => {
    return await supabase.from('cart_items').insert({ product_id: productId });
  },
  onMutate: async (productId) => {
    await queryClient.cancelQueries(['cart']);
    const previousCart = queryClient.getQueryData(['cart']);
    
    // 樂觀更新：立即加入購物車
    queryClient.setQueryData(['cart'], (old: any[]) => [
      ...old,
      { id: Date.now(), product_id: productId, quantity: 1 }
    ]);
    
    return { previousCart };
  },
  onError: (err, productId, context) => {
    queryClient.setQueryData(['cart'], context.previousCart);
  },
});

// 4. 切換開關設定範例
const toggleSettingMutation = useMutation({
  mutationFn: async ({ settingId, enabled }) => {
    return await supabase
      .from('settings')
      .update({ enabled })
      .eq('id', settingId);
  },
  onMutate: async ({ settingId, enabled }) => {
    await queryClient.cancelQueries(['settings']);
    const previousSettings = queryClient.getQueryData(['settings']);
    
    // 樂觀更新：立即切換開關
    queryClient.setQueryData(['settings'], (old: any[]) =>
      old.map(setting =>
        setting.id === settingId ? { ...setting, enabled } : setting
      )
    );
    
    return { previousSettings };
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(['settings'], context.previousSettings);
  },
});`,
          verify: `【Cursor 自動化指令】驗證樂觀更新

// 1. 測試按讚功能：點擊後應該立即看到變化
// 2. 測試錯誤處理：斷網後操作，應該恢復原狀
// 3. 檢查 Network tab：確認有發送請求
// 4. 測試快速連續點擊：應該正確處理`
        }
      },
      {
        id: "p15-2",
        title: "2. 防抖（Debounce）與節流（Throttle）優化",
        description: "限制頻繁觸發的操作執行次數，減少不必要的運算，提升效能",
        keywords: ["debounce", "throttle", "performance", "optimization", "search"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查防抖與節流實作

// 檢查頻繁觸發的操作
// 1. 搜尋框是否每次輸入都觸發搜尋？
// 2. 滾動事件是否頻繁執行？
// 3. 視窗縮放是否造成效能問題？`,
          fix: `【Cursor 自動化指令】自動實作防抖與節流

// 防抖（Debounce）：在使用者停止操作一段時間後才執行動作
// 節流（Throttle）：限制動作執行的頻率，固定每隔一段時間才執行一次

// 1. 自訂防抖 Hook
import { useEffect, useRef } from 'react';

function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  const debouncedCallback = ((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }) as T;
  
  return debouncedCallback;
}

// 2. 自訂節流 Hook
function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef<number>(0);
  
  const throttledCallback = ((...args: any[]) => {
    const now = Date.now();
    
    if (now - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = now;
    }
  }) as T;
  
  return throttledCallback;
}

// 3. 搜尋框即時搜尋（防抖）- 等使用者停止打字 300ms 後才搜尋
function SearchBox() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['search', searchTerm],
    queryFn: async () => {
      const { data } = await supabase
        .from('{{table_name}}')
        .select('*')
        .ilike('name', \`%\${searchTerm}%\`);
      return data;
    },
    enabled: searchTerm.length > 0,
  });
  
  const debouncedSearch = useDebounce((value: string) => {
    setSearchTerm(value);
  }, 300); // 停止輸入 300ms 後才搜尋
  
  return (
    <input
      type="text"
      onChange={(e) => debouncedSearch(e.target.value)}
      placeholder="搜尋..."
    />
  );
}

// 4. 頁面滾動時的動畫效果（節流）- 每 100ms 最多執行一次
function ScrollAnimation() {
  const [scrollY, setScrollY] = useState(0);
  
  const throttledScroll = useThrottle((y: number) => {
    setScrollY(y);
    // 執行動畫邏輯
    updateAnimation(y);
  }, 100); // 每 100ms 最多執行一次
  
  useEffect(() => {
    const handleScroll = () => {
      throttledScroll(window.scrollY);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return <div>Scroll: {scrollY}px</div>;
}

// 5. 視窗縮放時的重新計算（節流）
function ResponsiveComponent() {
  const [width, setWidth] = useState(window.innerWidth);
  
  const throttledResize = useThrottle(() => {
    setWidth(window.innerWidth);
    // 重新計算佈局
    recalculateLayout(window.innerWidth);
  }, 250); // 每 250ms 最多執行一次
  
  useEffect(() => {
    window.addEventListener('resize', throttledResize);
    return () => window.removeEventListener('resize', throttledResize);
  }, []);
  
  return <div>Width: {width}px</div>;
}

// 6. 使用 lodash 的防抖與節流（如果已安裝）
import { debounce, throttle } from 'lodash';

const debouncedSearch = debounce((value: string) => {
  // 搜尋邏輯
  performSearch(value);
}, 300);

const throttledScroll = throttle((y: number) => {
  // 滾動邏輯
  updateScrollPosition(y);
}, 100);`,
          verify: `【Cursor 自動化指令】驗證防抖與節流

// 1. 測試搜尋框：快速輸入多個字，應該只在停止輸入後才搜尋
// 2. 測試滾動：快速滾動時，應該限制執行頻率
// 3. 檢查 Network tab：確認 API 請求次數減少
// 4. 測試視窗縮放：應該限制重新計算的頻率`
        }
      },
      {
        id: "p15-3",
        title: "3. 伺服器快取優化機制",
        description: "將常用的資料暫時儲存在伺服器端，減少資料庫查詢次數，提升回應速度",
        keywords: ["server", "cache", "redis", "database", "performance"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查伺服器快取設定

// 檢查是否有實作伺服器端快取
// 1. 商品列表、使用者資料等常用資料是否每次都查詢資料庫？
// 2. 是否有使用 Redis 或其他快取機制？
// 3. 資料庫查詢次數是否過多？`,
          fix: `【Cursor 自動化指令】自動實作伺服器快取機制

// 伺服器快取是將常用的資料暫時儲存起來，而不是每次都重新從資料庫查詢
// 這樣可以大幅減少資料庫的負擔，讓網站回應速度更快

// 1. 使用 Supabase Edge Functions 實作快取層
// supabase/functions/cached-products/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 簡單的記憶體快取（生產環境建議使用 Redis）
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 分鐘

serve(async (req) => {
  const cacheKey = 'products-list';
  const cached = cache.get(cacheKey);
  
  // 檢查快取是否有效
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cached.data), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // 快取失效或不存在，從資料庫查詢
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const { data, error } = await supabase
    .from('{{table_name}}')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // 更新快取
  cache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
  
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// 2. 使用 Redis 快取（推薦用於生產環境）
// 需要先安裝 Redis 或使用 Upstash Redis
import { Redis } from "https://deno.land/x/upstash_redis@v1.19.3/mod.ts";

const redis = new Redis({
  url: Deno.env.get('REDIS_URL') || "{{redis_url}}",
  token: Deno.env.get('REDIS_TOKEN') || "{{redis_token}}",
});

serve(async (req) => {
  const cacheKey = 'products-list';
  
  // 嘗試從 Redis 取得快取
  const cached = await redis.get(cacheKey);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // 從資料庫查詢
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const { data, error } = await supabase
    .from('{{table_name}}')
    .select('*');
  
  if (error) throw error;
  
  // 存入 Redis，設定 5 分鐘過期
  await redis.setex(cacheKey, 300, JSON.stringify(data));
  
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// 3. 快取使用者個人資料
const getUserProfile = async (userId: string) => {
  const cacheKey = \`user-profile:\${userId}\`;
  
  // 檢查快取
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // 查詢資料庫
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  // 存入快取（1 小時）
  await redis.setex(cacheKey, 3600, JSON.stringify(data));
  
  return data;
};

// 4. 快取熱門文章內容
const getPopularPosts = async () => {
  const cacheKey = 'popular-posts';
  const cached = await redis.get(cacheKey);
  
  if (cached) return JSON.parse(cached);
  
  const { data } = await supabase
    .from('posts')
    .select('*')
    .order('views', { ascending: false })
    .limit(10);
  
  // 快取 10 分鐘
  await redis.setex(cacheKey, 600, JSON.stringify(data));
  
  return data;
};

// 5. 清除快取（當資料更新時）
const invalidateCache = async (key: string) => {
  await redis.del(key);
  // 或清除相關的所有快取
  // await redis.del('products-list', 'popular-posts');
};`,
          verify: `【Cursor 自動化指令】驗證伺服器快取

// 1. 測試快取效果：第一次請求應該較慢，第二次應該很快
// 2. 檢查資料庫查詢次數：應該明顯減少
// 3. 測試快取過期：等待 TTL 時間後，應該重新查詢資料庫
// 4. 測試快取清除：更新資料後，快取應該被清除`
        }
      },
      {
        id: "p15-4",
        title: "4. 客戶端快取優化機制",
        description: "將資料儲存在使用者的瀏覽器中，避免重複從伺服器下載，讓頁面載入更快",
        keywords: ["client", "cache", "browser", "localStorage", "sessionStorage"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查客戶端快取設定

// 檢查是否有實作客戶端快取
// 1. 使用者看過的文章是否每次都重新下載？
// 2. 個人設定（語言、主題色）是否每次都從伺服器取得？
// 3. 圖片、字體等不常變動的檔案是否重複下載？`,
          fix: `【Cursor 自動化指令】自動實作客戶端快取機制

// 客戶端快取是把資料儲存在使用者的瀏覽器中
// 這樣同樣的資料就不需要重複從伺服器下載

// 1. 使用 localStorage 快取使用者看過的文章
function useArticleCache() {
  const getCachedArticle = (articleId: string) => {
    const cached = localStorage.getItem(\`article:\${articleId}\`);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // 檢查是否過期（24 小時）
      if (Date.now() - timestamp < 1000 * 60 * 60 * 24) {
        return data;
      }
    }
    return null;
  };
  
  const setCachedArticle = (articleId: string, data: any) => {
    localStorage.setItem(\`article:\${articleId}\`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  };
  
  return { getCachedArticle, setCachedArticle };
}

// 使用範例
function ArticlePage({ articleId }) {
  const { getCachedArticle, setCachedArticle } = useArticleCache();
  const [article, setArticle] = useState(getCachedArticle(articleId));
  
  useEffect(() => {
    if (!article) {
      // 從伺服器取得
      supabase
        .from('articles')
        .select('*')
        .eq('id', articleId)
        .single()
        .then(({ data }) => {
          setArticle(data);
          setCachedArticle(articleId, data);
        });
    }
  }, [articleId]);
  
  return <div>{article?.content}</div>;
}

// 2. 使用 sessionStorage 快取個人設定（語言、主題色）
function useUserSettings() {
  const getSettings = () => {
    const cached = sessionStorage.getItem('user-settings');
    return cached ? JSON.parse(cached) : null;
  };
  
  const setSettings = (settings: any) => {
    sessionStorage.setItem('user-settings', JSON.stringify(settings));
  };
  
  const [settings, setSettingsState] = useState(getSettings() || {
    language: 'zh-TW',
    theme: 'light',
  });
  
  useEffect(() => {
    // 從伺服器同步設定
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setSettingsState(data);
          setSettings(data);
        }
      });
  }, []);
  
  const updateSettings = (newSettings: any) => {
    setSettingsState(newSettings);
    setSettings(newSettings);
    // 同步到伺服器
    supabase.from('user_settings').upsert(newSettings);
  };
  
  return { settings, updateSettings };
}

// 3. 使用 IndexedDB 快取大量資料（如圖片、字體）
async function cacheImage(url: string) {
  const cacheName = 'image-cache-v1';
  const cache = await caches.open(cacheName);
  
  // 檢查快取
  const cached = await cache.match(url);
  if (cached) {
    return cached.blob();
  }
  
  // 下載並快取
  const response = await fetch(url);
  await cache.put(url, response.clone());
  return response.blob();
}

// 使用範例
function CachedImage({ src, alt }) {
  const [imageUrl, setImageUrl] = useState(null);
  
  useEffect(() => {
    cacheImage(src).then(blob => {
      setImageUrl(URL.createObjectURL(blob));
    });
  }, [src]);
  
  return imageUrl ? <img src={imageUrl} alt={alt} /> : <div>載入中...</div>;
}

// 4. 使用 Service Worker 快取 API 回應
// public/sw.js
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((response) => {
          const responseClone = response.clone();
          caches.open('api-cache-v1').then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        });
      })
    );
  }
});

// 5. 使用 React Query 的持久化快取
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24 小時
});`,
          verify: `【Cursor 自動化指令】驗證客戶端快取

// 1. 測試 localStorage：重新整理頁面後，資料應該還在
// 2. 測試 sessionStorage：關閉分頁後應該清除
// 3. 檢查 Network tab：第二次載入應該從快取讀取
// 4. 測試 IndexedDB：大量資料應該被快取`
        }
      },
      {
        id: "p15-5",
        title: "5. React Query 優化",
        description: "自動處理資料的快取、更新、重新驗證等複雜邏輯，讓資料獲取更簡單高效",
        keywords: ["react-query", "tanstack", "cache", "refetch", "stale"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查 React Query 設定

// 檢查是否有使用 React Query
// 1. 是否手動管理資料的存取和更新？
// 2. 是否有重複的 API 請求？
// 3. 是否自動處理資料的快取、更新、重新驗證？`,
          fix: `【Cursor 自動化指令】自動實作 React Query 優化

// React Query 會自動處理資料的記憶、更新檢查、背景刷新和錯誤處理
// 讓你專注在功能開發上

// 1. 基本設定 - 從後台獲取商品資料
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['products'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('{{table_name}}')
      .select('*');
    if (error) throw error;
    return data;
  },
  staleTime: 1000 * 60 * 5, // 5 分鐘內視為新鮮資料
  cacheTime: 1000 * 60 * 30, // 30 分鐘後清除快取
  refetchOnWindowFocus: false, // 視窗聚焦時不自動重新取得
  refetchOnMount: false, // 組件掛載時不自動重新取得
});

// 2. 載入使用者的訂單紀錄
const { data: orders } = useQuery({
  queryKey: ['orders', userId],
  queryFn: async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return data;
  },
  enabled: !!userId, // 只有 userId 存在時才執行
});

// 3. 即時同步的購物車內容
import { useQuery, useQueryClient } from '@tanstack/react-query';

const { data: cart } = useQuery({
  queryKey: ['cart', userId],
  queryFn: async () => {
    const { data } = await supabase
      .from('cart_items')
      .select('*, products(*)')
      .eq('user_id', userId);
    return data;
  },
  // 每 30 秒自動重新驗證
  refetchInterval: 30000,
});

// 使用 Supabase Realtime 自動更新
useEffect(() => {
  const channel = supabase
    .channel('cart-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cart_items',
      filter: \`user_id=eq.\${userId}\`
    }, () => {
      // 自動重新取得資料
      queryClient.invalidateQueries(['cart', userId]);
    })
    .subscribe();

  return () => channel.unsubscribe();
}, [userId]);

// 4. 自動處理載入中和錯誤狀態
function ProductsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  if (isLoading) return <div>載入中...</div>;
  if (error) return <div>錯誤：{error.message}</div>;
  
  return (
    <div>
      {data?.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// 5. 背景自動刷新過期的資料
const { data } = useQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
  staleTime: 1000 * 60 * 5, // 5 分鐘後視為過期
  // 當資料過期時，在背景自動重新取得
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
});

// 6. 設定全域預設值
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 預設 5 分鐘
      cacheTime: 1000 * 60 * 30, // 預設 30 分鐘
      retry: 3, // 失敗時重試 3 次
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  );
}`,
          verify: `【Cursor 自動化指令】驗證 React Query 優化

// 1. 檢查 Network tab：相同查詢應該不會重複請求
// 2. 測試自動重新驗證：資料過期後應該在背景刷新
// 3. 測試錯誤處理：API 失敗時應該顯示錯誤訊息
// 4. 檢查 React Query DevTools：確認快取狀態正常`
        }
      },
      {
        id: "p15-6",
        title: "6. 圖片載入優化",
        description: "壓縮畫質、使用現代格式（WebP）、預載入重要圖片，減少載入時間",
        keywords: ["image", "webp", "compress", "lazy", "preload"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查圖片載入優化

// 檢查圖片載入設定
// 1. 圖片檔案大小是否過大？
// 2. 是否使用 WebP 等現代格式？
// 3. 首屏圖片是否有預載入？
// 4. 是否使用 lazy loading？`,
          fix: `【Cursor 自動化指令】自動優化圖片載入

// 圖片載入優化包含三個主要技術：
// 1. 壓縮畫質 - 降低檔案大小但保持視覺品質
// 2. 使用現代格式（如 WebP）- 比傳統 JPG/PNG 更小
// 3. 預載入 - 提前載入重要圖片，避免空白畫面

// 1. 使用 Supabase Storage 的圖片轉換功能
const getOptimizedImageUrl = (path: string, width?: number) => {
  const { data } = supabase.storage
    .from('{{bucket_name}}')
    .getPublicUrl(path);
  
  // Supabase 自動提供圖片優化
  // 可以透過 URL 參數調整大小和品質
  if (width) {
    return \`\${data.publicUrl}?width=\${width}&quality=80\`;
  }
  return data.publicUrl;
};

// 2. 使用 Next.js Image 元件（如果使用 Next.js）
import Image from 'next/image';

<Image
  src={imageUrl}
  alt="Description"
  width={800}
  height={600}
  loading="lazy" // 懶加載
  placeholder="blur" // 模糊佔位符
  quality={80} // 品質設定（降低檔案大小）
/>

// 3. 原生 React 圖片優化
<img
  src={imageUrl}
  alt="Description"
  loading="lazy" // 原生懶加載
  decoding="async" // 非同步解碼
  onError={(e) => {
    // 載入失敗時使用備用圖片
    e.currentTarget.src = '/fallback-image.png';
  }}
/>

// 4. 使用 WebP 格式（比 JPG/PNG 更小）
const getWebPImage = (originalUrl: string) => {
  // 檢查瀏覽器是否支援 WebP
  const supportsWebP = document.createElement('canvas')
    .toDataURL('image/webp')
    .indexOf('data:image/webp') === 0;
  
  if (supportsWebP) {
    return originalUrl.replace(/\\.(jpg|png)$/, '.webp');
  }
  return originalUrl;
};

// 5. 預載入首頁的大圖 banner
<link rel="preload" href="/hero-banner.jpg" as="image" />

// 或使用 JavaScript 預載入
const preloadImage = (src: string) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  document.head.appendChild(link);
};

// 預載入關鍵圖片
useEffect(() => {
  preloadImage('/hero-banner.jpg');
  preloadImage('/logo.png');
}, []);

// 6. 商品縮圖列表 - 使用適當尺寸
function ProductThumbnail({ product }) {
  const thumbnailUrl = getOptimizedImageUrl(
    product.image_path,
    300 // 縮圖只需要 300px 寬度
  );
  
  return (
    <img
      src={thumbnailUrl}
      alt={product.name}
      loading="lazy"
      width={300}
      height={300}
    />
  );
}

// 7. 個人頭像 - 使用小尺寸
function UserAvatar({ userId }) {
  const avatarUrl = getOptimizedImageUrl(
    \`avatars/\${userId}.jpg\`,
    100 // 頭像只需要 100px
  );
  
  return (
    <img
      src={avatarUrl}
      alt="Avatar"
      width={100}
      height={100}
      className="rounded-full"
    />
  );
}`,
          verify: `【Cursor 自動化指令】驗證圖片載入優化

// 1. 檢查 Network tab：圖片大小應該明顯減少
// 2. 測試 lazy loading：滾動頁面時圖片才載入
// 3. 測試預載入：首屏圖片應該立即顯示
// 4. 使用 Lighthouse 檢查圖片優化分數
// 5. 檢查 Core Web Vitals：LCP < 2.5s`
        }
      },
      {
        id: "p15-7",
        title: "7. 非同步處理技術",
        description: "將耗時的工作放到背景執行，不會阻擋其他操作，讓使用者可以繼續使用介面",
        keywords: ["async", "background", "worker", "queue", "processing"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查非同步處理實作

// 檢查耗時操作是否阻塞 UI
// 1. 上傳大型檔案時，使用者是否可以繼續操作？
// 2. 匯出報表時，介面是否會卡住？
// 3. 批次處理資料時，是否影響使用者體驗？`,
          fix: `【Cursor 自動化指令】自動實作非同步處理技術

// 非同步處理是指將耗時的工作放到背景執行
// 不會阻擋其他操作，使用者可以繼續使用介面

// 1. 上傳大型檔案 - 使用非同步上傳
async function uploadLargeFile(file: File) {
  // 顯示上傳進度
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  setIsUploading(true);
  
  try {
    const { data, error } = await supabase.storage
      .from('{{bucket_name}}')
      .upload(\`files/\${file.name}\`, file, {
        cacheControl: '3600',
        upsert: false,
        // 非同步上傳，不阻塞 UI
      });
    
    if (error) throw error;
    
    // 上傳完成後通知使用者
    toast.success('檔案上傳成功！');
    return data;
  } catch (error) {
    toast.error('上傳失敗：' + error.message);
  } finally {
    setIsUploading(false);
  }
}

// 使用 Web Worker 處理大型檔案
const worker = new Worker(new URL('./file-processor.worker.ts', import.meta.url));

worker.postMessage({ file, action: 'process' });

worker.onmessage = (e) => {
  const { progress, result } = e.data;
  setUploadProgress(progress);
  
  if (result) {
    // 處理完成
    handleProcessedFile(result);
  }
};

// 2. 匯出報表 - 使用背景任務
async function exportReport(reportType: string) {
  // 顯示載入狀態，但不阻塞 UI
  const [isExporting, setIsExporting] = useState(false);
  
  setIsExporting(true);
  
  try {
    // 在 Edge Function 中處理（不阻塞前端）
    const { data, error } = await supabase.functions.invoke('export-report', {
      body: { reportType },
    });
    
    if (error) throw error;
    
    // 下載檔案
    const link = document.createElement('a');
    link.href = data.downloadUrl;
    link.download = \`report-\${Date.now()}.xlsx\`;
    link.click();
    
    toast.success('報表匯出成功！');
  } catch (error) {
    toast.error('匯出失敗：' + error.message);
  } finally {
    setIsExporting(false);
  }
}

// Edge Function: supabase/functions/export-report/index.ts
serve(async (req) => {
  const { reportType } = await req.json();
  
  // 在背景處理大量資料
  const reportData = await generateReport(reportType);
  
  // 上傳到 Storage
  const fileName = \`reports/\${reportType}-\${Date.now()}.xlsx\`;
  await supabase.storage.from('reports').upload(fileName, reportData);
  
  // 返回下載連結
  const { data } = supabase.storage.from('reports').getPublicUrl(fileName);
  
  return new Response(JSON.stringify({ downloadUrl: data.publicUrl }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// 3. 批次處理資料 - 使用佇列
class TaskQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  
  async add(task: () => Promise<any>) {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.process();
    });
  }
  
  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
        // 每處理一個任務，讓 UI 有機會更新
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    this.processing = false;
  }
}

const taskQueue = new TaskQueue();

// 批次處理大量資料
async function batchProcessData(items: any[]) {
  const [progress, setProgress] = useState(0);
  
  for (let i = 0; i < items.length; i++) {
    await taskQueue.add(async () => {
      // 處理單一項目
      await processItem(items[i]);
      
      // 更新進度
      setProgress(((i + 1) / items.length) * 100);
    });
  }
  
  toast.success('批次處理完成！');
}

// 4. 使用 Web Worker 處理複雜計算
// worker.ts
self.onmessage = (e) => {
  const { data, type } = e.data;
  
  if (type === 'process') {
    // 複雜的資料處理
    const result = heavyComputation(data);
    
    // 回傳結果
    self.postMessage({ result });
  }
};

// 在主執行緒使用
const worker = new Worker(new URL('./worker.ts', import.meta.url));

worker.postMessage({ data: largeDataset, type: 'process' });

worker.onmessage = (e) => {
  const { result } = e.data;
  // 更新 UI（不會阻塞）
  setProcessedData(result);
};

// 5. 使用 setTimeout 將任務分解
function processLargeArray(array: any[], chunkSize = 100) {
  let index = 0;
  
  function processChunk() {
    const chunk = array.slice(index, index + chunkSize);
    
    // 處理這個 chunk
    chunk.forEach(item => processItem(item));
    
    index += chunkSize;
    
    if (index < array.length) {
      // 讓 UI 有機會更新，然後繼續處理
      setTimeout(processChunk, 0);
    } else {
      console.log('處理完成！');
    }
  }
  
  processChunk();
}`,
          verify: `【Cursor 自動化指令】驗證非同步處理

// 1. 測試上傳大型檔案：上傳時應該可以繼續操作介面
// 2. 測試匯出報表：應該顯示進度，但不阻塞 UI
// 3. 測試批次處理：應該顯示進度條，介面保持響應
// 4. 檢查 Web Worker：複雜計算應該在背景執行
// 5. 測試任務佇列：多個任務應該依序處理，不阻塞 UI`
        }
      }
    ]
  },
  // ===== 基本功能模組 =====
  {
    id: 16,
    title: "名單搜集表單",
    shortTitle: "名單搜集",
    purpose: "建立一個名單搜集表單，放在首頁下方，收集用戶的基本資訊和詢問內容。",
    badge: "common",
    category: "templates",
    keywords: ["form", "contact", "lead", "collection", "survey"],
    checklist: [
      { id: "16-1", label: "表單欄位設計完成", completed: false },
      { id: "16-2", label: "表單驗證功能正常", completed: false },
      { id: "16-3", label: "資料儲存功能正常", completed: false },
      { id: "16-4", label: "成功提交提示顯示", completed: false },
    ],
    prompts: [
      {
        id: "p16-1",
        title: "名單搜集表單",
        description: "使用 Lovable Cloud 實現一個名單搜集的表單，放在首頁下方",
        keywords: ["form", "contact", "lead", "collection"],
        variables: [
          {
            key: "user_name_label",
            label: "用戶稱呼方式",
            placeholder: "例如：姓名、暱稱",
            description: "第一個欄位的標籤文字"
          },
          {
            key: "user_email_label",
            label: "用戶的 Email",
            placeholder: "例如：Email、電子郵件",
            description: "第二個欄位的標籤文字"
          },
          {
            key: "question_label",
            label: "想詢問的問題、搜集的資料",
            placeholder: "例如：對 AI 工具的了解程度 (完全沒嘗試過 / 有嘗試但不多 / 完全導入工作)",
            description: "第三個欄位的標籤文字和選項"
          }
        ],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查表單需求

請確認以下需求：
1. 表單位置：首頁下方
2. 需要收集的資料：
   - {{user_name_label}}
   - {{user_email_label}}
   - {{question_label}}
3. 表單驗證：Email 格式驗證
4. 提交後處理：儲存到資料庫並顯示成功訊息`,
          fix: `【Cursor 自動化指令】實作名單搜集表單

請幫我使用 Lovable Cloud 實現一個名單搜集的表單，放在首頁下方，會搜集三個資料：

1. {{user_name_label}}
2. {{user_email_label}}
3. {{question_label}}

實作要求：
1. 建立一個表單組件，包含三個輸入欄位
2. 實作 Email 格式驗證
3. 表單提交後，將資料儲存到 Supabase 資料庫
4. 顯示成功提交的提示訊息
5. 表單重置功能

資料庫表格結構建議：
- id (uuid, primary key)
- user_name (text)
- user_email (text, unique)
- question_answer (text)
- created_at (timestamp)

請使用 React Hook Form 或類似的表單管理庫來處理表單狀態和驗證。`,
          verify: `【Cursor 自動化指令】驗證表單功能

請測試以下功能：
1. 表單欄位是否正確顯示（{{user_name_label}}、{{user_email_label}}、{{question_label}}）
2. Email 格式驗證是否正常運作
3. 提交後資料是否正確儲存到資料庫
4. 成功提示訊息是否顯示
5. 表單重置功能是否正常`
        }
      }
    ]
  },
  {
    id: 17,
    title: "後台管理頁面",
    shortTitle: "後台管理",
    purpose: "建立一個簡單的後台管理頁面，用於查看和管理收集的資料，並透過密碼保護。",
    badge: "common",
    category: "templates",
    keywords: ["admin", "dashboard", "management", "password", "auth"],
    checklist: [
      { id: "17-1", label: "後台頁面路由建立", completed: false },
      { id: "17-2", label: "密碼保護功能實作", completed: false },
      { id: "17-3", label: "資料列表顯示功能", completed: false },
      { id: "17-4", label: "密碼儲存在 Secret", completed: false },
    ],
    prompts: [
      {
        id: "p17-1",
        title: "後台管理頁面",
        description: "建立一個簡單的後台管理頁面，用來查看和管理收集的資料",
        keywords: ["admin", "dashboard", "management", "password"],
        variables: [
          {
            key: "backend_function",
            label: "後台功能",
            placeholder: "例如：查看前面用戶名單搜集的結果",
            description: "後台頁面的主要功能描述"
          },
          {
            key: "admin_password",
            label: "管理密碼",
            placeholder: "例如：mySecurePassword123",
            description: "後台管理頁面的登入密碼（將儲存在 Secret）"
          }
        ],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查後台管理需求

請確認以下需求：
1. 後台功能：{{backend_function}}
2. 權限保護：使用密碼保護
3. 密碼儲存：存在 Secret（環境變數）
4. 資料顯示：列表形式顯示收集的資料`,
          fix: `【Cursor 自動化指令】實作後台管理頁面

請幫我建立一個簡單的後台管理頁面，用來 {{backend_function}}。幫我：

1. 建立一個後台管理頁面，並透過密碼來做權限保護
   - 建立 /admin 路由
   - 實作密碼輸入頁面
   - 使用 sessionStorage 或 cookie 儲存登入狀態
   - 密碼驗證邏輯

2. 密碼請讓我自己決定，存在 Secret
   - 在環境變數中設定 ADMIN_PASSWORD={{admin_password}}
   - 使用 process.env.ADMIN_PASSWORD 或 NEXT_PUBLIC_ADMIN_PASSWORD
   - 注意：如果使用 NEXT_PUBLIC_ 前綴，密碼會暴露在前端，建議使用 API route 驗證

3. 實作資料顯示功能
   - 從 Supabase 讀取收集的資料
   - 以表格或列表形式顯示
   - 包含分頁功能（如果資料量大）

4. 實作登出功能
   - 清除登入狀態
   - 導向登入頁面

建議實作方式：
- 使用 Next.js API Route 處理密碼驗證（更安全）
- 或使用 Server Component 驗證（Next.js 13+）
- 使用 Supabase 查詢資料`,
          verify: `【Cursor 自動化指令】驗證後台管理功能

請測試以下功能：
1. 未登入時訪問 /admin 是否會導向登入頁
2. 輸入正確密碼（{{admin_password}}）是否可以成功登入
3. 輸入錯誤密碼是否會顯示錯誤訊息
4. 登入後是否可以正常查看 {{backend_function}}
5. 登出功能是否正常運作
6. 資料列表是否正確顯示`
        }
      }
    ]
  },
  {
    id: 18,
    title: "互動報價功能",
    shortTitle: "互動報價",
    purpose: "建立一個互動報價功能，讓使用者可以依照自己需求選擇服務項目，自動生成報價。",
    badge: "common",
    category: "templates",
    keywords: ["quote", "pricing", "calculator", "interactive", "service"],
    checklist: [
      { id: "18-1", label: "服務項目選單建立", completed: false },
      { id: "18-2", label: "報價計算邏輯實作", completed: false },
      { id: "18-3", label: "報價結果顯示", completed: false },
      { id: "18-4", label: "報價方案選擇功能", completed: false },
    ],
    prompts: [
      {
        id: "p18-1",
        title: "互動報價功能",
        description: "建立一個互動報價功能，讓使用者可以依照自己需求選擇，自動生成報價",
        keywords: ["quote", "pricing", "calculator", "interactive"],
        variables: [
          {
            key: "service_items",
            label: "服務項目",
            placeholder: "例如：網站設計、SEO 優化、內容行銷、社群管理",
            description: "可選擇的服務項目列表（用逗號分隔）"
          },
          {
            key: "quote_plans",
            label: "報價方案",
            placeholder: "例如：\n基本方案：$10,000\n進階方案：$20,000\n專業方案：$30,000",
            description: "報價方案和價格（每行一個方案）"
          }
        ],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查互動報價需求

請確認以下需求：
1. 服務項目：{{service_items}}
2. 報價方案：{{quote_plans}}
3. 互動方式：使用者選擇服務項目後自動計算報價
4. 顯示方式：即時顯示報價結果`,
          fix: `【Cursor 自動化指令】實作互動報價功能

我想建立一個[{{service_items}}]的互動報價功能，讓使用者可以依照自己需求選擇，自動生成報價：

{{quote_plans}}

實作要求：
1. 建立服務項目選擇介面
   - 使用 checkbox 或 toggle 讓使用者選擇服務項目
   - 每個服務項目顯示名稱和價格
   - 支援多選

2. 實作報價計算邏輯
   - 根據選擇的服務項目自動計算總價
   - 即時更新報價結果
   - 顯示明細（選擇的項目和個別價格）

3. 實作報價方案選擇
   - 根據 {{quote_plans}} 顯示不同方案
   - 使用者可以選擇方案或自訂組合
   - 方案選擇後自動更新總價

4. 實作報價結果顯示
   - 顯示總價
   - 顯示選擇的服務項目明細
   - 提供「取得報價」或「聯絡我們」按鈕

5. 可選功能
   - 儲存報價記錄到資料庫
   - 發送報價單到 Email
   - 匯出 PDF 報價單

建議實作方式：
- 使用 React state 管理選擇的服務項目
- 使用 useMemo 計算總價（效能優化）
- 使用 Supabase 儲存報價記錄（如果需要）`,
          verify: `【Cursor 自動化指令】驗證互動報價功能

請測試以下功能：
1. 服務項目選擇是否正常運作（{{service_items}}）
2. 選擇項目後報價是否即時更新
3. 報價方案選擇是否正常（{{quote_plans}}）
4. 總價計算是否正確
5. 報價結果顯示是否完整
6. 「取得報價」按鈕是否正常運作`
        }
      }
    ]
  },
  // ===== 部署問題 =====
  {
    id: 19,
    title: "Cloudflare Pages 部署問題",
    shortTitle: "部署問題",
    purpose: "解決 Cloudflare Pages 部署失敗、建置錯誤、環境變數設定、套件管理器衝突等部署相關問題。",
    badge: "common",
    category: "deployment",
    keywords: ["cloudflare", "pages", "deploy", "build", "npm", "bun", "error", "522", "accountId"],
    checklist: [
      { id: "19-1", label: "檢查建置命令是否正確", completed: false },
      { id: "19-2", label: "確認套件管理器設定（npm vs bun）", completed: false },
      { id: "19-3", label: "驗證環境變數設定", completed: false },
      { id: "19-4", label: "檢查建置輸出目錄", completed: false },
      { id: "19-5", label: "確認 Node.js 版本", completed: false },
    ],
    prompts: [
      {
        id: "p19-1",
        title: "1. 建置命令錯誤診斷",
        description: "診斷建置命令是否正確執行，檢查 dist 目錄是否產生",
        keywords: ["build", "command", "dist", "output"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】診斷 Cloudflare Pages 建置命令問題

檢查建置日誌中的錯誤訊息：

1. 如果看到 "Executing user command: CF_PAGES=1" 但沒有建置輸出：
   → 問題：建置命令只設定了環境變數，沒有執行實際建置
   → 解決：建置命令必須包含 "npm run build"

2. 如果看到 "Error: Output directory 'dist' not found"：
   → 問題：建置沒有執行或失敗，dist 目錄未產生
   → 檢查：建置日誌中是否有錯誤訊息

3. 檢查建置命令設定：
   - 前往 Cloudflare Dashboard > Settings > Builds & deployments
   - 確認 Build command 是否為：npm ci && CF_PAGES=1 npm run build
   - 確認 Build output directory 是否為：dist

4. 驗證本地建置：
   CF_PAGES=1 npm run build
   ls -la dist/  # 確認 dist 目錄存在`,
          fix: `【Cursor 自動化指令】修復 Cloudflare Pages 建置命令

在 Cloudflare Dashboard 中設定正確的建置命令：

1. 前往：https://dash.cloudflare.com
   Workers & Pages > 您的專案 > Settings > Builds & deployments

2. 設定建置命令（兩種方式）：

   方式 A - 單一建置命令（推薦）：
   Build command: npm ci && CF_PAGES=1 npm run build
   
   方式 B - 分開設定：
   Install command: npm ci
   Build command: CF_PAGES=1 npm run build

3. 確認其他設定：
   - Build output directory: dist
   - Root directory: / (留空)
   - Node.js version: 20
   - Framework preset: Vite 或 None

4. 環境變數（可選，因為已在建置命令中設定）：
   - CF_PAGES = 1
   - NODE_ENV = production

5. 點擊 Save 儲存設定

6. 重新部署：點擊 Retry deployment 或 Create deployment`,
          verify: `【Cursor 自動化指令】驗證建置命令修復

檢查建置日誌應該會看到：

1. ✅ 安裝依賴：
   Installing project dependencies: npm clean-install
   added XXX packages...

2. ✅ 執行建置：
   Executing user command: npm ci && CF_PAGES=1 npm run build
   vite v5.4.19 building for production...
   ✓ built in X.XXs

3. ✅ 找到輸出目錄：
   Validating asset output directory
   Success: Found output directory "dist"

4. ✅ 部署成功：
   Deployment successful

如果看到以上訊息，表示建置命令已正確設定。`
        }
      },
      {
        id: "p19-2",
        title: "2. 套件管理器衝突（npm vs bun）",
        description: "解決 Cloudflare Pages 自動偵測錯誤套件管理器的問題",
        keywords: ["npm", "bun", "package", "manager", "lockfile"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】診斷套件管理器衝突

檢查專案中的 lockfile 檔案：

1. 檢查專案根目錄：
   ls -la | grep -E "lock|package"
   
   如果同時存在：
   - package-lock.json (npm)
   - bun.lockb (bun)
   
   → 問題：Cloudflare Pages 可能自動偵測到 bun.lockb 並嘗試使用 bun install

2. 檢查建置日誌：
   如果看到 "bun install" 或 "bun.lockb" 相關錯誤：
   → 問題：Cloudflare Pages 嘗試使用 bun 但專案使用 npm

3. 檢查 package.json：
   - 確認沒有指定 "packageManager": "bun"
   - 確認 scripts 使用 npm 命令

4. 驗證專案實際使用的套件管理器：
   - 檢查 package-lock.json 是否存在（使用 npm）
   - 檢查是否有 bun 相關配置`,
          fix: `【Cursor 自動化指令】修復套件管理器衝突

解決方案 1：刪除不需要的 bun.lockb（如果專案使用 npm）

1. 確認專案使用 npm：
   - 檢查 package-lock.json 是否存在
   - 檢查 package.json 中的 scripts 是否使用 npm

2. 刪除 bun.lockb：
   rm bun.lockb
   git add bun.lockb
   git commit -m "Remove bun.lockb, project uses npm only"
   git push origin main

解決方案 2：在 Cloudflare Dashboard 中明確指定 npm

1. 前往：Settings > Builds & deployments
2. 設定 Install command: npm ci
3. 確認 Build command 使用 npm：npm ci && CF_PAGES=1 npm run build
4. 儲存設定

解決方案 3：在 .cloudflare/pages.json 中指定

{
  "packageManager": "npm",
  "installCommand": "npm ci",
  "buildCommand": "npm ci && CF_PAGES=1 npm run build"
}

注意：Cloudflare Dashboard 中的設定優先級更高。`,
          verify: `【Cursor 自動化指令】驗證套件管理器修復

檢查建置日誌應該會看到：

1. ✅ 使用 npm 安裝依賴：
   Installing project dependencies: npm clean-install
   或
   npm ci
   
   而不是：
   ❌ bun install

2. ✅ 建置成功：
   npm run build
   ✓ built in X.XXs

3. ✅ 沒有 bun 相關錯誤：
   - 沒有 "bun.lockb" 錯誤
   - 沒有 "bun install" 失敗

如果看到以上結果，表示套件管理器問題已解決。`
        }
      },
      {
        id: "p19-3",
        title: "3. Error 522 連線逾時",
        description: "解決 Cloudflare Pages 部署後出現 522 錯誤的問題",
        keywords: ["522", "timeout", "connection", "deploy", "error"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】診斷 Error 522 問題

Error 522: Connection timed out 表示 Cloudflare 無法連接到源服務器。

檢查項目：

1. 檢查 Cloudflare Dashboard 中的部署狀態：
   - 前往：Workers & Pages > 您的專案 > Deployments
   - 查看最新的部署狀態
   - 如果顯示 "Failed" 或 "Building"，點擊查看建置日誌

2. 檢查專案是否存在：
   - 確認 Cloudflare Pages 專案已正確建立
   - 確認 GitHub 倉庫已正確連接

3. 檢查建置配置：
   - 確認建置命令是否正確
   - 確認建置輸出目錄是否正確
   - 確認環境變數是否設定

4. 檢查建置日誌：
   - 查看是否有建置錯誤
   - 查看是否有 "Output directory not found" 錯誤`,
          fix: `【Cursor 自動化指令】修復 Error 522 問題

解決步驟：

1. 確認專案存在：
   - 前往 Cloudflare Dashboard
   - 確認 Pages 專案已建立
   - 如果不存在，建立新專案並連接 GitHub 倉庫

2. 檢查建置配置：
   - Settings > Builds & deployments
   - Build command: npm ci && CF_PAGES=1 npm run build
   - Build output directory: dist
   - Node.js version: 20

3. 重新部署：
   - 點擊 Retry deployment 或 Create deployment
   - 選擇分支：main
   - 等待建置完成（約 2-5 分鐘）

4. 如果建置失敗：
   - 查看建置日誌中的錯誤訊息
   - 根據錯誤訊息修正配置
   - 重新部署

5. 如果專案不存在：
   - Workers & Pages > Create application > Pages > Connect to Git
   - 選擇 GitHub 倉庫
   - 設定建置配置
   - 點擊 Save and Deploy`,
          verify: `【Cursor 自動化指令】驗證 Error 522 修復

檢查以下項目：

1. ✅ Cloudflare Dashboard：
   - 部署狀態顯示 "Success"
   - 建置日誌沒有錯誤
   - 最新的部署已完成

2. ✅ 網站訪問：
   - 前往部署網址（例如：https://your-project.pages.dev）
   - 網站可以正常訪問
   - 沒有 522 或 404 錯誤

3. ✅ 自動部署：
   - 推送代碼到 main 分支
   - Cloudflare 自動觸發部署
   - 部署成功完成

如果以上都正常，表示 Error 522 問題已解決。`
        }
      },
      {
        id: "p19-4",
        title: "4. GitHub Actions 與 Cloudflare Dashboard 衝突",
        description: "解決同時使用 GitHub Actions 和 Cloudflare Dashboard 導致的重複部署和錯誤",
        keywords: ["github", "actions", "workflow", "secrets", "accountId", "duplicate"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】診斷部署方式衝突

檢查是否有兩種部署方式同時運作：

1. 檢查 GitHub Actions：
   - 前往：https://github.com/您的倉庫/actions
   - 查看是否有 "Deploy to Cloudflare Pages" workflow
   - 如果執行失敗，查看錯誤訊息
   - 常見錯誤：Error: Input required and not supplied: accountId

2. 檢查 Cloudflare Dashboard：
   - 前往：Workers & Pages > 您的專案
   - 查看 Deployments 標籤
   - 確認是否有自動部署記錄

3. 如果兩種方式同時運作：
   - 每次推送會觸發兩次部署
   - GitHub Actions 需要設定 Secrets（CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID）
   - Cloudflare Dashboard 不需要 Secrets

4. 檢查 .github/workflows/ 目錄：
   ls -la .github/workflows/
   如果存在 cloudflare-pages.yml，表示使用 GitHub Actions`,
          fix: `【Cursor 自動化指令】修復部署方式衝突

推薦方案：使用 Cloudflare Dashboard Git 整合（更簡單）

1. 禁用 GitHub Actions：
   - 重命名或刪除 .github/workflows/cloudflare-pages.yml
   - 或重命名為 .github/workflows/cloudflare-pages.yml.disabled
   
   git mv .github/workflows/cloudflare-pages.yml .github/workflows/cloudflare-pages.yml.disabled
   git commit -m "Disable GitHub Actions, use Cloudflare Dashboard Git integration"
   git push origin main

2. 確認 Cloudflare Dashboard 設定：
   - 前往：Settings > Builds & deployments
   - 確認已連接 GitHub 倉庫
   - 確認建置配置正確

3. 優點：
   - ✅ 不需要設定 GitHub Secrets
   - ✅ 設定更簡單
   - ✅ 避免重複部署
   - ✅ 所有部署都在 Cloudflare Dashboard 中管理

替代方案：如果必須使用 GitHub Actions

1. 設定 GitHub Secrets：
   - 前往：Settings > Secrets and variables > Actions
   - 添加 CLOUDFLARE_API_TOKEN
   - 添加 CLOUDFLARE_ACCOUNT_ID

2. 禁用 Cloudflare Dashboard 自動部署：
   - 在 Cloudflare Dashboard 中斷開 GitHub 連接
   - 或設定為手動部署`,
          verify: `【Cursor 自動化指令】驗證部署方式修復

檢查結果：

1. ✅ 只有一種部署方式運作：
   - 如果使用 Cloudflare Dashboard：GitHub Actions 不執行
   - 如果使用 GitHub Actions：Cloudflare Dashboard 不自動部署

2. ✅ 推送代碼後：
   - 只觸發一次部署
   - 部署成功完成
   - 沒有重複部署

3. ✅ 沒有錯誤：
   - GitHub Actions 不會出現 accountId 錯誤
   - Cloudflare Dashboard 部署正常

4. ✅ 部署管理：
   - 所有部署記錄在一個地方管理
   - 建置日誌清晰明確

如果以上都正常，表示部署方式衝突已解決。`
        }
      },
      {
        id: "p19-5",
        title: "5. 環境變數與 Base Path 設定",
        description: "確保 Cloudflare Pages 使用正確的 base path 和環境變數",
        keywords: ["base", "path", "CF_PAGES", "environment", "variable"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】診斷環境變數與 Base Path 問題

檢查項目：

1. 檢查建置日誌中的環境變數：
   - 確認 CF_PAGES=1 是否已設定
   - 確認 NODE_ENV=production 是否已設定

2. 檢查建置輸出的資源路徑：
   - 查看 dist/index.html 中的資源路徑
   - 應該使用 /assets/ 而不是 /Ddbug-Runbook/assets/
   - 如果路徑錯誤，表示 base path 設定不正確

3. 檢查 vite.config.ts：
   - 確認有偵測 CF_PAGES 環境變數
   - 確認 base path 設定正確

4. 檢查 Cloudflare Dashboard 設定：
   - Settings > Builds & deployments > Environment variables
   - 確認 CF_PAGES=1 已設定`,
          fix: `【Cursor 自動化指令】修復環境變數與 Base Path

1. 在 Cloudflare Dashboard 中設定環境變數：
   - Settings > Builds & deployments > Environment variables
   - 添加：CF_PAGES = 1
   - 添加：NODE_ENV = production

2. 確認建置命令包含環境變數：
   Build command: npm ci && CF_PAGES=1 npm run build
   
   這樣可以確保建置時使用正確的 base path

3. 驗證 vite.config.ts 配置：
   // 應該有類似這樣的配置
   const isCloudflarePages = process.env.CF_PAGES || process.env.CF_PAGES_BRANCH;
   const base = isCloudflarePages ? '/' : (process.env.NODE_ENV === 'production' ? '/Ddbug-Runbook/' : '/');

4. 本地測試建置：
   CF_PAGES=1 npm run build
   cat dist/index.html | grep -E "src=|href="
   # 應該看到 /assets/ 而不是 /Ddbug-Runbook/assets/`,
          verify: `【Cursor 自動化指令】驗證環境變數與 Base Path 修復

檢查結果：

1. ✅ 建置日誌顯示：
   Executing user command: npm ci && CF_PAGES=1 npm run build
   CF_PAGES=1 已設定

2. ✅ 建置輸出的資源路徑正確：
   <script src="/assets/index-XXX.js"></script>
   <link href="/assets/index-XXX.css">
   使用 /assets/ 而不是 /Ddbug-Runbook/assets/

3. ✅ 網站可以正常訪問：
   - 所有資源正確載入
   - 沒有 404 錯誤
   - 路由功能正常

4. ✅ 環境變數生效：
   - Cloudflare Pages 使用根路徑 /
   - GitHub Pages 使用子路徑 /Ddbug-Runbook/

如果以上都正常，表示環境變數與 Base Path 設定正確。`
        }
      }
    ]
  },
  // ===== 監控與日誌系統 =====
  {
    id: 20,
    title: "錯誤追蹤與監控設定",
    shortTitle: "錯誤追蹤",
    purpose: "設定 Sentry 或其他錯誤追蹤工具，捕獲前端和後端錯誤，進行錯誤分組、通知和追蹤。",
    badge: "critical",
    category: "monitoring",
    keywords: ["sentry", "error", "tracking", "monitoring", "exception", "crash", "bug"],
    checklist: [
      { id: "20-1", label: "確認 Sentry 專案已建立", completed: false },
      { id: "20-2", label: "檢查 DSN 是否正確設定", completed: false },
      { id: "20-3", label: "驗證錯誤是否成功上報", completed: false },
      { id: "20-4", label: "設定錯誤通知規則", completed: false },
      { id: "20-5", label: "測試錯誤捕獲功能", completed: false },
    ],
    prompts: [
      {
        id: "p20-1",
        title: "1. 檢查 Sentry 設定",
        description: "診斷 Sentry 是否正確安裝和配置",
        keywords: ["sentry", "dsn", "config", "setup"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查 Sentry 錯誤追蹤設定

1. 檢查 Sentry 是否已安裝：
   npm list @sentry/react @sentry/node

2. 檢查環境變數是否設定：
   - VITE_SENTRY_DSN (前端)
   - SENTRY_DSN (後端)
   - SENTRY_ENVIRONMENT (環境名稱)

3. 檢查 Sentry 初始化程式碼：
   - 前端：src/main.tsx 或 App.tsx
   - 後端：server entry point

4. 檢查瀏覽器 Console 是否有 Sentry 相關錯誤`,
          fix: `【Cursor 自動化指令】設定 Sentry 錯誤追蹤

請幫我設定 Sentry 錯誤追蹤系統：

1. 安裝 Sentry SDK：
   npm install @sentry/react @sentry/node

2. 前端初始化（src/main.tsx 或 App.tsx）：
   import * as Sentry from "@sentry/react";
   
   Sentry.init({
     dsn: import.meta.env.VITE_SENTRY_DSN,
     environment: import.meta.env.MODE,
     integrations: [
       Sentry.browserTracingIntegration(),
       Sentry.replayIntegration(),
     ],
     tracesSampleRate: 1.0,
     replaysSessionSampleRate: 0.1,
     replaysOnErrorSampleRate: 1.0,
   });

3. 後端初始化（如果使用 Node.js）：
   import * as Sentry from "@sentry/node";
   
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 1.0,
   });

4. 設定環境變數：
   - .env.local: VITE_SENTRY_DSN=your_dsn_here
   - .env.production: VITE_SENTRY_DSN=your_production_dsn

5. 測試錯誤捕獲：
   // 測試用錯誤
   throw new Error("Test error for Sentry");`,
          verify: `【Cursor 自動化指令】驗證 Sentry 錯誤追蹤

請測試以下項目：

1. 觸發測試錯誤，確認 Sentry 收到錯誤：
   - 在 Sentry Dashboard 查看是否收到錯誤
   - 確認錯誤包含正確的堆疊追蹤
   - 確認環境標籤正確

2. 檢查錯誤詳情：
   - 用戶資訊是否正確
   - 瀏覽器/設備資訊是否記錄
   - 錯誤發生位置是否正確

3. 測試通知功能：
   - 確認錯誤通知是否發送
   - 檢查通知管道（Email/Slack）是否正常`
        }
      },
      {
        id: "p20-2",
        title: "2. 前端錯誤捕獲",
        description: "設定 React 錯誤邊界和全域錯誤處理",
        keywords: ["error", "boundary", "react", "catch"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查前端錯誤處理

檢查以下項目：
1. 是否有 Error Boundary 組件
2. 是否有全域錯誤處理（window.onerror）
3. 未處理的 Promise rejection 是否被捕獲
4. 錯誤是否正確顯示給用戶`,
          fix: `【Cursor 自動化指令】實作前端錯誤處理

1. 建立 Error Boundary 組件：
   import { Component, ReactNode } from 'react';
   import * as Sentry from '@sentry/react';
   
   interface Props {
     children: ReactNode;
   }
   
   interface State {
     hasError: boolean;
   }
   
   class ErrorBoundary extends Component<Props, State> {
     constructor(props: Props) {
       super(props);
       this.state = { hasError: false };
     }
   
     static getDerivedStateFromError() {
       return { hasError: true };
     }
   
     componentDidCatch(error: Error, errorInfo: any) {
       Sentry.captureException(error, { contexts: { react: errorInfo } });
     }
   
     render() {
       if (this.state.hasError) {
         return (
           <div className="error-fallback">
             <h2>發生錯誤</h2>
             <p>應用程式遇到問題，我們已記錄此錯誤。</p>
             <button onClick={() => window.location.reload()}>
               重新載入
             </button>
           </div>
         );
       }
       return this.props.children;
     }
   }

2. 在 App.tsx 中使用：
   <ErrorBoundary>
     <App />
   </ErrorBoundary>

3. 設定全域錯誤處理：
   window.addEventListener('error', (event) => {
     Sentry.captureException(event.error);
   });
   
   window.addEventListener('unhandledrejection', (event) => {
     Sentry.captureException(event.reason);
   });`,
          verify: `測試錯誤處理：
1. 在組件中故意拋出錯誤
2. 確認 Error Boundary 正確顯示
3. 確認 Sentry 收到錯誤報告
4. 測試未處理的 Promise rejection`
        }
      }
    ]
  },
  {
    id: 21,
    title: "效能監控與 Web Vitals",
    shortTitle: "效能監控",
    purpose: "監控應用程式效能指標（LCP、FID、CLS），追蹤 API 回應時間，識別效能瓶頸。",
    badge: "common",
    category: "monitoring",
    keywords: ["performance", "vitals", "lcp", "fid", "cls", "metrics", "speed"],
    checklist: [
      { id: "21-1", label: "設定 Web Vitals 追蹤", completed: false },
      { id: "21-2", label: "監控 API 回應時間", completed: false },
      { id: "21-3", label: "設定效能閾值告警", completed: false },
      { id: "21-4", label: "分析效能報表", completed: false },
      { id: "21-5", label: "優化慢速操作", completed: false },
    ],
    prompts: [
      {
        id: "p21-1",
        title: "1. Web Vitals 監控",
        description: "設定 Core Web Vitals 追蹤",
        keywords: ["web", "vitals", "lcp", "fid", "cls"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查 Web Vitals 設定

檢查以下項目：
1. 是否安裝 web-vitals 套件
2. 是否有追蹤 Web Vitals 的程式碼
3. 效能資料是否發送到監控服務
4. 當前效能指標是否達標`,
          fix: `【Cursor 自動化指令】設定 Web Vitals 監控

1. 安裝 web-vitals：
   npm install web-vitals

2. 在 main.tsx 中設定：
   import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';
   import * as Sentry from '@sentry/react';
   
   function sendToAnalytics(metric) {
     // 發送到 Sentry
     Sentry.metrics.distribution(metric.name, metric.value, {
       tags: {
         id: metric.id,
         name: metric.name,
         rating: metric.rating,
       },
     });
   }
   
   onCLS(sendToAnalytics);
   onFID(sendToAnalytics);
   onLCP(sendToAnalytics);
   onFCP(sendToAnalytics);
   onTTFB(sendToAnalytics);

3. 設定效能閾值：
   - LCP (Largest Contentful Paint): < 2.5s (良好)
   - FID (First Input Delay): < 100ms (良好)
   - CLS (Cumulative Layout Shift): < 0.1 (良好)`,
          verify: `驗證 Web Vitals 監控：
1. 使用 Chrome DevTools Performance 面板測試
2. 確認 Sentry 或 Analytics 收到效能資料
3. 檢查效能指標是否在良好範圍內
4. 測試不同網路條件下的效能`
        }
      },
      {
        id: "p21-2",
        title: "2. API 回應時間監控",
        description: "追蹤 API 呼叫的效能",
        keywords: ["api", "response", "time", "performance"],
        prompts: {
          diagnostic: `檢查 API 回應時間：
1. 使用瀏覽器 Network 面板檢查 API 回應時間
2. 識別慢速 API 端點
3. 檢查是否有超時錯誤`,
          fix: `【Cursor 自動化指令】實作 API 效能監控

1. 建立 API 攔截器（使用 Axios）：
   import axios from 'axios';
   import * as Sentry from '@sentry/react';
   
   axios.interceptors.request.use((config) => {
     config.metadata = { startTime: Date.now() };
     return config;
   });
   
   axios.interceptors.response.use(
     (response) => {
       const duration = Date.now() - response.config.metadata.startTime;
       
       // 記錄慢速 API（超過 1 秒）
       if (duration > 1000) {
         Sentry.metrics.distribution('api.response_time', duration, {
           tags: {
             url: response.config.url,
             method: response.config.method,
             status: response.status,
           },
         });
       }
       
       return response;
     },
     (error) => {
       const duration = Date.now() - (error.config?.metadata?.startTime || Date.now());
       Sentry.captureException(error, {
         tags: {
           api_url: error.config?.url,
           api_method: error.config?.method,
           response_time: duration,
         },
       });
       return Promise.reject(error);
     }
   );`,
          verify: `測試 API 監控：
1. 呼叫多個 API 端點
2. 確認回應時間被記錄
3. 檢查慢速 API 是否觸發告警
4. 驗證錯誤是否正確記錄`
        }
      }
    ]
  },
  {
    id: 22,
    title: "日誌管理與集中收集",
    shortTitle: "日誌管理",
    purpose: "設定集中式日誌收集系統，統一管理應用程式日誌，支援搜尋、過濾和分析。",
    badge: "common",
    category: "monitoring",
    keywords: ["log", "logging", "logtail", "datadog", "winston", "pino"],
    checklist: [
      { id: "22-1", label: "選擇日誌服務（Logtail/Datadog）", completed: false },
      { id: "22-2", label: "設定日誌格式和結構", completed: false },
      { id: "22-3", label: "整合前端日誌收集", completed: false },
      { id: "22-4", label: "整合後端日誌收集", completed: false },
      { id: "22-5", label: "設定日誌保留策略", completed: false },
    ],
    prompts: [
      {
        id: "p22-1",
        title: "1. 前端日誌收集",
        description: "設定前端日誌發送到集中式服務",
        keywords: ["log", "frontend", "client"],
        prompts: {
          diagnostic: `檢查前端日誌設定：
1. 是否有統一的日誌函數
2. 日誌是否發送到外部服務
3. 日誌格式是否一致`,
          fix: `【Cursor 自動化指令】設定前端日誌收集

1. 建立日誌工具（src/lib/logger.ts）：
   class Logger {
     private logLevel = import.meta.env.DEV ? 0 : 1;
     
     private log(level, message, data) {
       const timestamp = new Date().toISOString();
       const logEntry = {
         level,
         message,
         timestamp,
         data,
         url: window.location.href,
         userAgent: navigator.userAgent,
       };
       
       // 發送到 Logtail 或其他服務
       if (import.meta.env.VITE_LOGTAIL_SOURCE_TOKEN) {
         fetch('https://in.logtail.com/', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': 'Bearer ' + import.meta.env.VITE_LOGTAIL_SOURCE_TOKEN,
           },
           body: JSON.stringify(logEntry),
         }).catch(console.error);
       }
       
       // 開發環境顯示在 Console
       if (import.meta.env.DEV) {
         console[level](message, data || '');
       }
     }
     
     debug(message, data) {
       this.log('debug', message, data);
     }
     
     info(message, data) {
       this.log('info', message, data);
     }
     
     warn(message, data) {
       this.log('warn', message, data);
     }
     
     error(message, data) {
       this.log('error', message, data);
     }
   }
   
   export const logger = new Logger();

2. 使用範例：
   import { logger } from '@/lib/logger';
   
   logger.info('User logged in', { userId: user.id });
   logger.error('API call failed', { error, endpoint: '/api/users' });`,
          verify: `測試日誌功能：
1. 呼叫不同級別的日誌
2. 確認日誌發送到 Logtail
3. 檢查日誌格式是否正確
4. 驗證日誌搜尋功能`
        }
      }
    ]
  },
  // ===== 資料庫管理 =====
  {
    id: 23,
    title: "資料庫備份與還原",
    shortTitle: "資料庫備份",
    purpose: "設定自動化資料庫備份策略，建立備份驗證流程，實作點對點還原功能。",
    badge: "critical",
    category: "database",
    keywords: ["backup", "restore", "database", "supabase", "pg_dump", "migration"],
    checklist: [
      { id: "23-1", label: "確認備份策略已設定", completed: false },
      { id: "23-2", label: "測試備份是否成功", completed: false },
      { id: "23-3", label: "驗證備份完整性", completed: false },
      { id: "23-4", label: "測試還原流程", completed: false },
      { id: "23-5", label: "設定備份保留政策", completed: false },
    ],
    prompts: [
      {
        id: "p23-1",
        title: "1. Supabase 自動備份",
        description: "檢查和設定 Supabase 自動備份",
        keywords: ["supabase", "backup", "pg_dump"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查 Supabase 備份設定

1. 前往 Supabase Dashboard > Settings > Database
2. 檢查 "Point in Time Recovery" 是否啟用
3. 檢查備份保留期間設定
4. 查看最近的備份記錄`,
          fix: `【Cursor 自動化指令】設定 Supabase 備份

1. 啟用 Point in Time Recovery (PITR)：
   - 前往 Supabase Dashboard
   - Settings > Database > Point in Time Recovery
   - 啟用 PITR（需要升級到 Pro 計劃）

2. 手動備份（使用 Supabase CLI）：
   # 安裝 Supabase CLI
   npm install -g supabase
   
   # 登入
   supabase login
   
   # 建立備份
   supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql

3. 自動化備份腳本（GitHub Actions）：
   name: Database Backup
   on:
     schedule:
       - cron: '0 2 * * *'  # 每天凌晨 2 點
   jobs:
     backup:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: supabase/setup-cli@v1
         - run: |
             supabase db dump -f backup.sql
             # 上傳到 S3 或其他儲存服務`,
          verify: `驗證備份功能：
1. 確認 PITR 已啟用
2. 執行手動備份測試
3. 檢查備份檔案是否產生
4. 測試還原到測試環境`
        }
      },
      {
        id: "p23-2",
        title: "2. 資料庫還原流程",
        description: "建立安全的還原流程",
        keywords: ["restore", "recovery", "rollback"],
        prompts: {
          diagnostic: `檢查還原準備：
1. 是否有還原測試環境
2. 是否有還原流程文件
3. 是否測試過還原流程`,
          fix: `【Cursor 自動化指令】建立資料庫還原流程

1. 還原到測試環境（使用 Supabase CLI）：
   # 還原備份
   supabase db restore backup.sql --db-url "postgresql://..."

2. 建立還原檢查清單：
   - [ ] 確認還原目標環境
   - [ ] 備份當前資料庫狀態
   - [ ] 執行還原操作
   - [ ] 驗證資料完整性
   - [ ] 測試關鍵功能
   - [ ] 通知團隊還原完成

3. 還原腳本範例：
   #!/bin/bash
   BACKUP_FILE=$1
   TARGET_DB=$2
   
   if [ -z "$BACKUP_FILE" ] || [ -z "$TARGET_DB" ]; then
     echo "Usage: restore.sh <backup_file> <target_db_url>"
     exit 1
   fi
   
   echo "Restoring from $BACKUP_FILE to $TARGET_DB"
   psql $TARGET_DB < $BACKUP_FILE
   echo "Restore completed"`,
          verify: `測試還原流程：
1. 在測試環境執行還原
2. 驗證資料是否正確
3. 測試應用程式功能
4. 確認沒有資料遺失`
        }
      }
    ]
  },
  {
    id: 24,
    title: "資料庫效能優化",
    shortTitle: "DB 效能",
    purpose: "識別慢查詢，優化索引，改善資料庫連線池設定，提升查詢效能。",
    badge: "common",
    category: "database",
    keywords: ["performance", "index", "query", "optimization", "slow", "pg_stat"],
    checklist: [
      { id: "24-1", label: "識別慢查詢", completed: false },
      { id: "24-2", label: "分析查詢執行計劃", completed: false },
      { id: "24-3", label: "優化或新增索引", completed: false },
      { id: "24-4", label: "檢查連線池設定", completed: false },
      { id: "24-5", label: "驗證效能改善", completed: false },
    ],
    prompts: [
      {
        id: "p24-1",
        title: "1. 識別慢查詢",
        description: "使用 pg_stat_statements 找出慢查詢",
        keywords: ["slow", "query", "pg_stat"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查資料庫慢查詢

在 Supabase SQL Editor 執行：

1. 啟用 pg_stat_statements（如果尚未啟用）：
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

2. 查看最慢的查詢：
   SELECT 
     query,
     calls,
     total_exec_time,
     mean_exec_time,
     max_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;

3. 查看查詢執行次數：
   SELECT 
     query,
     calls,
     total_exec_time / calls AS avg_time
   FROM pg_stat_statements
   WHERE calls > 100
   ORDER BY avg_time DESC;`,
          fix: `【Cursor 自動化指令】優化慢查詢

1. 分析查詢執行計劃：
   EXPLAIN ANALYZE
   SELECT * FROM {{table_name}} 
   WHERE {{condition}};

2. 檢查是否需要索引：
   -- 查看現有索引
   SELECT 
     tablename,
     indexname,
     indexdef
   FROM pg_indexes
   WHERE tablename = '{{table_name}}';

3. 建立適當的索引：
   -- 單欄位索引
   CREATE INDEX idx_{{table_name}}_{{column}} 
   ON {{table_name}}({{column}});
   
   -- 複合索引
   CREATE INDEX idx_{{table_name}}_{{col1}}_{{col2}}
   ON {{table_name}}({{col1}}, {{col2}});
   
   -- 部分索引（有條件的索引）
   CREATE INDEX idx_{{table_name}}_active
   ON {{table_name}}({{column}})
   WHERE {{condition}};

4. 優化查詢：
   - 避免 SELECT *
   - 使用 LIMIT 限制結果
   - 避免在 WHERE 子句使用函數
   - 使用適當的 JOIN 類型`,
          verify: `驗證效能改善：
1. 重新執行 EXPLAIN ANALYZE
2. 確認查詢時間減少
3. 檢查索引使用情況
4. 監控應用程式回應時間`
        }
      }
    ]
  },
  {
    id: 25,
    title: "資料庫遷移管理",
    shortTitle: "DB 遷移",
    purpose: "管理資料庫結構變更，處理遷移衝突，建立安全的遷移和回滾流程。",
    badge: "common",
    category: "database",
    keywords: ["migration", "schema", "alter", "rollback", "supabase"],
    checklist: [
      { id: "25-1", label: "檢查遷移檔案格式", completed: false },
      { id: "25-2", label: "在測試環境執行遷移", completed: false },
      { id: "25-3", label: "檢查遷移衝突", completed: false },
      { id: "25-4", label: "執行生產環境遷移", completed: false },
      { id: "25-5", label: "驗證遷移結果", completed: false },
    ],
    prompts: [
      {
        id: "p25-1",
        title: "1. 建立資料庫遷移",
        description: "使用 Supabase Migrations 管理結構變更",
        keywords: ["migration", "supabase", "schema"],
        prompts: {
          diagnostic: `檢查遷移狀態：
1. 查看現有遷移檔案
2. 檢查是否有未執行的遷移
3. 確認遷移順序`,
          fix: `【Cursor 自動化指令】建立資料庫遷移

1. 使用 Supabase CLI 建立遷移：
   supabase migration new {{migration_name}}

2. 在生成的遷移檔案中編寫 SQL：
   -- supabase/migrations/YYYYMMDDHHMMSS_{{migration_name}}.sql
   
   -- 範例：新增欄位
   ALTER TABLE {{table_name}}
   ADD COLUMN {{column_name}} {{data_type}};
   
   -- 範例：新增索引
   CREATE INDEX idx_{{table_name}}_{{column}}
   ON {{table_name}}({{column}});
   
   -- 範例：修改欄位
   ALTER TABLE {{table_name}}
   ALTER COLUMN {{column_name}} TYPE {{new_type}};

3. 在本地測試遷移：
   supabase db reset  # 重置並執行所有遷移
   
   或
   
   supabase migration up  # 執行新的遷移

4. 推送到 Supabase：
   supabase db push`,
          verify: `驗證遷移：
1. 檢查遷移是否成功執行
2. 驗證資料庫結構變更
3. 測試應用程式功能
4. 確認沒有資料遺失`
        }
      }
    ]
  },
  // ===== 安全性工具 =====
  {
    id: 26,
    title: "依賴套件安全掃描",
    shortTitle: "依賴掃描",
    purpose: "自動掃描專案依賴套件的已知漏洞，更新有安全風險的套件，管理許可證合規性。",
    badge: "critical",
    category: "security",
    keywords: ["security", "vulnerability", "npm", "audit", "dependabot", "snyk"],
    checklist: [
      { id: "26-1", label: "執行 npm audit 掃描", completed: false },
      { id: "26-2", label: "檢查高風險漏洞", completed: false },
      { id: "26-3", label: "更新有漏洞的套件", completed: false },
      { id: "26-4", label: "設定自動化掃描", completed: false },
      { id: "26-5", label: "驗證修復後功能", completed: false },
    ],
    prompts: [
      {
        id: "p26-1",
        title: "1. 執行安全掃描",
        description: "使用 npm audit 檢查依賴漏洞",
        keywords: ["audit", "vulnerability", "security"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查依賴套件安全漏洞

執行安全掃描：
npm audit

檢查輸出中的：
- 漏洞數量
- 嚴重程度（Critical, High, Moderate, Low）
- 受影響的套件`,
          fix: `【Cursor 自動化指令】修復安全漏洞

1. 自動修復（可能包含 breaking changes）：
   npm audit fix

2. 強制修復（可能破壞相容性）：
   npm audit fix --force

3. 手動更新特定套件：
   npm update {{package_name}}

4. 升級到最新版本：
   npm install {{package_name}}@latest

5. 如果無法修復，考慮：
   - 尋找替代套件
   - 使用 npm overrides 強制版本
   - 暫時接受風險（不建議）

6. 設定 .npmrc 忽略特定漏洞（不建議）：
   audit-level=moderate  # 只報告 moderate 以上`,
          verify: `驗證修復：
1. 重新執行 npm audit
2. 確認漏洞數量減少
3. 測試應用程式功能
4. 檢查是否有 breaking changes`
        }
      },
      {
        id: "p26-2",
        title: "2. 設定自動化掃描",
        description: "使用 Dependabot 或 Snyk 自動掃描",
        keywords: ["dependabot", "snyk", "automation"],
        prompts: {
          diagnostic: `檢查自動化掃描設定：
1. 是否有 .github/dependabot.yml
2. 是否有 Snyk 整合
3. 是否有 CI/CD 安全掃描`,
          fix: `【Cursor 自動化指令】設定 Dependabot 自動掃描

1. 建立 .github/dependabot.yml：
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/"
       schedule:
         interval: "weekly"
       open-pull-requests-limit: 10
       reviewers:
         - "{{github_username}}"
       labels:
         - "dependencies"
         - "security"

2. 設定 GitHub Actions 自動掃描：
   name: Security Scan
   on:
     schedule:
       - cron: '0 0 * * 1'  # 每週一
     push:
       branches: [main]
   jobs:
     audit:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
         - run: npm ci
         - run: npm audit --audit-level=moderate`,
          verify: `測試自動化：
1. 推送變更觸發掃描
2. 確認 Dependabot 建立 PR
3. 檢查掃描報告`
        }
      }
    ]
  },
  {
    id: 27,
    title: "API 金鑰與敏感資訊管理",
    shortTitle: "API 金鑰",
    purpose: "安全地管理 API 金鑰、環境變數和敏感資訊，實作金鑰輪換機制，防止金鑰洩露。",
    badge: "critical",
    category: "security",
    keywords: ["api", "key", "secret", "env", "rotation", "vault"],
    checklist: [
      { id: "27-1", label: "檢查是否有硬編碼的金鑰", completed: false },
      { id: "27-2", label: "確認環境變數正確設定", completed: false },
      { id: "27-3", label: "檢查 .gitignore 設定", completed: false },
      { id: "27-4", label: "設定金鑰輪換流程", completed: false },
      { id: "27-5", label: "掃描 Git 歷史是否有洩露", completed: false },
    ],
    prompts: [
      {
        id: "p27-1",
        title: "1. 檢查敏感資訊洩露",
        description: "掃描程式碼和 Git 歷史中的敏感資訊",
        keywords: ["secret", "leak", "scan"],
        prompts: {
          diagnostic: `【Cursor 自動化指令】檢查敏感資訊洩露

1. 使用 git-secrets 掃描：
   # 安裝
   brew install git-secrets
   
   # 設定
   git secrets --install
   git secrets --register-aws
   
   # 掃描
   git secrets --scan

2. 使用 truffleHog 掃描 Git 歷史：
   # 安裝
   pip install truffleHog
   
   # 掃描
   truffleHog --regex --entropy=False {{repo_url}}

3. 手動檢查：
   - 搜尋程式碼中的 API key 模式
   - 檢查 .env 檔案是否提交
   - 檢查 config 檔案`,
          fix: `【Cursor 自動化指令】修復敏感資訊洩露

1. 如果發現硬編碼的金鑰：
   - 立即撤銷該金鑰
   - 從程式碼中移除
   - 改用環境變數

2. 確保 .gitignore 包含：
   .env
   .env.local
   .env.*.local
   *.key
   *.pem
   secrets/

3. 如果金鑰已提交到 Git：
   # 從 Git 歷史移除（危險操作）
   git filter-branch --force --index-filter \\
     "git rm --cached --ignore-unmatch .env" \\
     --prune-empty --tag-name-filter cat -- --all
   
   # 強制推送（需要團隊協調）
   git push origin --force --all

4. 使用環境變數：
   # .env.local (不提交到 Git)
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_ANON_KEY=your_key
   
   # 在程式碼中使用
   const url = import.meta.env.VITE_SUPABASE_URL;`,
          verify: `驗證修復：
1. 重新掃描確認沒有敏感資訊
2. 確認 .env 檔案在 .gitignore
3. 測試環境變數是否正確載入
4. 確認應用程式功能正常`
        }
      }
    ]
  },
  // ===== 測試工具 =====
  {
    id: 28,
    title: "自動化測試框架設定",
    shortTitle: "測試框架",
    purpose: "設定單元測試、整合測試和端對端測試框架，建立測試覆蓋率報告。",
    badge: "common",
    category: "testing",
    keywords: ["test", "jest", "vitest", "cypress", "playwright", "coverage"],
    checklist: [
      { id: "28-1", label: "選擇測試框架", completed: false },
      { id: "28-2", label: "設定測試環境", completed: false },
      { id: "28-3", label: "撰寫第一個測試", completed: false },
      { id: "28-4", label: "設定測試覆蓋率", completed: false },
      { id: "28-5", label: "整合到 CI/CD", completed: false },
    ],
    prompts: [
      {
        id: "p28-1",
        title: "1. 設定 Vitest 測試框架",
        description: "為 React 專案設定 Vitest",
        keywords: ["vitest", "test", "setup"],
        prompts: {
          diagnostic: `檢查測試設定：
1. 是否已安裝測試套件
2. 是否有測試設定檔
3. 是否有現有測試`,
          fix: `【Cursor 自動化指令】設定 Vitest 測試框架

1. 安裝必要套件：
   npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

2. 更新 vite.config.ts：
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react-swc';
   
   export default defineConfig({
     plugins: [react()],
     test: {
       globals: true,
       environment: 'jsdom',
       setupFiles: './src/test/setup.ts',
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html'],
       },
     },
   });

3. 建立測試設定檔 src/test/setup.ts：
   import '@testing-library/jest-dom';
   import { expect, afterEach } from 'vitest';
   import { cleanup } from '@testing-library/react';
   
   afterEach(() => {
     cleanup();
   });

4. 建立範例測試 src/lib/utils.test.ts：
   import { describe, it, expect } from 'vitest';
   import { cn } from './utils';
   
   describe('cn utility', () => {
     it('should merge class names', () => {
       expect(cn('foo', 'bar')).toBe('foo bar');
     });
   });

5. 更新 package.json scripts：
   "test": "vitest",
   "test:ui": "vitest --ui",
   "test:coverage": "vitest --coverage"`,
          verify: `測試設定：
1. 執行 npm test
2. 確認測試通過
3. 檢查覆蓋率報告
4. 測試 UI 模式：npm run test:ui`
        }
      }
    ]
  },
  {
    id: 29,
    title: "API 測試與 Mock 服務",
    shortTitle: "API 測試",
    purpose: "建立 API 端點測試，設定 Mock 服務，測試錯誤處理和邊界情況。",
    badge: "common",
    category: "testing",
    keywords: ["api", "test", "mock", "msw", "supertest"],
    checklist: [
      { id: "29-1", label: "設定 API 測試工具", completed: false },
      { id: "29-2", label: "建立 Mock 服務", completed: false },
      { id: "29-3", label: "撰寫 API 測試案例", completed: false },
      { id: "29-4", label: "測試錯誤處理", completed: false },
      { id: "29-5", label: "整合到測試流程", completed: false },
    ],
    prompts: [
      {
        id: "p29-1",
        title: "1. 設定 MSW (Mock Service Worker)",
        description: "使用 MSW 模擬 API 回應",
        keywords: ["msw", "mock", "api"],
        prompts: {
          diagnostic: `檢查 API 測試設定：
1. 是否有 Mock 服務
2. 測試是否依賴真實 API
3. 是否有錯誤處理測試`,
          fix: `【Cursor 自動化指令】設定 MSW Mock 服務

1. 安裝 MSW：
   npm install -D msw

2. 建立 Mock Handlers (src/mocks/handlers.ts)：
   import { http, HttpResponse } from 'msw';
   
   export const handlers = [
     // Mock GET 請求
     http.get('/api/users', () => {
       return HttpResponse.json([
         { id: 1, name: 'User 1' },
         { id: 2, name: 'User 2' },
       ]);
     }),
     
     // Mock POST 請求
     http.post('/api/users', async ({ request }) => {
       const body = await request.json();
       return HttpResponse.json({ id: 3, ...body }, { status: 201 });
     }),
     
     // Mock 錯誤回應
     http.get('/api/error', () => {
       return HttpResponse.json(
         { error: 'Not found' },
         { status: 404 }
       );
     }),
   ];

3. 在測試中設定 (src/test/setup.ts)：
   import { setupServer } from 'msw/node';
   import { handlers } from '../mocks/handlers';
   
   export const server = setupServer(...handlers);
   
   beforeAll(() => server.listen());
   afterEach(() => server.resetHandlers());
   afterAll(() => server.close());`,
          verify: `測試 Mock 服務：
1. 執行測試確認 Mock 正常運作
2. 測試不同回應情況
3. 測試錯誤處理
4. 確認測試不依賴真實 API`
        }
      }
    ]
  },
  // ===== CI/CD 擴充 =====
  {
    id: 30,
    title: "部署後自動驗證",
    shortTitle: "部署驗證",
    purpose: "建立部署後自動化驗證流程，檢查服務健康狀態，執行回歸測試，確保部署成功。",
    badge: "common",
    category: "cicd",
    keywords: ["deployment", "verification", "health", "check", "smoke", "test"],
    checklist: [
      { id: "30-1", label: "設定健康檢查端點", completed: false },
      { id: "30-2", label: "建立部署後測試腳本", completed: false },
      { id: "30-3", label: "設定自動化驗證", completed: false },
      { id: "30-4", label: "整合到 CI/CD 流程", completed: false },
      { id: "30-5", label: "設定失敗告警", completed: false },
    ],
    prompts: [
      {
        id: "p30-1",
        title: "1. 健康檢查端點",
        description: "建立應用程式健康檢查 API",
        keywords: ["health", "check", "endpoint"],
        prompts: {
          diagnostic: `檢查健康檢查設定：
1. 是否有 /health 或 /api/health 端點
2. 健康檢查是否包含依賴服務狀態
3. 是否有詳細的健康狀態資訊`,
          fix: `【Cursor 自動化指令】建立健康檢查端點

1. 建立健康檢查 API (如果使用 Supabase Edge Functions)：
   // supabase/functions/health/index.ts
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
   
   serve(async (req) => {
     const checks = {
       status: 'healthy',
       timestamp: new Date().toISOString(),
       services: {},
     };
     
     // 檢查資料庫連線
     try {
       const supabase = createClient(
         Deno.env.get('SUPABASE_URL'),
         Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
       );
       const { data, error } = await supabase.from('_health').select('1').limit(1);
       checks.services.database = error ? 'unhealthy' : 'healthy';
     } catch (error) {
       checks.services.database = 'unhealthy';
       checks.status = 'degraded';
     }
     
     return new Response(
       JSON.stringify(checks),
       { 
         status: checks.status === 'healthy' ? 200 : 503,
         headers: { 'Content-Type': 'application/json' },
       }
     );
   });`,
          verify: `測試健康檢查：
1. 訪問健康檢查端點
2. 確認回應格式正確
3. 測試服務故障情況
4. 確認狀態碼正確`
        }
      },
      {
        id: "p30-2",
        title: "2. 部署後自動驗證",
        description: "在 CI/CD 中自動執行部署驗證",
        keywords: ["deployment", "verification", "ci", "cd"],
        prompts: {
          diagnostic: `檢查部署驗證設定：
1. CI/CD 是否有部署後驗證步驟
2. 是否有 Smoke Test
3. 是否有自動回滾機制`,
          fix: `【Cursor 自動化指令】設定部署後自動驗證

1. 建立驗證腳本 (scripts/verify-deployment.sh)：
   #!/bin/bash
   set -e
   
   DEPLOY_URL=$1
   
   echo "Verifying deployment at $DEPLOY_URL"
   
   # 健康檢查
   HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $DEPLOY_URL/api/health)
   if [ "$HEALTH_STATUS" != "200" ]; then
     echo "Health check failed: $HEALTH_STATUS"
     exit 1
   fi
   
   # Smoke Test
   echo "Running smoke tests..."
   npm run test:smoke -- --url=$DEPLOY_URL
   
   # 檢查關鍵頁面
   curl -f $DEPLOY_URL/ || exit 1
   
   echo "Deployment verification passed"

2. 在 GitHub Actions 中使用：
   name: Deploy and Verify
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Deploy
           run: |
             # 部署步驟
         - name: Verify Deployment
           run: |
             chmod +x scripts/verify-deployment.sh
             ./scripts/verify-deployment.sh $DEPLOY_URL
           continue-on-error: false`,
          verify: `測試驗證流程：
1. 觸發部署
2. 確認驗證步驟執行
3. 測試失敗情況
4. 確認告警正常`
        }
      }
    ]
  },
  {
    id: 31,
    title: "環境管理與配置",
    shortTitle: "環境管理",
    purpose: "管理多環境配置（開發、測試、生產），同步環境變數，確保環境一致性。",
    badge: "common",
    category: "cicd",
    keywords: ["environment", "config", "env", "staging", "production"],
    checklist: [
      { id: "31-1", label: "確認環境變數文件", completed: false },
      { id: "31-2", label: "檢查環境隔離", completed: false },
      { id: "31-3", label: "驗證環境變數同步", completed: false },
      { id: "31-4", label: "測試環境切換", completed: false },
      { id: "31-5", label: "建立環境檢查清單", completed: false },
    ],
    prompts: [
      {
        id: "p31-1",
        title: "1. 環境變數管理",
        description: "建立統一的環境變數管理系統",
        keywords: ["env", "variable", "config"],
        prompts: {
          diagnostic: `檢查環境變數管理：
1. 是否有 .env.example 檔案
2. 環境變數是否有文件說明
3. 不同環境的變數是否一致`,
          fix: `【Cursor 自動化指令】建立環境變數管理

1. 建立 .env.example：
   # Supabase
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   
   # Sentry
   VITE_SENTRY_DSN=your-sentry-dsn
   
   # API
   VITE_API_URL=https://api.example.com
   
   # Environment
   VITE_APP_ENV=development

2. 建立環境變數驗證腳本 (scripts/validate-env.js)：
   const required = [
     'VITE_SUPABASE_URL',
     'VITE_SUPABASE_ANON_KEY',
   ];
   
   const missing = required.filter(key => !process.env[key]);
   
   if (missing.length > 0) {
     console.error('Missing required environment variables:');
     missing.forEach(key => console.error('  - ' + key));
     process.exit(1);
   }
   
   console.log('All required environment variables are set');

3. 在 package.json 中加入驗證：
   "scripts": {
     "validate-env": "node scripts/validate-env.js",
     "dev": "npm run validate-env && vite",
     "build": "npm run validate-env && vite build"
   }`,
          verify: `測試環境變數：
1. 執行 npm run validate-env
2. 確認缺少變數時會失敗
3. 測試不同環境的變數載入`
        }
      }
    ]
  },
  // ===== API 管理 =====
  {
    id: 32,
    title: "API 文件生成與版本管理",
    shortTitle: "API 文件",
    purpose: "自動生成 API 文件（OpenAPI/Swagger），管理 API 版本，提供互動式 API 文件介面。",
    badge: "common",
    category: "api",
    keywords: ["api", "documentation", "openapi", "swagger", "version", "endpoint"],
    checklist: [
      { id: "32-1", label: "選擇 API 文件工具", completed: false },
      { id: "32-2", label: "定義 API 端點結構", completed: false },
      { id: "32-3", label: "生成 OpenAPI/Swagger 規格", completed: false },
      { id: "32-4", label: "設定 API 版本管理", completed: false },
      { id: "32-5", label: "部署互動式 API 文件", completed: false },
    ],
    prompts: [
      {
        id: "p32-1",
        title: "1. 生成 OpenAPI 文件",
        description: "使用工具自動生成 API 文件",
        keywords: ["openapi", "swagger", "documentation"],
        prompts: {
          diagnostic: `檢查 API 文件狀態：
1. 是否有 API 文件
2. 文件是否是最新的
3. 是否有版本管理`,
          fix: `【Cursor 自動化指令】生成 OpenAPI API 文件

1. 安裝 Swagger/OpenAPI 工具：
   npm install -D @apidevtools/swagger-cli swagger-ui-react

2. 建立 OpenAPI 規格檔案 (openapi.yaml)：
   openapi: 3.0.0
   info:
     title: {{api_name}} API
     version: 1.0.0
     description: {{api_description}}
   servers:
     - url: https://api.example.com/v1
       description: Production server
   paths:
     /users:
       get:
         summary: 取得使用者列表
         responses:
           '200':
             description: 成功
             content:
               application/json:
                 schema:
                   type: array
                   items:
                     $ref: '#/components/schemas/User'

3. 在 React 中顯示 API 文件：
   import SwaggerUI from 'swagger-ui-react';
   import 'swagger-ui-react/swagger-ui.css';
   import openapiSpec from './openapi.yaml';
   
   function APIDocs() {
     return <SwaggerUI spec={openapiSpec} />;
   }

4. 自動生成（如果使用 Express）：
   npm install swagger-jsdoc swagger-ui-express
   
   const swaggerJsdoc = require('swagger-jsdoc');
   const swaggerUi = require('swagger-ui-express');
   
   const options = {
     definition: {
       openapi: '3.0.0',
       info: { title: 'API', version: '1.0.0' },
     },
     apis: ['./routes/*.js'],
   };
   
   const swaggerSpec = swaggerJsdoc(options);
   app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));`,
          verify: `驗證 API 文件：
1. 訪問 API 文件頁面
2. 確認所有端點都有文件
3. 測試互動式 API 文件功能
4. 確認版本資訊正確`
        }
      }
    ]
  },
  {
    id: 33,
    title: "API 效能與限流設定",
    shortTitle: "API 限流",
    purpose: "設定 API 限流規則，優化 API 回應時間，實作 API 快取策略。",
    badge: "common",
    category: "api",
    keywords: ["api", "rate", "limit", "throttle", "cache", "performance"],
    checklist: [
      { id: "33-1", label: "設定 API 限流規則", completed: false },
      { id: "33-2", label: "實作 API 快取", completed: false },
      { id: "33-3", label: "監控 API 使用量", completed: false },
      { id: "33-4", label: "處理限流錯誤回應", completed: false },
      { id: "33-5", label: "測試限流功能", completed: false },
    ],
    prompts: [
      {
        id: "p33-1",
        title: "1. API 限流設定",
        description: "實作 API 請求限流",
        keywords: ["rate", "limit", "throttle"],
        prompts: {
          diagnostic: `檢查 API 限流設定：
1. 是否有限流機制
2. 限流規則是否合理
3. 限流錯誤是否正確處理`,
          fix: `【Cursor 自動化指令】實作 API 限流

1. 使用 express-rate-limit（Node.js）：
   npm install express-rate-limit
   
   const rateLimit = require('express-rate-limit');
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 分鐘
     max: 100, // 限制每個 IP 100 次請求
     message: '請求過於頻繁，請稍後再試',
     standardHeaders: true,
     legacyHeaders: false,
   });
   
   app.use('/api/', limiter);

2. 使用 Supabase Edge Functions 限流：
   // supabase/functions/api/index.ts
   const RATE_LIMIT = 100; // 每小時
   const cache = new Map();
   
   Deno.serve(async (req) => {
     const ip = req.headers.get('x-forwarded-for') || 'unknown';
     const key = ip + ':' + new Date().getHours();
     
     const count = cache.get(key) || 0;
     if (count >= RATE_LIMIT) {
       return new Response(
         JSON.stringify({ error: 'Rate limit exceeded' }),
         { status: 429 }
       );
     }
     
     cache.set(key, count + 1);
     // 處理請求
   });

3. 前端處理限流錯誤：
   try {
     const response = await fetch('/api/data');
     if (response.status === 429) {
       const retryAfter = response.headers.get('Retry-After');
       console.log('Rate limited, retry after:', retryAfter);
     }
   } catch (error) {
     // 處理錯誤
   }`,
          verify: `測試限流功能：
1. 發送大量請求測試限流
2. 確認限流錯誤回應正確
3. 檢查限流計數是否正確
4. 驗證限流重置時間`
        }
      }
    ]
  },
  // ===== 快取策略 =====
  {
    id: 34,
    title: "Redis 快取設定與管理",
    shortTitle: "Redis 快取",
    purpose: "設定 Redis 快取系統，實作快取策略，處理快取失效和穿透問題。",
    badge: "common",
    category: "caching",
    keywords: ["redis", "cache", "performance", "ttl", "invalidation"],
    checklist: [
      { id: "34-1", label: "設定 Redis 連線", completed: false },
      { id: "34-2", label: "實作快取讀寫邏輯", completed: false },
      { id: "34-3", label: "設定快取 TTL", completed: false },
      { id: "34-4", label: "處理快取失效", completed: false },
      { id: "34-5", label: "監控快取效能", completed: false },
    ],
    prompts: [
      {
        id: "p34-1",
        title: "1. Redis 快取實作",
        description: "設定 Redis 並實作快取邏輯",
        keywords: ["redis", "cache", "setup"],
        prompts: {
          diagnostic: `檢查 Redis 設定：
1. Redis 是否已安裝和運行
2. 是否有快取實作
3. 快取策略是否合理`,
          fix: `【Cursor 自動化指令】設定 Redis 快取

1. 安裝 Redis 客戶端（Node.js）：
   npm install redis
   
   import { createClient } from 'redis';
   
   const client = createClient({
     url: process.env.REDIS_URL || 'redis://localhost:6379'
   });
   
   client.on('error', (err) => console.error('Redis Client Error', err));
   await client.connect();

2. 實作快取函數：
   async function getCached(key, fetchFn, ttl = 3600) {
     // 嘗試從快取取得
     const cached = await client.get(key);
     if (cached) {
       return JSON.parse(cached);
     }
     
     // 快取未命中，從資料來源取得
     const data = await fetchFn();
     
     // 存入快取
     await client.setEx(key, ttl, JSON.stringify(data));
     
     return data;
   }
   
   // 使用範例
   const users = await getCached(
     'users:list',
     () => supabase.from('users').select('*'),
     300 // 5 分鐘 TTL
   );

3. 快取失效：
   async function invalidateCache(pattern) {
     const keys = await client.keys(pattern);
     if (keys.length > 0) {
       await client.del(keys);
     }
   }
   
   // 更新資料時失效快取
   await supabase.from('users').update({ name: 'New' }).eq('id', 1);
   await invalidateCache('users:*');`,
          verify: `測試快取功能：
1. 確認快取讀寫正常
2. 測試快取命中率
3. 驗證快取失效機制
4. 檢查快取效能`
        }
      }
    ]
  },
  {
    id: 35,
    title: "前端快取與 Service Worker",
    shortTitle: "前端快取",
    purpose: "設定瀏覽器快取、Service Worker，優化靜態資源載入，實作離線功能。",
    badge: "common",
    category: "caching",
    keywords: ["service", "worker", "cache", "pwa", "offline", "browser"],
    checklist: [
      { id: "35-1", label: "設定 Service Worker", completed: false },
      { id: "35-2", label: "實作快取策略", completed: false },
      { id: "35-3", label: "設定靜態資源快取", completed: false },
      { id: "35-4", label: "測試離線功能", completed: false },
      { id: "35-5", label: "優化快取更新機制", completed: false },
    ],
    prompts: [
      {
        id: "p35-1",
        title: "1. Service Worker 設定",
        description: "建立 Service Worker 實作快取",
        keywords: ["service", "worker", "pwa"],
        prompts: {
          diagnostic: `檢查 Service Worker 設定：
1. 是否有 Service Worker 檔案
2. Service Worker 是否已註冊
3. 快取策略是否實作`,
          fix: `【Cursor 自動化指令】設定 Service Worker

1. 建立 Service Worker (public/sw.js)：
   const CACHE_NAME = 'app-cache-v1';
   const urlsToCache = [
     '/',
     '/index.html',
     '/assets/index.css',
     '/assets/index.js',
   ];
   
   // 安裝時快取資源
   self.addEventListener('install', (event) => {
     event.waitUntil(
       caches.open(CACHE_NAME)
         .then((cache) => cache.addAll(urlsToCache))
     );
   });
   
   // 攔截請求，使用快取或網路
   self.addEventListener('fetch', (event) => {
     event.respondWith(
       caches.match(event.request)
         .then((response) => {
           // 快取命中，返回快取
           if (response) {
             return response;
           }
           // 快取未命中，從網路取得
           return fetch(event.request).then((response) => {
             // 檢查回應是否有效
             if (!response || response.status !== 200) {
               return response;
             }
             // 複製回應並存入快取
             const responseToCache = response.clone();
             caches.open(CACHE_NAME).then((cache) => {
               cache.put(event.request, responseToCache);
             });
             return response;
           });
         })
     );
   });

2. 註冊 Service Worker (main.tsx)：
   if ('serviceWorker' in navigator) {
     window.addEventListener('load', () => {
       navigator.serviceWorker.register('/sw.js')
         .then((registration) => {
           console.log('SW registered:', registration);
         })
         .catch((error) => {
           console.log('SW registration failed:', error);
         });
     });
   }

3. 使用 Vite PWA 插件（推薦）：
   npm install -D vite-plugin-pwa
   
   // vite.config.ts
   import { VitePWA } from 'vite-plugin-pwa';
   
   export default defineConfig({
     plugins: [
       react(),
       VitePWA({
         registerType: 'autoUpdate',
         workbox: {
           globPatterns: ['**/*.{js,css,html,ico,png,svg}']
         }
       })
     ]
   });`,
          verify: `測試 Service Worker：
1. 檢查 Service Worker 是否註冊
2. 測試離線功能
3. 驗證快取是否正常運作
4. 檢查快取更新機制`
        }
      }
    ]
  },
  // ===== 通知系統擴充 =====
  {
    id: 36,
    title: "Slack 與 Discord 通知整合",
    shortTitle: "Slack/Discord",
    purpose: "整合 Slack 和 Discord Webhook，發送系統通知、錯誤告警和狀態更新。",
    badge: "common",
    category: "notifications",
    keywords: ["slack", "discord", "webhook", "notification", "alert"],
    checklist: [
      { id: "36-1", label: "建立 Slack Webhook", completed: false },
      { id: "36-2", label: "建立 Discord Webhook", completed: false },
      { id: "36-3", label: "實作通知發送函數", completed: false },
      { id: "36-4", label: "整合錯誤告警", completed: false },
      { id: "36-5", label: "測試通知功能", completed: false },
    ],
    prompts: [
      {
        id: "p36-1",
        title: "1. Slack Webhook 整合",
        description: "設定 Slack 通知",
        keywords: ["slack", "webhook"],
        prompts: {
          diagnostic: `檢查 Slack 整合：
1. 是否有 Slack Webhook URL
2. 通知是否正常發送
3. 訊息格式是否正確`,
          fix: `【Cursor 自動化指令】整合 Slack Webhook

1. 建立 Slack 通知函數：
   async function sendSlackNotification(message, channel = '#alerts') {
     const webhookUrl = process.env.SLACK_WEBHOOK_URL;
     
     if (!webhookUrl) {
       console.warn('Slack webhook URL not configured');
       return;
     }
     
     const payload = {
       text: message,
       channel: channel,
       username: 'System Bot',
       icon_emoji: ':robot_face:',
     };
     
     try {
       const response = await fetch(webhookUrl, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload),
       });
       
       if (!response.ok) {
         throw new Error('Slack notification failed');
       }
     } catch (error) {
       console.error('Failed to send Slack notification:', error);
     }
   }

2. 整合到錯誤處理：
   // 在 Sentry 或錯誤處理中使用
   Sentry.captureException(error, {
     beforeSend(event) {
       sendSlackNotification(
         '錯誤發生: ' + event.message + '\\n' +
         '環境: ' + process.env.NODE_ENV
       );
       return event;
     }
   });

3. 使用 Slack Block Kit（進階格式）：
   const blocks = [
     {
       type: 'section',
       text: {
         type: 'mrkdwn',
         text: '*錯誤告警*\\n' + error.message
       }
     },
     {
       type: 'section',
       fields: [
         { type: 'mrkdwn', text: '*環境*\\n' + env },
         { type: 'mrkdwn', text: '*時間*\\n' + new Date().toISOString() }
       ]
     }
   ];
   
   await fetch(webhookUrl, {
     method: 'POST',
     body: JSON.stringify({ blocks })
   });`,
          verify: `測試 Slack 通知：
1. 發送測試通知
2. 確認訊息格式正確
3. 測試錯誤告警
4. 驗證不同頻道通知`
        }
      },
      {
        id: "p36-2",
        title: "2. Discord Webhook 整合",
        description: "設定 Discord 通知",
        keywords: ["discord", "webhook"],
        prompts: {
          diagnostic: `檢查 Discord 整合：
1. 是否有 Discord Webhook URL
2. 通知是否正常發送`,
          fix: `【Cursor 自動化指令】整合 Discord Webhook

1. 建立 Discord 通知函數：
   async function sendDiscordNotification(message, title = '通知') {
     const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
     
     if (!webhookUrl) {
       console.warn('Discord webhook URL not configured');
       return;
     }
     
     const payload = {
       embeds: [{
         title: title,
         description: message,
         color: 0x3498db, // 藍色
         timestamp: new Date().toISOString(),
       }]
     };
     
     try {
       const response = await fetch(webhookUrl, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload),
       });
       
       if (!response.ok) {
         throw new Error('Discord notification failed');
       }
     } catch (error) {
       console.error('Failed to send Discord notification:', error);
     }
   }`,
          verify: `測試 Discord 通知：
1. 發送測試通知
2. 確認訊息格式正確
3. 測試不同類型的通知`
        }
      }
    ]
  },
  {
    id: 37,
    title: "SMS 簡訊通知設定",
    shortTitle: "SMS 通知",
    purpose: "整合 SMS 簡訊服務（Twilio、AWS SNS），發送重要通知和驗證碼。",
    badge: "common",
    category: "notifications",
    keywords: ["sms", "twilio", "aws", "sns", "text", "message"],
    checklist: [
      { id: "37-1", label: "選擇 SMS 服務提供商", completed: false },
      { id: "37-2", label: "設定 API 金鑰", completed: false },
      { id: "37-3", label: "實作 SMS 發送函數", completed: false },
      { id: "37-4", label: "整合驗證碼功能", completed: false },
      { id: "37-5", label: "測試 SMS 發送", completed: false },
    ],
    prompts: [
      {
        id: "p37-1",
        title: "1. Twilio SMS 整合",
        description: "使用 Twilio 發送 SMS",
        keywords: ["twilio", "sms"],
        prompts: {
          diagnostic: `檢查 SMS 設定：
1. 是否有 Twilio 帳號
2. API 金鑰是否設定
3. SMS 是否正常發送`,
          fix: `【Cursor 自動化指令】整合 Twilio SMS

1. 安裝 Twilio SDK：
   npm install twilio
   
   import twilio from 'twilio';
   
   const client = twilio(
     process.env.TWILIO_ACCOUNT_SID,
     process.env.TWILIO_AUTH_TOKEN
   );

2. 發送 SMS：
   async function sendSMS(to, message) {
     try {
       const result = await client.messages.create({
         body: message,
         from: process.env.TWILIO_PHONE_NUMBER,
         to: to
       });
       
       console.log('SMS sent:', result.sid);
       return result;
     } catch (error) {
       console.error('Failed to send SMS:', error);
       throw error;
     }
   }
   
   // 使用範例
   await sendSMS('+1234567890', '您的驗證碼是: 123456');

3. 整合到 Supabase Edge Function：
   // supabase/functions/send-sms/index.ts
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
   import twilio from 'npm:twilio@4.19.0';
   
   serve(async (req) => {
     const { to, message } = await req.json();
     
     const client = twilio(
       Deno.env.get('TWILIO_ACCOUNT_SID'),
       Deno.env.get('TWILIO_AUTH_TOKEN')
     );
     
     const result = await client.messages.create({
       body: message,
       from: Deno.env.get('TWILIO_PHONE_NUMBER'),
       to: to
     });
     
     return new Response(JSON.stringify({ sid: result.sid }), {
       headers: { 'Content-Type': 'application/json' }
     });
   });`,
          verify: `測試 SMS 功能：
1. 發送測試簡訊
2. 確認簡訊送達
3. 測試驗證碼功能
4. 檢查錯誤處理`
        }
      }
    ]
  },
  // ===== 第三方整合 =====
  {
    id: 38,
    title: "Stripe 支付整合",
    shortTitle: "Stripe 支付",
    purpose: "整合 Stripe 支付系統，處理付款、退款和訂閱管理。",
    badge: "critical",
    category: "integrations",
    keywords: ["stripe", "payment", "checkout", "subscription", "refund"],
    checklist: [
      { id: "38-1", label: "建立 Stripe 帳號", completed: false },
      { id: "38-2", label: "設定 API 金鑰", completed: false },
      { id: "38-3", label: "實作付款流程", completed: false },
      { id: "38-4", label: "處理 Webhook 事件", completed: false },
      { id: "38-5", label: "測試付款功能", completed: false },
    ],
    prompts: [
      {
        id: "p38-1",
        title: "1. Stripe Checkout 整合",
        description: "設定 Stripe 付款頁面",
        keywords: ["stripe", "checkout", "payment"],
        prompts: {
          diagnostic: `檢查 Stripe 設定：
1. Stripe 帳號是否建立
2. API 金鑰是否設定
3. 付款流程是否正常`,
          fix: `【Cursor 自動化指令】整合 Stripe 支付

1. 安裝 Stripe SDK：
   npm install @stripe/stripe-js stripe
   
   // 前端
   import { loadStripe } from '@stripe/stripe-js';
   
   // 後端
   import Stripe from 'stripe';
   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

2. 建立付款 Session（後端）：
   async function createCheckoutSession(amount, currency = 'usd') {
     const session = await stripe.checkout.sessions.create({
       payment_method_types: ['card'],
       line_items: [{
         price_data: {
           currency: currency,
           product_data: {
             name: '產品名稱',
           },
           unit_amount: amount * 100, // 轉換為分
         },
         quantity: 1,
       }],
       mode: 'payment',
       success_url: 'https://yoursite.com/success',
       cancel_url: 'https://yoursite.com/cancel',
     });
     
     return session;
   }

3. 前端啟動 Checkout：
   const stripe = await loadStripe(process.env.VITE_STRIPE_PUBLISHABLE_KEY);
   
   async function handleCheckout(amount) {
     // 從後端取得 session ID
     const response = await fetch('/api/create-checkout-session', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ amount }),
     });
     
     const { sessionId } = await response.json();
     
     // 導向 Stripe Checkout
     const result = await stripe.redirectToCheckout({ sessionId });
     
     if (result.error) {
       console.error(result.error.message);
     }
   }

4. 處理 Webhook（後端）：
   app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
     const sig = req.headers['stripe-signature'];
     
     let event;
     try {
       event = stripe.webhooks.constructEvent(
         req.body,
         sig,
         process.env.STRIPE_WEBHOOK_SECRET
       );
     } catch (err) {
       return res.status(400).send('Webhook Error');
     }
     
     // 處理事件
     switch (event.type) {
       case 'payment_intent.succeeded':
         // 付款成功
         break;
       case 'payment_intent.payment_failed':
         // 付款失敗
         break;
     }
     
     res.json({ received: true });
   });`,
          verify: `測試 Stripe 整合：
1. 測試付款流程
2. 確認 Webhook 接收正常
3. 測試退款功能
4. 驗證錯誤處理`
        }
      }
    ]
  },
  {
    id: 39,
    title: "Google Maps API 整合",
    shortTitle: "Google Maps",
    purpose: "整合 Google Maps API，顯示地圖、地理編碼和路線規劃功能。",
    badge: "common",
    category: "integrations",
    keywords: ["google", "maps", "geocoding", "directions", "location"],
    checklist: [
      { id: "39-1", label: "取得 Google Maps API 金鑰", completed: false },
      { id: "39-2", label: "載入 Google Maps SDK", completed: false },
      { id: "39-3", label: "實作地圖顯示", completed: false },
      { id: "39-4", label: "實作地理編碼", completed: false },
      { id: "39-5", label: "測試地圖功能", completed: false },
    ],
    prompts: [
      {
        id: "p39-1",
        title: "1. Google Maps 地圖顯示",
        description: "整合 Google Maps 顯示地圖",
        keywords: ["google", "maps", "display"],
        prompts: {
          diagnostic: `檢查 Google Maps 設定：
1. 是否有 API 金鑰
2. 地圖是否正常顯示
3. API 配額是否足夠`,
          fix: `【Cursor 自動化指令】整合 Google Maps

1. 安裝 Google Maps React 套件：
   npm install @react-google-maps/api

2. 建立地圖組件：
   import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
   
   const containerStyle = {
     width: '100%',
     height: '400px'
   };
   
   const center = {
     lat: 25.0330,
     lng: 121.5654
   };
   
   function MapComponent() {
     return (
       <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
         <GoogleMap
           mapContainerStyle={containerStyle}
           center={center}
           zoom={10}
         >
           <Marker position={center} />
         </GoogleMap>
       </LoadScript>
     );
   }

3. 地理編碼（地址轉座標）：
   async function geocodeAddress(address) {
     const response = await fetch(
       'https://maps.googleapis.com/maps/api/geocode/json?' +
       'address=' + encodeURIComponent(address) +
       '&key=' + import.meta.env.VITE_GOOGLE_MAPS_API_KEY
     );
     
     const data = await response.json();
     if (data.results.length > 0) {
       return data.results[0].geometry.location;
     }
     return null;
   }

4. 路線規劃：
   async function getDirections(origin, destination) {
     const response = await fetch(
       'https://maps.googleapis.com/maps/api/directions/json?' +
       'origin=' + encodeURIComponent(origin) +
       '&destination=' + encodeURIComponent(destination) +
       '&key=' + import.meta.env.VITE_GOOGLE_MAPS_API_KEY
     );
     
     return await response.json();
   }`,
          verify: `測試 Google Maps：
1. 確認地圖正常顯示
2. 測試標記功能
3. 測試地理編碼
4. 驗證路線規劃`
        }
      }
    ]
  },
  {
    id: 40,
    title: "社交媒體 API 整合",
    shortTitle: "社交媒體",
    purpose: "整合 Facebook、Twitter/X、Instagram 等社交媒體 API，實作社交登入和內容分享。",
    badge: "common",
    category: "integrations",
    keywords: ["facebook", "twitter", "instagram", "social", "oauth", "login"],
    checklist: [
      { id: "40-1", label: "選擇社交媒體平台", completed: false },
      { id: "40-2", label: "建立應用程式和取得 API 金鑰", completed: false },
      { id: "40-3", label: "實作 OAuth 登入流程", completed: false },
      { id: "40-4", label: "實作內容分享功能", completed: false },
      { id: "40-5", label: "測試社交媒體整合", completed: false },
    ],
    prompts: [
      {
        id: "p40-1",
        title: "1. Facebook OAuth 登入",
        description: "實作 Facebook 社交登入",
        keywords: ["facebook", "oauth", "login"],
        prompts: {
          diagnostic: `檢查 Facebook 整合：
1. Facebook App 是否建立
2. OAuth 設定是否正確
3. 登入流程是否正常`,
          fix: `【Cursor 自動化指令】整合 Facebook OAuth

1. 安裝 Facebook SDK：
   npm install react-facebook-login
   
   import FacebookLogin from 'react-facebook-login';

2. 實作 Facebook 登入組件：
   function FacebookLoginButton() {
     const responseFacebook = (response) => {
       console.log('Facebook login response:', response);
       
       // 發送到後端驗證
       fetch('/api/auth/facebook', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           accessToken: response.accessToken,
           userID: response.userID,
         }),
       }).then(res => res.json())
         .then(data => {
           // 處理登入成功
         });
     };
     
     return (
       <FacebookLogin
         appId={import.meta.env.VITE_FACEBOOK_APP_ID}
         autoLoad={false}
         fields="name,email,picture"
         callback={responseFacebook}
       />
     );
   }

3. 後端驗證（Supabase Edge Function）：
   // supabase/functions/facebook-auth/index.ts
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
   
   serve(async (req) => {
     const { accessToken, userID } = await req.json();
     
     // 驗證 Facebook Token
     const fbResponse = await fetch(
       'https://graph.facebook.com/me?access_token=' + accessToken
     );
     const fbUser = await fbResponse.json();
     
     // 建立或更新 Supabase 用戶
     const supabase = createClient(
       Deno.env.get('SUPABASE_URL'),
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
     );
     
     // 處理用戶登入
     // ...
   });`,
          verify: `測試 Facebook 登入：
1. 測試登入流程
2. 確認用戶資料正確
3. 測試登出功能
4. 驗證錯誤處理`
        }
      }
    ]
  },
  // ===== 開發工具 =====
  {
    id: 41,
    title: "開發環境除錯工具",
    shortTitle: "除錯工具",
    purpose: "設定開發環境除錯工具，使用 React DevTools、Redux DevTools，優化除錯流程。",
    badge: "common",
    category: "development",
    keywords: ["debug", "devtools", "react", "redux", "console"],
    checklist: [
      { id: "41-1", label: "安裝 React DevTools", completed: false },
      { id: "41-2", label: "設定 Redux DevTools", completed: false },
      { id: "41-3", label: "配置除錯設定", completed: false },
      { id: "41-4", label: "建立除錯工具函數", completed: false },
      { id: "41-5", label: "測試除錯功能", completed: false },
    ],
    prompts: [
      {
        id: "p41-1",
        title: "1. React DevTools 設定",
        description: "使用 React DevTools 除錯",
        keywords: ["react", "devtools", "debug"],
        prompts: {
          diagnostic: `檢查除錯工具設定：
1. React DevTools 是否安裝
2. 除錯功能是否正常
3. 是否有除錯工具函數`,
          fix: `【Cursor 自動化指令】設定開發除錯工具

1. 安裝 React DevTools 瀏覽器擴充功能：
   - Chrome: 從 Chrome Web Store 安裝
   - Firefox: 從 Firefox Add-ons 安裝

2. 建立除錯工具函數 (src/lib/debug.ts)：
   const isDev = import.meta.env.DEV;
   
   export const debug = {
     log: (...args) => {
       if (isDev) {
         console.log('[DEBUG]', ...args);
       }
     },
     error: (...args) => {
       if (isDev) {
         console.error('[ERROR]', ...args);
       }
     },
     group: (label, fn) => {
       if (isDev) {
         console.group(label);
         fn();
         console.groupEnd();
       }
     },
     time: (label) => {
       if (isDev) {
         console.time(label);
       }
     },
     timeEnd: (label) => {
       if (isDev) {
         console.timeEnd(label);
       }
     },
   };

3. 使用 React DevTools Profiler：
   import { Profiler } from 'react';
   
   function onRenderCallback(id, phase, actualDuration) {
     console.log('Component:', id, 'Phase:', phase, 'Duration:', actualDuration);
   }
   
   <Profiler id="App" onRender={onRenderCallback}>
     <App />
   </Profiler>

4. Redux DevTools 設定（如果使用 Redux）：
   import { configureStore } from '@reduxjs/toolkit';
   
   export const store = configureStore({
     reducer: rootReducer,
     devTools: process.env.NODE_ENV !== 'production',
   });`,
          verify: `測試除錯工具：
1. 確認 React DevTools 正常運作
2. 測試除錯函數
3. 檢查效能分析
4. 驗證除錯資訊`
        }
      }
    ]
  },
  {
    id: 42,
    title: "Mock 服務與測試資料",
    shortTitle: "Mock 服務",
    purpose: "建立 Mock API 服務，生成測試資料，模擬後端回應，加速開發流程。",
    badge: "common",
    category: "development",
    keywords: ["mock", "fake", "data", "api", "testing", "development"],
    checklist: [
      { id: "42-1", label: "選擇 Mock 工具", completed: false },
      { id: "42-2", label: "建立 Mock API 端點", completed: false },
      { id: "42-3", label: "生成測試資料", completed: false },
      { id: "42-4", label: "整合到開發環境", completed: false },
      { id: "42-5", label: "測試 Mock 服務", completed: false },
    ],
    prompts: [
      {
        id: "p42-1",
        title: "1. Mock API 服務",
        description: "建立 Mock API 服務器",
        keywords: ["mock", "api", "server"],
        prompts: {
          diagnostic: `檢查 Mock 服務設定：
1. 是否有 Mock API
2. Mock 資料是否完整
3. Mock 服務是否正常運作`,
          fix: `【Cursor 自動化指令】建立 Mock API 服務

1. 使用 MSW (Mock Service Worker) - 已在測試工具中涵蓋
   或使用 json-server：
   
   npm install -D json-server
   
   // db.json
   {
     "users": [
       { "id": 1, "name": "User 1", "email": "user1@example.com" },
       { "id": 2, "name": "User 2", "email": "user2@example.com" }
     ],
     "posts": [
       { "id": 1, "title": "Post 1", "userId": 1 }
     ]
   }
   
   // package.json
   "scripts": {
     "mock:server": "json-server --watch db.json --port 3001"
   }

2. 使用 faker.js 生成測試資料：
   npm install -D @faker-js/faker
   
   import { faker } from '@faker-js/faker';
   
   function generateMockUsers(count = 10) {
     return Array.from({ length: count }, () => ({
       id: faker.string.uuid(),
       name: faker.person.fullName(),
       email: faker.internet.email(),
       avatar: faker.image.avatar(),
     }));
   }

3. 在開發環境中使用 Mock：
   // src/lib/api.ts
   const API_BASE = import.meta.env.DEV 
     ? 'http://localhost:3001'  // Mock server
     : import.meta.env.VITE_API_URL;  // Real API
   
   export async function fetchUsers() {
     const response = await fetch(API_BASE + '/users');
     return response.json();
   }`,
          verify: `測試 Mock 服務：
1. 確認 Mock API 正常運作
2. 測試資料生成
3. 驗證 API 回應格式
4. 檢查開發環境整合`
        }
      }
    ]
  },
  // ===== 行動應用 =====
  {
    id: 43,
    title: "React Native 應用開發",
    shortTitle: "React Native",
    purpose: "使用 React Native 開發跨平台行動應用，處理原生模組整合和平台特定問題。",
    badge: "advanced",
    category: "mobile",
    keywords: ["react", "native", "mobile", "ios", "android", "app"],
    checklist: [
      { id: "43-1", label: "設定 React Native 環境", completed: false },
      { id: "43-2", label: "建立專案結構", completed: false },
      { id: "43-3", label: "整合原生模組", completed: false },
      { id: "43-4", label: "處理平台差異", completed: false },
      { id: "43-5", label: "測試應用功能", completed: false },
    ],
    prompts: [
      {
        id: "p43-1",
        title: "1. React Native 專案設定",
        description: "建立 React Native 專案",
        keywords: ["react", "native", "setup"],
        prompts: {
          diagnostic: `檢查 React Native 環境：
1. Node.js 和開發工具是否安裝
2. Android/iOS 開發環境是否設定
3. 專案是否正常運行`,
          fix: `【Cursor 自動化指令】建立 React Native 專案

1. 安裝 React Native CLI：
   npm install -g react-native-cli
   
   或使用 Expo（推薦）：
   npm install -g expo-cli

2. 建立新專案：
   npx react-native init {{project_name}}
   
   或使用 Expo：
   npx create-expo-app {{project_name}}

3. 執行應用：
   # iOS
   npx react-native run-ios
   
   # Android
   npx react-native run-android

4. 整合 Supabase：
   npm install @supabase/supabase-js
   
   import { createClient } from '@supabase/supabase-js';
   
   const supabase = createClient(
     'YOUR_SUPABASE_URL',
     'YOUR_SUPABASE_ANON_KEY'
   );`,
          verify: `測試 React Native 應用：
1. 確認應用正常啟動
2. 測試基本功能
3. 檢查平台相容性
4. 驗證原生模組整合`
        }
      }
    ]
  },
  {
    id: 44,
    title: "行動應用上架與憑證管理",
    shortTitle: "App 上架",
    purpose: "處理 iOS App Store 和 Google Play 上架流程，管理憑證和簽名。",
    badge: "common",
    category: "mobile",
    keywords: ["app", "store", "ios", "android", "certificate", "signing"],
    checklist: [
      { id: "44-1", label: "準備上架資料", completed: false },
      { id: "44-2", label: "建立應用程式憑證", completed: false },
      { id: "44-3", label: "設定應用程式資訊", completed: false },
      { id: "44-4", label: "提交審核", completed: false },
      { id: "44-5", label: "處理審核回饋", completed: false },
    ],
    prompts: [
      {
        id: "p44-1",
        title: "1. iOS App Store 上架",
        description: "準備 iOS 應用上架",
        keywords: ["ios", "app", "store"],
        prompts: {
          diagnostic: `檢查 iOS 上架準備：
1. Apple Developer 帳號是否建立
2. 應用程式憑證是否設定
3. 上架資料是否完整`,
          fix: `【Cursor 自動化指令】iOS App Store 上架流程

1. 建立 App Store Connect 應用：
   - 登入 App Store Connect
   - 建立新應用程式
   - 填寫應用程式資訊

2. 設定 Xcode 專案：
   - 選擇正確的 Team
   - 設定 Bundle Identifier
   - 選擇 Provisioning Profile

3. 建置應用：
   - Product > Archive
   - 選擇 "Distribute App"
   - 選擇 "App Store Connect"

4. 上傳應用：
   - 使用 Xcode Organizer
   - 或使用 altool/transporter

5. 提交審核：
   - 在 App Store Connect 填寫審核資訊
   - 上傳截圖和說明
   - 提交審核`,
          verify: `檢查上架狀態：
1. 確認應用已上傳
2. 檢查審核狀態
3. 處理審核回饋
4. 確認應用已上架`
        }
      }
    ]
  },
  // ===== 國際化 =====
  {
    id: 45,
    title: "多語言支援與 i18n 設定",
    shortTitle: "多語言",
    purpose: "實作多語言支援，使用 i18n 框架，管理翻譯檔案，支援動態語言切換。",
    badge: "common",
    category: "i18n",
    keywords: ["i18n", "internationalization", "translation", "language", "locale"],
    checklist: [
      { id: "45-1", label: "選擇 i18n 框架", completed: false },
      { id: "45-2", label: "建立翻譯檔案", completed: false },
      { id: "45-3", label: "設定語言切換", completed: false },
      { id: "45-4", label: "處理日期時間格式", completed: false },
      { id: "45-5", label: "測試多語言功能", completed: false },
    ],
    prompts: [
      {
        id: "p45-1",
        title: "1. React i18next 設定",
        description: "使用 react-i18next 實作多語言",
        keywords: ["i18n", "react", "i18next"],
        prompts: {
          diagnostic: `檢查 i18n 設定：
1. 是否安裝 i18n 套件
2. 翻譯檔案是否存在
3. 語言切換是否正常`,
          fix: `【Cursor 自動化指令】設定 React i18next

1. 安裝套件：
   npm install i18next react-i18next i18next-browser-languagedetector

2. 建立 i18n 設定 (src/i18n/config.ts)：
   import i18n from 'i18next';
   import { initReactI18next } from 'react-i18next';
   import LanguageDetector from 'i18next-browser-languagedetector';
   
   import en from './locales/en.json';
   import zh from './locales/zh.json';
   
   i18n
     .use(LanguageDetector)
     .use(initReactI18next)
     .init({
       resources: {
         en: { translation: en },
         zh: { translation: zh },
       },
       fallbackLng: 'en',
       interpolation: {
         escapeValue: false,
       },
     });
   
   export default i18n;

3. 建立翻譯檔案 (src/i18n/locales/zh.json)：
   {
     "welcome": "歡迎",
     "hello": "你好，{{name}}",
     "buttons": {
       "submit": "提交",
       "cancel": "取消"
     }
   }

4. 在組件中使用：
   import { useTranslation } from 'react-i18next';
   
   function MyComponent() {
     const { t, i18n } = useTranslation();
     
     return (
       <div>
         <h1>{t('welcome')}</h1>
         <p>{t('hello', { name: 'User' })}</p>
         <button onClick={() => i18n.changeLanguage('zh')}>
           切換中文
         </button>
       </div>
     );
   }`,
          verify: `測試多語言功能：
1. 確認語言切換正常
2. 檢查翻譯是否正確
3. 測試日期時間格式
4. 驗證所有語言`
        }
      }
    ]
  },
  // ===== 業務功能擴充 =====
  {
    id: 46,
    title: "進階 CRM 功能",
    shortTitle: "進階 CRM",
    purpose: "擴充 CRM 功能，實作客戶分群、標籤系統、互動歷史和生命週期管理。",
    badge: "common",
    category: "business",
    keywords: ["crm", "customer", "segment", "tag", "lifecycle"],
    checklist: [
      { id: "46-1", label: "設計客戶資料結構", completed: false },
      { id: "46-2", label: "實作客戶分群功能", completed: false },
      { id: "46-3", label: "建立標籤系統", completed: false },
      { id: "46-4", label: "記錄互動歷史", completed: false },
      { id: "46-5", label: "實作生命週期管理", completed: false },
    ],
    prompts: [
      {
        id: "p46-1",
        title: "1. 客戶分群與標籤",
        description: "實作客戶分群和標籤功能",
        keywords: ["customer", "segment", "tag"],
        prompts: {
          diagnostic: `檢查 CRM 功能：
1. 客戶資料結構是否完整
2. 分群功能是否實作
3. 標籤系統是否建立`,
          fix: `【Cursor 自動化指令】實作進階 CRM 功能

1. 建立客戶標籤資料表：
   -- Supabase SQL
   CREATE TABLE customer_tags (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     customer_id UUID REFERENCES customers(id),
     tag_name TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE TABLE customer_segments (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     name TEXT NOT NULL,
     criteria JSONB,
     created_at TIMESTAMP DEFAULT NOW()
   );

2. 實作標籤管理：
   async function addTagToCustomer(customerId, tagName) {
     const { data, error } = await supabase
       .from('customer_tags')
       .insert({
         customer_id: customerId,
         tag_name: tagName,
       });
     
     return { data, error };
   }
   
   async function getCustomersByTag(tagName) {
     const { data } = await supabase
       .from('customer_tags')
       .select('customer_id, customers(*)')
       .eq('tag_name', tagName);
     
     return data;
   }

3. 實作客戶分群：
   async function createSegment(name, criteria) {
     const { data, error } = await supabase
       .from('customer_segments')
       .insert({
         name,
         criteria, // { min_orders: 5, tags: ['vip'] }
       });
     
     return { data, error };
   }`,
          verify: `測試 CRM 功能：
1. 測試標籤新增和查詢
2. 測試客戶分群
3. 驗證互動歷史記錄
4. 檢查生命週期管理`
        }
      }
    ]
  },
  {
    id: 47,
    title: "Email 行銷自動化",
    shortTitle: "Email 行銷",
    purpose: "擴充 Email 功能，實作郵件範本、排程發送、開啟率追蹤和 A/B 測試。",
    badge: "common",
    category: "business",
    keywords: ["email", "marketing", "template", "schedule", "tracking", "ab", "test"],
    checklist: [
      { id: "47-1", label: "設計郵件範本系統", completed: false },
      { id: "47-2", label: "實作排程發送功能", completed: false },
      { id: "47-3", label: "整合開啟率追蹤", completed: false },
      { id: "47-4", label: "實作 A/B 測試", completed: false },
      { id: "47-5", label: "建立郵件分析報表", completed: false },
    ],
    prompts: [
      {
        id: "p47-1",
        title: "1. 郵件範本與排程",
        description: "建立郵件範本和排程系統",
        keywords: ["email", "template", "schedule"],
        prompts: {
          diagnostic: `檢查 Email 行銷功能：
1. 郵件範本系統是否建立
2. 排程功能是否實作
3. 追蹤功能是否整合`,
          fix: `【Cursor 自動化指令】實作 Email 行銷自動化

1. 建立郵件範本資料表：
   CREATE TABLE email_templates (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     name TEXT NOT NULL,
     subject TEXT NOT NULL,
     body_html TEXT NOT NULL,
     body_text TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE TABLE email_campaigns (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     template_id UUID REFERENCES email_templates(id),
     scheduled_at TIMESTAMP,
     status TEXT DEFAULT 'draft',
     created_at TIMESTAMP DEFAULT NOW()
   );

2. 實作郵件發送排程：
   async function scheduleEmail(campaignId, scheduledAt) {
     const { data, error } = await supabase
       .from('email_campaigns')
       .update({
         scheduled_at: scheduledAt,
         status: 'scheduled',
       })
       .eq('id', campaignId);
     
     return { data, error };
   }

3. 使用 n8n 或 Supabase Edge Functions 處理排程：
   // 使用 Supabase Cron Jobs 或 n8n 工作流程`,
          verify: `測試 Email 行銷功能：
1. 測試郵件範本建立
2. 測試排程發送
3. 驗證開啟率追蹤
4. 檢查 A/B 測試功能`
        }
      }
    ]
  },
  // ===== 資料分析 =====
  {
    id: 48,
    title: "使用者行為追蹤與分析",
    shortTitle: "行為追蹤",
    purpose: "實作使用者行為追蹤，分析使用者路徑、轉換漏斗和使用者體驗指標。",
    badge: "common",
    category: "analytics",
    keywords: ["analytics", "tracking", "behavior", "funnel", "conversion"],
    checklist: [
      { id: "48-1", label: "選擇分析工具", completed: false },
      { id: "48-2", label: "設定事件追蹤", completed: false },
      { id: "48-3", label: "實作轉換漏斗", completed: false },
      { id: "48-4", label: "建立分析儀表板", completed: false },
      { id: "48-5", label: "測試追蹤功能", completed: false },
    ],
    prompts: [
      {
        id: "p48-1",
        title: "1. Google Analytics 整合",
        description: "整合 Google Analytics 追蹤",
        keywords: ["google", "analytics", "tracking"],
        prompts: {
          diagnostic: `檢查分析工具設定：
1. Google Analytics 是否設定
2. 追蹤代碼是否安裝
3. 事件追蹤是否正常`,
          fix: `【Cursor 自動化指令】整合 Google Analytics

1. 安裝 Google Analytics：
   npm install react-ga4
   
   import ReactGA from 'react-ga4';

2. 初始化：
   ReactGA.initialize('G-XXXXXXXXXX');

3. 追蹤頁面瀏覽：
   import { useEffect } from 'react';
   import { useLocation } from 'react-router-dom';
   
   function usePageTracking() {
     const location = useLocation();
     
     useEffect(() => {
       ReactGA.send({ hitType: 'pageview', page: location.pathname });
     }, [location]);
   }

4. 追蹤自訂事件：
   function trackEvent(category, action, label) {
     ReactGA.event({
       category: category,
       action: action,
       label: label,
     });
   }
   
   // 使用範例
   trackEvent('Button', 'Click', 'Subscribe');`,
          verify: `測試分析追蹤：
1. 確認事件正常追蹤
2. 檢查 Google Analytics 報表
3. 測試轉換漏斗
4. 驗證使用者路徑分析`
        }
      }
    ]
  },
  {
    id: 49,
    title: "資料視覺化與報表生成",
    shortTitle: "資料報表",
    purpose: "建立資料視覺化儀表板，生成自動化報表，支援資料匯出功能。",
    badge: "common",
    category: "analytics",
    keywords: ["dashboard", "report", "visualization", "chart", "export"],
    checklist: [
      { id: "49-1", label: "選擇視覺化套件", completed: false },
      { id: "49-2", label: "設計儀表板佈局", completed: false },
      { id: "49-3", label: "實作圖表組件", completed: false },
      { id: "49-4", label: "建立報表生成功能", completed: false },
      { id: "49-5", label: "實作資料匯出", completed: false },
    ],
    prompts: [
      {
        id: "p49-1",
        title: "1. 資料視覺化儀表板",
        description: "使用 Recharts 建立儀表板",
        keywords: ["dashboard", "chart", "visualization"],
        prompts: {
          diagnostic: `檢查視覺化設定：
1. 圖表套件是否安裝
2. 儀表板是否建立
3. 資料是否正確顯示`,
          fix: `【Cursor 自動化指令】建立資料視覺化儀表板

1. 安裝 Recharts（已在專案中）：
   npm install recharts

2. 建立圖表組件：
   import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
   
   function SalesChart({ data }) {
     return (
       <LineChart width={600} height={300} data={data}>
         <CartesianGrid strokeDasharray="3 3" />
         <XAxis dataKey="date" />
         <YAxis />
         <Tooltip />
         <Legend />
         <Line type="monotone" dataKey="sales" stroke="#8884d8" />
       </LineChart>
     );
   }

3. 建立儀表板：
   function Dashboard() {
     const [salesData, setSalesData] = useState([]);
     
     useEffect(() => {
       // 從 API 取得資料
       fetchSalesData().then(setSalesData);
     }, []);
     
     return (
       <div className="dashboard">
         <SalesChart data={salesData} />
         {/* 其他圖表 */}
       </div>
     );
   }`,
          verify: `測試視覺化功能：
1. 確認圖表正常顯示
2. 測試資料更新
3. 檢查報表生成
4. 驗證資料匯出`
        }
      }
    ]
  },
  // ===== 文件系統 =====
  {
    id: 50,
    title: "技術文件與知識庫",
    shortTitle: "技術文件",
    purpose: "建立技術文件系統，管理 API 文件、開發指南和常見問題知識庫。",
    badge: "common",
    category: "documentation",
    keywords: ["documentation", "docs", "knowledge", "base", "guide"],
    checklist: [
      { id: "50-1", label: "選擇文件工具", completed: false },
      { id: "50-2", label: "建立文件結構", completed: false },
      { id: "50-3", label: "撰寫技術文件", completed: false },
      { id: "50-4", label: "建立搜尋功能", completed: false },
      { id: "50-5", label: "部署文件網站", completed: false },
    ],
    prompts: [
      {
        id: "p50-1",
        title: "1. 建立文件網站",
        description: "使用 Docusaurus 或 VitePress 建立文件",
        keywords: ["documentation", "docs", "site"],
        prompts: {
          diagnostic: `檢查文件系統：
1. 是否有文件網站
2. 文件是否完整
3. 搜尋功能是否正常`,
          fix: `【Cursor 自動化指令】建立技術文件系統

1. 使用 Docusaurus：
   npx create-docusaurus@latest docs-website classic
   
   或使用 VitePress：
   npm install -D vitepress
   
   mkdir docs
   echo '# Hello VitePress' > docs/index.md

2. 建立文件結構：
   docs/
     getting-started/
       installation.md
       setup.md
     api/
       reference.md
     guides/
       deployment.md

3. 整合搜尋功能：
   - Docusaurus 內建搜尋
   - VitePress 可使用 Algolia

4. 部署文件：
   - 使用 GitHub Pages
   - 或使用 Vercel/Netlify`,
          verify: `測試文件系統：
1. 確認文件正常顯示
2. 測試搜尋功能
3. 檢查導航結構
4. 驗證部署狀態`
        }
      }
    ]
  }
];

// Helper: Get steps by category
export const getStepsByCategory = (category: Step['category']) => 
  stepsData.filter(step => step.category === category);

// Helper: Get all categories with counts
export const getCategoryCounts = () => {
  const counts: Record<string, number> = {};
  stepsData.forEach(step => {
    counts[step.category] = (counts[step.category] || 0) + 1;
  });
  return counts;
};
