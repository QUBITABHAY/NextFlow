import { type Node, type NodeProps } from "@xyflow/react";
import { useFlowStore } from "@/store/useFlowStore";
import { useTheme } from "@/hooks/useTheme";

const GROUP_COLORS = [
  "#c9a0dc", // lavender
  "#e8c86a", // gold
  "#7da7d9", // periwinkle
  "#c5cc8e", // sage
  "#6db5a0", // teal
  "#9b89b3", // mauve
  "#d9908a", // rose
  "#b8a0c8", // lilac
];

export type GroupNodeData = {
  label: string;
  color: string;
  width: number;
  height: number;
};

export function GroupNode({
  id,
  data,
  selected,
}: NodeProps<Node<GroupNodeData>>) {
  const { isLight } = useTheme();
  const color = data.color || "#a855f7";

  const runGroupNodes = useFlowStore((s) => s.runGroupNodes);
  const ungroupNode = useFlowStore((s) => s.ungroupNode);
  const changeGroupColor = useFlowStore((s) => s.changeGroupColor);
  const isWorkflowRunning = useFlowStore((s) => s.isWorkflowRunning);
  const stopWorkflow = useFlowStore((s) => s.stopWorkflow);

  return (
    <div
      className="rounded-xl transition-all relative"
      style={{
        width: data.width,
        height: data.height,
        backgroundColor: isLight ? `${color}08` : `${color}0a`,
        border: `1.5px solid ${color}${selected ? "60" : "30"}`,
        minWidth: 100,
        minHeight: 60,
      }}
    >
      {/* Group label */}
      <div
        className="absolute font-medium text-[13px] tracking-wide"
        style={{ top: -24, left: 12, color: `${color}99` }}
      >
        {data.label || "Group"}
      </div>

      {/* Action buttons — visible when selected */}
      {selected && (
        <div
          className="absolute flex flex-col items-end gap-1.5"
          style={{
            top: -8,
            right: `calc(100% + 10px)`,
          }}
        >
          {/* Run / Stop Group */}
          {isWorkflowRunning ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                stopWorkflow();
              }}
              className="h-[32px] px-3.5 rounded-lg bg-red-500/90 text-white text-[13px] font-semibold flex items-center gap-2 shadow-lg hover:bg-red-600 transition-all active:scale-95 whitespace-nowrap"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                runGroupNodes(id);
              }}
              className="h-[32px] px-3.5 rounded-lg bg-[#0066ff] text-white text-[13px] font-semibold flex items-center gap-2 shadow-lg hover:bg-[#0052cc] transition-all active:scale-95 whitespace-nowrap"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Run Group
            </button>
          )}

          {/* Ungroup */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              ungroupNode(id);
            }}
            className={`h-[32px] px-3.5 rounded-lg border text-[13px] font-medium flex items-center gap-2 shadow-sm transition-all active:scale-95 whitespace-nowrap ${
              isLight
                ? "bg-white border-black/10 text-black/70 hover:bg-black/5"
                : "bg-[#1a1a1a] border-white/10 text-white/70 hover:bg-white/10"
            }`}
          >
            Ungroup
          </button>

          {/* Color dots */}
          {GROUP_COLORS.map((c) => (
            <button
              key={c}
              onClick={(e) => {
                e.stopPropagation();
                changeGroupColor(id, c);
              }}
              className="w-[28px] h-[28px] rounded-full transition-all hover:scale-110 active:scale-95 flex-shrink-0"
              style={{
                backgroundColor: c,
                opacity: 0.7,
                boxShadow:
                  color === c
                    ? `0 0 0 2.5px ${isLight ? "#fff" : "#1a1a1a"}, 0 0 0 4.5px ${c}`
                    : "none",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
