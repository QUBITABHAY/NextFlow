import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { PaletteItem, WorkflowNodeData } from "./types";

export const paletteItems: PaletteItem[] = [
  { label: "Text Node", model: "Text" },
  { label: "Image Input", model: "Image" },
  { label: "Video Input", model: "Video" },
  { label: "Image Generator", model: "Krea 1" },
  { label: "Image Editor", model: "Flux 2 Klein" },
  { label: "Video Generator", model: "Krea Video" },
  { label: "Prompt Remix", model: "Remix V2" },
  { label: "Upscale", model: "Sharp 4x" },
];

export const initialNodes: Node[] = [
  {
    id: "text-1",
    type: "textNode",
    position: { x: 50, y: 150 },
    data: {
      text: "",
    },
  },
  {
    id: "media-image",
    type: "mediaNode",
    position: { x: 50, y: 350 },
    data: {
      type: "image",
    },
  },
  {
    id: "media-video",
    type: "mediaNode",
    position: { x: 50, y: 600 },
    data: {
      type: "video",
    },
  },
  {
    id: "krea-1",
    type: "workflowCard",
    position: { x: 400, y: 116 },
    data: {
      title: "Krea 1",
      gpu: "6 CU",
      model: "Krea 1",
      prompt: "A beautiful sunset over a calm ocean",
      placeholder: "Enter prompt",
      lowerLeft: "Image",
      lowerRight: "Result",
      rightLabel: "Image",
    },
  },
  {
    id: "flux-2-klein",
    type: "workflowCard",
    position: { x: 750, y: 130 },
    data: {
      title: "Flux 2 Klein",
      gpu: "",
      model: "Flux 2 Klein",
      prompt: "",
      placeholder: "Describe the edit you want",
      lowerLeft: "Base Image",
      lowerRight: "Receiving input",
      rightLabel: "Result",
      inputBadge: "Receiving input",
    },
  },
];

export const initialEdges: Edge[] = [
  {
    id: "e-krea-flux",
    source: "krea-1",
    sourceHandle: "out-main-blue",
    target: "flux-2-klein",
    targetHandle: "in-lower-blue",
    type: "customEdge",
    style: {
      stroke: "#1188ff",
      strokeWidth: 2,
    },
  },
];
