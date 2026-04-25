import { Dispatch, SetStateAction, useState, useEffect } from "react";
import { PaletteItem } from "./types";
import { useTheme } from "@/hooks/useTheme";

export function SidePanel({
  collapsed,
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
  const { isLight } = useTheme();
  const [recentNodes, setRecentNodes] = useState<PaletteItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("nextflow-recent-nodes");
      if (stored) {
        setRecentNodes(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const handleAddNode = (item: PaletteItem) => {
    addNode(item);
    const newRecent = [
      item,
      ...recentNodes.filter((n) => n.label !== item.label),
    ].slice(0, 3);
    setRecentNodes(newRecent);
    localStorage.setItem("nextflow-recent-nodes", JSON.stringify(newRecent));
  };

  const getIconForModel = (model: string) => {
    if (model.includes("Image")) {
      return (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    }
    if (model.includes("Video") || model === "Extract Frame") {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5l5.5 4.125A.5.5 0 0 0 22 18V6a.5.5 0 0 0-.8-.4L16 9.5V8a2 2 0 0 0-2-2H4z" />
        </svg>
      );
    }
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19V5a2 2 0 0 1 2-2h13.4a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-1.5 1.5H6a2 2 0 0 1-2-2z" />
        <path d="M4 19h15" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
      </svg>
    );
  };

  const categorized = [
    {
      title: "Text & Logic",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      ),
      items: filteredPalette.filter((i) => i.model === "Text"),
    },
    {
      title: "Image",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
      items: filteredPalette.filter((i) => i.model.includes("Image")),
    },
    {
      title: "Video",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5l5.5 4.125A.5.5 0 0 0 22 18V6a.5.5 0 0 0-.8-.4L16 9.5V8a2 2 0 0 0-2-2H4z" />
        </svg>
      ),
      items: filteredPalette.filter(
        (i) => i.model.includes("Video") || i.model === "Extract Frame",
      ),
    },
  ].filter((c) => c.items.length > 0);

  return (
    <div
      className={`h-[90%] my-auto ml-4 rounded-[20px] transition-all duration-300 ease-out overflow-hidden border shadow-2xl flex flex-col ${collapsed ? "w-0 opacity-0 border-transparent ml-0" : "w-[280px] opacity-100"} ${isLight ? "bg-white border-black/5" : "bg-[#0e0e0e] border-[#262626]"}`}
    >
      {/* Search Input */}
      <div className="flex items-center px-4 h-[52px] shrink-0">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#8a8a8a] shrink-0"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes or models..."
          className={`w-full h-full bg-transparent border-none outline-none text-[15px] px-3 placeholder:text-[#8a8a8a] ${isLight ? "text-black" : "text-[#ededed]"}`}
        />
      </div>

      <div className="overflow-y-auto pb-4 custom-scrollbar">
        {/* Recent Section */}
        {!query && recentNodes.length > 0 && (
          <div className="mt-2 mb-1">
            <div className="flex items-center gap-2 px-4 py-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#8a8a8a]"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-[#8a8a8a] text-[13px] font-medium tracking-wide">
                Recent
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {recentNodes.map((item, idx) => (
                <div
                  key={`recent-${item.label}-${idx}`}
                  onClick={() => handleAddNode(item)}
                  className={`flex items-center justify-between px-3 h-[40px] mx-2 rounded-lg cursor-pointer text-[14px] transition-colors ${isLight ? "text-black hover:bg-black/5" : "text-[#ededed] hover:bg-[#262626]"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[#8a8a8a]">
                      {getIconForModel(item.model)}
                    </span>
                    <span className="font-medium tracking-wide">
                      {item.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        {categorized.map((category) => (
          <div key={category.title} className="mt-4 mb-1">
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-[#8a8a8a]">{category.icon}</span>
              <span className="text-[#8a8a8a] text-[13px] font-medium tracking-wide">
                {category.title}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {category.items.map((item) => (
                <div
                  key={item.label}
                  onClick={() => handleAddNode(item)}
                  className={`flex items-center justify-between px-4 h-[40px] mx-2 rounded-[10px] cursor-pointer text-[14px] font-medium tracking-wide transition-colors ${isLight ? "text-black hover:bg-black/5" : "text-[#ededed] hover:bg-[#262626]"}`}
                >
                  <span>{item.label}</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[#8a8a8a]"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredPalette.length === 0 && (
          <div className="px-4 py-8 text-center text-[#8a8a8a] text-[13px]">
            No nodes found
          </div>
        )}
      </div>
    </div>
  );
}
