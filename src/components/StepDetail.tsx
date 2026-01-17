import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Search, Wrench, CheckCircle, Database, Zap, Shield, Settings, Gauge, FileText, Rocket, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PromptCard } from "./PromptCard";
import { Checklist } from "./Checklist";
import { WorkflowChainComponent } from "./WorkflowChain";
import { NextSteps } from "./NextSteps";
import { Tags } from "./Tags";
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
  onUndoCompleteStep: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  isCompleted: boolean;
  variables: Record<string, string>;
  allSteps: Step[];
  onStepClick: (stepId: number) => void;
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
  deployment: { icon: Rocket, label: "部署問題", color: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
};

function StepDetail({
  step,
  checklist,
  tone,
  onToneChange,
  onChecklistToggle,
  onPrevStep,
  onNextStep,
  onCompleteStep,
  onUndoCompleteStep,
  hasPrev,
  hasNext,
  isCompleted,
  variables,
  allSteps,
  onStepClick,
}: StepDetailProps) {
  // 獲取下一步驟
  const nextSteps = step.nextSteps
    ? step.nextSteps
        .map((id) => allSteps.find((s) => s.id === id))
        .filter((s): s is Step => s !== undefined)
    : [];
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
      className="h-full flex flex-col min-h-0"
    >
      {/* Step Header - 優化電腦版空間使用 */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-2 sm:py-3 border-b border-border bg-card/50">
        {/* 第一行：標題和 Badges */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
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
            <h1 className="text-lg sm:text-xl font-bold text-foreground mb-1">
              {step.title}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm line-clamp-2">{step.purpose}</p>
          </div>
        </div>

        {/* 第二行：Tone Selector 和 目前模式（電腦版同行顯示） */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
          <div className="p-1 bg-secondary rounded-lg inline-flex">
            {(Object.keys(toneConfig) as PromptTone[]).map((t, index) => {
              const { icon: Icon, label, description } = toneConfig[t];
              const isActive = tone === t;
              return (
                <button
                  key={t}
                  onClick={() => onToneChange(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={`flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    {index + 1}
                  </span>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>
          {/* 目前模式 - 電腦版顯示在 Tone Selector 右側 */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground hidden lg:inline">
              模式: <span className="text-primary font-medium">{toneConfig[tone].description}</span>
            </span>
            {/* 關鍵字 - 緊湊顯示 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground hidden sm:inline">關鍵字:</span>
              <div className="flex flex-wrap gap-1">
                {step.keywords.slice(0, 4).map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="font-mono text-[10px] sm:text-xs px-1.5 py-0.5">
                    {keyword}
                  </Badge>
                ))}
                {step.keywords.length > 4 && (
                  <Badge variant="secondary" className="font-mono text-[10px] sm:text-xs px-1.5 py-0.5 text-muted-foreground">
                    +{step.keywords.length - 4}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* 目前模式 - 手機版單獨顯示 */}
        <p className="text-xs text-muted-foreground mt-1.5 sm:hidden">
          目前模式: <span className="text-primary">{toneConfig[tone].description}</span>
        </p>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-5 space-y-4 min-h-0 overscroll-contain">
        {/* Checklist Section */}
        <section className="bg-card rounded-lg border border-border p-3 sm:p-4">
          <h2 className="text-sm sm:text-base font-semibold text-foreground mb-2.5 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary rounded-full" />
            排查清單
            <span className="text-xs text-muted-foreground font-normal">
              ({checklist.filter(i => i.completed).length}/{checklist.length} 完成)
            </span>
          </h2>
          <Checklist items={checklist} onToggle={onChecklistToggle} />
        </section>

        {/* Prompts Section - 核心內容區域 */}
        <section>
          <h2 className="text-sm sm:text-base font-semibold text-foreground mb-3 flex items-center gap-2">
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

        {/* Workflow Chains Section */}
        {step.workflowChains && step.workflowChains.length > 0 && (
          <WorkflowChainComponent
            currentStep={step}
            workflowChains={step.workflowChains}
            allSteps={allSteps}
            onStepClick={onStepClick}
          />
        )}

        {/* Next Steps Section */}
        {nextSteps.length > 0 && (
          <NextSteps
            currentStep={step}
            nextSteps={nextSteps}
            onStepClick={onStepClick}
          />
        )}

        {/* Tags Section */}
        <Tags
          currentStep={step}
          allSteps={allSteps}
          onStepClick={onStepClick}
        />
      </div>

      {/* Navigation Footer */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-2 sm:py-3 border-t border-border bg-card/50">
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
            {isCompleted ? (
              <Button
                variant="outline"
                onClick={onUndoCompleteStep}
                className="gap-2 border-warning/20 text-warning hover:bg-warning/10"
                size="sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">撤銷已解決</span>
              </Button>
            ) : (
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

// 同時提供命名導出和默認導出以支持不同的導入方式
export { StepDetail };
export default StepDetail;
