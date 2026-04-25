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

// Max seconds a task can stay QUEUED / WAITING_FOR_DEPLOY before we bail
const QUEUE_TIMEOUT = 15;
const MAX_POLL = 120;

/**
 * Poll a Trigger.dev run until it completes, fails, or gets stuck in queue.
 */
async function pollRun(
  runId: string,
  label: string,
): Promise<{ success: boolean; runId: string; runResult?: string; error?: string }> {
  let queuedSeconds = 0;

  for (let i = 0; i < MAX_POLL; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const run = await runs.retrieve(runId);

    if (run.status === "COMPLETED") {
      const output = run.output as any;
      if (output?.success) {
        return { success: true, runId, runResult: output.result };
      }
      return {
        success: false,
        runId,
        error: output?.result ?? `${label} completed but produced no output`,
      };
    }

    if (TERMINAL_STATUSES.has(run.status)) {
      return {
        success: false,
        runId,
        error: `${label} ${run.status.toLowerCase()}. Check Trigger.dev dashboard.`,
      };
    }

    // Detect stuck queue — task hasn't started executing
    if (
      run.status === "WAITING" ||
      run.status === "DELAYED" ||
      run.status === "PENDING_VERSION"
    ) {
      queuedSeconds++;
      if (queuedSeconds >= QUEUE_TIMEOUT) {
        return {
          success: false,
          runId,
          error: `${label} stuck in queue for ${QUEUE_TIMEOUT}s. Make sure \`trigger dev\` is running.`,
        };
      }
    } else {
      // Task is executing / reattempting — reset queue counter
      queuedSeconds = 0;
    }
  }

  return {
    success: false,
    runId,
    error: `${label} timed out after 2 minutes.`,
  };
}

export async function triggerNodeAction(
  nodeId: string,
  nodeType: string,
  inputData?: any,
) {
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

      return pollRun(handle.id, "Crop task");
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

      return pollRun(handle.id, "Extract frame task");
    }

    // LLM Call → dedicated llm-call task
    if (nodeType === "LLM Call") {
      if (!inputData?.userMessage && !inputData?.prompt) {
        return {
          success: false,
          runId: "",
          error: "User message is required. Type a message or connect a Text node.",
        };
      }

      const handle = await tasks.trigger<typeof llmCall>("llm-call", {
        nodeId,
        systemPrompt: inputData?.systemPrompt || undefined,
        userMessage: inputData?.userMessage || inputData?.prompt || "",
        imageUrl: inputData?.media?.[0] || undefined,
        model: inputData?.selectedModel || "gemini-2.0-flash",
      });

      return pollRun(handle.id, "LLM call");
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

    return pollRun(handle.id, "Task");
  } catch (error: any) {
    console.error("Trigger error:", error);
    return { success: false, runId: "", runResult: undefined, error: error.message };
  }
}
