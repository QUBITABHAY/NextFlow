import { Dispatch, SetStateAction } from "react";
import { PaletteItem } from "./types";
import { useFlowStore } from "@/store/useFlowStore";

export function SidePanel({
  collapsed,
  setCollapsed,
  query,
  setQuery,
  filteredPalette,
  addNode,
}: {
  collapsed: boolean;
  setCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  filteredPalette: PaletteItem[];
  addNode: (item: PaletteItem) => void;
}) {
  const theme = useFlowStore((state) => state.theme);
  const isLight = theme === "light";

  return (
    <div
      className={`h-full transition-all duration-300 ease-out overflow-hidden border-r ${isLight ? 'bg-white border-black/5' : 'bg-[#0b0d11]/95 border-white/5'} ${collapsed ? "w-0 opacity-0 border-transparent" : "w-[260px] opacity-100"}`}
    >
      <div className={`flex items-center justify-between px-4 py-3.5 text-[13px] border-b font-medium ${isLight ? 'text-black/80 border-black/5' : 'text-white/90 border-white/5'}`}>
        <span>Nodes</span>
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Collapse panel"
          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isLight ? 'border-black/10 bg-black/5 text-black/40 hover:bg-black/10' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
        >
          ×
        </button>
      </div>
      <div className="p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes"
          aria-label="Search nodes"
          className={`w-full h-8 rounded-lg border text-xs px-3 outline-none transition-colors shadow-inner ${isLight ? 'border-black/10 bg-black/5 text-black focus:border-black/20 focus:bg-white' : 'border-white/10 bg-white/5 text-white focus:border-white/20 focus:bg-white/10'}`}
        />
      </div>
      <div className="flex flex-col gap-1.5 px-3 pb-4">
        {filteredPalette.map((item) => (
          <button
            key={item.label}
            className={`h-[36px] rounded-lg border px-3 flex items-center justify-between text-xs cursor-pointer transition-all ${isLight ? 'border-black/5 bg-black/[0.02] text-black/60 hover:bg-black/5 hover:border-black/10 hover:text-black/90' : 'border-white/5 bg-white/[0.02] text-white/70 hover:bg-white/10 hover:border-white/10 hover:text-white/90'}`}
            onClick={() => addNode(item)}
          >
            <span>{item.label}</span>
            <span className={`text-[10px] uppercase tracking-wider font-medium ${isLight ? 'text-black/30' : 'text-white/30'}`}>
              Add
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
