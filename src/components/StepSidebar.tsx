import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, AlertTriangle, AlertCircle, Info, Database, Zap, Shield, Settings, ChevronLeft, Gauge, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Step } from "@/data/stepsData";
import { getStepsByCategory } from "@/data/stepsData";

interface StepSidebarProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  onStepClick: (stepId: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const categoryConfig: Record<Step['category'], { icon: typeof Database; label: string; color: string }> = {
  supabase: { icon: Database, label: "Supabase", color: "text-green-500" },
  n8n: { icon: Zap, label: "n8n", color: "text-orange-500" },
  security: { icon: Shield, label: "安全性", color: "text-red-500" },
  general: { icon: Settings, label: "一般", color: "text-blue-500" },
  backend: { icon: Settings, label: "後台串接", color: "text-purple-500" },
  crm: { icon: Database, label: "CRM", color: "text-cyan-500" },
  email: { icon: Zap, label: "Email", color: "text-pink-500" },
  line: { icon: Zap, label: "LINE", color: "text-emerald-500" },
  frontend: { icon: Gauge, label: "前端優化", color: "text-indigo-500" },
  templates: { icon: FileText, label: "功能模組", color: "text-amber-500" },
};

export const StepSidebar = memo(function StepSidebar({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  isCollapsed = false,
  onToggleCollapse,
}: StepSidebarProps) {
  const getStepStatus = (stepId: number) => {
    if (completedSteps.includes(stepId)) return "complete";
    if (stepId === currentStep) return "active";
    return "pending";
  };

  const getBadgeIcon = (badge: Step["badge"]) => {
    switch (badge) {
      case "critical":
        return <AlertCircle className="w-3 h-3 text-destructive" />;
      case "common":
        return <AlertTriangle className="w-3 h-3 text-warning" />;
      default:
        return <Info className="w-3 h-3 text-muted-foreground" />;
    }
  };

  // Group steps by category using helper function
  const groupedSteps = useMemo(() => {
    const grouped: Record<string, Step[]> = {};
    const categories: Step['category'][] = ['supabase', 'n8n', 'security', 'general', 'backend', 'crm', 'email', 'line', 'frontend', 'templates'];
    categories.forEach(category => {
      const categorySteps = getStepsByCategory(category);
      if (categorySteps.length > 0) {
        grouped[category] = categorySteps;
      }
    });
    return grouped;
  }, []);

  return (
    <nav className="h-full flex flex-col relative">
      <div className="p-4 border-b border-sidebar-border relative">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              問題排查清單
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              依序檢查找出問題根源
            </p>
          </div>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="收合側邊欄"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {Object.entries(groupedSteps).map(([category, categorySteps]) => {
          const config = categoryConfig[category as Step['category']];
          const CategoryIcon = config.icon;
          
          return (
            <div key={category} className="mb-4">
              <div className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider ${config.color}`}>
                <CategoryIcon className="w-3.5 h-3.5" />
                {config.label}
              </div>
              
              <div className="space-y-1">
                {categorySteps.map((step) => {
                  const status = getStepStatus(step.id);
                  return (
                    <motion.button
                      key={step.id}
                      onClick={() => onStepClick(step.id)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all group ${
                        status === "active"
                          ? "bg-primary/10 border border-primary/20"
                          : status === "complete"
                          ? "bg-success/5 hover:bg-success/10"
                          : "hover:bg-sidebar-accent"
                      }`}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div
                        className={`step-indicator flex-shrink-0 mt-0.5 ${
                          status === "complete"
                            ? "step-indicator-complete"
                            : status === "active"
                            ? "step-indicator-active"
                            : "step-indicator-pending"
                        }`}
                      >
                        {status === "complete" ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span className="text-xs">{step.id}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {getBadgeIcon(step.badge)}
                          <p className={`text-sm font-medium truncate ${
                            status === "active" 
                              ? "text-primary" 
                              : status === "complete"
                              ? "text-success"
                              : "text-foreground"
                          }`}>
                            {step.shortTitle}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>已解決</span>
          <span className="font-medium">
            {completedSteps.length} / {steps.length}
          </span>
        </div>
        <div className="progress-bar-track">
          <motion.div
            className="progress-bar-fill"
            initial={{ width: 0 }}
            animate={{
              width: `${(completedSteps.length / steps.length) * 100}%`,
            }}
          />
        </div>
        {completedSteps.length === steps.length && (
          <p className="text-xs text-success mt-2 flex items-center gap-1">
            <Check className="w-3 h-3" />
            所有問題已排查完成！
          </p>
        )}
      </div>
    </nav>
  );
});
