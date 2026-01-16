import { Settings, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateVariable } from "@/lib/variableConfig";
import { useState } from "react";

interface ProjectSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  variables: Record<string, string>;
  onVariableChange: (key: string, value: string) => void;
}

const variableConfig = [
  {
    key: "project_name",
    label: "專案名稱",
    placeholder: "my-awesome-app",
    description: "專案在 prompt 中的顯示名稱",
    category: "基本資訊",
  },
  {
    key: "repo_name",
    label: "Repository",
    placeholder: "username/my-repo",
    description: "GitHub repository 路徑",
    category: "基本資訊",
  },
  {
    key: "supabase_ref",
    label: "Supabase Project Ref",
    placeholder: "abcdefghijklmnop",
    description: "Supabase 專案 reference ID",
    category: "基本資訊",
  },
  {
    key: "table_name",
    label: "表格名稱",
    placeholder: "users",
    description: "資料庫表格名稱（用於 RLS、查詢等）",
    category: "資料庫",
  },
  {
    key: "field_name",
    label: "欄位名稱",
    placeholder: "user_id",
    description: "資料庫欄位名稱（用於 RLS policy、查詢條件等）",
    category: "資料庫",
  },
  {
    key: "bucket_name",
    label: "Storage Bucket 名稱",
    placeholder: "avatars",
    description: "Supabase Storage bucket 名稱",
    category: "Storage",
  },
  {
    key: "function_name",
    label: "Edge Function 名稱",
    placeholder: "send-email",
    description: "Supabase Edge Function 名稱",
    category: "Edge Functions",
  },
  {
    key: "api_endpoint",
    label: "API 端點",
    placeholder: "/api/users",
    description: "API 端點路徑",
    category: "API",
  },
  {
    key: "channel_name",
    label: "Realtime Channel 名稱",
    placeholder: "messages",
    description: "Supabase Realtime channel 名稱",
    category: "Realtime",
  },
  {
    key: "resend_api_key",
    label: "Resend API Key",
    placeholder: "re_xxxxxxxxxxxx",
    description: "Resend Email 服務的 API Key（用於 Email 自動化）",
    category: "API Keys",
  },
  {
    key: "line_channel_access_token",
    label: "LINE Channel Access Token",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    description: "LINE Messaging API 的 Channel Access Token",
    category: "API Keys",
  },
  {
    key: "line_channel_secret",
    label: "LINE Channel Secret",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    description: "LINE Messaging API 的 Channel Secret",
    category: "API Keys",
  },
  {
    key: "cron_secret",
    label: "Cron Secret",
    placeholder: "your-secret-key-for-cron",
    description: "Edge Functions 定時任務的驗證密鑰",
    category: "Secrets",
  },
  {
    key: "redis_url",
    label: "Redis URL",
    placeholder: "https://xxx.upstash.io",
    description: "Redis 服務的 URL（用於伺服器快取）",
    category: "快取服務",
  },
  {
    key: "redis_token",
    label: "Redis Token",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    description: "Redis 服務的認證 Token",
    category: "快取服務",
  },
];

export function ProjectSettingsDrawer({
  isOpen,
  onClose,
  variables,
  onVariableChange,
}: ProjectSettingsDrawerProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleVariableChangeWithValidation = (key: string, value: string) => {
    onVariableChange(key, value);
    
    // 驗證變數
    if (value.trim()) {
      const result = validateVariable(key, value);
      if (result.valid) {
        setValidationErrors(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } else {
        setValidationErrors(prev => ({
          ...prev,
          [key]: result.error || "驗證失敗",
        }));
      }
    } else {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border shadow-2xl z-50"
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Settings className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">專案設定</h2>
                    <p className="text-sm text-muted-foreground">
                      設定變數以自動替換 prompt
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {Object.entries(
                  variableConfig.reduce((acc, config) => {
                    const category = config.category || "其他";
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(config);
                    return acc;
                  }, {} as Record<string, typeof variableConfig>)
                ).map(([category, configs]) => (
                  <div key={category} className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                      {category}
                    </h3>
                    {configs.map((config) => (
                      <div key={config.key} className="space-y-2">
                        <Label htmlFor={config.key} className="text-foreground">
                          {config.label}
                        </Label>
                        <Input
                          id={config.key}
                          placeholder={config.placeholder}
                          value={variables[config.key] || ""}
                          onChange={(e) =>
                            handleVariableChangeWithValidation(config.key, e.target.value)
                          }
                          className={`font-mono ${
                            validationErrors[config.key] ? "border-destructive" : ""
                          }`}
                        />
                        {validationErrors[config.key] && (
                          <div className="flex items-center gap-1 text-xs text-destructive">
                            <AlertCircle className="w-3 h-3" />
                            <span>{validationErrors[config.key]}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {config.description}
                        </p>
                        <p className="text-xs text-primary font-mono">
                          使用: {`{{${config.key}}}`}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}

                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-medium text-foreground mb-3">
                    預覽替換效果
                  </h3>
                  <div className="p-4 bg-code-background rounded-lg border border-code-border space-y-2">
                    <p className="text-sm font-mono text-code-foreground">
                      <span className="text-muted-foreground">-- 範例 SQL：</span>
                      <br />
                      ALTER TABLE{" "}
                      <span className="text-primary font-semibold">
                        {variables.table_name || "{{table_name}}"}
                      </span>{" "}
                      ENABLE ROW LEVEL SECURITY;
                    </p>
                    <p className="text-sm font-mono text-code-foreground">
                      <span className="text-muted-foreground">-- 範例查詢：</span>
                      <br />
                      SELECT * FROM{" "}
                      <span className="text-primary font-semibold">
                        {variables.table_name || "{{table_name}}"}
                      </span>
                      {variables.field_name && (
                        <>
                          {" "}WHERE{" "}
                          <span className="text-primary font-semibold">
                            {variables.field_name}
                          </span>{" "}= auth.uid();
                        </>
                      )}
                    </p>
                    {variables.bucket_name && (
                      <p className="text-sm font-mono text-code-foreground">
                        <span className="text-muted-foreground">-- 範例 Storage：</span>
                        <br />
                        .from('
                        <span className="text-primary font-semibold">
                          {variables.bucket_name}
                        </span>
                        ')
                      </p>
                    )}
                    {variables.function_name && (
                      <p className="text-sm font-mono text-code-foreground">
                        <span className="text-muted-foreground">-- 範例 Edge Function：</span>
                        <br />
                        supabase.functions.invoke('
                        <span className="text-primary font-semibold">
                          {variables.function_name}
                        </span>
                        ')
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border">
                <Button onClick={onClose} className="w-full">
                  完成設定
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
