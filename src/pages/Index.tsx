import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { StepSidebar } from "@/components/StepSidebar";
import { ProjectSettingsDrawer } from "@/components/ProjectSettingsDrawer";
import { stepsData, type PromptTone, type ChecklistItem } from "@/data/stepsData";
import { defaultVariables } from "@/lib/variableConfig";

// 動態載入步驟組件以優化初始載入
const StepDetail = lazy(() => 
  import("@/components/StepDetail").then(module => ({ 
    default: module.StepDetail 
  })).catch(error => {
    console.error("Failed to load StepDetail:", error);
    // 返回一個錯誤組件作為 fallback
    return { default: () => <div className="p-4 text-destructive">載入組件時發生錯誤</div> };
  })
);

const Index = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [tone, setTone] = useState<PromptTone>("diagnostic");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobileHeaderCollapsed, setIsMobileHeaderCollapsed] = useState(false);

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

  // 優化：使用 Map 快速查找步驟（避免每次都遍歷）
  const stepsMap = useMemo(() => {
    const map = new Map<number, typeof stepsData[0]>();
    stepsData.forEach((step) => {
      map.set(step.id, step);
    });
    return map;
  }, []);

  // Initialize checklist state for all steps（延遲初始化）
  const [checklists, setChecklists] = useState<Record<number, ChecklistItem[]>>(() => {
    const initial: Record<number, ChecklistItem[]> = {};
    // 只初始化當前步驟，其他按需初始化
    const currentStep = stepsMap.get(1) || stepsData[0];
    if (currentStep) {
      initial[currentStep.id] = currentStep.checklist.map((item) => ({ ...item }));
    }
    return initial;
  });

  // 優化：按需初始化 checklist（當切換步驟時）
  useEffect(() => {
    const stepData = stepsMap.get(currentStep);
    if (stepData && !checklists[currentStep]) {
      setChecklists((prev) => ({
        ...prev,
        [currentStep]: stepData.checklist.map((item) => ({ ...item })),
      }));
    }
  }, [currentStep, stepsMap, checklists]);

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

  // 當切換步驟時，自動展開標題列（手機/平板）
  useEffect(() => {
    setIsMobileHeaderCollapsed(false);
  }, [currentStep]);

  // 優化：使用 Map 快速查找當前步驟數據
  const currentStepData = useMemo(() => {
    return stepsMap.get(currentStep) || null;
  }, [currentStep, stepsMap]);

  const currentChecklist = useMemo(() => {
    return checklists[currentStep] || currentStepData?.checklist.map((item) => ({ ...item })) || [];
  }, [currentStep, checklists, currentStepData]);

  // Navigation handlers
  const handleStepClick = useCallback((stepId: number) => {
    setCurrentStep(stepId);
    // Reset tone to diagnostic when switching steps
    setTone("diagnostic");
  }, []);

  // 優化：預先計算步驟順序
  const stepIds = useMemo(() => stepsData.map((s) => s.id), []);

  const handlePrevStep = useCallback(() => {
    const currentIndex = stepIds.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepIds[currentIndex - 1]);
      setTone("diagnostic");
    }
  }, [currentStep, stepIds]);

  const handleNextStep = useCallback(() => {
    const currentIndex = stepIds.indexOf(currentStep);
    if (currentIndex < stepIds.length - 1) {
      setCurrentStep(stepIds[currentIndex + 1]);
      setTone("diagnostic");
    }
  }, [currentStep, stepIds]);

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

  const handleUndoCompleteStep = useCallback(() => {
    if (completedSteps.includes(currentStep)) {
      setCompletedSteps((prev) => prev.filter((id) => id !== currentStep));
      // Also unmark all checklist items
      setChecklists((prev) => {
        const currentChecklist = prev[currentStep];
        if (!currentChecklist) return prev;
        
        return {
          ...prev,
          [currentStep]: currentChecklist.map((item) => ({
            ...item,
            completed: false,
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

  // 優化：使用 useMemo 快取導航狀態
  const { currentIndex, hasPrev, hasNext } = useMemo(() => {
    const index = stepIds.indexOf(currentStep);
    return {
      currentIndex: index,
      hasPrev: index > 0,
      hasNext: index < stepIds.length - 1,
    };
  }, [currentStep, stepIds]);

  const isCompleted = useMemo(() => completedSteps.includes(currentStep), [completedSteps, currentStep]);

  // 優化：如果找不到步驟數據，顯示錯誤訊息而不是空白頁面
  if (!currentStepData) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <h2 className="text-xl font-semibold text-foreground mb-2">步驟不存在</h2>
          <p className="text-muted-foreground mb-4">找不到 ID 為 {currentStep} 的步驟</p>
          <Button onClick={() => setCurrentStep(1)}>返回首頁</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header - 手機/平板可收合 */}
      <AnimatePresence>
        {!isMobileHeaderCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Header
              steps={stepsData}
              completedSteps={completedSteps}
              onSelectStep={handleStepClick}
              onOpenSettings={() => setIsSettingsOpen(true)}
              isDarkMode={isDarkMode}
              onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Toggle - 手機/平板可收合 */}
      <AnimatePresence>
        {!isMobileHeaderCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden overflow-hidden border-b border-border bg-card/50 flex-shrink-0"
          >
            <div className="flex items-center gap-2 px-4 py-2">
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* 浮動收合按鈕 - 僅手機/平板顯示 */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsMobileHeaderCollapsed(!isMobileHeaderCollapsed)}
        className="lg:hidden fixed top-3 right-3 z-50 p-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all active:scale-95"
        aria-label={isMobileHeaderCollapsed ? "展開標題列" : "收合標題列"}
      >
        {isMobileHeaderCollapsed ? (
          <ChevronDown className="w-5 h-5" />
        ) : (
          <ChevronUp className="w-5 h-5" />
        )}
      </motion.button>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
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
        <main className="flex-1 overflow-hidden min-h-0">
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
              onUndoCompleteStep={handleUndoCompleteStep}
              hasPrev={hasPrev}
              hasNext={hasNext}
              isCompleted={isCompleted}
              variables={variables}
              allSteps={stepsData}
              onStepClick={handleStepClick}
            />
          </Suspense>
        </main>
      </div>

      {/* Footer */}
      <footer className="h-10 border-t border-border bg-card/50 flex items-center justify-between px-4 text-xs text-muted-foreground flex-shrink-0">
        <span className="hidden sm:inline">Prompt Runbook v1.0.0 — Debug Edition</span>
        <span className="text-xs">最後更新: 2024-01-15</span>
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
