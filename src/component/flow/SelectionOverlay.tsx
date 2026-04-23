import { useStore, type ReactFlowState } from "@xyflow/react";

const selectionSelector = (s: ReactFlowState) => s.selectionRect;

export function SelectionOverlay() {
  const selectionRect = useStore(selectionSelector);

  if (!selectionRect || !selectionRect.width || !selectionRect.height) {
    return null;
  }

  const x = selectionRect.x;
  const y = selectionRect.y;

  return (
    <div
      className="absolute z-50 flex flex-col gap-1.5 pointer-events-none"
      style={{
        left: x + 12,
        top: y + 12,
      }}
    >
      <button className="h-[28px] px-2.5 rounded-lg bg-[#0066ff] text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-md pointer-events-auto hover:bg-[#0052cc] transition-all active:scale-95">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Run nodes
      </button>
      
      <button className="h-[28px] px-2.5 rounded-lg bg-white border border-black/5 text-black/70 text-[11px] font-medium flex items-center gap-1.5 shadow-sm pointer-events-auto hover:bg-black/5 transition-all active:scale-95">
        <span className="text-[14px] font-mono leading-none">( )</span>
        Group
      </button>

      <button className="h-[28px] px-2.5 rounded-lg bg-white border border-black/5 text-black/70 text-[11px] font-medium flex items-center gap-1.5 shadow-sm pointer-events-auto hover:bg-black/5 transition-all active:scale-95">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
        Tidy Up
      </button>
    </div>
  );
}
