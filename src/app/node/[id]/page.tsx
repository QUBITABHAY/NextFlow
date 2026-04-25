"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Connection,
  type Edge,
} from "@xyflow/react";
import { useFlowStore } from "@/store/useFlowStore";

import { WorkflowCardNode } from "@/component/flow/WorkflowCardNode";
import { TextNode } from "@/component/flow/TextNode";
import { MediaNode } from "@/component/flow/MediaNode";
import { LLMNode } from "@/component/flow/LLMNode";
import { CustomEdge } from "@/component/flow/CustomEdge";
import { isSameColorFamily } from "@/component/flow/constants";
import { useTheme } from "@/hooks/useTheme";
import { Sidebar } from "@/component/Sidebar";
import { TopActions } from "@/component/flow/TopActions";
import { BottomActions } from "@/component/flow/BottomActions";
import { SelectionOverlay } from "@/component/flow/SelectionOverlay";
import { HistorySidebar } from "@/component/flow/HistorySidebar";

// Auto-save debounce: 1.5s after last change
const AUTOSAVE_DELAY = 1500;

function WorkflowBuilder({ workflowId }: { workflowId: string }) {
  const setWorkflowId = useFlowStore((state) => state.setWorkflowId);

  useEffect(() => {
    setWorkflowId(workflowId);
  }, [workflowId, setWorkflowId]);

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
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
    addNode,
    collapsed,
    setNodes,
    setEdges,
    historyOpen,
    setHistoryOpen,
  } = useFlowStore();

  const { isLight } = useTheme();
  const { screenToFlowPosition } = useReactFlow();

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

  const isValidConnection = useCallback(
    (connection: Connection | Edge) =>
      isSameColorFamily(connection.sourceHandle, connection.targetHandle),
    [],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      const label = event.dataTransfer.getData("application/reactflow-label");

      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode({ label, model: type }, position);
    },
    [screenToFlowPosition, addNode]
  );

  const nodeTypes = useMemo(
    () => ({
      workflowCard: WorkflowCardNode,
      textNode: TextNode,
      mediaNode: MediaNode,
      llmNode: LLMNode,
    }),
    [],
  );

  const edgeTypes = useMemo(
    () => ({
      customEdge: CustomEdge,
    }),
    [],
  );

  const leftOffset = collapsed ? "left-[64px]" : "left-[230px]";

  return (
    <div
      className={`relative flex h-screen w-full overflow-hidden transition-colors duration-300 ${isLight ? "bg-white text-black" : "bg-[#0e0e0e] text-white"}`}
    >
      <Sidebar onAddNode={(item) => addNode(item)} />

      <main className="relative flex-1 overflow-hidden">
        <TopActions leftOffset={leftOffset} />

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
          onDragOver={onDragOver}
          onDrop={onDrop}
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
          elevateNodesOnSelect={true}
          elevateEdgesOnSelect={true}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color={
              isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.08)"
            }
          />
          <MiniMap
            className={`w-[200px]! h-[140px]! m-0! right-4! bottom-4! rounded-xl! overflow-hidden! border! shadow-2xl backdrop-blur-xl ${isLight ? "border-black/5! bg-white/90!" : "border-white/10! bg-[#0b0d11]/90!"}`}
            position="bottom-right"
            nodeColor={() =>
              isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.2)"
            }
            maskColor={isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(0, 0, 0, 0.7)"}
            bgColor="transparent"
            pannable
            zoomable
          />
          <SelectionOverlay />
        </ReactFlow>

        <BottomActions />
      </main>

      <HistorySidebar open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

export default function NodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
