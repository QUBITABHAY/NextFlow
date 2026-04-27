import { create } from "zustand";
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  reconnectEdge,
} from "@xyflow/react";
import { PaletteItem } from "@/component/flow/types";
import { getStrokeColor } from "@/component/flow/constants";
import {
  executeWorkflow,
  cancelAllActiveRuns,
  type RunTracker,
} from "@/lib/workflowExecutor";
import {
  createWorkflowRun,
  createNodeRun,
  finishNodeRun,
  finishWorkflowRun,
} from "@/app/runActions";

type Snapshot = { nodes: Node[]; edges: Edge[] };

const MAX_HISTORY = 100;

function createSnapshot(nodes: Node[], edges: Edge[]): Snapshot {
  return {
    nodes: nodes.map((n) => ({ ...n })),
    edges: edges.map((e) => ({ ...e })),
  };
}

export type FlowState = {
  nodes: Node[];
  edges: Edge[];
  interactionMode: "pan" | "select" | "add" | "cut";
  collapsed: boolean;
  theme: "light" | "dark";

  // History stacks
  past: Snapshot[];
  future: Snapshot[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  toggleTheme: () => void;
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: OnConnect;
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setInteractionMode: (mode: "pan" | "select" | "add" | "cut") => void;
  setCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  addNode: (item: PaletteItem, position?: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, newData: any) => void;

  // Workflow identity
  workflowId: string | null;
  workflowTitle: string;
  setWorkflowId: (id: string) => void;
  setWorkflowTitle: (title: string) => void;

  // History sidebar
  historyOpen: boolean;
  setHistoryOpen: (open: boolean | ((prev: boolean) => boolean)) => void;

  // Workflow execution
  isWorkflowRunning: boolean;
  workflowError: string | null;
  workflowAbort: AbortController | null;
  runWorkflow: () => Promise<void>;
  runSelectedNodes: () => Promise<void>;
  stopWorkflow: () => void;

  // Selection actions
  tidyUpSelectedNodes: () => void;
  groupSelectedNodes: () => void;

  // Group node actions
  ungroupNode: (groupId: string) => void;
  changeGroupColor: (groupId: string, color: string) => void;
  runGroupNodes: (groupId: string) => Promise<void>;

  // Export / Import
  exportWorkflow: () => void;
  importWorkflow: (file: File) => Promise<{ success: boolean; error?: string }>;
};

/** Push the current state into the past stack, clear future. */
function pushHistory(
  get: () => FlowState,
  set: (partial: Partial<FlowState>) => void,
) {
  const { nodes, edges, past } = get();
  const snapshot = createSnapshot(nodes, edges);
  const newPast = [...past, snapshot].slice(-MAX_HISTORY);
  set({ past: newPast, future: [], canUndo: true, canRedo: false });
}

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  interactionMode: "pan",
  collapsed: true,
  theme: "dark",

  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  workflowId: null,
  workflowTitle: "Untitled",
  setWorkflowId: (id: string) => set({ workflowId: id }),
  setWorkflowTitle: (title: string) => set({ workflowTitle: title }),

  historyOpen: false,
  setHistoryOpen: (open) =>
    set((state) => ({
      historyOpen: typeof open === "function" ? open(state.historyOpen) : open,
    })),

  isWorkflowRunning: false,
  workflowError: null,
  workflowAbort: null,

  undo: () => {
    const { past, future, nodes, edges } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const newFuture = [createSnapshot(nodes, edges), ...future].slice(
      0,
      MAX_HISTORY,
    );

    set({
      nodes: previous.nodes,
      edges: previous.edges,
      past: newPast,
      future: newFuture,
      canUndo: newPast.length > 0,
      canRedo: true,
    });
  },

  redo: () => {
    const { past, future, nodes, edges } = get();
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);
    const newPast = [...past, createSnapshot(nodes, edges)].slice(-MAX_HISTORY);

    set({
      nodes: next.nodes,
      edges: next.edges,
      past: newPast,
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    });
  },

  toggleTheme: () => {
    set((state) => ({ theme: state.theme === "light" ? "dark" : "light" }));
  },

  onNodesChange: (changes: NodeChange<Node>[]) => {
    // Only snapshot for changes that actually mutate structure (not position drags in progress)
    const isSignificant = changes.some(
      (c) =>
        c.type === "remove" || (c.type === "position" && c.dragging === false),
    );
    if (isSignificant) {
      pushHistory(get, set);
    }
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes: EdgeChange<Edge>[]) => {
    const isSignificant = changes.some((c) => c.type === "remove");
    if (isSignificant) {
      pushHistory(get, set);
    }
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection: Connection) => {
    pushHistory(get, set);

    set({
      edges: addEdge(
        {
          ...connection,
          type: "customEdge",
          style: {
            stroke: getStrokeColor(connection.sourceHandle),
            strokeWidth: 2,
          },
        } as any,
        get().edges,
      ),
    });
  },

  onReconnect: (oldEdge: Edge, newConnection: Connection) => {
    pushHistory(get, set);
    set({
      edges: reconnectEdge(oldEdge, newConnection, get().edges),
    });
  },

  setNodes: (nodes: Node[]) => {
    set({ nodes });
  },

  setEdges: (edges: Edge[]) => {
    set({ edges });
  },

  setInteractionMode: (interactionMode: "pan" | "select" | "add" | "cut") => {
    set({ interactionMode });
  },

  setCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => {
    set((state) => ({
      collapsed:
        typeof collapsed === "function"
          ? collapsed(state.collapsed)
          : collapsed,
    }));
  },

  addNode: (item: PaletteItem, position?: { x: number; y: number }) => {
    pushHistory(get, set);

    const nodes = get().nodes;
    const next = nodes.length + 1;
    const x = position?.x ?? 320 + (next % 3) * 340;
    const y = position?.y ?? 380 + Math.floor(next / 3) * 60;

    let newNodeData: any = {};
    let nodeType = "workflowCard";

    if (item.model === "Text") {
      nodeType = "textNode";
      newNodeData = { text: "" };
    } else if (item.model === "Image" || item.model === "Video") {
      nodeType = "mediaNode";
      newNodeData = { type: item.model.toLowerCase() };
    } else if (item.model === "Crop Image") {
      newNodeData = {
        title: "Crop Image",
        gpu: "",
        model: "Crop Image",
        prompt: "",
        placeholder: "",
        lowerLeft: "Image",
        lowerRight: "Result",
        rightLabel: "Image",
        cropX: 0,
        cropY: 0,
        cropWidth: 100,
        cropHeight: 100,
      };
    } else if (item.model === "Extract Frame") {
      newNodeData = {
        title: "Extract Frame",
        gpu: "",
        model: "Extract Frame",
        prompt: "",
        placeholder: "",
        lowerLeft: "Video",
        lowerRight: "Frame",
        rightLabel: "Image",
        frameTimestamp: 0,
        frameTimestampMode: "seconds",
      };
    } else if (item.model === "LLM Call") {
      nodeType = "llmNode";
      newNodeData = {
        systemPrompt: "",
        userMessage: "",
        selectedModel: "",
      };
    } else {
      newNodeData = {
        title: item.label,
        gpu: "",
        model: item.model,
        prompt: "",
        placeholder: "Describe the edit you want",
        lowerLeft: "Input",
        lowerRight: "Waiting",
        rightLabel: "Result",
        inputBadge: "Waiting input",
      };
    }

    set({
      nodes: [
        ...nodes,
        {
          id: `dynamic-${Date.now()}`,
          type: nodeType,
          position: { x, y },
          data: newNodeData,
        },
      ],
    });
  },

  updateNodeData: (nodeId: string, newData: any) => {
    pushHistory(get, set);
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n,
      ),
    }));
  },

  runWorkflow: async () => {
    const { nodes, edges, isWorkflowRunning, workflowId } = get();
    if (isWorkflowRunning) return;

    const abort = new AbortController();
    set({ isWorkflowRunning: true, workflowError: null, workflowAbort: abort });

    // Create run record if we have a workflowId
    let runId: string | undefined;
    let tracker: RunTracker | undefined;
    const startTime = Date.now();

    if (workflowId) {
      try {
        runId = await createWorkflowRun(workflowId, "full");
        tracker = {
          onNodeStart: (nodeId, nodeType, nodeLabel, input) =>
            createNodeRun(runId!, nodeId, nodeType, nodeLabel, input),
          onNodeFinish: (nodeRunId, success, durationMs, output, error) =>
            finishNodeRun(
              nodeRunId,
              success ? "success" : "failed",
              durationMs,
              output,
              error,
            ),
        };
      } catch (e) {
        console.error("[NextFlow] Failed to create run record:", e);
      }
    }

    const result = await executeWorkflow(
      nodes,
      edges,
      (nodeId, newData) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n,
          ),
        }));
      },
      () => get().nodes,
      abort.signal,
      tracker,
    );

    // Finish the run record
    if (runId) {
      const duration = Date.now() - startTime;
      const status = result.success
        ? "success"
        : result.partial
          ? "partial"
          : "failed";
      try {
        await finishWorkflowRun(runId, status, duration, result.error);
      } catch (e) {
        console.error("[NextFlow] Failed to finish run record:", e);
      }
    }

    set({
      isWorkflowRunning: false,
      workflowError: result.success ? null : (result.error ?? "Unknown error"),
      workflowAbort: null,
    });
  },

  runSelectedNodes: async () => {
    const { nodes, edges, isWorkflowRunning, workflowId } = get();
    if (isWorkflowRunning) return;

    const selectedIds = new Set(
      nodes.filter((n) => n.selected).map((n) => n.id),
    );
    if (selectedIds.size === 0) return;

    // Include selected nodes + any non-executable source nodes they depend on (text, media)
    const relevantIds = new Set(selectedIds);
    for (const edge of edges) {
      if (selectedIds.has(edge.target)) {
        relevantIds.add(edge.source);
      }
    }

    const filteredNodes = nodes.filter((n) => relevantIds.has(n.id));
    const filteredEdges = edges.filter(
      (e) => relevantIds.has(e.source) && relevantIds.has(e.target),
    );

    const abort = new AbortController();
    set({ isWorkflowRunning: true, workflowError: null, workflowAbort: abort });

    let runId: string | undefined;
    let tracker: RunTracker | undefined;
    const startTime = Date.now();

    if (workflowId) {
      try {
        runId = await createWorkflowRun(workflowId, "partial");
        tracker = {
          onNodeStart: (nodeId, nodeType, nodeLabel, input) =>
            createNodeRun(runId!, nodeId, nodeType, nodeLabel, input),
          onNodeFinish: (nodeRunId, success, durationMs, output, error) =>
            finishNodeRun(
              nodeRunId,
              success ? "success" : "failed",
              durationMs,
              output,
              error,
            ),
        };
      } catch (e) {
        console.error("[NextFlow] Failed to create run record:", e);
      }
    }

    const result = await executeWorkflow(
      filteredNodes,
      filteredEdges,
      (nodeId, newData) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n,
          ),
        }));
      },
      () => {
        const all = get().nodes;
        return all.filter((n) => relevantIds.has(n.id));
      },
      abort.signal,
      tracker,
    );

    if (runId) {
      const duration = Date.now() - startTime;
      const status = result.success
        ? "success"
        : result.partial
          ? "partial"
          : "failed";
      try {
        await finishWorkflowRun(runId, status, duration, result.error);
      } catch (e) {
        console.error("[NextFlow] Failed to finish run record:", e);
      }
    }

    set({
      isWorkflowRunning: false,
      workflowError: result.success ? null : (result.error ?? "Unknown error"),
      workflowAbort: null,
    });
  },

  stopWorkflow: () => {
    const { workflowAbort } = get();
    workflowAbort?.abort();
    cancelAllActiveRuns();
    set({
      isWorkflowRunning: false,
      workflowError: "Workflow stopped by user.",
      workflowAbort: null,
    });
    set((state) => ({
      nodes: state.nodes.map((n) =>
        (n.data as any).isRunning
          ? {
              ...n,
              data: {
                ...n.data,
                isRunning: false,
                inputBadge: "Failed",
                runResult: "Stopped by user.",
              },
            }
          : n,
      ),
    }));
  },

  tidyUpSelectedNodes: () => {
    const { nodes } = get();
    const selected = nodes.filter((n) => n.selected);
    if (selected.length < 2) return;

    pushHistory(get, set);

    // Sort selected nodes top-to-bottom, left-to-right
    const sorted = [...selected].sort((a, b) =>
      a.position.y !== b.position.y
        ? a.position.y - b.position.y
        : a.position.x - b.position.x,
    );

    // Grid layout: arrange in rows
    const cols = Math.ceil(Math.sqrt(sorted.length));
    const gapX = 400;
    const gapY = 300;

    // Use the top-left of the current bounding box as the anchor
    const anchorX = Math.min(...sorted.map((n) => n.position.x));
    const anchorY = Math.min(...sorted.map((n) => n.position.y));

    const movedIds = new Map<string, { x: number; y: number }>();
    sorted.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      movedIds.set(node.id, {
        x: anchorX + col * gapX,
        y: anchorY + row * gapY,
      });
    });

    set({
      nodes: nodes.map((n) => {
        const newPos = movedIds.get(n.id);
        return newPos ? { ...n, position: newPos } : n;
      }),
    });
  },

  groupSelectedNodes: () => {
    const { nodes } = get();
    const selected = nodes.filter((n) => n.selected && n.type !== "groupNode");
    if (selected.length < 2) return;

    pushHistory(get, set);

    // Random pastel-ish color
    const GROUP_COLORS = [
      "#a855f7",
      "#3b82f6",
      "#ef4444",
      "#22c55e",
      "#f59e0b",
      "#ec4899",
      "#06b6d4",
      "#8b5cf6",
      "#14b8a6",
      "#f97316",
    ];
    const color = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];

    // Count existing groups for naming
    const groupCount = nodes.filter((n) => n.type === "groupNode").length;

    // Compute bounding box of selected nodes
    const PAD = 40;
    const LABEL_HEIGHT = 30;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const n of selected) {
      const w = n.measured?.width ?? (n.width as number) ?? 200;
      const h = n.measured?.height ?? (n.height as number) ?? 100;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }

    const groupX = minX - PAD;
    const groupY = minY - PAD - LABEL_HEIGHT;
    const groupW = maxX - minX + PAD * 2;
    const groupH = maxY - minY + PAD * 2 + LABEL_HEIGHT;

    const groupId = `group-${Date.now()}`;

    // Create the group node
    const groupNode: Node = {
      id: groupId,
      type: "groupNode",
      position: { x: groupX, y: groupY },
      data: {
        label: `Group ${groupCount + 1}`,
        color,
        width: groupW,
        height: groupH,
      },
      style: { zIndex: -1 },
    };

    // Reparent selected nodes under the group — positions become relative
    const updatedNodes = nodes.map((n) => {
      if (!n.selected || n.type === "groupNode") return n;
      return {
        ...n,
        parentId: groupId,
        extent: "parent" as const,
        position: {
          x: n.position.x - groupX,
          y: n.position.y - groupY,
        },
        selected: false,
      };
    });

    // Group node must come BEFORE its children in the array
    set({ nodes: [groupNode, ...updatedNodes] });
  },

  ungroupNode: (groupId: string) => {
    const { nodes } = get();
    const groupNode = nodes.find((n) => n.id === groupId);
    if (!groupNode) return;

    pushHistory(get, set);

    const groupX = groupNode.position.x;
    const groupY = groupNode.position.y;

    // Convert children back to absolute positions and remove parentId
    const updatedNodes = nodes
      .filter((n) => n.id !== groupId)
      .map((n) => {
        if (n.parentId !== groupId) return n;
        const { parentId, extent, ...rest } = n as any;
        return {
          ...rest,
          position: {
            x: n.position.x + groupX,
            y: n.position.y + groupY,
          },
        };
      });

    set({ nodes: updatedNodes });
  },

  changeGroupColor: (groupId: string, color: string) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === groupId ? { ...n, data: { ...n.data, color } } : n,
      ),
    }));
  },

  runGroupNodes: async (groupId: string) => {
    const { nodes, edges, isWorkflowRunning, workflowId } = get();
    if (isWorkflowRunning) return;

    // Find all children of this group
    const childIds = new Set(
      nodes.filter((n) => n.parentId === groupId).map((n) => n.id),
    );
    if (childIds.size === 0) return;

    // Also include connected input sources (text, media nodes outside the group)
    const relevantIds = new Set(childIds);
    for (const edge of edges) {
      if (childIds.has(edge.target)) {
        relevantIds.add(edge.source);
      }
    }

    const filteredNodes = nodes.filter((n) => relevantIds.has(n.id));
    const filteredEdges = edges.filter(
      (e) => relevantIds.has(e.source) && relevantIds.has(e.target),
    );

    const abort = new AbortController();
    set({ isWorkflowRunning: true, workflowError: null, workflowAbort: abort });

    let runId: string | undefined;
    let tracker: RunTracker | undefined;
    const startTime = Date.now();

    if (workflowId) {
      try {
        runId = await createWorkflowRun(workflowId, "partial");
        tracker = {
          onNodeStart: (nodeId, nodeType, nodeLabel, input) =>
            createNodeRun(runId!, nodeId, nodeType, nodeLabel, input),
          onNodeFinish: (nodeRunId, success, durationMs, output, error) =>
            finishNodeRun(
              nodeRunId,
              success ? "success" : "failed",
              durationMs,
              output,
              error,
            ),
        };
      } catch (e) {
        console.error("[NextFlow] Failed to create run record:", e);
      }
    }

    const result = await executeWorkflow(
      filteredNodes,
      filteredEdges,
      (nodeId, newData) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n,
          ),
        }));
      },
      () => get().nodes.filter((n) => relevantIds.has(n.id)),
      abort.signal,
      tracker,
    );

    if (runId) {
      const duration = Date.now() - startTime;
      const status = result.success
        ? "success"
        : result.partial
          ? "partial"
          : "failed";
      try {
        await finishWorkflowRun(runId, status, duration, result.error);
      } catch (e) {
        console.error("[NextFlow] Failed to finish run record:", e);
      }
    }

    set({
      isWorkflowRunning: false,
      workflowError: result.success ? null : (result.error ?? "Unknown error"),
      workflowAbort: null,
    });
  },

  exportWorkflow: () => {
    const { nodes, edges, workflowTitle } = get();
    const payload = {
      version: 1,
      title: workflowTitle || "Untitled",
      exportedAt: new Date().toISOString(),
      nodes: nodes.map(({ id, type, position, data, parentId, extent, style }) => ({
        id,
        type,
        position,
        data,
        ...(parentId ? { parentId } : {}),
        ...(extent ? { extent } : {}),
        ...(style ? { style } : {}),
      })),
      edges: edges.map(({ id, source, target, sourceHandle, targetHandle, type, style }) => ({
        id,
        source,
        target,
        ...(sourceHandle ? { sourceHandle } : {}),
        ...(targetHandle ? { targetHandle } : {}),
        ...(type ? { type } : {}),
        ...(style ? { style } : {}),
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(workflowTitle || "workflow").replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importWorkflow: async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate structure
      if (!data || typeof data !== "object") {
        return { success: false, error: "Invalid JSON file." };
      }
      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        return { success: false, error: "Missing nodes or edges array." };
      }

      // Validate each node has required fields
      for (const node of data.nodes) {
        if (!node.id || !node.position || typeof node.position.x !== "number" || typeof node.position.y !== "number") {
          return { success: false, error: `Invalid node: ${node.id ?? "unknown"}` };
        }
      }

      pushHistory(get, set);

      set({
        nodes: data.nodes,
        edges: data.edges,
        ...(data.title ? { workflowTitle: data.title } : {}),
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Failed to parse JSON file." };
    }
  },
}));
