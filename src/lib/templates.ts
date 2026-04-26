/** Hardcoded workflow templates with pre-built nodes and edges. */

type TemplateNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
};

type TemplateEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type: string;
  style: { stroke: string; strokeWidth: number };
};

export type WorkflowTemplate = {
  id: string;
  title: string;
  description: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
};

// ─── Template 1: Image Crop Pipeline ────────────────────────────────

const imageCropPipeline: WorkflowTemplate = {
  id: "tpl-image-crop",
  title: "Image Crop Pipeline",
  description: "Upload an image and crop it to a specific region.",
  nodes: [
    {
      id: "img-1",
      type: "mediaNode",
      position: { x: 0, y: 50 },
      data: { type: "image" },
    },
    {
      id: "crop-1",
      type: "workflowCard",
      position: { x: 450, y: 0 },
      data: {
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
      },
    },
  ],
  edges: [
    {
      id: "e-img1-crop1",
      source: "img-1",
      target: "crop-1",
      sourceHandle: "out-blue",
      targetHandle: "in-lower-blue",
      type: "customEdge",
      style: { stroke: "#1188ff", strokeWidth: 2 },
    },
  ],
};

// ─── Template 2: Video Frame Extractor ──────────────────────────────

const videoFrameExtractor: WorkflowTemplate = {
  id: "tpl-video-extract",
  title: "Video Frame Extractor",
  description: "Upload a video and extract a frame at a specific timestamp.",
  nodes: [
    {
      id: "vid-1",
      type: "mediaNode",
      position: { x: 0, y: 50 },
      data: { type: "video" },
    },
    {
      id: "extract-1",
      type: "workflowCard",
      position: { x: 450, y: 0 },
      data: {
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
      },
    },
  ],
  edges: [
    {
      id: "e-vid1-ext1",
      source: "vid-1",
      target: "extract-1",
      sourceHandle: "out-green",
      targetHandle: "in-lower-green",
      type: "customEdge",
      style: { stroke: "#22c55e", strokeWidth: 2 },
    },
  ],
};

// ─── Template 3: LLM Vision Chat ───────────────────────────────────

const llmVisionChat: WorkflowTemplate = {
  id: "tpl-llm-vision",
  title: "LLM Vision Chat",
  description:
    "Connect text prompts and an image to an LLM for vision-based responses.",
  nodes: [
    {
      id: "txt-sys-1",
      type: "textNode",
      position: { x: 0, y: 0 },
      data: { text: "" },
    },
    {
      id: "txt-usr-1",
      type: "textNode",
      position: { x: 0, y: 200 },
      data: { text: "" },
    },
    {
      id: "img-1",
      type: "mediaNode",
      position: { x: 0, y: 400 },
      data: { type: "image" },
    },
    {
      id: "llm-1",
      type: "llmNode",
      position: { x: 550, y: 100 },
      data: {
        systemPrompt: "",
        userMessage: "",
        selectedModel: "gemini-2.0-flash",
      },
    },
  ],
  edges: [
    {
      id: "e-sys1-llm1",
      source: "txt-sys-1",
      target: "llm-1",
      sourceHandle: "out-yellow",
      targetHandle: "in-yellow-system",
      type: "customEdge",
      style: { stroke: "#e3c92f", strokeWidth: 2 },
    },
    {
      id: "e-usr1-llm1",
      source: "txt-usr-1",
      target: "llm-1",
      sourceHandle: "out-yellow",
      targetHandle: "in-yellow-user",
      type: "customEdge",
      style: { stroke: "#e3c92f", strokeWidth: 2 },
    },
    {
      id: "e-img1-llm1",
      source: "img-1",
      target: "llm-1",
      sourceHandle: "out-blue",
      targetHandle: "in-blue",
      type: "customEdge",
      style: { stroke: "#1188ff", strokeWidth: 2 },
    },
  ],
};

// ─── Template 4: Full Pipeline ──────────────────────────────────────
//
//  Image → Crop ──┬───────────────→ LLM #1 (vision) ──→ LLM #2 (final)
//                 └─────────────────────────────────────→ LLM #2 (image)
//  Text (system1) ──→ LLM #1         ↑ user prompt        ↑ system
//  Text (user1) ────→ LLM #1         │                 Text (system2)
//                                     │                     ↑ image
//  Video → Extract Frame ─────────────────────────────→ LLM #2
//

