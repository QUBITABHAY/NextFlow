import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useFlowStore } from "@/store/useFlowStore";
import { useTheme } from "@/hooks/useTheme";

export type TextNodeData = {
  text: string;
};

export function TextNode({
  id,
  data,
  selected,
}: NodeProps<Node<TextNodeData>>) {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const { isLight } = useTheme();

  return (
    <div className="relative font-[var(--font-space-grotesk)]">
      {/* Floating Top Label */}
      <div className="absolute -top-[28px] left-3 flex items-center gap-2">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#e3c92f"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
        <span className={`${isLight ? 'text-black/50' : 'text-white/40'} text-[15px] font-medium tracking-wide`}>
          Text
        </span>
      </div>

      {/* Main Card */}
      <div
        className={`w-[320px] rounded-2xl transition-all box-border border-2 p-4 ${isLight ? 'bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-black/5' : 'bg-[#1c1e24] shadow-2xl border-white/0'}`}
        style={{ borderColor: selected ? "#e3c92f" : (isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.0)") }}
      >
        <Handle
          type="target"
          id="in-yellow"
          position={Position.Left}
          className="!w-4 !h-4 !border-none transition-all duration-300 !z-50"
          style={{ 
            top: "26px", 
            left: "0px", 
            backgroundColor: "#e3c92f", 
            boxShadow: `0 0 0 6px rgba(227, 201, 47, 0.4)`
          }}
        />
        <Handle
          type="source"
          id="out-yellow"
          position={Position.Right}
          className="!w-4 !h-4 !border-none transition-all duration-300 !z-50"
          style={{ 
            top: "26px", 
            right: "0px", 
            backgroundColor: "#e3c92f", 
            boxShadow: `0 0 0 6px rgba(227, 201, 47, 0.4)`
          }}
        />

        {/* Header row: Input, Output */}
        <div className={`flex justify-between items-center text-[13px] font-medium mb-4 px-1 ${isLight ? 'text-black/30' : 'text-white/40'}`}>
          <span>Input</span>
          <span>Output</span>
        </div>

        {/* Toolbar row */}
        <div className="flex items-center gap-4 mb-4 px-1">
          <button className={`${isLight ? 'text-black/30 hover:text-black/60' : 'text-white/20 hover:text-white/50'} transition-colors`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4h12" />
              <path d="M6 20h12" />
              <path d="M12 4v16" />
            </svg>
          </button>
          <button className={`${isLight ? 'text-black/30 hover:text-black/60' : 'text-white/20 hover:text-white/50'} transition-colors`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button className={`${isLight ? 'text-black/30 hover:text-black/60' : 'text-white/20 hover:text-white/50'} transition-colors`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>

        {/* Text Area */}
        <textarea
          className={`w-full h-[120px] rounded-xl border leading-relaxed p-4 text-[15px] outline-none transition-all shadow-inner ${isLight ? 'bg-[#f9fafb] border-black/5 text-black/80 focus:bg-white focus:border-black/10' : 'bg-black/30 border-white/5 text-white/90 focus:bg-black/40 focus:border-white/20'}`}
          value={data.text}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          placeholder="Enter prompt text..."
        />
      </div>
    </div>
  );
}
