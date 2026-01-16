import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Search, Wrench, CheckCircle, Database, Zap, Shield, Settings, Gauge, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PromptCard } from "./PromptCard";
import { Checklist } from "./Checklist";
import type { Step, PromptTone, ChecklistItem } from "@/data/stepsData";

interface StepDetailProps {
  step: Step;
  checklist: ChecklistItem[];
  tone: PromptTone;
  onToneChange: (tone: PromptTone) => void;
  onChecklistToggle: (id: string) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onCompleteStep: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  isCompleted: boolean;
  variables: Record<string, string>;
}

const toneConfig: Record<PromptTone, { icon: typeof Search; label: string; description: string }> = {
  diagnostic: { icon: Search, label: "診斷", description: "檢查問題所在" },
  fix: { icon: Wrench, label: "修正", description: "解決問題" },
  verify: { icon: CheckCircle, label: "驗證", description: "確認已修復" },
};

const categoryConfig: Record<Step['category'], { icon: typeof Database; label: string; color: string }> = {
  supabase: { icon: Database, label: "Supabase", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  n8n: { icon: Zap, label: "n8n", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  security: { icon: Shield, label: "安全性", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  general: { icon: Settings, label: "一般", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  backend: { icon: Settings, label: "後台串接", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  crm: { icon: Database, label: "CRM", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  email: { icon: Zap, label: "Email", color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  line: { icon: Zap, label: "LINE", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  frontend: { icon: Gauge, label: "前端優化", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  templates: { icon: FileText, label: "功能模組", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
};

export function StepDetail({
  step,
  checklist,
  tone,
  onToneChange,
  onChecklistToggle,
  onPrevStep,
  onNextStep,
  onCompleteStep,
  hasPrev,
  hasNext,
  isCompleted,
  variables,
}: StepDetailProps) {
  const badgeClass =
    step.badge === "critical"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : step.badge === "common"
      ? "bg-warning/10 text-warning border-warning/20"
      : "bg-muted text-muted-foreground border-border";

  const badgeLabel =
    step.badge === "critical"
      ? "常見問題"
      : step.badge === "common"
      ? "一般問題"
      : "進階";

  const categoryConf = categoryConfig[step.category];
  const CategoryIcon = categoryConf.icon;

  return (
    <motion.div
      key={step.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full flex flex-col"
    >
      {/* Step Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-border bg-card/50">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="outline" className={categoryConf.color}>
                <CategoryIcon className="w-3 h-3 mr-1" />
                {categoryConf.label}
              </Badge>
              <Badge variant="outline" className={badgeClass}>
                {badgeLabel}
              </Badge>
              {isCompleted && (
                <Badge className="bg-success text-success-foreground">
                  已解決
                </Badge>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
              {step.title}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">{step.purpose}</p>
          </div>
        </div>

        {/* Tone Selector - Debug Flow */}
        <div className="mt-4 p-1 bg-secondary rounded-lg inline-flex">
          {(Object.keys(toneConfig) as PromptTone[]).map((t, index) => {
            const { icon: Icon, label, description } = toneConfig[t];
            const isActive = tone === t;
            return (
              <button
                key={t}
                onClick={() => onToneChange(t)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {index + 1}
                </span>
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          目前模式: <span className="text-primary">{toneConfig[tone].description}</span>
        </p>

        {/* Keywords */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span className="text-xs text-muted-foreground">關鍵字:</span>
          <div className="flex flex-wrap gap-1">
            {step.keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="font-mono text-xs">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        {/* Checklist Section */}
        <section className="bg-card rounded-lg border border-border p-4">
          <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary rounded-full" />
            排查清單
            <span className="text-xs text-muted-foreground font-normal">
              ({checklist.filter(i => i.completed).length}/{checklist.length} 完成)
            </span>
          </h2>
          <Checklist items={checklist} onToggle={onChecklistToggle} />
        </section>

        {/* Prompts Section */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-accent rounded-full" />
            {tone === "diagnostic" ? "診斷指令" : tone === "fix" ? "修正方案" : "驗證步驟"}
            <span className="text-xs text-muted-foreground font-normal">
              點擊複製按鈕直接使用
            </span>
          </h2>
          <div className="space-y-4">
            {step.prompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                tone={tone}
                variables={variables}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Navigation Footer */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-border bg-card/50">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={onPrevStep}
            disabled={!hasPrev}
            className="gap-2"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">上一個問題</span>
          </Button>

          <div className="flex items-center gap-2">
            {!isCompleted && (
              <Button
                variant="secondary"
                onClick={onCompleteStep}
                className="gap-2"
                size="sm"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">標記已解決</span>
              </Button>
            )}
            <Button
              onClick={onNextStep}
              disabled={!hasNext}
              className="gap-2 bg-primary hover:bg-primary/90"
              size="sm"
            >
              <span className="hidden sm:inline">下一個問題</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