const fullPipeline: WorkflowTemplate = {
  id: "tpl-full-pipeline",
  title: "Full Pipeline",
  description:
    "Image crop + video frame extraction feeding into chained LLM calls.",
  nodes: [
    // Row 1: Image → Crop
    {
      id: "img-1",
      type: "mediaNode",
      position: { x: 0, y: 50 },
      data: { type: "image" },
    },
    {
      id: "crop-1",
      type: "workflowCard",
      position: { x: 450, y: 0 },
      data: {
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
      },
    },
    // Row 2: Text inputs for LLM #1
    {
      id: "txt-sys-1",
      type: "textNode",
      position: { x: 450, y: 500 },
      data: { text: "" },
    },
    {
      id: "txt-usr-1",
      type: "textNode",
      position: { x: 450, y: 680 },
      data: { text: "" },
    },
    // LLM #1 — receives crop output as image, text inputs
    {
      id: "llm-1",
      type: "llmNode",
      position: { x: 900, y: 350 },
      data: {
        systemPrompt: "",
        userMessage: "",
        selectedModel: "gemini-2.0-flash",
      },
    },
    // Row 3: Video → Extract Frame
    {
      id: "vid-1",
      type: "mediaNode",
      position: { x: 0, y: 850 },
      data: { type: "video" },
    },
    {
      id: "extract-1",
      type: "workflowCard",
      position: { x: 450, y: 800 },
      data: {
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
      },
    },
    // System prompt text for LLM #2
    {
      id: "txt-sys-2",
      type: "textNode",
      position: { x: 900, y: 850 },
      data: { text: "" },
    },
    // LLM #2 — receives LLM#1 output as user prompt, text as system, extract frame as image
    {
      id: "llm-2",
      type: "llmNode",
      position: { x: 1400, y: 650 },
      data: {
        systemPrompt: "",
        userMessage: "",
        selectedModel: "gemini-2.0-flash",
      },
    },
  ],
  edges: [
    // Image → Crop
    {
      id: "e-img1-crop1",
      source: "img-1",
      target: "crop-1",
      sourceHandle: "out-blue",
      targetHandle: "in-lower-blue",
      type: "customEdge",
      style: { stroke: "#1188ff", strokeWidth: 2 },
    },
    // Crop output → LLM #1 image input
    {
      id: "e-crop1-llm1",
      source: "crop-1",
      target: "llm-1",
      sourceHandle: "out-main-blue",
      targetHandle: "in-blue",
      type: "customEdge",
      style: { stroke: "#1188ff", strokeWidth: 2 },
    },
    // Text system → LLM #1
    {
      id: "e-sys1-llm1",
      source: "txt-sys-1",
      target: "llm-1",
      sourceHandle: "out-yellow",
      targetHandle: "in-yellow-system",
      type: "customEdge",
      style: { stroke: "#e3c92f", strokeWidth: 2 },
    },
    // Text user → LLM #1
    {
      id: "e-usr1-llm1",
      source: "txt-usr-1",
      target: "llm-1",
      sourceHandle: "out-yellow",
      targetHandle: "in-yellow-user",
      type: "customEdge",
      style: { stroke: "#e3c92f", strokeWidth: 2 },
    },
    // Video → Extract Frame
    {
      id: "e-vid1-ext1",
      source: "vid-1",
      target: "extract-1",
      sourceHandle: "out-green",
      targetHandle: "in-lower-green",
      type: "customEdge",
      style: { stroke: "#22c55e", strokeWidth: 2 },
    },
    // Crop output → LLM #2 image input (second image)
    {
      id: "e-crop1-llm2",
      source: "crop-1",
      target: "llm-2",
      sourceHandle: "out-main-blue",
      targetHandle: "in-blue",
      type: "customEdge",
      style: { stroke: "#1188ff", strokeWidth: 2 },
    },
    // Extract Frame output → LLM #2 image input
    {
      id: "e-ext1-llm2",
      source: "extract-1",
      target: "llm-2",
      sourceHandle: "out-main-blue",
      targetHandle: "in-blue",
      type: "customEdge",
      style: { stroke: "#1188ff", strokeWidth: 2 },
    },
    // LLM #1 output → LLM #2 user prompt
    {
      id: "e-llm1-llm2",
      source: "llm-1",
      target: "llm-2",
      sourceHandle: "out-yellow",
      targetHandle: "in-yellow-user",
      type: "customEdge",
      style: { stroke: "#e3c92f", strokeWidth: 2 },
    },
    // Text system → LLM #2
    {
      id: "e-sys2-llm2",
      source: "txt-sys-2",
      target: "llm-2",
      sourceHandle: "out-yellow",
      targetHandle: "in-yellow-system",
      type: "customEdge",
      style: { stroke: "#e3c92f", strokeWidth: 2 },
    },
  ],
};

// ─── Export all templates ───────────────────────────────────────────

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  imageCropPipeline,
  videoFrameExtractor,
  llmVisionChat,
  fullPipeline,
];
