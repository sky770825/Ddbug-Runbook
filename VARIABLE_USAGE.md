# 變數系統使用說明

## 📋 功能概述

系統現在支援動態變數替換功能，讓您可以填寫常用資訊（如表格名稱、欄位名稱、API 端點等），系統會自動將這些變數替換到所有提示詞中，方便直接複製使用。

## 🎯 支援的變數

### 基本資訊
- **project_name**: 專案名稱
- **repo_name**: GitHub Repository 路徑
- **supabase_ref**: Supabase Project Reference ID

### 資料庫
- **table_name**: 資料庫表格名稱（用於 RLS、查詢等）
- **field_name**: 資料庫欄位名稱（用於 RLS policy、查詢條件等）

### Storage
- **bucket_name**: Supabase Storage Bucket 名稱

### Edge Functions
- **function_name**: Supabase Edge Function 名稱

### API
- **api_endpoint**: API 端點路徑

### Realtime
- **channel_name**: Supabase Realtime Channel 名稱

## 🚀 使用方法

### 1. 開啟專案設定

點擊右上角的「設定」圖示（⚙️），開啟專案設定抽屜。

### 2. 填寫變數

在對應的欄位中填入您的專案資訊：

```
表格名稱: users
欄位名稱: user_id
Bucket 名稱: avatars
Function 名稱: send-email
```

### 3. 查看自動替換

填寫變數後，所有提示詞中的佔位符會自動替換：

**替換前：**
```sql
ALTER TABLE {{table_name}} ENABLE ROW LEVEL SECURITY;
```

**替換後（如果 table_name = "users"）：**
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

### 4. 複製使用

點擊提示詞卡片的「複製」按鈕，即可複製已替換完成的提示詞，直接貼到 Cursor 或 Supabase 中使用。

## 📝 變數佔位符格式

所有變數使用雙大括號格式：`{{變數名稱}}`

例如：
- `{{table_name}}` → 會被替換為您填寫的表格名稱
- `{{field_name}}` → 會被替換為您填寫的欄位名稱
- `{{bucket_name}}` → 會被替換為您填寫的 Bucket 名稱

## 💡 使用範例

### 範例 1：設定 RLS Policy

1. 在專案設定中填入：
   - `table_name`: `users`
   - `field_name`: `user_id`

2. 查看「RLS 政策阻擋存取」步驟的提示詞，會自動顯示：

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = user_id);
```

3. 直接複製使用！

### 範例 2：Storage 上傳

1. 在專案設定中填入：
   - `bucket_name`: `avatars`

2. 查看「Supabase Storage 圖片串接」步驟的提示詞，會自動顯示：

```typescript
const handleFileUpload = async (file: File, bucketName: string = 'avatars') => {
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, file);
  // ...
};
```

3. 直接複製使用！

### 範例 3：Edge Function 部署

1. 在專案設定中填入：
   - `function_name`: `send-email`
   - `supabase_ref`: `abcdefghijklmnop`

2. 查看「Supabase Edge Functions 自動化部署」步驟的提示詞，會自動顯示：

```bash
npx supabase functions deploy send-email

curl -i --location --request POST \
  'https://abcdefghijklmnop.supabase.co/functions/v1/send-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY'
```

3. 直接複製使用！

## ⚠️ 注意事項

1. **未填寫的變數**：如果變數未填寫，系統會保留 `{{變數名稱}}` 格式，提醒您需要設定。

2. **變數名稱區分大小寫**：變數名稱必須完全匹配，例如 `{{table_name}}` 和 `{{Table_Name}}` 是不同的變數。

3. **即時替換**：變數會即時替換到所有提示詞中，無需重新整理頁面。

4. **預覽功能**：在專案設定抽屜底部有「預覽替換效果」區域，可以即時查看變數替換的效果。

## 🔄 變數替換邏輯

- ✅ **已填寫變數**：直接替換為填寫的值
- ⚠️ **未填寫變數**：保留 `{{變數名稱}}` 格式，提醒需要設定
- 🔍 **自動搜尋**：系統會在所有提示詞中搜尋並替換所有匹配的變數

## 📚 相關步驟

以下步驟已支援變數替換：

1. ✅ RLS 政策阻擋存取
2. ✅ Supabase Storage 圖片串接
3. ✅ Supabase Authentication 自動化設定
4. ✅ Supabase Realtime 訂閱自動化
5. ✅ Supabase Edge Functions 自動化部署
6. ✅ SQL Migration 問題

## 🎉 開始使用

1. 點擊右上角「設定」圖示
2. 填寫您的專案資訊
3. 查看提示詞，確認變數已自動替換
4. 點擊「複製」按鈕，直接使用！

---

**最後更新**：2024-01-15
**版本**：1.0.0
