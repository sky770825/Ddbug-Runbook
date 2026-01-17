import { motion } from "framer-motion";
import { ArrowRight, Zap, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Step, WorkflowChain } from "@/data/stepsData";

interface WorkflowChainProps {
  currentStep: Step;
  workflowChains: WorkflowChain[];
  allSteps: Step[];
  onStepClick: (stepId: number) => void;
}

export function WorkflowChainComponent({
  currentStep,
  workflowChains,
  allSteps,
  onStepClick,
}: WorkflowChainProps) {
  if (!workflowChains || workflowChains.length === 0) {
    return null;
  }

  const getStepById = (id: number) => allSteps.find((s) => s.id === id);

  return (
    <section className="bg-card rounded-lg border border-border p-3 sm:p-4">
      <h2 className="text-sm sm:text-base font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-accent rounded-full" />
        <Zap className="w-4 h-4 text-accent" />
        工作流程鏈
        <span className="text-xs text-muted-foreground font-normal">
          ({workflowChains.length} 個流程)
        </span>
      </h2>

      <div className="space-y-4">
        {workflowChains.map((chain) => {
          const chainSteps = chain.steps
            .map((id) => getStepById(id))
            .filter((step): step is Step => step !== undefined);

          if (chainSteps.length === 0) return null;

          const currentIndex = chainSteps.findIndex((s) => s.id === currentStep.id);
          const isInChain = currentIndex !== -1;
          const nextSteps = isInChain ? chainSteps.slice(currentIndex + 1) : chainSteps;

          return (
            <div
              key={chain.id}
              className="bg-muted/30 rounded-lg p-3 border border-border/50"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    {chain.name}
                  </h3>
                  {chain.description && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {chain.description}
                    </p>
                  )}
                  {chain.tags && chain.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {chain.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0.5"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 工作流程視覺化 */}
              <div className="flex items-center gap-2 flex-wrap">
                {chainSteps.map((step, index) => {
                  const isCurrent = step.id === currentStep.id;
                  const isPast = isInChain && index < currentIndex;
                  const isNext = isInChain && index > currentIndex;

                  return (
                    <div key={step.id} className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onStepClick(step.id)}
                        className={`
                          px-2.5 py-1.5 rounded-md text-xs font-medium transition-all
                          ${
                            isCurrent
                              ? "bg-primary text-primary-foreground shadow-md"
                              : isPast
                              ? "bg-muted text-muted-foreground line-through opacity-60"
                              : isNext
                              ? "bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30"
                              : "bg-background text-foreground border border-border hover:bg-muted"
                          }
                        `}
                      >
                        <span className="hidden sm:inline">{step.shortTitle}</span>
                        <span className="sm:hidden">步驟 {step.id}</span>
                      </motion.button>
                      {index < chainSteps.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 下一步驟提示 */}
              {isInChain && nextSteps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs font-medium text-foreground">
                      下一步：
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {nextSteps.slice(0, 3).map((step) => (
                      <Button
                        key={step.id}
                        variant="outline"
                        size="sm"
                        onClick={() => onStepClick(step.id)}
                        className="h-7 text-xs gap-1.5"
                      >
                        <span>{step.shortTitle}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
