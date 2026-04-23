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

type Snapshot = { nodes: Node[]; edges: Edge[] };

const MAX_HISTORY = 100;

export type FlowState = {
  nodes: Node[];
  edges: Edge[];
  interactionMode: "pan" | "select";
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
  setInteractionMode: (mode: "pan" | "select") => void;
  setCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  addNode: (item: PaletteItem) => void;
  updateNodeData: (nodeId: string, newData: any) => void;
};

/** Push the current state into the past stack, clear future. */
function pushHistory(
  get: () => FlowState,
  set: (partial: Partial<FlowState>) => void
) {
  const { nodes, edges, past } = get();
  const snapshot: Snapshot = {
    nodes: nodes.map((n) => ({ ...n })),
    edges: edges.map((e) => ({ ...e })),
  };
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

  undo: () => {
    const { past, future, nodes, edges } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const currentSnapshot: Snapshot = {
      nodes: nodes.map((n) => ({ ...n })),
      edges: edges.map((e) => ({ ...e })),
    };
    const newFuture = [currentSnapshot, ...future].slice(0, MAX_HISTORY);

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
    const currentSnapshot: Snapshot = {
      nodes: nodes.map((n) => ({ ...n })),
      edges: edges.map((e) => ({ ...e })),
    };
    const newPast = [...past, currentSnapshot].slice(-MAX_HISTORY);

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
        c.type === "remove" ||
        (c.type === "position" && c.dragging === false)
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

    const isYellow = connection.sourceHandle?.includes("yellow");
    const isGreen = connection.sourceHandle?.includes("green");
    const isBlue = connection.sourceHandle?.includes("blue");

    const strokeColor = isYellow
      ? "#e3c92f"
      : isGreen
      ? "#22c55e"
      : isBlue
      ? "#1188ff"
      : "#1188ff";

    set({
      edges: addEdge(
        {
          ...connection,
          type: "customEdge",
          style: {
            stroke: strokeColor,
            strokeWidth: 2,
          },
        } as any,
        get().edges
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

  setInteractionMode: (interactionMode: "pan" | "select") => {
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

  addNode: (item: PaletteItem) => {
    pushHistory(get, set);

    const nodes = get().nodes;
    const next = nodes.length + 1;
    const x = 320 + (next % 3) * 340;
    const y = 380 + Math.floor(next / 3) * 60;

    let newNodeData: any = {};
    let nodeType = "workflowCard";

    if (item.model === "Text") {
      nodeType = "textNode";
      newNodeData = { text: "" };
    } else if (item.model === "Image" || item.model === "Video") {
      nodeType = "mediaNode";
      newNodeData = { type: item.model.toLowerCase() };
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
        n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n
      ),
    }));
  },
}));
