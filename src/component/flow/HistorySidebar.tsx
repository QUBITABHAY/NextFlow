"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useFlowStore } from "@/store/useFlowStore";

type NodeRunData = {
  id: string;
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  input: string | null;
  output: string | null;
  error: string | null;
};

type RunData = {
  id: string;
  scope: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
  nodeRuns: NodeRunData[];
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function StatusBadge({
  status,
  isLight,
}: {
  status: string;
  isLight: boolean;
}) {
  const colors: Record<string, { bg: string; text: string }> = {
    success: {
      bg: isLight ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.15)",
      text: "#22c55e",
    },
    failed: {
      bg: isLight ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.15)",
      text: "#ef4444",
    },
    partial: {
      bg: isLight ? "rgba(234,179,8,0.1)" : "rgba(234,179,8,0.15)",
      text: "#eab308",
    },
    running: {
      bg: isLight ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.15)",
      text: "#3b82f6",
    },
  };
  const c = colors[status] || colors.failed;
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {status}
    </span>
  );
}

function ScopeLabel({ scope }: { scope: string }) {
  const labels: Record<string, string> = {
    full: "Full workflow",
    single: "Single node",
    partial: "Selected nodes",
  };
  return (
    <span className="text-[10px] opacity-50">{labels[scope] || scope}</span>
  );
}

function NodeRunRow({ nr, isLight }: { nr: NodeRunData; isLight: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-lg border text-[11px] transition-colors ${isLight ? "border-black/5 bg-black/2" : "border-white/5 bg-white/2"}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors rounded-lg ${isLight ? "hover:bg-black/3" : "hover:bg-white/3"}`}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`opacity-30 transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <polygon points="6 3 20 12 6 21" />
        </svg>
        <span className="flex-1 font-medium truncate">{nr.nodeLabel}</span>
        <StatusBadge status={nr.status} isLight={isLight} />
      </button>
      {expanded && (
        <div
          className={`px-3 pb-2.5 space-y-1.5 ${isLight ? "text-black/60" : "text-white/50"}`}
        >
          <div className="flex justify-between">
            <span>Type</span>
            <span className={isLight ? "text-black/80" : "text-white/80"}>
              {nr.nodeType}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Duration</span>
            <span className={isLight ? "text-black/80" : "text-white/80"}>
              {formatDuration(nr.durationMs)}
            </span>
          </div>
          {nr.input && (
            <div>
              <span className="block mb-0.5">Input</span>
              <div
                className={`rounded-md p-1.5 text-[10px] leading-relaxed break-all max-h-[60px] overflow-y-auto ${isLight ? "bg-black/3" : "bg-white/3"}`}
              >
                {nr.input}
              </div>
            </div>
          )}
          {nr.output && (
            <div>
              <span className="block mb-0.5">Output</span>
              <div
                className={`rounded-md p-1.5 text-[10px] leading-relaxed break-all max-h-[60px] overflow-y-auto ${isLight ? "bg-black/3" : "bg-white/3"}`}
              >
                {nr.output}
              </div>
            </div>
          )}
          {nr.error && (
            <div>
              <span className="block mb-0.5 text-red-400">Error</span>
              <div className="rounded-md p-1.5 text-[10px] leading-relaxed break-all text-red-400 bg-red-500/5 max-h-[60px] overflow-y-auto">
                {nr.error}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RunEntry({ run, isLight }: { run: RunData; isLight: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-xl border transition-colors ${isLight ? "border-black/5" : "border-white/5"}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full px-3 py-2.5 text-left transition-colors rounded-xl ${isLight ? "hover:bg-black/2" : "hover:bg-white/2"}`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={run.status} isLight={isLight} />
            <ScopeLabel scope={run.scope} />
          </div>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`opacity-30 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div
          className={`flex items-center gap-3 text-[11px] ${isLight ? "text-black/40" : "text-white/40"}`}
        >
          <span>{formatTime(run.startedAt)}</span>
          <span>{formatDate(run.startedAt)}</span>
          {run.durationMs !== null && (
            <span className={isLight ? "text-black/60" : "text-white/60"}>
              {formatDuration(run.durationMs)}
            </span>
          )}
        </div>
        {run.error && !expanded && (
          <div className="text-[10px] text-red-400 mt-1 truncate">
            {run.error}
          </div>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {run.error && (
            <div className="text-[11px] text-red-400 bg-red-500/5 rounded-lg px-2.5 py-1.5 mb-2">
              {run.error}
            </div>
          )}
          {run.nodeRuns.length > 0 ? (
            run.nodeRuns.map((nr) => (
              <NodeRunRow key={nr.id} nr={nr} isLight={isLight} />
            ))
          ) : (
            <div
              className={`text-[11px] text-center py-2 ${isLight ? "text-black/30" : "text-white/30"}`}
            >
              No node executions recorded
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HistorySidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isLight } = useTheme();
  const workflowId = useFlowStore((state) => state.workflowId);
  const isWorkflowRunning = useFlowStore((state) => state.isWorkflowRunning);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRuns = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
      }
    } catch (e) {
      console.error("[NextFlow] Failed to fetch runs:", e);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  // Fetch on open and when workflow finishes running
  useEffect(() => {
    if (open) fetchRuns();
  }, [open, fetchRuns]);

  // Refresh when workflow finishes
  useEffect(() => {
    if (open && !isWorkflowRunning) {
      // Small delay to let the finishWorkflowRun call complete
      const t = setTimeout(fetchRuns, 500);
      return () => clearTimeout(t);
    }
  }, [isWorkflowRunning, open, fetchRuns]);

  return (
    <div
      className={`fixed top-0 right-0 h-full z-50 transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      style={{ width: 340 }}
    >
      <div
        className={`h-full flex flex-col border-l ${isLight ? "bg-white border-black/5" : "bg-[#0e0e0e] border-white/5"}`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b ${isLight ? "border-black/5" : "border-white/5"}`}
        >
          <div className="flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isLight ? "text-black/60" : "text-white/60"}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span
              className={`text-[13px] font-semibold ${isLight ? "text-black/80" : "text-white/90"}`}
            >
              Run History
            </span>
            {runs.length > 0 && (
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full ${isLight ? "bg-black/5 text-black/40" : "bg-white/5 text-white/40"}`}
              >
                {runs.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchRuns}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isLight ? "hover:bg-black/5 text-black/40" : "hover:bg-white/5 text-white/40"}`}
              title="Refresh"
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
                className={loading ? "animate-spin" : ""}
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isLight ? "hover:bg-black/5 text-black/40" : "hover:bg-white/5 text-white/40"}`}
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Run list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {loading && runs.length === 0 ? (
            <div
              className={`text-center py-8 text-[12px] ${isLight ? "text-black/30" : "text-white/30"}`}
            >
              <svg
                className="animate-spin mx-auto mb-2"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Loading runs...
            </div>
          ) : runs.length === 0 ? (
            <div
              className={`text-center py-12 ${isLight ? "text-black/30" : "text-white/30"}`}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto mb-3 opacity-40"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div className="text-[12px] font-medium mb-1">No runs yet</div>
              <div className="text-[11px] opacity-60">
                Run a workflow or node to see history here
              </div>
            </div>
          ) : (
            runs.map((run) => (
              <RunEntry key={run.id} run={run} isLight={isLight} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
