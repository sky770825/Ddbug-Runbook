import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Step } from "@/data/stepsData";

interface SearchBarProps {
  steps: Step[];
  onSelectStep: (stepId: number) => void;
}

interface SearchResult {
  stepId: number;
  stepTitle: string;
  type: "step" | "prompt" | "keyword";
  title: string;
  keywords: string[];
}

export function SearchBar({ steps, onSelectStep }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];

    const searchTerms = query.toLowerCase().split(/\s+/);
    const matches: SearchResult[] = [];

    steps.forEach((step) => {
      // Match step title/keywords
      const stepMatches = searchTerms.every(
        (term) =>
          step.title.toLowerCase().includes(term) ||
          step.shortTitle.toLowerCase().includes(term) ||
          step.keywords.some((k) => k.toLowerCase().includes(term))
      );

      if (stepMatches) {
        matches.push({
          stepId: step.id,
          stepTitle: step.shortTitle,
          type: "step",
          title: step.title,
          keywords: step.keywords,
        });
      }

      // Match prompts
      step.prompts.forEach((prompt) => {
        const promptMatches = searchTerms.every(
          (term) =>
            prompt.title.toLowerCase().includes(term) ||
            prompt.description.toLowerCase().includes(term) ||
            prompt.keywords.some((k) => k.toLowerCase().includes(term))
        );

        if (promptMatches && !stepMatches) {
          matches.push({
            stepId: step.id,
            stepTitle: step.shortTitle,
            type: "prompt",
            title: prompt.title,
            keywords: prompt.keywords,
          });
        }
      });
    });

    return matches.slice(0, 8);
  }, [query, steps]);

  const handleSelect = (stepId: number) => {
    onSelectStep(stepId);
    setQuery("");
    setIsFocused(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="搜尋 step、prompt 或關鍵字..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          className="pl-10 pr-10 bg-secondary/50 border-border focus:bg-background"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isFocused && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 top-full mt-2 w-full bg-popover border border-border rounded-lg shadow-xl overflow-hidden"
          >
            {results.map((result, index) => (
              <button
                key={`${result.stepId}-${result.title}-${index}`}
                onClick={() => handleSelect(result.stepId)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
              >
                <Badge
                  variant="outline"
                  className={`flex-shrink-0 mt-0.5 ${
                    result.type === "step"
                      ? "border-primary text-primary"
                      : "border-muted-foreground text-muted-foreground"
                  }`}
                >
                  {result.type === "step" ? "Step" : "Prompt"}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {result.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Step {result.stepId}: {result.stepTitle}
                  </p>
                  <div className="flex gap-1 mt-1.5">
                    {result.keywords.slice(0, 3).map((keyword) => (
                      <span
                        key={keyword}
                        className="text-xs font-mono text-primary/70"
                      >
                        #{keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
