# 🗄️ Supabase 自動化資料庫建置工具

## 📋 功能概述

這個工具可以根據專案中現有的會員資料、訂單等資料結構，自動生成完整的 Supabase 資料庫建置 SQL，包括：
- ✅ 資料表建立（CREATE TABLE）
- ✅ 索引建立（CREATE INDEX）
- ✅ RLS 政策（Row Level Security）
- ✅ 觸發器（Triggers）
- ✅ 函數（Functions）
- ✅ 外鍵關聯（Foreign Keys）

---

## 🎯 使用方式

### 方式一：從 TypeScript 類型定義自動生成

如果您有 TypeScript 類型定義，工具可以自動分析並生成 SQL。

#### 範例：會員資料表

**輸入（TypeScript 類型）**：
```typescript
interface Member {
  id: string; // UUID
  user_id: string; // UUID, 關聯到 auth.users
  email: string;
  display_name: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  organization_name?: string;
  organization_type?: 'company' | 'individual' | 'nonprofit';
  organization_id?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  role: 'admin' | 'member' | 'guest' | 'moderator';
  is_verified: boolean;
  language?: string;
  timezone?: string;
  notification_preferences?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
  verified_at?: Date;
}
```

**自動生成的 SQL**：
```sql
-- ============================================
-- 自動生成：members 資料表
-- 生成時間：2024-01-15
-- ============================================

-- 1. 建立資料表
CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- 基本資訊
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  
  -- 組織資訊
  organization_name TEXT,
  organization_type TEXT CHECK (organization_type IN ('company', 'individual', 'nonprofit')),
  organization_id TEXT,
  
  -- 地址資訊
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'TW',
  
  -- 狀態與權限
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  role TEXT DEFAULT 'member' NOT NULL CHECK (role IN ('admin', 'member', 'guest', 'moderator')),
  is_verified BOOLEAN DEFAULT false NOT NULL,
  
  -- 偏好設定
  language TEXT DEFAULT 'zh-TW',
  timezone TEXT DEFAULT 'Asia/Taipei',
  notification_preferences JSONB DEFAULT '{}',
  
  -- 時間戳
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_login_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ
);

-- 2. 建立索引
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_organization_name ON members(organization_name) WHERE organization_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_role ON members(role);
CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_email_lower ON members(LOWER(email));

-- 3. 啟用 RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- 4. 建立 RLS 政策
-- 使用者可以查看自己的資料
CREATE POLICY "Users can view own member data"
  ON members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 使用者可以更新自己的資料
CREATE POLICY "Users can update own member data"
  ON members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 使用者可以插入自己的資料
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

-- 管理員可以更新所有會員
CREATE POLICY "Admins can update all members"
  ON members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 5. 建立更新時間觸發器函數（如果尚未存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. 建立觸發器
DROP TRIGGER IF EXISTS update_members_updated_at ON members;
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. 自動建立會員資料的觸發器（當用戶註冊時）
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
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_member ON auth.users;
CREATE TRIGGER on_auth_user_created_member
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_member();

-- 8. 建立註解（說明）
COMMENT ON TABLE members IS '會員資料表，儲存所有會員的基本資訊和偏好設定';
COMMENT ON COLUMN members.user_id IS '關聯到 auth.users 的 UUID';
COMMENT ON COLUMN members.status IS '會員狀態：active, inactive, suspended, pending';
COMMENT ON COLUMN members.role IS '會員角色：admin, member, guest, moderator';
```

---

### 方式二：從現有程式碼自動分析

工具可以分析您專案中的程式碼，找出資料結構並自動生成 SQL。

#### 範例：訂單資料表

**輸入（從程式碼分析）**：
```typescript
// 從您的程式碼中分析出以下結構
const orderSchema = {
  id: 'UUID',
  user_id: 'UUID (FK -> members.user_id)',
  order_number: 'TEXT (UNIQUE)',
  status: 'pending | processing | shipped | delivered | cancelled',
  total_amount: 'NUMERIC(10,2)',
  currency: 'TEXT DEFAULT "TWD"',
  items: 'JSONB', // 訂單項目陣列
  shipping_address: 'JSONB',
  billing_address: 'JSONB',
  payment_method: 'TEXT',
  payment_status: 'pending | paid | failed | refunded',
  created_at: 'TIMESTAMPTZ',
  updated_at: 'TIMESTAMPTZ',
  shipped_at: 'TIMESTAMPTZ',
  delivered_at: 'TIMESTAMPTZ'
};
```

