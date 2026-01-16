# Cursor 自動化提示詞集合

本文件包含所有可直接複製使用的 Cursor 自動化提示詞，涵蓋 Supabase 常見問題的自動化處理。

## 📋 使用說明

1. 複製對應的提示詞
2. 貼到 Cursor 中
3. Cursor 會自動執行對應的任務

---

## 🔐 1. RLS 政策阻擋存取

### 1.1 檢查用戶登入狀態

```
【Cursor 自動化指令】檢查用戶登入狀態

1. 在 Supabase SQL Editor 執行：
SELECT auth.uid() as current_user_id;

2. 如果回傳 null，表示用戶未登入。前端檢查方式：
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user?.id || 'NOT LOGGED IN');
```

### 1.2 實作登入檢查與 API 呼叫保護

```
【Cursor 自動化指令】實作登入檢查與 API 呼叫保護

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
  .from('your_table')
  .select('*')
  .eq('user_id', user.id);

if (error) {
  console.error('RLS Error:', error);
  // 自動處理錯誤
}
```

### 1.3 自動建立完整的 RLS Policies

```
【Cursor 自動化指令】自動建立完整的 RLS Policies

請根據表格結構自動生成以下 SQL，並在 Supabase SQL Editor 執行：

-- 1. 啟用 RLS（如果尚未啟用）
ALTER TABLE your_table_name ENABLE ROW LEVEL SECURITY;

-- 2. SELECT: 用戶只能讀取自己的資料
CREATE POLICY "Users can view own data"
  ON your_table_name FOR SELECT
  USING (auth.uid() = user_id);

-- 3. INSERT: 用戶只能新增自己的資料
CREATE POLICY "Users can insert own data"
  ON your_table_name FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. UPDATE: 用戶只能更新自己的資料
CREATE POLICY "Users can update own data"
  ON your_table_name FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. DELETE: 用戶只能刪除自己的資料
CREATE POLICY "Users can delete own data"
  ON your_table_name FOR DELETE
  USING (auth.uid() = user_id);

【注意】請將 your_table_name 替換為實際表格名稱，user_id 替換為實際的用戶 ID 欄位名稱。
```

---

## 📸 2. Supabase Storage 圖片串接

### 2.1 自動實作完整的檔案上傳流程

```
【Cursor 自動化指令】自動實作完整的檔案上傳流程

請自動建立以下上傳功能：

// 1. 上傳檔案（使用用戶 ID 作為資料夾）
const handleFileUpload = async (file: File, bucketName: string = 'avatars') => {
  // 確保用戶已登入
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // 建立檔案路徑（使用用戶 ID 作為資料夾）
  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/${Date.now()}.${fileExt}`;

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

  return { publicUrl, path: fileName };
};

// 使用範例：
const uploadAvatar = async (file: File) => {
  try {
    const { publicUrl } = await handleFileUpload(file, 'avatars');
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
```

### 2.2 建立 Storage Bucket 與 RLS Policies

```
【Cursor 自動化指令】自動建立 Storage Bucket 與 RLS Policies

請在 Supabase SQL Editor 執行：

-- 1. 建立公開的 bucket（任何人可讀取）
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 建立私有的 bucket（需要認證才能讀取）
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3. 允許已登入用戶上傳檔案到自己的資料夾
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. 允許任何人讀取公開 bucket 的檔案
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 5. 允許用戶刪除自己的檔案
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## 🔑 3. Supabase Authentication 自動化設定

### 3.1 自動設定 Email/Password 登入

```
【Cursor 自動化指令】自動設定 Email/Password 認證

請在 Supabase Dashboard 或使用 SQL 自動設定：

-- 1. 啟用 Email provider（在 Dashboard 中操作）
-- Authentication > Providers > Email > Enable

-- 2. 前端實作登入/註冊功能
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
    emailRedirectTo: `${window.location.origin}/auth/callback`
  }
});

// 登入
const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password'
});

// 登出
await supabase.auth.signOut();
```

### 3.2 自動建立用戶資料表與觸發器

```
【Cursor 自動化指令】自動建立用戶資料表與觸發器

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
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 3.3 OAuth 登入自動設定

```
【Cursor 自動化指令】自動設定 OAuth 登入

1. 在 Supabase Dashboard 設定：
   - Authentication > Providers > Google/GitHub/etc
   - 啟用 provider
   - 填入 Client ID 和 Client Secret（從對應平台取得）
   - 設定 Redirect URL: https://your-project-ref.supabase.co/auth/v1/callback

2. 前端實作 OAuth 登入：
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google', // 或 'github', 'apple', etc.
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
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
}, []);
```

---

## 🔄 4. Supabase Realtime 訂閱自動化

### 4.1 啟用表格 Realtime

```
【Cursor 自動化指令】自動啟用表格 Realtime

