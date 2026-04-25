"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useFlowStore } from "@/store/useFlowStore";
import { useTheme } from "@/hooks/useTheme";

type SessionWorkflow = {
  id: string;
  title: string;
  updatedAt: string;
};

type SidebarItem = {
  label: string;
  color?: string;
  icon?: string;
  active?: boolean;
  model?: string;
};

type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

function SidebarIcon({
  label,
  color,
  icon,
}: {
  label: string;
  color?: string;
  icon?: string;
}) {
  const { isLight } = useTheme();
  if (icon) {
    return (
      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isLight ? "bg-black/5" : "bg-white/10"}`}>
        <Image
          src={icon}
          alt={label}
          width={18}
          height={18}
          className={`rounded-sm ${(label === "Assets" || label === "Node Editor") && !isLight ? "brightness-0 invert" : ""}`}
        />
      </div>
    );
  }

  const icons: Record<string, React.ReactNode> = {
    Home: (
      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isLight ? "bg-black/5" : "bg-white/10"}`}>
        <Image
          src="/home.webp"
          alt="Home"
          width={18}
          height={18}
          className="rounded-sm"
        />
      </div>
    ),
    "Train Lora": (
      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isLight ? "bg-black/5" : "bg-white/10"}`}>
        <Image
          src="/trainLora.webp"
          alt="Train Lora"
          width={18}
          height={18}
          className="rounded-sm"
        />
      </div>
    ),
    "Text Node": (
      <div className="w-6 h-6 bg-[#3b82f6] rounded-md flex items-center justify-center">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      </div>
    ),
    "Image Input": (
      <div className="w-6 h-6 bg-[#3b82f6] rounded-md flex items-center justify-center">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    ),
    "Video Input": (
      <div className="w-6 h-6 bg-[#f59e0b] rounded-md flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
          <path d="M4 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5l5.5 4.125A.5.5 0 0 0 22 18V6a.5.5 0 0 0-.8-.4L16 9.5V8a2 2 0 0 0-2-2H4z" />
        </svg>
      </div>
    ),
    "Crop Image": (
      <div className="w-6 h-6 bg-[#3b82f6] rounded-md flex items-center justify-center">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 2v14a2 2 0 0 0 2 2h14" />
          <path d="M18 22V8a2 2 0 0 0-2-2H2" />
        </svg>
      </div>
    ),
    "Extract Frame": (
      <div className="w-6 h-6 bg-[#f59e0b] rounded-md flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
          <path d="M12 7v10l7-5-7-5z" />
        </svg>
      </div>
    ),
    "LLM Call": (
      <div className="w-6 h-6 bg-[#a855f7] rounded-md flex items-center justify-center">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93V12h2.75a2.5 2.5 0 0 1 2.5 2.5V16a4 4 0 1 1-2 0v-1.5a.5.5 0 0 0-.5-.5h-6.5a.5.5 0 0 0-.5.5V16a4 4 0 1 1-2 0v-1.5A2.5 2.5 0 0 1 9 12h2.75V9.93A4.002 4.002 0 0 1 12 2z" />
        </svg>
      </div>
    ),
  };

  return (
    <div className="flex items-center justify-center shrink-0">
      {icons[label] || (
        <div
          className="w-6 h-6 rounded-md"
          style={{ backgroundColor: color }}
        />
      )}
    </div>
  );
}

const sidebarSections: SidebarSection[] = [
  {
    title: "",
    items: [
      { label: "Home", color: "#22c55e", icon: "/home.webp" },
      { label: "Train Lora", color: "#ffffff", icon: "/trainLora.webp" },
      {
        label: "Node Editor",
        color: "#3b82f6",
        active: true,
        icon: "/nodeEditor.webp",
      },
      { label: "Assets", color: "#3b82f6", icon: "/asset.webp" },
    ],
  },
  {
    title: "Nodes",
    items: [
      { label: "Text Node", model: "Text", color: "#3b82f6" },
      { label: "Image Input", model: "Image", color: "#3b82f6" },
      { label: "Video Input", model: "Video", color: "#f59e0b" },
      { label: "Crop Image", model: "Crop Image", color: "#3b82f6" },
      { label: "Extract Frame", model: "Extract Frame", color: "#f59e0b" },
      { label: "LLM Call", model: "LLM Call", color: "#a855f7" },
    ],
  },
];

export function Sidebar({
  onAddNode,
}: {
  onAddNode?: (item: { label: string; model: string }) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const { collapsed, setCollapsed } = useFlowStore();
  const { isLight } = useTheme();

  const onDragStart = (
    event: React.DragEvent,
    nodeType: string,
    label: string,
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.setData("application/reactflow-label", label);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleItemClick = (item: SidebarItem) => {
    if (item.label === "Home") {
      router.push("/");
    } else if (item.label === "Node Editor") {
      if (!pathname.includes("/node/")) {
        router.push("/node/new");
      }
    } else if (item.model && onAddNode) {
      onAddNode({ label: item.label, model: item.model });
    }
  };

  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionWorkflows, setSessionWorkflows] = useState<SessionWorkflow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const fetchSessionWorkflows = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const data = await res.json();
        setSessionWorkflows(data);
      }
    } catch (e) {
      console.error("Failed to fetch session workflows:", e);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const handleSessionsToggle = () => {
    const next = !sessionsOpen;
    setSessionsOpen(next);
    if (next && sessionWorkflows.length === 0) {
      fetchSessionWorkflows();
    }
  };

  const sidebarOpen = !collapsed;

  return (
    <aside
      className={`h-full flex flex-col shrink-0 transition-all duration-300 ease-out border-r ${sidebarOpen ? "w-[230px]" : "w-[64px]"} ${isLight ? "bg-[#f9fafb] border-black/5 text-black" : "bg-black border-white/5 text-white"}`}
    >
      {/* Collapse toggle */}
      <div className="px-4.5 pt-5 pb-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`transition-colors ${isLight ? "text-black/30 hover:text-black/60" : "text-white/30 hover:text-white/60"}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            className="w-4.5 h-4.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2.5 pt-1">
        {sidebarSections.map((section, si) => (
          <div key={si} className="mb-4">
            {sidebarOpen && section.title && (
              <div className={`px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-widest ${isLight ? "text-black/40" : "text-white/40"}`}>
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const isActive =
                (item.label === "Home" && pathname === "/") ||
                (item.label === "Node Editor" && pathname.includes("/node/")) ||
                item.active;

              return (
                <button
                  key={item.label}
                  draggable={!!item.model}
                  onDragStart={(e) =>
                    item.model && onDragStart(e, item.model, item.label)
                  }
                  onClick={() => handleItemClick(item)}
                  className={`w-full flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13.5px] font-medium transition-all ${isActive ? (isLight ? "bg-black/8 text-black" : "bg-white/8 text-white") : isLight ? "text-black/70 hover:bg-black/8" : "text-white/90 hover:bg-white/8"}`}
                >
                  <SidebarIcon
                    label={item.label}
                    color={item.color}
                    icon={item.icon}
                  />
                  {sidebarOpen && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {/* Sessions */}
        <div className="mt-2">
          <button
            onClick={handleSessionsToggle}
            className={`w-full flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13.5px] font-medium transition-all ${isLight ? "text-black/70 hover:bg-black/8" : "text-white/90 hover:bg-white/8"}`}
          >
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isLight ? "bg-black/5" : "bg-white/10"}`}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isLight ? "text-black/50" : "text-white/50"}
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            {sidebarOpen && (
              <>
                <span className="truncate flex-1 text-left">Sessions</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={`opacity-30 transition-transform ${sessionsOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </>
            )}
          </button>

          {/* Session workflow list */}
          {sessionsOpen && sidebarOpen && (
            <div className="mt-1 ml-3 pl-3 border-l border-dashed space-y-0.5"
              style={{ borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" }}
            >
              {sessionsLoading ? (
                <div className={`flex items-center gap-2 px-2 py-2 text-[12px] ${isLight ? "text-black/30" : "text-white/30"}`}>
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Loading...
                </div>
              ) : sessionWorkflows.length === 0 ? (
                <div className={`px-2 py-2 text-[12px] ${isLight ? "text-black/30" : "text-white/30"}`}>
                  No projects yet
                </div>
              ) : (
                sessionWorkflows.map((wf) => {
                  const isCurrentProject = pathname === `/node/${wf.id}`;
                  return (
                    <button
                      key={wf.id}
                      onClick={() => router.push(`/node/${wf.id}`)}
                      className={`w-full flex items-center gap-2.5 px-2 py-[6px] rounded-md text-[12.5px] transition-all ${isCurrentProject ? (isLight ? "bg-black/8 text-black font-semibold" : "bg-white/8 text-white font-semibold") : isLight ? "text-black/60 hover:bg-black/5 hover:text-black/80" : "text-white/60 hover:bg-white/5 hover:text-white/80"}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCurrentProject ? "bg-emerald-400" : isLight ? "bg-black/15" : "bg-white/15"}`} />
                      <span className="truncate">{wf.title || "Untitled"}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </nav>

      {/* User info */}
      <div
        className={`border-t p-3.5 ${sidebarOpen ? "" : "flex justify-center"} ${isLight ? "border-black/5" : "border-white/5"}`}
      >
        <div className={`flex items-center ${sidebarOpen ? "gap-3" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-neutral-800 shrink-0 border border-white/5 flex items-center justify-center text-[11px] font-bold text-white/50">
            {user?.username?.[0]?.toUpperCase() ||
              user?.firstName?.[0]?.toUpperCase() ||
              "U"}
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className={`text-[13px] truncate ${isLight ? "text-black/70" : "text-white/70"}`}>
                {user?.username || user?.firstName || "User"}
              </div>
              <div className={`text-[10px] uppercase tracking-tighter ${isLight ? "text-black/30" : "text-white/30"}`}>
                Free
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
