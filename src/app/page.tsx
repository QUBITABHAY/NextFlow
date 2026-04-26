"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type WfNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
  parentId?: string;
};

type WfEdge = {
  id: string;
  source: string;
  target: string;
};

type Workflow = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  nodes?: WfNode[];
  edges?: WfEdge[];
};

import { Sidebar } from "@/component/Sidebar";
import { useTheme } from "@/hooks/useTheme";
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from "@/lib/templates";

const NODE_COLORS: Record<string, string> = {
  workflowCard: "#22c55e",
  textNode: "#e3c92f",
  mediaNode: "#1188ff",
  llmNode: "#a855f7",
  groupNode: "#6b7280",
};

/** Extract the first image URL found in any node's data */
function extractFirstImage(nodes: WfNode[]): string | null {
  for (const n of nodes) {
    const d = n.data;
    if (d.uploadedImageUrl) return d.uploadedImageUrl;
    if (typeof d.url === "string" && /\.(png|jpe?g|webp|gif|svg)/i.test(d.url))
      return d.url;
    if (
      typeof d.runResult === "string" &&
      (d.runResult.startsWith("http") || d.runResult.startsWith("data:image"))
    )
      return d.runResult;
  }
  return null;
}

/** SVG minimap of a workflow's nodes & edges */
function WorkflowMinimap({
  nodes,
  edges,
  isLight,
}: {
  nodes: WfNode[];
  edges: WfEdge[];
  isLight: boolean;
}) {
  // Filter out group nodes for bounding box — they just contain others
  const visibleNodes = nodes.filter((n) => n.type !== "groupNode" && !n.parentId);
  const childNodes = nodes.filter((n) => !!n.parentId);

  // Resolve absolute positions for child nodes
  const parentMap = new Map(nodes.map((n) => [n.id, n]));
  const absPos = (n: WfNode) => {
    if (n.parentId) {
      const parent = parentMap.get(n.parentId);
      if (parent)
        return {
          x: parent.position.x + n.position.x,
          y: parent.position.y + n.position.y,
        };
    }
    return n.position;
  };

  const allNodes = [...visibleNodes, ...childNodes];
  if (allNodes.length === 0) return null;

  // Compute bounding box
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of allNodes) {
    const pos = absPos(n);
    const w = n.measured?.width ?? (n.width as number) ?? 200;
    const h = n.measured?.height ?? (n.height as number) ?? 120;
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + w);
    maxY = Math.max(maxY, pos.y + h);
  }

  const pad = 40;
  const bw = maxX - minX + pad * 2;
  const bh = maxY - minY + pad * 2;

  // Build node position lookup for edges
  const nodeCenters = new Map<string, { cx: number; cy: number }>();
  for (const n of allNodes) {
    const pos = absPos(n);
    const w = n.measured?.width ?? (n.width as number) ?? 200;
    const h = n.measured?.height ?? (n.height as number) ?? 120;
    nodeCenters.set(n.id, {
      cx: pos.x - minX + pad + w / 2,
      cy: pos.y - minY + pad + h / 2,
    });
  }

  return (
    <svg
      viewBox={`0 0 ${bw} ${bh}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Edges */}
      {edges.map((e) => {
        const src = nodeCenters.get(e.source);
        const tgt = nodeCenters.get(e.target);
        if (!src || !tgt) return null;
        const dx = tgt.cx - src.cx;
        return (
          <path
            key={e.id}
            d={`M${src.cx},${src.cy} C${src.cx + dx * 0.4},${src.cy} ${tgt.cx - dx * 0.4},${tgt.cy} ${tgt.cx},${tgt.cy}`}
            fill="none"
            stroke={isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.12)"}
            strokeWidth={Math.max(2, bw * 0.004)}
          />
        );
      })}
      {/* Nodes */}
      {allNodes.map((n) => {
        const pos = absPos(n);
        const w = n.measured?.width ?? (n.width as number) ?? 200;
        const h = n.measured?.height ?? (n.height as number) ?? 120;
        const color = NODE_COLORS[n.type || ""] || "#6b7280";
        return (
          <rect
            key={n.id}
            x={pos.x - minX + pad}
            y={pos.y - minY + pad}
            width={w}
            height={h}
            rx={8}
            fill={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)"}
            stroke={color}
            strokeWidth={Math.max(2, bw * 0.004)}
            strokeOpacity={0.5}
          />
        );
      })}
    </svg>
  );
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Edited just now";
  if (mins < 60) return `Edited ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Edited ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Edited yesterday";
  return `Edited ${days}d ago`;
}

export default function HomePage() {
  const router = useRouter();
  const { isLight } = useTheme();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Projects");
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(
    null,
  );

  const tabs = ["Projects", "Apps", "Examples", "Templates"];

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
      }
    } catch (e) {
      console.error("Failed to fetch workflows:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const filteredWorkflows = workflows.filter((wf) =>
    (wf.title || "Untitled").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const createNewWorkflow = async () => {
    if (creating) return;
    setCreating(true);
    const id = Math.random().toString(36).substring(2, 10);
    try {
      await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", nodes: [], edges: [] }),
      });
      router.push(`/node/${id}`);
    } catch {
      setCreating(false);
    }
  };

  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);

  const createFromTemplate = async (template: WorkflowTemplate) => {
    if (creatingTemplate) return;
    setCreatingTemplate(template.id);
    const id = Math.random().toString(36).substring(2, 10);
    try {
      await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: template.title,
          nodes: template.nodes,
          edges: template.edges,
        }),
      });
      router.push(`/node/${id}`);
    } catch {
      setCreatingTemplate(null);
    }
  };

  const [workflowToRename, setWorkflowToRename] = useState<Workflow | null>(
    null,
  );
  const [renameTitle, setRenameTitle] = useState("");

  const handleRename = async (id: string, newTitle: string) => {
    if (!newTitle || newTitle === workflowToRename?.title) {
      setWorkflowToRename(null);
      return;
    }

    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setWorkflows((prev) =>
          prev.map((wf) => (wf.id === id ? { ...wf, title: newTitle } : wf)),
        );
        setWorkflowToRename(null);
      }
    } catch (e) {
      console.error("Failed to rename workflow:", e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWorkflows((prev) => prev.filter((wf) => wf.id !== id));
        setWorkflowToDelete(null);
      }
    } catch (e) {
      console.error("Failed to delete workflow:", e);
    }
  };

  const handleDuplicate = async (wf: Workflow) => {
    const newId = Math.random().toString(36).substring(2, 10);
    try {
      // Fetch full workflow data first
      const getRes = await fetch(`/api/workflows/${wf.id}`);
      if (!getRes.ok) return;
      const fullWf = await getRes.json();

      // Create new one with same data
      const res = await fetch(`/api/workflows/${newId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${fullWf.title} (Copy)`,
          nodes: fullWf.nodes,
          edges: fullWf.edges,
          viewport: fullWf.viewport,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setWorkflows((prev) => [created, ...prev]);
      }
    } catch (e) {
      console.error("Failed to duplicate workflow:", e);
    }
  };

  return (
    <div
      className={`flex h-screen overflow-hidden transition-colors duration-300 ${isLight ? "bg-white text-black" : "bg-[#0e0e0e] text-white"}`}
    >
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Banner */}
        <div className="relative w-full h-[400px] overflow-hidden border-b border-white/5">
          <Image
            src="/nodesHeaderBannerBlurGradient.webp"
            alt="Banner"
            width={1920}
            height={400}
            className="w-full h-full object-cover block"
            priority
          />
          {/* Banner content */}
          <div className="absolute inset-0 z-10 flex flex-col justify-center px-10 md:px-20 max-w-[1400px] mx-auto">
            <div className="flex items-center gap-4 mb-4">
              <Image
                src="/nodeEditor.webp"
                alt="Node Editor"
                width={48}
                height={48}
                className="rounded-xl shadow-2xl"
              />
              <h1 className="text-[32px] font-bold text-white tracking-tight">
                Node Editor
              </h1>
            </div>
            <p className="text-[16px] text-white/80 leading-relaxed mb-10 max-w-lg">
              Nodes is the most powerful way to operate Krea. Connect every tool
              and model into complex automated pipelines.
            </p>
            <button
              onClick={createNewWorkflow}
              disabled={creating}
              className="flex items-center gap-2 bg-white hover:bg-neutral-200 text-black text-[14.5px] font-bold px-8 py-3 rounded-full w-fit transition-all disabled:opacity-50 shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              New Workflow
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs + search bar */}
        <div className="px-10 md:px-20 pt-10 pb-6">
          <div className="flex items-center justify-between">
            {/* Tabs */}
            <div className="flex items-center gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-[13.5px] font-semibold transition-all ${
                    activeTab === tab
                      ? isLight
                        ? "bg-[#f1f1f1] text-black"
                        : "bg-white/10 text-white"
                      : isLight
                        ? "text-black/40 hover:text-black/60"
                        : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Search + filter */}
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-2 border rounded-xl px-4 py-2 ${isLight ? "bg-white border-[#f1f1f1]" : "bg-white/4 border-white/5"}`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={isLight ? "text-black/30" : "text-white/30"}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`bg-transparent text-[14px] outline-none w-[200px] ${isLight ? "text-black placeholder:text-black/30" : "text-white placeholder:text-white/25"}`}
                />
              </div>

              <button
                className={`flex items-center gap-2 border rounded-xl px-4 py-2 text-[14px] font-medium transition-colors ${isLight ? "bg-white border-[#f1f1f1] text-black" : "bg-white/4 border-white/5 text-white"}`}
              >
                Last viewed
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="opacity-40"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              <button
                className={`p-2 border rounded-xl transition-colors ${isLight ? "bg-white border-[#f1f1f1] text-black/40 hover:text-black/60" : "bg-white/4 border-white/5 text-white/40 hover:text-white/60"}`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Workflow cards / Templates */}
        <div className="px-10 md:px-20 pt-6 pb-20">
          {activeTab === "Templates" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 gap-y-12">
              {WORKFLOW_TEMPLATES.map((tpl) => (
                <div key={tpl.id} className="flex flex-col gap-3.5">
                  <button
                    onClick={() => createFromTemplate(tpl)}
                    disabled={creatingTemplate === tpl.id}
                    className={`group w-full aspect-[1.3] rounded-2xl border overflow-hidden transition-all disabled:opacity-50 relative ${isLight ? "border-[#f1f1f1] bg-[#f7f7f7] hover:bg-[#efefef]" : "border-white/5 bg-white/3 hover:bg-white/6"}`}
                  >
                    {creatingTemplate === tpl.id ? (
                      <div className="flex items-center justify-center h-full">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-full h-full p-3">
                        <WorkflowMinimap
                          nodes={tpl.nodes as WfNode[]}
                          edges={tpl.edges as WfEdge[]}
                          isLight={isLight}
                        />
                      </div>
                    )}
                  </button>
                  <div className="flex flex-col">
                    <div className={`text-[15px] font-bold ${isLight ? "text-black" : "text-white"}`}>
                      {tpl.title}
                    </div>
                    <div className={`text-[12.5px] mt-0.5 ${isLight ? "text-black/30" : "text-white/30"}`}>
                      {tpl.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 text-neutral-500 py-20 justify-center">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                />
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Loading...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 gap-y-12">
              {/* New Workflow card */}
              <div className="flex flex-col gap-3.5">
                <button
                  onClick={createNewWorkflow}
                  disabled={creating}
                  className={`group w-full aspect-[1.3] rounded-2xl border transition-all disabled:opacity-50 overflow-hidden flex items-center justify-center ${isLight ? "border-[#f1f1f1] bg-[#f7f7f7] hover:bg-[#efefef]" : "border-white/5 bg-white/3 hover:bg-white/6"}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isLight ? "border-black/5 bg-white text-black/40 group-hover:scale-110 shadow-sm" : "border-white/10 text-white/40 group-hover:bg-white/10"}`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                </button>
                <div
                  className={`text-[15px] font-bold ${isLight ? "text-black" : "text-white"}`}
                >
                  New Workflow
                </div>
              </div>

              {/* Existing workflows */}
              {filteredWorkflows.map((wf) => {
                const nodes = wf.nodes ?? [];
                const edges = wf.edges ?? [];
                const hasNodes = nodes.length > 0;
                const firstImage = extractFirstImage(nodes);

                return (
                <div
                  key={wf.id}
                  className="flex flex-col gap-3.5 group relative"
                >
                  <div className="relative">
                    <button
                      onClick={() => router.push(`/node/${wf.id}`)}
                      className={`group/card w-full aspect-[1.3] rounded-2xl border overflow-hidden transition-all relative ${isLight ? "border-[#f1f1f1] bg-[#f7f7f7]" : "border-white/5 bg-white/3"}`}
                    >
                      {/* Default view: image or minimap */}
                      <div className={`absolute inset-0 transition-opacity duration-300 ${firstImage ? "group-hover/card:opacity-0" : ""}`}>
                        {firstImage ? (
                          <img
                            src={firstImage}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : hasNodes ? (
                          <div className="w-full h-full p-3">
                            <WorkflowMinimap nodes={nodes} edges={edges} isLight={isLight} />
                          </div>
                        ) : (
                          <div className={`h-full w-full flex items-center justify-center ${isLight ? "text-black/10" : "text-white/10"}`}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Hover view: minimap (only if there's an image to swap from) */}
                      {firstImage && hasNodes && (
                        <div className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 p-3">
                          <div className={`w-full h-full rounded-lg ${isLight ? "bg-[#f7f7f7]" : "bg-[#151515]"}`}>
                            <WorkflowMinimap nodes={nodes} edges={edges} isLight={isLight} />
                          </div>
                        </div>
                      )}
                    </button>

                    {/* Three dots menu */}
                    <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <WorkflowActionsMenu
                        workflow={wf}
                        onRename={() => {
                          setWorkflowToRename(wf);
                          setRenameTitle(wf.title || "");
                        }}
                        onDelete={() => setWorkflowToDelete(wf)}
                        onDuplicate={() => handleDuplicate(wf)}
                        isLight={isLight}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div
                      className={`text-[15px] font-bold truncate ${isLight ? "text-black" : "text-white"}`}
                    >
                      {wf.title || "Untitled"}
                    </div>
                    <div
                      className={`text-[12.5px] mt-0.5 ${isLight ? "text-black/30" : "text-white/30"}`}
                    >
                      {formatRelativeTime(wf.updatedAt)}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {workflowToDelete && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
              onClick={() => setWorkflowToDelete(null)}
            />
            <div
              className={`relative w-full max-w-[420px] rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 fade-in duration-300 ${isLight ? "bg-white" : "bg-[#1a1a1a]"}`}
            >
              <button
                onClick={() => setWorkflowToDelete(null)}
                className={`absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isLight ? "bg-black/5 hover:bg-black/10 text-black" : "bg-white/10 hover:bg-white/20 text-white"}`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <div className="flex flex-col gap-2 mt-2">
                <h3
                  className={`text-[24px] font-bold ${isLight ? "text-black" : "text-white"}`}
                >
                  Delete Workflow
                </h3>
                <p
                  className={`text-[16px] leading-relaxed ${isLight ? "text-black/50" : "text-white/50"}`}
                >
                  Are you sure you want to delete{" "}
                  <span className="font-bold">
                    "{workflowToDelete.title || "Untitled"}"
                  </span>
                  ? This cannot be undone.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 mt-8">
                <button
                  onClick={() => setWorkflowToDelete(null)}
                  className={`px-8 py-3.5 rounded-2xl text-[15px] font-bold transition-all active:scale-95 ${isLight ? "bg-black text-white hover:bg-black/90" : "bg-white text-black hover:bg-white/90"}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(workflowToDelete.id)}
                  className="px-8 py-3.5 rounded-2xl bg-[#ff0000] text-white text-[15px] font-bold hover:bg-[#e60000] transition-all active:scale-95 shadow-[0_4px_12px_rgba(255,0,0,0.2)]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Modal */}
        {workflowToRename && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
              onClick={() => setWorkflowToRename(null)}
            />
            <div
              className={`relative w-full max-w-[420px] rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 fade-in duration-300 ${isLight ? "bg-white" : "bg-[#1a1a1a]"}`}
            >
              <button
                onClick={() => setWorkflowToRename(null)}
                className={`absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isLight ? "bg-black/5 hover:bg-black/10 text-black" : "bg-white/10 hover:bg-white/20 text-white"}`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <div className="flex flex-col gap-2 mt-2">
                <h3
                  className={`text-[24px] font-bold ${isLight ? "text-black" : "text-white"}`}
                >
                  Rename Workflow
                </h3>
                <p
                  className={`text-[16px] leading-relaxed ${isLight ? "text-black/50" : "text-white/50"}`}
                >
                  Enter a new name for your workflow.
                </p>
              </div>

              <div className="mt-6">
                <input
                  autoFocus
                  type="text"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      handleRename(workflowToRename.id, renameTitle);
                    if (e.key === "Escape") setWorkflowToRename(null);
                  }}
                  className={`w-full px-5 py-4 rounded-2xl border-2 outline-none transition-all text-[16px] font-medium ${
                    isLight
                      ? "bg-white border-black/5 focus:border-[#0070f3] text-black"
                      : "bg-[#2a2a2a] border-white/5 focus:border-[#0070f3] text-white"
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-8">
                <button
                  onClick={() => setWorkflowToRename(null)}
                  className={`px-8 py-3.5 rounded-2xl text-[15px] font-bold transition-all active:scale-95 ${isLight ? "bg-black text-white hover:bg-black/90" : "bg-white text-black hover:bg-white/90"}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRename(workflowToRename.id, renameTitle)}
                  className="px-8 py-3.5 rounded-2xl bg-[#0070f3] text-white text-[15px] font-bold hover:bg-[#0060d9] transition-all active:scale-95 shadow-[0_4px_12px_rgba(0,112,243,0.2)]"
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function WorkflowActionsMenu({
  workflow,
  onRename,
  onDelete,
  onDuplicate,
  isLight,
}: {
  workflow: Workflow;
  onRename: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isLight: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = () => setIsOpen(false);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isLight ? "bg-white/80 hover:bg-white text-black shadow-sm" : "bg-black/50 hover:bg-black text-white"}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute top-full right-0 mt-2 w-48 rounded-2xl border shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 ${isLight ? "bg-white border-black/5" : "bg-[#1a1a1a] border-white/10"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => router.push(`/node/${workflow.id}`)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-medium transition-colors ${isLight ? "hover:bg-black/5 text-black" : "hover:bg-white/10 text-white"}`}
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
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              onRename();
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-medium transition-colors ${isLight ? "hover:bg-black/5 text-black" : "hover:bg-white/10 text-white"}`}
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
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
            Rename
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              onDuplicate();
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-medium transition-colors ${isLight ? "hover:bg-black/5 text-black" : "hover:bg-white/10 text-white"}`}
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
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Duplicate
          </button>
          <div
            className={`my-1 border-t ${isLight ? "border-black/5" : "border-white/5"}`}
          />
          <button
            onClick={() => {
              setIsOpen(false);
              onDelete();
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-medium text-red-500 transition-colors ${isLight ? "hover:bg-red-50" : "hover:bg-red-500/10"}`}
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
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