請在 Supabase SQL Editor 執行：

-- 1. 啟用表格的 Realtime（方法一：使用 Dashboard）
-- Dashboard > Database > Replication > 選擇表格 > Enable

-- 2. 啟用表格的 Realtime（方法二：使用 SQL）
-- 首先建立 publication（如果不存在）
CREATE PUBLICATION supabase_realtime FOR TABLE your_table_name;

-- 或將表格加入現有 publication
ALTER PUBLICATION supabase_realtime ADD TABLE your_table_name;

-- 3. 設定 replica identity（用於 UPDATE/DELETE 事件）
ALTER TABLE your_table_name REPLICA IDENTITY FULL;

-- 4. 前端訂閱實作
const subscription = supabase
  .channel('your_table_changes')
  .on(
    'postgres_changes',
    {
      event: '*', // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'your_table_name',
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
};
```

### 4.2 Presence 協作功能

```
【Cursor 自動化指令】自動實作 Presence 協作功能

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
};
```

---

## ⚡ 5. Supabase Edge Functions 自動化部署

### 5.1 自動建立 Edge Function 專案

```
【Cursor 自動化指令】自動建立 Edge Function

1. 初始化 Supabase 專案（如果尚未初始化）：
npx supabase init

2. 建立新的 Edge Function：
npx supabase functions new your-function-name

3. 基本 Edge Function 模板：
// supabase/functions/your-function-name/index.ts
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
});
```

### 5.2 自動部署 Edge Function

```
【Cursor 自動化指令】自動部署 Edge Function

1. 設定 Supabase 專案連結：
npx supabase link --project-ref your-project-ref

2. 設定 Secrets（環境變數）：
npx supabase secrets set API_KEY=your-api-key
npx supabase secrets set RESEND_API_KEY=your-resend-key

3. 部署 Function：
npx supabase functions deploy your-function-name

4. 或部署所有 Functions：
npx supabase functions deploy

5. 測試部署的 Function：
curl -i --location --request POST \\
  'https://your-project-ref.supabase.co/functions/v1/your-function-name' \\
  --header 'Authorization: Bearer YOUR_ANON_KEY' \\
  --header 'Content-Type: application/json' \\
  --data '{"key":"value"}'

6. 前端呼叫 Edge Function：
const { data, error } = await supabase.functions.invoke('your-function-name', {
  body: { key: 'value' }
});
```

### 5.3 實作定時任務 (Cron Jobs)

```
【Cursor 自動化指令】自動實作定時任務

1. 建立定時任務 Edge Function：
// supabase/functions/cron-job/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // 驗證 Cron Secret（安全檢查）
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
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
npx supabase secrets set CRON_SECRET=your-secret-key

4. 使用 GitHub Actions 自動執行（範例）：
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
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \\
            https://your-project-ref.supabase.co/functions/v1/cron-job
```

---

## 📊 6. SQL Migration 問題

### 6.1 重新生成 TypeScript 類型

```
【Cursor 自動化指令】自動生成 TypeScript 類型

# 使用遠端資料庫
npx supabase gen types typescript --project-id your-project-ref > src/types/database.types.ts

# 或使用本地資料庫
npx supabase gen types typescript --local > src/types/database.types.ts

# 確保 Supabase client 使用類型
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

---

## 🎯 快速使用指南

### 完整 Supabase 專案初始化流程

```
【Cursor 自動化指令】完整 Supabase 專案初始化

請按照以下順序自動執行：

1. 設定環境變數
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY（僅後端）

2. 建立用戶資料表與觸發器（使用 3.2 的 SQL）

3. 建立必要的 Storage Buckets（使用 2.2 的 SQL）

4. 設定 RLS Policies（使用 1.3 的 SQL）

5. 生成 TypeScript 類型（使用 6.1 的指令）

6. 實作 Authentication（使用 3.1 和 3.3 的程式碼）

7. 測試所有功能是否正常運作
```

---

## 📝 注意事項

1. **安全性**：永遠不要在前端暴露 `SUPABASE_SERVICE_ROLE_KEY`
2. **RLS**：所有表格都應該啟用 RLS 並設定適當的 policies
3. **類型安全**：定期更新 TypeScript 類型以保持與資料庫同步
4. **錯誤處理**：所有 API 呼叫都應該包含錯誤處理邏輯
5. **測試**：在部署前務必測試所有功能

---

## 🔗 相關資源

- [Supabase 官方文件](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

---

**最後更新**：2024-01-15
**版本**：1.0.0
