import { useFlowStore } from "@/store/useFlowStore";
import {
  createWorkflowRun,
  createNodeRun,
  finishNodeRun,
  finishWorkflowRun,
} from "@/app/runActions";

export function useNodeRunRecorder() {
  const workflowId = useFlowStore((state) => state.workflowId);

  async function recordSingleNodeRun(
    nodeId: string,
    nodeType: string,
    nodeLabel: string,
    input: string,
    executeFn: () => Promise<{
      success: boolean;
      output?: string;
      error?: string;
    }>,
  ) {
    if (!workflowId) {
      return executeFn();
    }

    let runId: string | undefined;
    let nodeRunId: string | undefined;
    const startTime = Date.now();

    try {
      runId = await createWorkflowRun(workflowId, "single");
      nodeRunId = await createNodeRun(
        runId,
        nodeId,
        nodeType,
        nodeLabel,
        input,
      );
    } catch (e) {
      console.error("[NextFlow] Failed to create run record:", e);
    }

    const result = await executeFn();
    const duration = Date.now() - startTime;

    if (nodeRunId) {
      try {
        await finishNodeRun(
          nodeRunId,
          result.success ? "success" : "failed",
          duration,
          result.output,
          result.error,
        );
      } catch (e) {
        console.error("[NextFlow] Failed to finish node run:", e);
      }
    }

    if (runId) {
      try {
        await finishWorkflowRun(
          runId,
          result.success ? "success" : "failed",
          duration,
          result.error,
        );
      } catch (e) {
        console.error("[NextFlow] Failed to finish workflow run:", e);
      }
    }

    return result;
  }

  return { recordSingleNodeRun };
}
