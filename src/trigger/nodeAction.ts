import { logger, task, wait } from "@trigger.dev/sdk/v3";

export const executeNodeAction = task({
  id: "execute-node-action",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: {
    nodeId: string;
    nodeType: string;
    inputData?: any;
  }) => {
    logger.info("Trigger.dev executing node action", { nodeId: payload.nodeId, nodeType: payload.nodeType });

    // Step 1: Validating input
    logger.info("Validating input data...", { inputData: payload.inputData });
    await wait.for({ seconds: 1 });
    
    if (!payload.inputData?.prompt && !payload.inputData?.media?.length && payload.nodeType !== "WorkflowNode") {
      logger.warn("No prompt or media provided, using default fallback");
    }

    // Step 2: Processing based on node type
    logger.info(`Starting generation for ${payload.nodeType} model`);
    
    // Simulate real AI workload
    await wait.for({ seconds: 3 });
    
    let resultData = `Processed ${payload.nodeType}`;
    
    if (payload.nodeType.toLowerCase().includes("image") || payload.nodeType.toLowerCase().includes("krea")) {
      // Mock generated image
      resultData = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";
    } else if (payload.nodeType.toLowerCase().includes("text") || payload.inputData?.prompt) {
      resultData = `Generated response for: "${payload.inputData?.prompt || 'default workflow input'}"`;
    }

    logger.info("Task completed successfully", { resultData });

    return {
      success: true,
      result: resultData,
      timestamp: new Date().toISOString(),
    };
  },
});
