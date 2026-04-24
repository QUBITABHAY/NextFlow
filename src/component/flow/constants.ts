import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { PaletteItem, WorkflowNodeData } from "./types";

export const HANDLE_COLORS = {
  yellow: "#e3c92f",
  blue: "#1188ff",
  green: "#22c55e",
} as const;

export function getStrokeColor(handleId: string | null | undefined): string {
  if (handleId?.includes("yellow")) return HANDLE_COLORS.yellow;
  if (handleId?.includes("green")) return HANDLE_COLORS.green;
  return HANDLE_COLORS.blue;
}

export function isSameColorFamily(
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined,
): boolean {
  for (const color of Object.keys(HANDLE_COLORS)) {
    if (sourceHandle?.includes(color) && targetHandle?.includes(color))
      return true;
  }
  return false;
}

export const paletteItems: PaletteItem[] = [
  { label: "Text Node", model: "Text" },
  { label: "Image Input", model: "Image" },
  { label: "Video Input", model: "Video" },
  { label: "Crop Image", model: "Crop Image" },
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
    id: "crop-image-1",
    type: "workflowCard",
    position: { x: 400, y: 116 },
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
];

export const initialEdges: Edge[] = [];
