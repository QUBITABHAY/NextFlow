"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  type Connection,
  type Edge,
} from "@xyflow/react";
import { useFlowStore } from "@/store/useFlowStore";
import { useUser, UserButton } from "@clerk/nextjs";

import { WorkflowCardNode } from "@/component/flow/WorkflowCardNode";
import { TextNode } from "@/component/flow/TextNode";
import { MediaNode } from "@/component/flow/MediaNode";
import { CustomEdge } from "@/component/flow/CustomEdge";
import { paletteItems } from "@/component/flow/constants";
import { Dock } from "@/component/flow/Dock";
import { SidePanel } from "@/component/flow/SidePanel";
import { TopActions } from "@/component/flow/TopActions";
import { BottomActions } from "@/component/flow/BottomActions";
import { SelectionOverlay } from "@/component/flow/SelectionOverlay";

// Auto-save debounce: 1.5s after last change
const AUTOSAVE_DELAY = 1500;

function WorkflowBuilder({ workflowId }: { workflowId: string }) {
  const [query, setQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialized = useRef(false);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    interactionMode,
    setInteractionMode,
    addNode,
    collapsed,
    setCollapsed,
    setNodes,
    setEdges,
    theme,
  } = useFlowStore();

  const isLight = theme === "light";

  // --- Load workflow on mount ---
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.nodes) setNodes(data.nodes);
          if (data.edges) setEdges(data.edges);
        } else if (res.status !== 404) {
          // 404 = new workflow (blank), anything else is an actual error
          const err = await res.json().catch(() => ({}));
          console.error("[NextFlow] Failed to load workflow:", res.status, err);
        }
      } catch (e) {
        console.error("[NextFlow] Network error loading workflow:", e);
      } finally {
        isInitialized.current = true;
      }
    }
    load();
  }, [workflowId, setNodes, setEdges]);

  // --- Auto-save when nodes/edges change ---
  useEffect(() => {
    if (!isInitialized.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodes, edges }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("[NextFlow] Save failed:", res.status, err);
          setSaveStatus("error");
        } else {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        }
      } catch (e) {
        console.error("[NextFlow] Network error saving workflow:", e);
        setSaveStatus("error");
      }
    }, AUTOSAVE_DELAY);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [nodes, edges, workflowId]);

  const filteredPalette = useMemo(
    () =>
      paletteItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const isSourceYellow = connection.sourceHandle?.includes("yellow");
    const isTargetYellow = connection.targetHandle?.includes("yellow");
    const isSourceBlue = connection.sourceHandle?.includes("blue");
    const isTargetBlue = connection.targetHandle?.includes("blue");
    const isSourceGreen = connection.sourceHandle?.includes("green");
    const isTargetGreen = connection.targetHandle?.includes("green");

    if (isSourceYellow && isTargetYellow) return true;
    if (isSourceBlue && isTargetBlue) return true;
    if (isSourceGreen && isTargetGreen) return true;
    return false;
  }, []);

  const nodeTypes = useMemo(
    () => ({
      workflowCard: WorkflowCardNode,
      textNode: TextNode,
      mediaNode: MediaNode,
    }),
    [],
  );

  const edgeTypes = useMemo(
    () => ({
      customEdge: CustomEdge,
    }),
    [],
  );

  const leftOffset = collapsed ? "left-[64px]" : "left-[324px]";

  return (
    <div className={`relative flex h-screen w-full overflow-hidden transition-colors duration-300 ${isLight ? "bg-white text-black" : "bg-[#0e0e0e] text-white"}`}>
      <aside className="relative z-30 flex h-full">
        <Dock setCollapsed={setCollapsed} />
        <SidePanel
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          query={query}
          setQuery={setQuery}
          filteredPalette={filteredPalette}
          addNode={addNode}
        />
      </aside>

      <main className="relative flex-1 overflow-hidden">
        <TopActions leftOffset={leftOffset} />

        {/* Save status indicator */}
        <div className={`absolute top-4 z-50 transition-all duration-300 ${leftOffset}`}>
          <div className={`ml-4 flex items-center gap-2 h-9 px-3 rounded-xl border text-xs font-medium transition-all ${isLight ? "border-black/5 bg-white text-black/50" : "border-white/10 bg-[#12151b]/95 text-white/50"} ${saveStatus === "idle" ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            {saveStatus === "saving" && (
              <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Saving…</>
            )}
            {saveStatus === "saved" && (
              <><svg className="w-3 h-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>Saved</>
            )}
            {saveStatus === "error" && (
              <><svg className="w-3 h-3 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Save failed</>
            )}
          </div>
        </div>

        <ReactFlow
          className="bg-transparent"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          isValidConnection={isValidConnection}
          panOnDrag={interactionMode === "pan"}
          selectionOnDrag={interactionMode === "select"}
          selectionMode={SelectionMode.Partial}
          defaultViewport={{ x: 100, y: 50, zoom: 2 }}
          minZoom={0.35}
          maxZoom={4}
          panOnScroll={true}
          defaultEdgeOptions={{
            style: {
              stroke: "#e3c92f",
              strokeWidth: 2,
            },
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color={isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.08)"}
          />
          <MiniMap
            className={`!w-[200px] !h-[140px] !m-0 !right-4 !bottom-4 !rounded-xl !overflow-hidden !border shadow-2xl backdrop-blur-xl ${isLight ? "!border-black/5 !bg-white/90" : "!border-white/10 !bg-[#0b0d11]/90"}`}
            position="bottom-right"
            nodeColor={() => isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.2)"}
            maskColor={isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(0, 0, 0, 0.7)"}
            bgColor="transparent"
            pannable
            zoomable
          />
          <SelectionOverlay />
        </ReactFlow>

        <BottomActions />
      </main>
    </div>
  );
}

export default function NodePage({ params }: { params: Promise<{ id: string }> }) {
  const [workflowId, setWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setWorkflowId(p.id));
  }, [params]);

  if (!workflowId) return null;

  return (
    <ReactFlowProvider>
      <WorkflowBuilder workflowId={workflowId} />
    </ReactFlowProvider>
  );
}
