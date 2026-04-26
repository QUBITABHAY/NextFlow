import { logger, task } from "@trigger.dev/sdk/v3";
import { GoogleGenAI } from "@google/genai";

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number];

export const llmCall = task({
  id: "llm-call",
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: {
    nodeId: string;
    systemPrompt?: string;
    userMessage: string;
    imageUrl?: string;
    imageUrls?: string[];
    model: string;
  }) => {
    // Merge single imageUrl into imageUrls for backwards compat
    const allImageUrls = [
      ...(payload.imageUrls ?? []),
      ...(payload.imageUrl && !payload.imageUrls?.includes(payload.imageUrl)
        ? [payload.imageUrl]
        : []),
    ];

    logger.info("Starting LLM call", {
      nodeId: payload.nodeId,
      model: payload.model,
      hasSystemPrompt: !!payload.systemPrompt,
      imageCount: allImageUrls.length,
    });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        result: "GEMINI_API_KEY is not configured. Add it to .env.local.",
        timestamp: new Date().toISOString(),
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelId = GEMINI_MODELS.includes(payload.model as GeminiModel)
      ? payload.model
      : "gemini-2.0-flash";

    try {
      // Build content parts
      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [];

      // Add all images
      for (const imageUrl of allImageUrls) {
        logger.info("Processing image input...", { imageUrl: imageUrl.slice(0, 60) });
        let base64Data: string;
        let mimeType: string;

        if (imageUrl.startsWith("data:")) {
          const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          } else {
            throw new Error("Invalid data URL format for image");
          }
        } else {
          const res = await fetch(imageUrl);
          if (!res.ok)
            throw new Error(`Failed to fetch image: HTTP ${res.status}`);
          const buffer = Buffer.from(await res.arrayBuffer());
          base64Data = buffer.toString("base64");
          mimeType = res.headers.get("content-type") || "image/jpeg";
        }

        parts.push({
          inlineData: { mimeType, data: base64Data },
        });
      }

      // Add user message
      parts.push({ text: payload.userMessage });

      logger.info("Calling Gemini API", { model: modelId });

      const response = await ai.models.generateContent({
        model: modelId,
        contents: [{ role: "user", parts }],
        config: payload.systemPrompt
          ? { systemInstruction: payload.systemPrompt }
          : undefined,
      });

      const text = response.text ?? "No response generated.";

      logger.info("LLM call completed", {
        responseLength: text.length,
      });

      return {
        success: true,
        result: text,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error("LLM call failed", { error: error.message });
      return {
        success: false,
        result: `LLM call failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  },
});
