"use server";

import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { executeNodeAction } from "@/trigger/nodeAction";
import type { cropImage } from "@/trigger/cropImage";
import type { extractFrame } from "@/trigger/extractFrame";
import type { llmCall } from "@/trigger/llmCall";

const TERMINAL_STATUSES = new Set([
  "FAILED",
  "CRASHED",
  "CANCELED",
  "SYSTEM_FAILURE",
  "TIMED_OUT",
  "EXPIRED",
]);

/**
 * Check the status of a Trigger.dev run once (single poll).
 * Called repeatedly from the client side to avoid server action timeouts.
 */
export async function pollRunStatus(
  runId: string,
  label: string,
): Promise<{
  done: boolean;
  success: boolean;
  runId: string;
  runResult?: string;
  error?: string;
  status?: string;
}> {
  try {
    const run = await runs.retrieve(runId);

    if (run.status === "COMPLETED") {
      const output = run.output as any;
      if (output?.success) {
        return { done: true, success: true, runId, runResult: output.result };
      }
      return {
        done: true,
        success: false,
        runId,
        error: output?.result ?? `${label} completed but produced no output`,
      };
    }

    if (TERMINAL_STATUSES.has(run.status)) {
      return {
        done: true,
        success: false,
        runId,
        error: `${label} ${run.status.toLowerCase()}. Check Trigger.dev dashboard.`,
      };
    }

    // Still running / queued
    return { done: false, success: false, runId, status: run.status };
  } catch (error: any) {
    return {
      done: true,
      success: false,
      runId,
      error: `Failed to check run status: ${error.message}`,
    };
  }
}

/**
 * Cancel a running task.
 */
export async function cancelRun(
  runId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const run = await runs.retrieve(runId);
    if (!TERMINAL_STATUSES.has(run.status) && run.status !== "COMPLETED") {
      await runs.cancel(runId);
    }
    return { success: true };
  } catch (error: any) {
    console.error("Failed to cancel run:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Trigger a task and return the run handle immediately.
 * Does NOT poll — the caller is responsible for polling via pollRunStatus.
 */
export async function triggerNodeAction(
  nodeId: string,
  nodeType: string,
  inputData?: any,
): Promise<{ success: boolean; runId: string; error?: string }> {
  try {
    const hasTriggerConfig =
      process.env.TRIGGER_SECRET_KEY &&
      process.env.TRIGGER_SECRET_KEY.length > 0;

    if (!hasTriggerConfig) {
      console.warn("No TRIGGER_SECRET_KEY found");
      return {
        success: false,
        runId: "",
        error:
          "TRIGGER_SECRET_KEY is not configured. Add it to .env.local to run tasks.",
      };
    }

    // Crop Image → dedicated crop-image task
    if (nodeType === "Crop Image") {
      const imageUrl = inputData?.media?.[0];
      if (!imageUrl) {
        return {
          success: false,
          runId: "",
          error: "No image input connected. Connect an Image Input node.",
        };
      }

      const handle = await tasks.trigger<typeof cropImage>("crop-image", {
        nodeId,
        imageUrl,
        cropX: inputData?.cropX ?? 0,
        cropY: inputData?.cropY ?? 0,
        cropWidth: inputData?.cropWidth ?? 100,
        cropHeight: inputData?.cropHeight ?? 100,
      });

      return { success: true, runId: handle.id };
    }

    // Extract Frame → dedicated extract-frame task
    if (nodeType === "Extract Frame") {
      const videoUrl = inputData?.media?.[0];
      if (!videoUrl) {
        return {
          success: false,
          runId: "",
          error:
            "No video input connected. Connect a Video Input node or upload a video.",
        };
      }

      const handle = await tasks.trigger<typeof extractFrame>("extract-frame", {
        nodeId,
        videoUrl,
        frameTimestamp: inputData?.frameTimestamp ?? 0,
        frameTimestampMode: inputData?.frameTimestampMode ?? "seconds",
      });

      return { success: true, runId: handle.id };
    }

    // LLM Call → dedicated llm-call task
    if (nodeType === "LLM Call") {
      if (!inputData?.userMessage && !inputData?.prompt) {
        return {
          success: false,
          runId: "",
          error:
            "User message is required. Type a message or connect a Text node.",
        };
      }

      const mediaList: string[] = inputData?.media ?? [];
      const handle = await tasks.trigger<typeof llmCall>("llm-call", {
        nodeId,
        systemPrompt: inputData?.systemPrompt || undefined,
        userMessage: inputData?.userMessage || inputData?.prompt || "",
        imageUrls: mediaList.length > 0 ? mediaList : undefined,
        model: inputData?.selectedModel ?? "",
      });

      return { success: true, runId: handle.id };
    }

    // All other nodes → generic execute-node-action task
    const handle = await tasks.trigger<typeof executeNodeAction>(
      "execute-node-action",
      {
        nodeId,
        nodeType,
        inputData,
      },
    );

    return { success: true, runId: handle.id };
  } catch (error: any) {
    console.error("Trigger error:", error);
    return { success: false, runId: "", error: error.message };
  }
}