**自動生成的 SQL**：
```sql
-- ============================================
-- 自動生成：orders 資料表
-- 生成時間：2024-01-15
-- ============================================

-- 1. 建立資料表
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  order_number TEXT NOT NULL UNIQUE,
  
  -- 訂單狀態
  status TEXT DEFAULT 'pending' NOT NULL 
    CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  
  -- 金額資訊
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  currency TEXT DEFAULT 'TWD' NOT NULL,
  
  -- 訂單內容
  items JSONB DEFAULT '[]' NOT NULL,
  shipping_address JSONB,
  billing_address JSONB,
  
  -- 付款資訊
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending' NOT NULL
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  
  -- 時間戳
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- 2. 建立索引
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);

-- 3. 啟用 RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 4. 建立 RLS 政策
-- 使用者可以查看自己的訂單
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = (SELECT user_id FROM members WHERE user_id = orders.user_id));

-- 使用者可以建立自己的訂單
CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM members WHERE user_id = orders.user_id)
  );

-- 使用者可以更新自己的訂單（僅限特定狀態）
CREATE POLICY "Users can update own pending orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM members WHERE user_id = orders.user_id)
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM members WHERE user_id = orders.user_id)
  );

-- 管理員可以查看所有訂單
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 管理員可以更新所有訂單
CREATE POLICY "Admins can update all orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 5. 建立更新時間觸發器
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. 建立訂單狀態變更觸發器（記錄狀態變更歷史）
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id 
  ON order_status_history(order_id);

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_order_status_change_trigger ON orders;
CREATE TRIGGER log_order_status_change_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- 7. 建立註解
COMMENT ON TABLE orders IS '訂單資料表，儲存所有訂單資訊';
COMMENT ON COLUMN orders.user_id IS '關聯到 members.user_id';
COMMENT ON COLUMN orders.status IS '訂單狀態：pending, processing, shipped, delivered, cancelled';
COMMENT ON COLUMN orders.payment_status IS '付款狀態：pending, paid, failed, refunded';
```

---

## 🛠️ 工具功能

### 1. 自動類型推斷

工具會自動分析 TypeScript 類型並推斷對應的 PostgreSQL 類型：

| TypeScript | PostgreSQL | 說明 |
|------------|------------|------|
| `string` | `TEXT` | 文字字串 |
| `string` (UUID) | `UUID` | 如果欄位名包含 `id` 或 `uuid` |
| `number` | `NUMERIC` | 數字 |
| `number` (整數) | `INTEGER` | 如果沒有小數點 |
| `boolean` | `BOOLEAN` | 布林值 |
| `Date` | `TIMESTAMPTZ` | 時間戳 |
| `Record<string, any>` | `JSONB` | JSON 物件 |
| `Array<any>` | `JSONB` | JSON 陣列 |
| `'a' \| 'b' \| 'c'` | `TEXT CHECK (...)` | 列舉值 |

### 2. 自動索引生成

工具會根據欄位類型和使用模式自動生成索引：

- **主鍵和外鍵**：自動建立索引
- **唯一欄位**：自動建立唯一索引
- **常用查詢欄位**：自動建立索引（如 `status`, `created_at`）
- **組合查詢**：自動建立複合索引（如 `user_id + status`）

### 3. 自動 RLS 政策生成

工具會根據資料表類型自動生成適當的 RLS 政策：

- **使用者資料表**：使用者只能查看/更新自己的資料
- **訂單/交易表**：使用者可以查看自己的訂單，管理員可以查看全部
- **公開資料表**：所有人都可以查看，但只有管理員可以修改

### 4. 自動觸發器生成

工具會自動生成常用的觸發器：

- **更新時間觸發器**：自動更新 `updated_at` 欄位
- **自動建立關聯資料**：當使用者註冊時自動建立會員資料
- **狀態變更記錄**：記錄重要欄位的變更歷史

### 5. 外鍵關聯自動處理

工具會自動偵測並建立外鍵關聯：

- 如果欄位名包含 `user_id`，自動關聯到 `auth.users(id)`
- 如果欄位名包含 `_id` 且對應到其他資料表，自動建立外鍵
- 自動設定 `ON DELETE CASCADE` 或 `ON DELETE SET NULL`

---

## 📋 使用範例

### 範例 1：會員資料表

**輸入**：提供 TypeScript 類型定義或程式碼

**輸出**：完整的 SQL 建置腳本，包含：
- 資料表建立
- 索引建立
- RLS 政策
- 觸發器
- 函數

### 範例 2：訂單系統

**輸入**：訂單相關的資料結構

**輸出**：
- `orders` 資料表
- `order_items` 資料表（如果訂單項目是獨立表）
- `order_status_history` 資料表（狀態變更記錄）
- 所有相關的索引、RLS、觸發器

### 範例 3：產品目錄

**輸入**：產品資料結構

**輸出**：
- `products` 資料表
- `product_categories` 資料表
- `product_images` 資料表
- 所有關聯和索引

---

## 🎯 實作方式

### 選項 A：建立新的排查步驟

在系統中添加一個新的步驟：「Supabase 自動化資料庫建置」

這個步驟會提供：
1. **診斷模式**：分析現有資料結構
2. **修正模式**：生成完整的 SQL 腳本
3. **驗證模式**：檢查生成的 SQL 是否正確

### 選項 B：建立獨立工具

建立一個獨立的工具頁面，可以：
1. 上傳 TypeScript 類型定義檔案
2. 或貼上資料結構定義
3. 自動生成 SQL
4. 一鍵複製到 Supabase SQL Editor

### 選項 C：整合到現有步驟

擴充現有的 Supabase 相關步驟，添加「自動生成」功能。

---

## 💡 建議實作方案

我建議採用 **選項 A + 選項 B 的組合**：

1. **在排查系統中添加新步驟**（選項 A）
   - 提供診斷、修正、驗證三個模式
   - 整合到現有的步驟流程中

2. **建立獨立的 SQL 生成工具**（選項 B）
   - 可以獨立使用
   - 提供更詳細的設定選項
   - 可以匯出/匯入設定

---

## 📝 下一步

請告訴我您希望：
1. **採用哪種實作方式**？（選項 A、B、C 或組合）
2. **需要支援哪些資料表類型**？（會員、訂單、產品等）
3. **是否需要自訂 RLS 政策規則**？
4. **是否需要支援資料遷移**？（從舊系統匯入）

我可以根據您的需求開始實作！
