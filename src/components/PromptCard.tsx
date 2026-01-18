import { useState, useEffect, useMemo, memo } from "react";
import { Check, Copy, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { Prompt, PromptTone } from "@/data/stepsData";

interface PromptCardProps {
  prompt: Prompt;
  tone: PromptTone;
  variables: Record<string, string>;
}

// 正則表達式快取
const regexCache = new Map<string, RegExp>();
const getRegex = (key: string): RegExp => {
  if (!regexCache.has(key)) {
    regexCache.set(key, new RegExp(`\\{\\{${key}\\}\\}`, "g"));
  }
  return regexCache.get(key)!;
};

export const PromptCard = memo(function PromptCard({ prompt, tone, variables }: PromptCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // 初始化模組變數（當 prompt 改變時重置）
  const [moduleVariables, setModuleVariables] = useState<Record<string, string>>({});

  // 當 prompt 改變時，重置模組變數
  useEffect(() => {
    if (prompt.variables) {
      const initial: Record<string, string> = {};
      prompt.variables.forEach(v => {
        initial[v.key] = variables[v.key] || "";
      });
      setModuleVariables(initial);
    } else {
      setModuleVariables({});
    }
  }, [prompt.id, prompt.variables, variables]);

  const handleModuleVariableChange = (key: string, value: string) => {
    setModuleVariables(prev => ({ ...prev, [key]: value }));
  };

  // 優化：使用 useMemo 快取變數替換結果，減少字符串操作
  const processedPrompt = useMemo(() => {
    let result = prompt.prompts[tone];
    if (!result) return "";
    
    // 先收集所有需要替換的變數（避免重複遍歷）
    const replacements = new Map<string, string>();
    
    // 先處理模組變數（優先）
    if (prompt.variables) {
      prompt.variables.forEach(v => {
        const value = moduleVariables[v.key] || variables[v.key] || "";
        replacements.set(v.key, value && value.trim() ? value : `{{${v.key}}}`);
      });
    }
    
    // 再處理全域變數（跳過已處理的模組變數）
    Object.entries(variables).forEach(([key, value]) => {
      // 跳過已經處理的模組變數
      if (!prompt.variables?.some(v => v.key === key)) {
        replacements.set(key, value && value.trim() ? value : `{{${key}}}`);
      }
    });
    
    // 一次性替換所有變數（更高效）
    replacements.forEach((value, key) => {
      const regex = getRegex(key);
      result = result.replace(regex, value);
    });
    
    return result;
  }, [prompt.prompts, tone, moduleVariables, variables, prompt.variables]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(processedPrompt);
    setCopied(true);
    toast({
      title: "已複製！",
      description: "內容已複製到剪貼簿，可直接貼上使用",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      layout
      className="prompt-card group"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="prompt-header">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Terminal className="w-4 h-4 text-primary flex-shrink-0" />
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="truncate">{prompt.title}</span>
          </button>
        </div>
        
        <Button
          size="sm"
          onClick={handleCopy}
          className={`h-8 px-4 gap-2 transition-all flex-shrink-0 ${
            copied 
              ? "bg-success text-success-foreground hover:bg-success" 
              : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
          }`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>已複製</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>複製</span>
            </>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* 模組變數輸入欄位 */}
            {prompt.variables && prompt.variables.length > 0 && (
              <div className="px-4 py-4 border-b border-code-border bg-accent/30 space-y-4">
                <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                  填寫欄位
                </div>
                {prompt.variables.map((variable) => (
                  <div key={variable.key} className="space-y-2">
                    <Label htmlFor={variable.key} className="text-sm text-foreground">
                      {variable.label}
                    </Label>
                    <Input
                      id={variable.key}
                      placeholder={variable.placeholder}
                      value={moduleVariables[variable.key] || ""}
                      onChange={(e) => handleModuleVariableChange(variable.key, e.target.value)}
                      className="font-mono text-sm"
                    />
                    {variable.description && (
                      <p className="text-xs text-muted-foreground">
                        {variable.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="px-4 py-3 border-b border-code-border bg-secondary/30">
              <p className="text-sm text-muted-foreground">
                {prompt.description}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {prompt.keywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="outline"
                    className="text-xs font-mono px-2 py-0.5"
                  >
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
            <pre className="prompt-content whitespace-pre-wrap select-all cursor-text">
              {processedPrompt}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
