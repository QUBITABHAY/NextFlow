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
import { GroupNode } from "@/component/flow/GroupNode";
import { CustomEdge } from "@/component/flow/CustomEdge";
import { isSameColorFamily } from "@/component/flow/constants";
import { useTheme } from "@/hooks/useTheme";
import { Sidebar } from "@/component/Sidebar";
import { TopActions } from "@/component/flow/TopActions";
import { BottomActions } from "@/component/flow/BottomActions";
import { SelectionOverlay } from "@/component/flow/SelectionOverlay";
import { HistorySidebar } from "@/component/flow/HistorySidebar";
import { CutLine } from "@/component/flow/CutLine";
import { TemplateOverlay } from "@/component/flow/TemplateOverlay";
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from "@/lib/templates";

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
    workflowTitle,
    setWorkflowTitle,
  } = useFlowStore();

  const { isLight } = useTheme();
  const { screenToFlowPosition } = useReactFlow();

  const [showTemplateOverlay, setShowTemplateOverlay] = useState(false);

  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuFlowPos, setContextMenuFlowPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // --- Load workflow on mount ---
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.title) setWorkflowTitle(data.title);
          if (data.nodes && data.nodes.length > 0) {
            // Ensure parent (group) nodes come before children
            const sorted = [...data.nodes].sort((a: any, b: any) => {
              const aIsParent = !a.parentId;
              const bIsParent = !b.parentId;
              if (aIsParent && !bIsParent) return -1;
              if (!aIsParent && bIsParent) return 1;
              return 0;
            });
            setNodes(sorted);
          } else {
            setShowTemplateOverlay(true);
          }
          if (data.edges) setEdges(data.edges);
        } else if (res.status === 404) {
          // New workflow — show template picker
          setShowTemplateOverlay(true);
        } else {
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
  }, [workflowId, setNodes, setEdges, setWorkflowTitle]);

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
          body: JSON.stringify({ nodes, edges, title: workflowTitle }),
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
  }, [nodes, edges, workflowId, workflowTitle]);

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
    [screenToFlowPosition, addNode],
  );

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setContextMenuFlowPos(flowPos);
      setContextMenuOpen(true);
    },
    [screenToFlowPosition],
  );

  const nodeTypes = useMemo(
    () => ({
      workflowCard: WorkflowCardNode,
      textNode: TextNode,
      mediaNode: MediaNode,
      llmNode: LLMNode,
      groupNode: GroupNode,
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
          onPaneClick={() => {
            setContextMenuOpen(false);
            setContextMenuFlowPos(null);
          }}
          onPaneContextMenu={onPaneContextMenu}
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

        <CutLine />

        {showTemplateOverlay && (
          <TemplateOverlay
            onDismiss={() => setShowTemplateOverlay(false)}
            onSelectTemplate={(template) => {
              // Generate unique IDs so each project has distinct node/edge IDs
              const idMap = new Map<string, string>();
              const newNodes = template.nodes.map((n) => {
                const uid = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                idMap.set(n.id, uid);
                return { ...n, id: uid };
              });
              const newEdges = template.edges.map((e) => ({
                ...e,
                id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                source: idMap.get(e.source) ?? e.source,
                target: idMap.get(e.target) ?? e.target,
              }));
              setNodes(newNodes as any);
              setEdges(newEdges as any);
              setShowTemplateOverlay(false);
            }}
          />
        )}

        <BottomActions
          leftOffset={leftOffset}
          externalOpen={contextMenuOpen}
          onExternalOpenChange={(open) => {
            setContextMenuOpen(open);
            if (!open) setContextMenuFlowPos(null);
          }}
          dropPosition={contextMenuFlowPos}
        />
      </main>

      <HistorySidebar
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
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
