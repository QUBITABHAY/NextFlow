export type WorkflowNodeData = {
  title: string;
  gpu: string;
  model: string;
  prompt: string;
  placeholder: string;
  lowerLeft: string;
  lowerRight: string;
  rightLabel: string;
  inputBadge?: string;
  isRunning?: boolean;
  runResult?: string | null;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
};

export type PaletteItem = {
  label: string;
  model: string;
};
