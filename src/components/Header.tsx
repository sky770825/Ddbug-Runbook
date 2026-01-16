import { BookOpen, Share2, Download, Settings, Moon, Sun, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "./ProgressBar";
import { SearchBar } from "./SearchBar";
import type { Step } from "@/data/stepsData";

interface HeaderProps {
  steps: Step[];
  completedSteps: number[];
  onSelectStep: (stepId: number) => void;
  onOpenSettings: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Header({
  steps,
  completedSteps,
  onSelectStep,
  onOpenSettings,
  isDarkMode,
  onToggleDarkMode,
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-xl flex items-center px-4 gap-4">
      {/* Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-destructive/10 rounded-lg">
          <Bug className="w-5 h-5 text-destructive" />
        </div>
        <div className="hidden sm:block">
          <h1 className="text-lg font-bold text-foreground">Debug Runbook</h1>
          <p className="text-xs text-muted-foreground">問題排查指南</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md mx-4">
        <SearchBar steps={steps} onSelectStep={onSelectStep} />
      </div>

      {/* Progress */}
      <div className="hidden lg:flex items-center gap-2">
        <span className="text-sm text-muted-foreground">已解決:</span>
        <ProgressBar completed={completedSteps.length} total={steps.length} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDarkMode}
          className="text-muted-foreground hover:text-foreground"
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          className="text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-5 h-5" />
        </Button>
        <Button variant="outline" size="sm" className="hidden sm:flex gap-2">
          <Share2 className="w-4 h-4" />
          分享
        </Button>
        <Button variant="outline" size="sm" className="hidden sm:flex gap-2">
          <Download className="w-4 h-4" />
          匯出
        </Button>
      </div>
    </header>
  );
}
