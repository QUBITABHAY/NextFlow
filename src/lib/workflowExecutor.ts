import type { Node, Edge } from "@xyflow/react";
import { triggerNodeAction } from "@/app/actions";

type UpdateNodeData = (nodeId: string, data: any) => void;

/**
 * Detect if the graph has a cycle (i.e. is NOT a valid DAG).
 * Uses Kahn's algorithm — if we can't consume all executable nodes, there's a cycle.
 */
export function detectCycle(nodes: Node[], edges: Edge[]): string[] | null {
  const executableIds = new Set(
    nodes
      .filter((n) => n.type === "workflowCard" && hasInput(n, edges))
      .map((n) => n.id),
  );

  // Build adjacency + indegree only for workflowCard→workflowCard edges
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of executableIds) {
    indegree.set(id, 0);
    adj.set(id, []);
  }

  for (const edge of edges) {
    if (executableIds.has(edge.source) && executableIds.has(edge.target)) {
      adj.get(edge.source)!.push(edge.target);
      indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of indegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adj.get(current) ?? []) {
      const newDeg = (indegree.get(neighbor) ?? 1) - 1;
      indegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (sorted.length < executableIds.size) {
    // Return the nodes that are part of the cycle
    const cycleNodes = [...executableIds].filter((id) => !sorted.includes(id));
    return cycleNodes;
  }

  return null;
}

/**
 * Check if a workflowCard node has any real input:
 * - at least one incoming edge (from any node type), OR
 * - an uploaded file (uploadedImageUrl / uploadedVideoUrl)
 */
function hasInput(node: Node, edges: Edge[]): boolean {
  const data = node.data as any;
  if (data.uploadedImageUrl || data.uploadedVideoUrl) return true;
  return edges.some((e) => e.target === node.id);
}

/**
 * Group executable nodes into levels for parallel execution.
 * Level 0 = nodes with no workflowCard dependencies, Level 1 = depends only on Level 0, etc.
 * Skips nodes that have no inputs (no connected edges and no uploaded files).
 */
export function getExecutionLevels(nodes: Node[], edges: Edge[]): string[][] {
  const executableIds = new Set(
    nodes
      .filter((n) => n.type === "workflowCard" && hasInput(n, edges))
      .map((n) => n.id),
  );

  if (executableIds.size === 0) return [];

  // Build indegree counting only workflowCard→workflowCard edges
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of executableIds) {
    indegree.set(id, 0);
    adj.set(id, []);
  }

  for (const edge of edges) {
    if (executableIds.has(edge.source) && executableIds.has(edge.target)) {
      adj.get(edge.source)!.push(edge.target);
      indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    }
  }

  const levels: string[][] = [];
  let currentLevel = [...indegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id);

  while (currentLevel.length > 0) {
    levels.push(currentLevel);

    const nextLevel: string[] = [];
    for (const nodeId of currentLevel) {
      for (const neighbor of adj.get(nodeId) ?? []) {
        const newDeg = (indegree.get(neighbor) ?? 1) - 1;
        indegree.set(neighbor, newDeg);
        if (newDeg === 0) nextLevel.push(neighbor);
      }
    }
    currentLevel = nextLevel;
  }

  return levels;
}

/**
 * Collect inputs for a given node from connected sources (mirrors handleRun logic).
 */
