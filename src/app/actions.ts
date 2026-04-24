"use server";

import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { executeNodeAction } from "@/trigger/nodeAction";
import type { cropImage } from "@/trigger/cropImage";

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

      // Poll for completion
      const maxAttempts = 120;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 1000));

        const run = await runs.retrieve(handle.id);

        if (run.status === "COMPLETED") {
          const output = run.output as any;
          if (output?.success) {
            return {
              success: true,
              runId: handle.id,
              runResult: output.result,
            };
          }
          return {
            success: false,
            error: output?.result ?? "Crop completed but no output",
          };
        }

        if (
          run.status === "FAILED" ||
          run.status === "CRASHED" ||
          run.status === "CANCELED" ||
          run.status === "SYSTEM_FAILURE" ||
          run.status === "TIMED_OUT"
        ) {
          return {
            success: false,
            error: `Crop task ${run.status.toLowerCase()}. Check Trigger.dev dashboard.`,
          };
        }
      }

      return {
        success: false,
        error: "Crop task timed out after 2 minutes.",
      };
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

    return { success: true, runId: handle.id, runResult: "Task queued" };
  } catch (error: any) {
    console.error("Trigger error:", error);
    return { success: false, error: error.message };
  }
}
