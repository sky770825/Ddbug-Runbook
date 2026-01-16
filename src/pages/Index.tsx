import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { StepSidebar } from "@/components/StepSidebar";
import { ProjectSettingsDrawer } from "@/components/ProjectSettingsDrawer";
import type { PromptTone, ChecklistItem, Step } from "@/data/stepsData";
import { defaultVariables } from "@/lib/variableConfig";

// 動態載入步驟資料和組件以優化初始載入
const StepDetail = lazy(() => import("@/components/StepDetail").then(module => ({ default: module.StepDetail })));

const Index = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [tone, setTone] = useState<PromptTone>("diagnostic");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [stepsData, setStepsData] = useState<Step[]>([]);
  const [isLoadingSteps, setIsLoadingSteps] = useState(true);

  // 動態載入步驟資料
  useEffect(() => {
    import("@/data/stepsData").then((module) => {
      setStepsData(module.stepsData);
      setIsLoadingSteps(false);
    });
  }, []);

  // 從 localStorage 載入變數，或使用預設值
  const loadVariables = (): Record<string, string> => {
    try {
      const saved = localStorage.getItem("prompt-variables");
      if (saved) {
        const parsed = JSON.parse(saved);
        // 合併預設值，確保所有變數都存在
        return { ...defaultVariables, ...parsed };
      }
    } catch (error) {
      // 只在開發環境顯示錯誤
      if (import.meta.env.DEV) {
        console.error("Failed to load variables from localStorage:", error);
      }
    }
    return defaultVariables;
  };

  const [variables, setVariables] = useState<Record<string, string>>(loadVariables);

  // Initialize checklist state for all steps
  const [checklists, setChecklists] = useState<Record<number, ChecklistItem[]>>({});
  
  // 當 stepsData 載入完成後，初始化 checklists
  useEffect(() => {
    if (stepsData.length > 0) {
      const initial: Record<number, ChecklistItem[]> = {};
      stepsData.forEach((step) => {
        initial[step.id] = step.checklist.map((item) => ({ ...item }));
      });
      setChecklists(initial);
    }
  }, [stepsData]);

  // Set document title
  useEffect(() => {
    document.title = "Debug Runbook - 問題排查指南";
  }, []);

  // Handle dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Close sidebar on step change (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [currentStep]);

  // Get current step data
  const currentStepData = stepsData.find((s) => s.id === currentStep);
  const currentChecklist = checklists[currentStep] || [];

  // Navigation handlers
  const handleStepClick = useCallback((stepId: number) => {
    setCurrentStep(stepId);
    // Reset tone to diagnostic when switching steps
    setTone("diagnostic");
  }, []);

  const handlePrevStep = useCallback(() => {
    const currentIndex = stepsData.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepsData[currentIndex - 1].id);
      setTone("diagnostic");
    }
  }, [currentStep]);

  const handleNextStep = useCallback(() => {
    const currentIndex = stepsData.findIndex((s) => s.id === currentStep);
    if (currentIndex < stepsData.length - 1) {
      setCurrentStep(stepsData[currentIndex + 1].id);
      setTone("diagnostic");
    }
  }, [currentStep]);

  const handleCompleteStep = useCallback(() => {
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps((prev) => [...prev, currentStep]);
      // Also mark all checklist items as complete
      setChecklists((prev) => {
        const currentChecklist = prev[currentStep];
        if (!currentChecklist) return prev;
        
        return {
          ...prev,
          [currentStep]: currentChecklist.map((item) => ({
            ...item,
            completed: true,
          })),
        };
      });
    }
  }, [currentStep, completedSteps]);

  // Checklist toggle
  const handleChecklistToggle = useCallback(
    (itemId: string) => {
      setChecklists((prev) => {
        const currentChecklist = prev[currentStep];
        if (!currentChecklist) return prev;
        
        return {
          ...prev,
          [currentStep]: currentChecklist.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
          ),
        };
      });
    },
    [currentStep]
  );

  // Variables - 自動儲存到 localStorage
  const handleVariableChange = useCallback((key: string, value: string) => {
    setVariables((prev) => {
      const updated = { ...prev, [key]: value };
      // 儲存到 localStorage
      try {
        localStorage.setItem("prompt-variables", JSON.stringify(updated));
      } catch (error) {
        // 只在開發環境顯示錯誤
        if (import.meta.env.DEV) {
          console.error("Failed to save variables to localStorage:", error);
        }
      }
      return updated;
    });
  }, []);

  const currentIndex = stepsData.findIndex((s) => s.id === currentStep);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < stepsData.length - 1;
  const isCompleted = completedSteps.includes(currentStep);

  // 載入中狀態
  if (isLoadingSteps || stepsData.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  if (!currentStepData) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <Header
        steps={stepsData}
        completedSteps={completedSteps}
        onSelectStep={handleStepClick}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />

      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="gap-2"
        >
          {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          問題清單
        </Button>
        <span className="text-sm text-muted-foreground">
          {currentStepData.shortTitle}
        </span>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar - Desktop */}
        {!isDesktopSidebarCollapsed && (
          <motion.aside
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -288, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-72 flex-shrink-0 border-r border-border bg-sidebar hidden md:block"
          >
            <StepSidebar
              steps={stepsData}
              currentStep={currentStep}
              completedSteps={completedSteps}
              onStepClick={handleStepClick}
              isCollapsed={isDesktopSidebarCollapsed}
              onToggleCollapse={() => setIsDesktopSidebarCollapsed(true)}
            />
          </motion.aside>
        )}

        {/* Collapse Toggle Button - Desktop (Show when collapsed) */}
        {isDesktopSidebarCollapsed && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onClick={() => setIsDesktopSidebarCollapsed(false)}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-10 h-20 bg-card hover:bg-primary/10 border-r border-y border-border rounded-r-lg shadow-lg transition-all hover:shadow-xl group"
            aria-label="展開問題排查清單"
          >
            <Menu className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </motion.button>
        )}

        {/* Sidebar - Mobile Overlay */}
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              className="fixed left-0 top-0 bottom-0 w-72 border-r border-border bg-sidebar z-40 md:hidden pt-16"
            >
              <StepSidebar
                steps={stepsData}
                currentStep={currentStep}
                completedSteps={completedSteps}
                onStepClick={handleStepClick}
              />
            </motion.aside>
          </>
        )}

        {/* Step Detail */}
        <main className="flex-1 overflow-hidden">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">載入中...</p>
              </div>
            </div>
          }>
            <StepDetail
              step={currentStepData}
              checklist={currentChecklist}
              tone={tone}
              onToneChange={setTone}
              onChecklistToggle={handleChecklistToggle}
              onPrevStep={handlePrevStep}
              onNextStep={handleNextStep}
              onCompleteStep={handleCompleteStep}
              hasPrev={hasPrev}
              hasNext={hasNext}
              isCompleted={isCompleted}
              variables={variables}
            />
          </Suspense>
        </main>
      </div>

      {/* Footer */}
      <footer className="h-10 border-t border-border bg-card/50 flex items-center justify-between px-4 text-xs text-muted-foreground">
        <span>Prompt Runbook v1.0.0 — Debug Edition</span>
        <span>最後更新: 2024-01-15</span>
      </footer>

      {/* Settings Drawer */}
      <ProjectSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        variables={variables}
        onVariableChange={handleVariableChange}
      />
    </div>
  );
};

export default Index;
