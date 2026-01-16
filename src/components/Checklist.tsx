import { memo } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { ChecklistItem } from "@/data/stepsData";

interface ChecklistProps {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
}

export const Checklist = memo(function Checklist({ items, onToggle }: ChecklistProps) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <motion.label
          key={item.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-secondary/50 cursor-pointer transition-all group"
        >
          <button
            onClick={() => onToggle(item.id)}
            className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-all ${
              item.completed
                ? "bg-success border-success"
                : "border-muted-foreground/30 group-hover:border-primary"
            }`}
          >
            {item.completed && <Check className="w-3 h-3 text-success-foreground" />}
          </button>
          <span
            className={`text-sm transition-all ${
              item.completed
                ? "text-muted-foreground line-through"
                : "text-foreground"
            }`}
          >
            {item.label}
          </span>
        </motion.label>
      ))}
    </div>
  );
});