function collectNodeInputs(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
): { prompt: string; media: string[]; extra: Record<string, any> } {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return { prompt: "", media: [], extra: {} };

  const nodeData = node.data as any;
  const connectedEdges = edges.filter((e) => e.target === nodeId);
  const connectedInputs = connectedEdges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    return {
      handleId: edge.targetHandle,
      nodeType: sourceNode?.type,
      data: sourceNode?.data,
    };
  });

  // Combine text prompts
  const combinedPrompt =
    connectedInputs
      .filter((input) => input.nodeType === "textNode")
      .map((input) => (input.data as any)?.text)
      .filter(Boolean)
      .join("\n") || nodeData.prompt || "";

  // Collect media URLs from mediaNodes
  const mediaInputs = connectedInputs
    .filter(
      (input) => input.nodeType === "mediaNode" && (input.data as any)?.url,
    )
    .map((input) => (input.data as any)?.url);

  // Collect outputs from connected workflowCard nodes
  connectedInputs
    .filter((input) => {
      const result = (input.data as any)?.runResult;
      return (
        input.nodeType === "workflowCard" &&
        result &&
        (result.startsWith("http") || result.startsWith("data:image"))
      );
    })
    .forEach((input) => mediaInputs.push((input.data as any).runResult));

  // Add uploaded files
  const isCropNode = nodeData.model === "Crop Image";
  const isExtractFrameNode = nodeData.model === "Extract Frame";

  if (isExtractFrameNode && nodeData.uploadedVideoUrl) {
    mediaInputs.unshift(nodeData.uploadedVideoUrl);
  } else if (nodeData.uploadedImageUrl) {
    mediaInputs.unshift(nodeData.uploadedImageUrl);
  }

  // Extra params for specific node types
  const extra: Record<string, any> = {};
  if (isCropNode) {
    extra.cropX = nodeData.cropX ?? 0;
    extra.cropY = nodeData.cropY ?? 0;
    extra.cropWidth = nodeData.cropWidth ?? 100;
    extra.cropHeight = nodeData.cropHeight ?? 100;
  }
  if (isExtractFrameNode) {
    extra.frameTimestamp = nodeData.frameTimestamp ?? 0;
    extra.frameTimestampMode = nodeData.frameTimestampMode ?? "seconds";
  }

  return { prompt: combinedPrompt, media: mediaInputs, extra };
}

/**
 * Execute a single node and update its data in the store.
 */
async function executeNode(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  updateNodeData: UpdateNodeData,
): Promise<boolean> {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;

  const nodeData = node.data as any;
  updateNodeData(nodeId, { isRunning: true, runResult: null, inputBadge: undefined });

  const { prompt, media, extra } = collectNodeInputs(nodeId, nodes, edges);

  try {
    const response = await triggerNodeAction(
      nodeId,
      nodeData.model || "WorkflowNode",
      { prompt, media, ...extra },
    );

    if (response.success) {
      updateNodeData(nodeId, {
        isRunning: false,
        runResult: response.runResult,
        inputBadge: "Success",
      });
      return true;
    } else {
      updateNodeData(nodeId, {
        isRunning: false,
        runResult: response.error || "Task failed",
        inputBadge: "Failed",
      });
      return false;
    }
  } catch (err: any) {
    updateNodeData(nodeId, {
      isRunning: false,
      runResult: err.message || "Unexpected error",
      inputBadge: "Failed",
    });
    return false;
  }
}

/**
 * Execute the entire workflow:
 * 1. Validate DAG (no cycles)
 * 2. Group nodes into parallel execution levels
 * 3. Execute each level, running nodes within a level in parallel
 *
 * Returns { success, error? }
 */
export async function executeWorkflow(
  nodes: Node[],
  edges: Edge[],
  updateNodeData: UpdateNodeData,
  getLatestNodes: () => Node[],
  abortSignal?: AbortSignal,
): Promise<{ success: boolean; error?: string }> {
  // 1. Validate DAG
  const cycleNodes = detectCycle(nodes, edges);
  if (cycleNodes) {
    return {
      success: false,
      error: `Workflow has a cycle involving ${cycleNodes.length} node(s). Remove circular connections to run.`,
    };
  }

  // 2. Get execution levels
  const levels = getExecutionLevels(nodes, edges);
  if (levels.length === 0) {
    return { success: false, error: "No executable nodes in the workflow." };
  }

  // 3. Execute level by level
  for (const level of levels) {
    if (abortSignal?.aborted) {
      return { success: false, error: "Workflow execution was stopped." };
    }

    // Run all nodes in this level in parallel
    const results = await Promise.all(
      level.map((nodeId) =>
        executeNode(nodeId, getLatestNodes(), edges, updateNodeData),
      ),
    );

    // Check if any node in this level failed
    const failedCount = results.filter((r) => !r).length;
    if (failedCount > 0) {
      return {
        success: false,
        error: `${failedCount} node(s) failed in execution. Check individual nodes for details.`,
      };
    }
  }

  return { success: true };
}
