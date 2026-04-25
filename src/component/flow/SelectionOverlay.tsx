import { useNodes, useStore, useViewport, type ReactFlowState } from "@xyflow/react";
import { useFlowStore } from "@/store/useFlowStore";
import { useTheme } from "@/hooks/useTheme";

const PAD = 30;
const LABEL_OVERHANG = 28;
const BTN_GAP = 8;

const selectingSelector = (s: ReactFlowState) =>
  s.userSelectionActive || !!s.userSelectionRect;

export function SelectionOverlay() {
  const nodes = useNodes();
  const { x: vx, y: vy, zoom } = useViewport();
  const { isLight } = useTheme();
  const isSelecting = useStore(selectingSelector);

  const runSelectedNodes = useFlowStore((s) => s.runSelectedNodes);
  const tidyUpSelectedNodes = useFlowStore((s) => s.tidyUpSelectedNodes);
  const groupSelectedNodes = useFlowStore((s) => s.groupSelectedNodes);
  const isWorkflowRunning = useFlowStore((s) => s.isWorkflowRunning);
  const stopWorkflow = useFlowStore((s) => s.stopWorkflow);

  const selected = nodes.filter((n) => n.selected);

  // Hide while user is actively drag-selecting — only show after release
  if (selected.length < 2 || isSelecting) return null;

  // Bounding box in flow coords
  let fMinX = Infinity,
    fMinY = Infinity,
    fMaxX = -Infinity,
    fMaxY = -Infinity;

  for (const n of selected) {
    const w = n.measured?.width ?? (n.width as number) ?? 200;
    const h = n.measured?.height ?? (n.height as number) ?? 100;
    fMinX = Math.min(fMinX, n.position.x);
    fMinY = Math.min(fMinY, n.position.y - LABEL_OVERHANG);
    fMaxX = Math.max(fMaxX, n.position.x + w);
    fMaxY = Math.max(fMaxY, n.position.y + h);
  }

  // Pad in flow coords
  fMinX -= PAD / zoom;
  fMinY -= PAD / zoom;
  fMaxX += PAD / zoom;
  fMaxY += PAD / zoom;

  // Convert to screen px
  const sx = fMinX * zoom + vx;
  const sy = fMinY * zoom + vy;
  const sw = (fMaxX - fMinX) * zoom;
  const sh = (fMaxY - fMinY) * zoom;

  const stroke = "#4a9eff";

  const secondaryBtn = `h-[30px] px-3 rounded-lg border text-[12px] font-medium flex items-center gap-2 shadow-sm pointer-events-auto transition-all active:scale-95 whitespace-nowrap ${
    isLight
      ? "bg-white border-black/10 text-black/70 hover:bg-black/5"
      : "bg-[#1a1a1a] border-white/10 text-white/70 hover:bg-white/10"
  }`;

  return (
    <>
      {/* Dashed marching-ants border */}
      <svg
        className="absolute pointer-events-none"
        style={{ left: sx, top: sy, width: sw, height: sh, zIndex: 5 }}
      >
        <rect
          x="1"
          y="1"
          width={Math.max(0, sw - 2)}
          height={Math.max(0, sh - 2)}
          rx="12"
          ry="12"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeDasharray="8 8"
          style={{ animation: "svg-march 0.6s linear infinite" }}
        />
      </svg>

      {/* Buttons — top-left, outside the box */}
      <div
        className="absolute flex flex-col gap-1.5 pointer-events-none"
        style={{
          left: sx - BTN_GAP,
          top: sy - BTN_GAP,
          transform: "translate(-100%, 0)",
          zIndex: 50,
        }}
      >
        {/* Run / Stop selected nodes */}
        {isWorkflowRunning ? (
          <button
            onClick={stopWorkflow}
            className="h-[30px] px-3 rounded-lg bg-red-500/90 text-white text-[12px] font-semibold flex items-center gap-2 shadow-md pointer-events-auto hover:bg-red-600 transition-all active:scale-95 whitespace-nowrap"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stop
          </button>
        ) : (
          <button
            onClick={() => runSelectedNodes()}
            className="h-[30px] px-3 rounded-lg bg-[#0066ff] text-white text-[12px] font-semibold flex items-center gap-2 shadow-md pointer-events-auto hover:bg-[#0052cc] transition-all active:scale-95 whitespace-nowrap"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run nodes
          </button>
        )}

        {/* Group — wrap selected nodes in a group container */}
        <button
          className={secondaryBtn}
          onClick={groupSelectedNodes}
        >
          <span className="text-[14px] font-mono leading-none">{`{ }`}</span>
          Group
        </button>

        {/* Tidy Up — auto-arrange selected nodes */}
        <button className={secondaryBtn} onClick={tidyUpSelectedNodes}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          Tidy Up
        </button>
      </div>
    </>
  );
}
