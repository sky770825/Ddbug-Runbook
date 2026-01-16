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
  category: 'supabase' | 'n8n' | 'security' | 'general' | 'backend' | 'crm' | 'email' | 'line' | 'frontend' | 'templates' | 'deployment';
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
      { id: "2-4", label: "確認上傳路徑正確", completed: false },
      { id: "2-5", label: "測試圖片 URL 可存取", completed: false },
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
        description: "正確的檔案上傳流程與 URL 生成",
        keywords: ["upload", "url", "getPublicUrl", "signedUrl"],
        prompts: {
          diagnostic: `// 檢查上傳是否成功
const { data, error } = await supabase.storage
  .from('{{bucket_name}}')
  .upload('path/to/file.png', file);

console.log('Upload result:', { data, error });

// 常見錯誤：
// - "Bucket not found" → bucket 不存在
// - "new row violates RLS" → Storage policy 問題
// - "The resource already exists" → 檔案已存在`,
          fix: `【Cursor 自動化指令】自動實作完整的檔案上傳流程

請自動建立以下上傳功能：

// 1. 上傳檔案（使用用戶 ID 作為資料夾）
const handleFileUpload = async (file: File, bucketName: string = '{{bucket_name}}') => {
  // 確保用戶已登入
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // 建立檔案路徑（使用用戶 ID 作為資料夾）
  const fileExt = file.name.split('.').pop();
  const fileName = \`\${user.id}/\${Date.now()}.\${fileExt}\`;

  // 上傳檔案
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(fileName, file, {
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
};`,
          verify: `// 驗證圖片可以存取
const testUrl = publicUrl;

// 方法 1：使用 fetch 測試
const response = await fetch(testUrl, { method: 'HEAD' });
console.log('URL accessible:', response.ok);

// 方法 2：在瀏覽器直接開啟 URL
console.log('Test this URL:', testUrl);`
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
WHERE bucket_id = 'avatars' AND name LIKE '%filename%';

// 4. CORS 問題（較少見，Supabase 預設處理）`,
          fix: `// 修正常見問題

// 1. 確保 bucket 是 public
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

// 2. 使用正確的 URL 生成方式
const { data: { publicUrl } } = supabase.storage
  .from('avatars')
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
          verify: `// 完整的圖片顯示驗證
const imageUrl = supabase.storage
  .from('avatars')
  .getPublicUrl('path/to/image.png').data.publicUrl;

// 在 console 中測試
fetch(imageUrl)
  .then(res => {
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
  })
  .catch(err => console.error('Fetch failed:', err));`
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
