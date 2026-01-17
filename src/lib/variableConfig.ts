// 變數配置與驗證
import { z } from "zod";

// 變數驗證規則
export const variableValidationSchema = z.object({
  project_name: z.string().min(1, "專案名稱不能為空").optional(),
  repo_name: z.string().regex(/^[\w\-.]+\/[\w\-.]+$/, "格式應為 username/repo").optional(),
  supabase_ref: z.string().min(1, "Supabase Project Ref 不能為空").optional(),
  table_name: z.string().regex(/^[a-z][a-z0-9_]*$/, "表格名稱應為小寫字母、數字和底線").optional(),
  field_name: z.string().regex(/^[a-z][a-z0-9_]*$/, "欄位名稱應為小寫字母、數字和底線").optional(),
  bucket_name: z.string().regex(/^[a-z0-9-]+$/, "Bucket 名稱應為小寫字母、數字和連字號").optional(),
  function_name: z.string().regex(/^[a-z][a-z0-9-]*$/, "Function 名稱應為小寫字母、數字和連字號").optional(),
  api_endpoint: z.string().regex(/^\/[\w/-]*$/, "API 端點應以 / 開頭").optional(),
  channel_name: z.string().regex(/^[\w-]+$/, "Channel 名稱應為字母、數字、底線或連字號").optional(),
  resend_api_key: z.string().regex(/^re_[a-zA-Z0-9]+$/, "Resend API Key 格式應為 re_xxxxx").optional(),
  line_channel_access_token: z.string().min(40, "LINE Access Token 長度不足").optional(),
  line_channel_secret: z.string().min(20, "LINE Secret 長度不足").optional(),
  cron_secret: z.string().min(8, "Cron Secret 至少需要 8 個字元").optional(),
  redis_url: z.string().url("Redis URL 格式不正確").optional(),
  redis_token: z.string().min(20, "Redis Token 長度不足").optional(),
});

// 變數預設值
export const defaultVariables: Record<string, string> = {
  project_name: "",
  repo_name: "",
  supabase_ref: "",
  table_name: "",
  field_name: "",
  bucket_name: "",
  function_name: "",
  api_endpoint: "",
  channel_name: "",
  resend_api_key: "",
  line_channel_access_token: "",
  line_channel_secret: "",
  cron_secret: "",
  redis_url: "",
  redis_token: "",
};

// 驗證單個變數
export function validateVariable(key: string, value: string): { valid: boolean; error?: string } {
  try {
    const schema = variableValidationSchema.shape[key as keyof typeof variableValidationSchema.shape];
    if (schema) {
      schema.parse(value);
      return { valid: true };
    }
    return { valid: true }; // 如果沒有驗證規則，預設為有效
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message || "驗證失敗" };
    }
    return { valid: true };
  }
}

// 驗證所有變數
export function validateAllVariables(variables: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  Object.entries(variables).forEach(([key, value]) => {
    if (value.trim()) {
      const result = validateVariable(key, value);
      if (!result.valid && result.error) {
        errors[key] = result.error;
      }
    }
  });
  return errors;
}
