import type { Node, Edge } from "@xyflow/react";
import { triggerNodeAction, pollRunStatus } from "@/app/actions";

type UpdateNodeData = (nodeId: string, data: any) => void;

export type RunTracker = {
  onNodeStart: (
    nodeId: string,
    nodeType: string,
    nodeLabel: string,
    input: string,
  ) => Promise<string>; // returns nodeRunId
  onNodeFinish: (
    nodeRunId: string,
    success: boolean,
    durationMs: number,
    output?: string,
    error?: string,
  ) => Promise<void>;
};

/**
 * Detect if the graph has a cycle (i.e. is NOT a valid DAG).
 * Uses Kahn's algorithm — if we can't consume all executable nodes, there's a cycle.
 */
export function detectCycle(nodes: Node[], edges: Edge[]): string[] | null {
  const executableIds = new Set(
    nodes
      .filter((n) => isExecutableNode(n) && hasInput(n, edges))
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

/** Node types that are executable in the workflow */
function isExecutableNode(node: Node): boolean {
  return node.type === "workflowCard" || node.type === "llmNode";
}

/**
 * Check if an executable node has any real input:
 * - at least one incoming edge (from any node type), OR
 * - an uploaded file (uploadedImageUrl / uploadedVideoUrl), OR
 * - for LLM nodes: has a userMessage typed in
 */
function hasInput(node: Node, edges: Edge[]): boolean {
  const data = node.data as any;
  if (data.uploadedImageUrl || data.uploadedVideoUrl) return true;
  if (node.type === "llmNode" && data.userMessage) return true;
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
      .filter((n) => isExecutableNode(n) && hasInput(n, edges))
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
  let combinedPrompt =
    connectedInputs
      .filter((input) => input.nodeType === "textNode")
      .map((input) => (input.data as any)?.text)
      .filter(Boolean)
      .join("\n") ||
    nodeData.prompt ||
    "";

  // Collect media URLs from mediaNodes
  const mediaInputs = connectedInputs
    .filter(
      (input) => input.nodeType === "mediaNode" && (input.data as any)?.url,
    )
    .map((input) => (input.data as any)?.url);

  // Collect outputs from connected workflowCard nodes (media results)
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

  // Collect text outputs from connected llmNode nodes (append to prompt)
  const llmTextOutputs = connectedInputs
    .filter((input) => {
      const result = (input.data as any)?.runResult;
      return input.nodeType === "llmNode" && result;
    })
    .map((input) => (input.data as any).runResult);
  if (llmTextOutputs.length > 0) {
    const llmText = llmTextOutputs.join("\n");
    combinedPrompt = combinedPrompt ? `${combinedPrompt}\n${llmText}` : llmText;
  }

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

  // LLM node specifics
  if (node.type === "llmNode") {
    extra.systemPrompt = nodeData.systemPrompt || "";
    extra.userMessage = nodeData.userMessage || "";
    extra.selectedModel = nodeData.selectedModel ?? "";
    // If text nodes are connected, append to user message
    if (combinedPrompt && !nodeData.userMessage) {
      extra.userMessage = combinedPrompt;
    } else if (combinedPrompt && nodeData.userMessage) {
      extra.userMessage = `${nodeData.userMessage}\n\n${combinedPrompt}`;
    }
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
  tracker?: RunTracker,
): Promise<boolean> {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;

  const nodeData = node.data as any;
  updateNodeData(nodeId, {
    isRunning: true,
    runResult: null,
    inputBadge: undefined,
  });

  const { prompt, media, extra } = collectNodeInputs(nodeId, nodes, edges);

  // Determine the node type string for routing in triggerNodeAction
  const nodeTypeLabel =
    node.type === "llmNode" ? "LLM Call" : nodeData.model || "WorkflowNode";

  const nodeLabel =
    node.type === "llmNode" ? "LLM Call" : nodeData.title || nodeTypeLabel;
  const inputSummary = [prompt, ...media].filter(Boolean).join(" | ");

  let nodeRunId: string | undefined;
  const startTime = Date.now();
  if (tracker) {
    nodeRunId = await tracker.onNodeStart(
      nodeId,
      nodeTypeLabel,
      nodeLabel,
      inputSummary,
    );
  }

  try {
    const triggerResponse = await triggerNodeAction(nodeId, nodeTypeLabel, {
      prompt,
      media,
      ...extra,
    });

    if (!triggerResponse.success || !triggerResponse.runId) {
      const duration = Date.now() - startTime;
      const errMsg = triggerResponse.error || "Failed to trigger task";
      updateNodeData(nodeId, {
        isRunning: false,
        runResult: errMsg,
        inputBadge: "Failed",
      });
      if (tracker && nodeRunId) {
        await tracker.onNodeFinish(
          nodeRunId,
          false,
          duration,
          undefined,
          errMsg,
        );
      }
      return false;
    }

    const runId = triggerResponse.runId;
    const MAX_POLLS = 180;
    let queuedPolls = 0;
    const QUEUE_LIMIT = 30;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const status = await pollRunStatus(runId, nodeTypeLabel);

      if (status.done) {
        const duration = Date.now() - startTime;
        if (status.success) {
          updateNodeData(nodeId, {
            isRunning: false,
            runResult: status.runResult,
            inputBadge: "Success",
          });
          if (tracker && nodeRunId) {
            await tracker.onNodeFinish(
              nodeRunId,
              true,
              duration,
              status.runResult,
            );
          }
          return true;
        } else {
          updateNodeData(nodeId, {
            isRunning: false,
            runResult: status.error || "Task failed",
            inputBadge: "Failed",
          });
          if (tracker && nodeRunId) {
            await tracker.onNodeFinish(
              nodeRunId,
              false,
              duration,
              undefined,
              status.error || "Task failed",
            );
          }
          return false;
        }
      }

      if (
        status.status === "QUEUED" ||
        status.status === "WAITING" ||
        status.status === "PENDING_VERSION"
      ) {
        queuedPolls++;
        if (queuedPolls >= QUEUE_LIMIT) {
          const duration = Date.now() - startTime;
          const errMsg = `Task stuck in queue for ${QUEUE_LIMIT * 2}s. Make sure the worker is running.`;
          updateNodeData(nodeId, {
            isRunning: false,
            runResult: errMsg,
            inputBadge: "Failed",
          });
          if (tracker && nodeRunId) {
            await tracker.onNodeFinish(
              nodeRunId,
              false,
              duration,
              undefined,
              errMsg,
            );
          }
          return false;
        }
      } else {
        queuedPolls = 0;
      }
    }

    // Timed out
    const duration = Date.now() - startTime;
    const errMsg = "Task timed out after 6 minutes";
    updateNodeData(nodeId, {
      isRunning: false,
      runResult: errMsg,
      inputBadge: "Failed",
    });
    if (tracker && nodeRunId) {
      await tracker.onNodeFinish(nodeRunId, false, duration, undefined, errMsg);
    }
    return false;
  } catch (err: any) {
    const duration = Date.now() - startTime;
    updateNodeData(nodeId, {
      isRunning: false,
      runResult: err.message || "Unexpected error",
      inputBadge: "Failed",
    });
    if (tracker && nodeRunId) {
      await tracker.onNodeFinish(
        nodeRunId,
        false,
        duration,
        undefined,
        err.message || "Unexpected error",
      );
    }
    return false;
  }
}

/**
 * Execute the entire workflow using an ASAP DAG scheduler.
 *
 * Instead of grouping nodes into levels and waiting for each level to finish,
 * each node starts as soon as ALL of its specific dependencies are done.
 * Independent branches execute fully in parallel without blocking each other.
 *
 * Example: A→B→C and D→E run as two independent pipelines.
 * D→E doesn't wait for A→B to finish.
 */
export async function executeWorkflow(
  nodes: Node[],
  edges: Edge[],
  updateNodeData: UpdateNodeData,
  getLatestNodes: () => Node[],
  abortSignal?: AbortSignal,
  tracker?: RunTracker,
): Promise<{ success: boolean; error?: string; partial?: boolean }> {
  // 1. Validate DAG
  const cycleNodes = detectCycle(nodes, edges);
  if (cycleNodes) {
    return {
      success: false,
      error: `Workflow has a cycle involving ${cycleNodes.length} node(s). Remove circular connections to run.`,
    };
  }

  // 2. Build dependency graph for executable nodes only
  const executableIds = new Set(
    nodes
      .filter((n) => isExecutableNode(n) && hasInput(n, edges))
      .map((n) => n.id),
  );

  if (executableIds.size === 0) {
    return { success: false, error: "No executable nodes in the workflow." };
  }

  // deps: nodeId → set of executable node IDs it must wait for
  const deps = new Map<string, Set<string>>();
  // dependents: nodeId → set of executable node IDs that depend on it
  const dependents = new Map<string, Set<string>>();

  for (const id of executableIds) {
    deps.set(id, new Set());
    dependents.set(id, new Set());
  }

  for (const edge of edges) {
    if (executableIds.has(edge.source) && executableIds.has(edge.target)) {
      deps.get(edge.target)!.add(edge.source);
      dependents.get(edge.source)!.add(edge.target);
    }
  }

  // 3. ASAP scheduler — each node runs as soon as its deps finish
  const completed = new Set<string>();
  const failed = new Set<string>();

  return new Promise((resolve) => {
    let running = 0;
    // Nodes ready to execute (all deps satisfied)
    const ready: string[] = [...executableIds].filter(
      (id) => deps.get(id)!.size === 0,
    );

    function schedule() {
      // Check abort
      if (abortSignal?.aborted) {
        if (running === 0) {
          resolve({
            success: false,
            partial: completed.size > 0,
            error: "Workflow execution was stopped.",
          });
        }
        return;
      }

      // Launch all ready nodes
      while (ready.length > 0) {
        const nodeId = ready.shift()!;
        running++;

        executeNode(
          nodeId,
          getLatestNodes(),
          edges,
          updateNodeData,
          tracker,
        ).then((success) => {
          running--;

          if (success) {
            completed.add(nodeId);

            // Unlock dependents whose deps are now all satisfied
            for (const depId of dependents.get(nodeId) ?? []) {
              const depDeps = deps.get(depId)!;
              const allMet = [...depDeps].every((d) => completed.has(d));
              // Only schedule if all deps succeeded (skip if any dep failed)
              const anyFailed = [...depDeps].some((d) => failed.has(d));
              if (allMet && !anyFailed) {
                ready.push(depId);
              } else if (anyFailed) {
                // Propagate failure — don't run nodes whose deps failed
                failed.add(depId);
              }
            }
          } else {
            failed.add(nodeId);

            // Mark all downstream nodes as failed (they can't run)
            const markDownstream = (id: string) => {
              for (const depId of dependents.get(id) ?? []) {
                if (!failed.has(depId)) {
                  failed.add(depId);
                  markDownstream(depId);
                }
              }
            };
            markDownstream(nodeId);
          }

          // Check if we're done
          if (running === 0 && ready.length === 0) {
            if (failed.size > 0) {
              resolve({
                success: false,
                partial: completed.size > 0,
                error: `${failed.size} node(s) failed in execution. Check individual nodes for details.`,
              });
            } else {
              resolve({ success: true });
            }
          } else {
            schedule();
          }
        });
      }

      // If nothing is running and nothing is ready, we're done
      if (running === 0 && ready.length === 0) {
        if (failed.size > 0) {
          resolve({
            success: false,
            partial: completed.size > 0,
            error: `${failed.size} node(s) failed in execution. Check individual nodes for details.`,
          });
        } else {
          resolve({ success: true });
        }
      }
    }

    schedule();
  });
}
