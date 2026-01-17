import { motion } from "framer-motion";
import { ArrowRight, Link2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Step } from "@/data/stepsData";

interface NextStepsProps {
  currentStep: Step;
  nextSteps: Step[];
  onStepClick: (stepId: number) => void;
}

export function NextSteps({ currentStep, nextSteps, onStepClick }: NextStepsProps) {
  if (!nextSteps || nextSteps.length === 0) {
    return null;
  }

  return (
    <section className="bg-card rounded-lg border border-border p-3 sm:p-4">
      <h2 className="text-sm sm:text-base font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-primary rounded-full" />
        <Link2 className="w-4 h-4 text-primary" />
        可串接的下一步驟
        <span className="text-xs text-muted-foreground font-normal">
          ({nextSteps.length} 個步驟)
        </span>
      </h2>

      <div className="space-y-2">
        {nextSteps.map((step) => {
          const categoryColors: Record<string, string> = {
            supabase: "bg-green-500/10 text-green-500 border-green-500/20",
            n8n: "bg-orange-500/10 text-orange-500 border-orange-500/20",
            line: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
            email: "bg-pink-500/10 text-pink-500 border-pink-500/20",
            crm: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
            database: "bg-blue-500/10 text-blue-500 border-blue-500/20",
          };

          const categoryColor = categoryColors[step.category] || "bg-muted text-muted-foreground border-border";

          return (
            <motion.div
              key={step.id}
              whileHover={{ scale: 1.02 }}
              className="bg-muted/30 rounded-lg p-3 border border-border/50 hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="outline" className={`${categoryColor} text-xs`}>
                      {step.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">步驟 {step.id}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    {step.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {step.purpose}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onStepClick(step.id)}
                  className="flex-shrink-0 gap-1.5 h-8"
                >
                  <span className="hidden sm:inline">前往</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 工作流程提示 */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="w-3.5 h-3.5" />
          <span>
            這些步驟可以與「{currentStep.shortTitle}」串接，形成完整的工作流程
          </span>
        </div>
      </div>
    </section>
  );
}
