import { motion } from "framer-motion";
import { Tag, Hash, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Step } from "@/data/stepsData";

interface TagsProps {
  currentStep: Step;
  allSteps: Step[];
  onStepClick: (stepId: number) => void;
}

export function Tags({ currentStep, allSteps, onStepClick }: TagsProps) {
  // 根據關鍵字和分類找到相關步驟
  const getRelatedSteps = (): Step[] => {
    const related: Step[] = [];
    const seenIds = new Set<number>([currentStep.id]);

    // 1. 相同分類的步驟
    const sameCategory = allSteps.filter(
      (s) => s.category === currentStep.category && s.id !== currentStep.id
    );
    related.push(...sameCategory.slice(0, 3));

    // 2. 有相同關鍵字的步驟
    const keywordMatches = allSteps.filter((s) => {
      if (s.id === currentStep.id || seenIds.has(s.id)) return false;
      const commonKeywords = s.keywords.filter((k) =>
        currentStep.keywords.includes(k)
      );
      return commonKeywords.length > 0;
    });

    // 按共同關鍵字數量排序
    keywordMatches.sort((a, b) => {
      const aCommon = a.keywords.filter((k) =>
        currentStep.keywords.includes(k)
      ).length;
      const bCommon = b.keywords.filter((k) =>
        currentStep.keywords.includes(k)
      ).length;
      return bCommon - aCommon;
    });

    // 添加未重複的相關步驟
    keywordMatches.forEach((step) => {
      if (!seenIds.has(step.id) && related.length < 6) {
        related.push(step);
        seenIds.add(step.id);
      }
    });

    return related.slice(0, 6);
  };

  const relatedSteps = getRelatedSteps();

  // 獲取標籤分類
  const getTagGroups = () => {
    const groups: Record<string, string[]> = {
      分類: [currentStep.category],
      功能: currentStep.keywords.slice(0, 5),
    };

    // 從工作流程鏈中提取標籤
    if (currentStep.workflowChains) {
      const workflowTags = currentStep.workflowChains
        .flatMap((chain) => chain.tags || [])
        .filter((tag, index, self) => self.indexOf(tag) === index);
      if (workflowTags.length > 0) {
        groups["工作流程"] = workflowTags;
      }
    }

    return groups;
  };

  const tagGroups = getTagGroups();

  if (relatedSteps.length === 0 && Object.keys(tagGroups).length === 1) {
    return null;
  }

  return (
    <section className="bg-card rounded-lg border border-border p-3 sm:p-4">
      <h2 className="text-sm sm:text-base font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-accent rounded-full" />
        <Tag className="w-4 h-4 text-accent" />
        標籤與相關步驟
      </h2>

      {/* 標籤顯示 */}
      <div className="space-y-3 mb-4">
        {Object.entries(tagGroups).map(([groupName, tags]) => (
          <div key={groupName}>
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {groupName}:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs px-2 py-0.5 cursor-default"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 相關步驟 */}
      {relatedSteps.length > 0 && (
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">
              相關步驟 ({relatedSteps.length}):
            </span>
          </div>
          <div className="space-y-2">
            {relatedSteps.map((step) => {
              const categoryColors: Record<string, string> = {
                supabase: "bg-green-500/10 text-green-500 border-green-500/20",
                n8n: "bg-orange-500/10 text-orange-500 border-orange-500/20",
                line: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                email: "bg-pink-500/10 text-pink-500 border-pink-500/20",
                crm: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
                database: "bg-blue-500/10 text-blue-500 border-blue-500/20",
              };

              const categoryColor =
                categoryColors[step.category] ||
                "bg-muted text-muted-foreground border-border";

              // 計算共同關鍵字數量
              const commonKeywords = step.keywords.filter((k) =>
                currentStep.keywords.includes(k)
              );

              return (
                <motion.div
                  key={step.id}
                  whileHover={{ scale: 1.01 }}
                  className="bg-muted/30 rounded-lg p-2.5 border border-border/50 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={`${categoryColor} text-xs`}
                        >
                          {step.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          步驟 {step.id}
                        </span>
                        {commonKeywords.length > 0 && (
                          <span className="text-xs text-accent">
                            {commonKeywords.length} 個共同標籤
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mb-0.5">
                        {step.shortTitle}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {step.purpose}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStepClick(step.id)}
                      className="flex-shrink-0 h-7 w-7 p-0"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
