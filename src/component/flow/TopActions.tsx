import { useFlowStore } from "@/store/useFlowStore";
import { useTheme } from "@/hooks/useTheme";
import { useState, useEffect } from "react";

export function TopActions({ leftOffset }: { leftOffset: string }) {
  const toggleTheme = useFlowStore((state) => state.toggleTheme);
  const isWorkflowRunning = useFlowStore((state) => state.isWorkflowRunning);
  const workflowError = useFlowStore((state) => state.workflowError);
  const runWorkflow = useFlowStore((state) => state.runWorkflow);
  const stopWorkflow = useFlowStore((state) => state.stopWorkflow);
  const { isLight } = useTheme();

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Show toast on workflow completion
  useEffect(() => {
    if (!isWorkflowRunning && workflowError) {
      setToastMessage(workflowError);
      setToastType("error");
      setShowToast(true);
    }
  }, [isWorkflowRunning, workflowError]);

  // Auto-dismiss toast
  useEffect(() => {
    if (showToast) {
      const t = setTimeout(() => setShowToast(false), 4000);
      return () => clearTimeout(t);
    }
  }, [showToast]);

  return (
    <>
      <div
        className={`absolute top-4 z-40 h-9 rounded-xl border flex items-center gap-2.5 px-3.5 text-[13px] shadow-sm transition-all duration-300 ease-out ${leftOffset} ${isLight ? "border-black/5 bg-white text-black/80" : "border-white/10 bg-[#12151b]/95 text-[#eceff5]"}`}
      >
        <div
          className={`w-5 h-5 rounded-md flex items-center justify-center ${isLight ? "bg-black/5" : "bg-white/10"}`}
        >
          <span
            className={
              isLight
                ? "text-black/40 text-[10px]"
                : "text-white/50 text-[10px]"
            }
          >
            ✦
          </span>
        </div>
        <span className="font-medium">Untitled</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-40"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${isLight ? "border-black/5 bg-white text-black/60 hover:bg-black/5" : "border-white/10 bg-[#12151b]/95 text-white/70 hover:bg-white/10 hover:text-white"}`}
        >
          {isLight ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>

        {/* Run / Stop Workflow */}
        {isWorkflowRunning ? (
          <button
            onClick={stopWorkflow}
            className="h-9 rounded-xl border text-xs font-medium px-4 transition-all shadow-sm flex items-center gap-2 border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stop
          </button>
        ) : (
          <button
            onClick={async () => {
              setShowToast(false);
              await runWorkflow();
              // Show success toast if no error was set
              const err = useFlowStore.getState().workflowError;
              if (!err) {
                setToastMessage("Workflow completed successfully");
                setToastType("success");
                setShowToast(true);
              }
            }}
            className={`h-9 rounded-xl border text-xs font-medium px-4 transition-all shadow-sm flex items-center gap-2 ${isLight ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run Workflow
          </button>
        )}

        <button
          className={`h-9 rounded-xl border text-xs font-medium px-4 transition-all shadow-sm flex items-center gap-2 ${isLight ? "border-black/5 bg-white text-black/60 hover:bg-black/5" : "border-white/10 bg-[#12151b]/95 text-white/80 hover:bg-white/10 hover:text-white"}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
            <polyline points="16 6 12 2 8 6"></polyline>
            <line x1="12" y1="2" x2="12" y2="15"></line>
          </svg>
          Share
        </button>

        <button
          className={`h-9 rounded-xl border text-xs font-medium px-4 transition-all shadow-sm hidden md:flex items-center gap-2 ${isLight ? "border-transparent bg-black text-white hover:bg-black/90" : "border-transparent bg-white text-black hover:bg-white/90"}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
          </svg>
          Turn workflow into app
        </button>

        <button
          className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${isLight ? "border-black/5 bg-white text-black/60 hover:bg-black/5" : "border-white/10 bg-[#12151b]/95 text-white/70 hover:bg-white/10 hover:text-white"}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
        </button>
      </div>

      {/* Workflow execution toast */}
      {showToast && (
        <div
          className={`fixed top-16 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium shadow-lg transition-all animate-in slide-in-from-top-2 ${
            toastType === "success"
              ? isLight
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : isLight
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {toastType === "success" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <span className="max-w-[300px] truncate">{toastMessage}</span>
          <button
            onClick={() => setShowToast(false)}
            className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
