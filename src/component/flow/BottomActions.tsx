import { useState, useRef, useEffect, useMemo } from "react";
import { useFlowStore } from "@/store/useFlowStore";
import { useTheme } from "@/hooks/useTheme";
import { paletteItems } from "./constants";
import { PaletteItem } from "./types";
import { Plus, MousePointer2, Hand, Scissors } from "lucide-react";

export function BottomActions({
  externalOpen,
  onExternalOpenChange,
  dropPosition,
  leftOffset = "",
}: {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  dropPosition?: { x: number; y: number } | null;
  leftOffset?: string;
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isMenuOpen = externalOpen ?? internalOpen;
  const setIsMenuOpen = (open: boolean) => {
    setInternalOpen(open);
    onExternalOpenChange?.(open);
  };
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalOpen) {
      setInternalOpen(true);
      setQuery("");
    }
  }, [externalOpen]);

  const addNode = useFlowStore((state) => state.addNode);
  const interactionMode = useFlowStore((state) => state.interactionMode);
  const setInteractionMode = useFlowStore((state) => state.setInteractionMode);
  const { isLight } = useTheme();
  const undo = useFlowStore((state) => state.undo);
  const redo = useFlowStore((state) => state.redo);
  const canUndo = useFlowStore((state) => state.canUndo);
  const canRedo = useFlowStore((state) => state.canRedo);

  useEffect(() => {
    function handleClickOutside(event: Event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as globalThis.Node)
      ) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside, true);
    return () =>
      document.removeEventListener("pointerdown", handleClickOutside, true);
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? "⌘" : "Ctrl";

  const [recentNodes, setRecentNodes] = useState<PaletteItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("nextflow-recent-nodes");
      if (stored) {
        setRecentNodes(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const handleAdd = (item: PaletteItem) => {
    if (addNode) {
      addNode(item, dropPosition ?? undefined);
    }
    const newRecent = [
      item,
      ...recentNodes.filter((n) => n.label !== item.label),
    ].slice(0, 3);
    setRecentNodes(newRecent);
    localStorage.setItem("nextflow-recent-nodes", JSON.stringify(newRecent));
    setIsMenuOpen(false);
  };

  const filteredPalette = useMemo(
    () =>
      paletteItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  const getIconForModel = (model: string) => {
    if (model === "Crop Image") {
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
          <path d="M6 2v14a2 2 0 0 0 2 2h14" />
          <path d="M18 22V8a2 2 0 0 0-2-2H2" />
        </svg>
      );
    }
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
    if (model === "LLM Call") {
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
          <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93V12h2.75a2.5 2.5 0 0 1 2.5 2.5V16a4 4 0 1 1-2 0v-1.5a.5.5 0 0 0-.5-.5h-6.5a.5.5 0 0 0-.5.5V16a4 4 0 1 1-2 0v-1.5A2.5 2.5 0 0 1 9 12h2.75V9.93A4.002 4.002 0 0 1 12 2z" />
        </svg>
      );
    }
    if (model === "Text") {
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
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
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

  return (
    <>
      <div className="absolute left-6 bottom-6 z-50 flex gap-2">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
          className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${isLight ? "border-black/5 bg-white text-black/60 hover:bg-black/5" : "border-[#1f1f1f] bg-[#0f0f0f] text-white/70 hover:bg-white/10 hover:text-white"} disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
          </svg>
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
          className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${isLight ? "border-black/5 bg-white text-black/60 hover:bg-black/5" : "border-[#1f1f1f] bg-[#0f0f0f] text-white/70 hover:bg-white/10 hover:text-white"} disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 14 5-5-5-5" />
            <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" />
          </svg>
        </button>
        <div
          className="relative hidden md:block"
          onMouseEnter={() => setShowShortcuts(true)}
          onMouseLeave={() => setShowShortcuts(false)}
        >
          <button
            className={`h-9 rounded-xl border text-xs font-medium px-4 transition-all shadow-sm flex items-center gap-2 ${isLight ? "border-black/5 bg-white text-black/60 hover:bg-black/5" : "border-[#1f1f1f] bg-[#0f0f0f] text-white/80 hover:bg-white/10 hover:text-white"}`}
          >
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
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
            </svg>
            <span>Keyboard shortcuts</span>
          </button>

          {showShortcuts && (
            <div
              className={`absolute bottom-full left-0 mb-2 w-[240px] rounded-xl border p-3 shadow-xl animate-in fade-in zoom-in-95 duration-200 ${isLight ? "bg-white border-black/10" : "bg-[#1a1a1a] border-[#2a2a2a]"}`}
            >
              <div
                className={`text-[11px] font-semibold tracking-wider uppercase mb-2.5 px-1 ${isLight ? "text-black/40" : "text-white/30"}`}
              >
                Shortcuts
              </div>
              {[
                { label: "Undo", keys: `${mod} + Z` },
                { label: "Redo", keys: `${mod} + Shift + Z` },
                { label: "Delete node", keys: "Backspace" },
                { label: "Multi-select", keys: `Shift + Click` },
                { label: "Zoom in / out", keys: `${mod} + Scroll` },
                { label: "Pan canvas", keys: "Space + Drag" },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`flex items-center justify-between py-1.5 px-1 text-[12px] ${isLight ? "text-black/70" : "text-white/70"}`}
                >
                  <span>{s.label}</span>
                  <span
                    className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${isLight ? "bg-black/5 text-black/50" : "bg-white/8 text-white/50"}`}
                  >
                    {s.keys}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-4 z-50 flex flex-col items-start gap-3"
        ref={menuRef}
      >
        {/* Popover Menu */}
        {isMenuOpen && (
          <div
            className={`w-[280px] rounded-[16px] overflow-hidden flex flex-col transform origin-bottom relative -left-8 ${isLight ? "bg-white border border-black/10" : "bg-[#0f0f0f] border border-[#1f1f1f]"}`}
          >
            <div className="p-3">
              <div
                className={`flex items-center gap-2 px-3 h-10 rounded-[10px] ${isLight ? "bg-black/5" : "bg-transparent"}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isLight ? "#666" : "#8a8a8a"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Search nodes or models..."
                  className={`bg-transparent border-none outline-none text-[14px] w-full ${isLight ? "text-black placeholder:text-black/40" : "text-[#ededed] placeholder:text-[#8a8a8a]"}`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[400px] py-2 custom-scrollbar">
              {/* Recent Section */}
              {!query && recentNodes.length > 0 && (
                <div className="mb-2">
                  <div
                    className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium tracking-wide ${isLight ? "text-black/40" : "text-[#737373]"}`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Recent
                  </div>
                  <div className="flex flex-col px-1.5">
                    {recentNodes.map((item, idx) => (
                      <button
                        key={`recent-${item.label}-${idx}`}
                        onClick={() => handleAdd(item)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-[15px] font-medium text-left ${isLight ? "hover:bg-black/5 text-black/90" : "hover:bg-[#1f1f1f] text-[#ededed]"}`}
                      >
                        <div
                          className={`w-5 h-5 flex items-center justify-center opacity-80 ${isLight ? "text-black/60" : "text-[#b3b3b3]"}`}
                        >
                          {getIconForModel(item.model)}
                        </div>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categorized Nodes Section (when not searching) */}
              {!query &&
                [
                  {
                    title: "Text",
                    icon: (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="4 7 4 4 20 4 20 7" />
                        <line x1="9" y1="20" x2="15" y2="20" />
                        <line x1="12" y1="4" x2="12" y2="20" />
                      </svg>
                    ),
                    items: filteredPalette.filter(
                      (i) =>
                        i.model === "Text" &&
                        !recentNodes.some((r) => r.label === i.label),
                    ),
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
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    ),
                    items: filteredPalette.filter(
                      (i) =>
                        i.model.includes("Image") &&
                        !recentNodes.some((r) => r.label === i.label),
                    ),
                  },
                  {
                    title: "Video",
                    icon: (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M4 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5l5.5 4.125A.5.5 0 0 0 22 18V6a.5.5 0 0 0-.8-.4L16 9.5V8a2 2 0 0 0-2-2H4z" />
                      </svg>
                    ),
                    items: filteredPalette.filter(
                      (i) =>
                        (i.model.includes("Video") ||
                          i.model === "Extract Frame") &&
                        !recentNodes.some((r) => r.label === i.label),
                    ),
                  },
                  {
                    title: "AI",
                    icon: (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93V12h2.75a2.5 2.5 0 0 1 2.5 2.5V16a4 4 0 1 1-2 0v-1.5a.5.5 0 0 0-.5-.5h-6.5a.5.5 0 0 0-.5.5V16a4 4 0 1 1-2 0v-1.5A2.5 2.5 0 0 1 9 12h2.75V9.93A4.002 4.002 0 0 1 12 2z" />
                      </svg>
                    ),
                    items: filteredPalette.filter(
                      (i) =>
                        i.model === "LLM Call" &&
                        !recentNodes.some((r) => r.label === i.label),
                    ),
                  },
                ].map(
                  (category) =>
                    category.items.length > 0 && (
                      <div key={category.title} className="mb-2 mt-2">
                        <div
                          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium tracking-wide ${isLight ? "text-black/40" : "text-[#737373]"}`}
                        >
                          <div className="opacity-80">{category.icon}</div>
                          {category.title}
                        </div>
                        <div className="flex flex-col px-1.5">
                          {category.items.map((item) => (
                            <button
                              key={`palette-${item.label}`}
                              onClick={() => handleAdd(item)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-[15px] text-left ${isLight ? "hover:bg-black/5 text-black/90" : "hover:bg-[#1f1f1f] text-[#ededed]"}`}
                            >
                              <span>{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ),
                )}

              {/* Search Results (when searching) */}
              {query && (
                <div className="flex flex-col px-1.5">
                  <div
                    className={`px-2.5 py-1.5 mb-1 text-[11px] font-semibold tracking-wider uppercase ${isLight ? "text-black/40" : "text-[#737373]"}`}
                  >
                    Search Results
                  </div>
                  {filteredPalette.map((item) => (
                    <button
                      key={`search-${item.label}`}
                      onClick={() => handleAdd(item)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-[15px] font-medium text-left ${isLight ? "hover:bg-black/5 text-black/90" : "hover:bg-[#1f1f1f] text-[#ededed]"}`}
                    >
                      <div
                        className={`w-5 h-5 flex items-center justify-center opacity-80 ${isLight ? "text-black/60" : "text-[#b3b3b3]"}`}
                      >
                        {getIconForModel(item.model)}
                      </div>
                      {item.label}
                    </button>
                  ))}
                  {filteredPalette.length === 0 && (
                    <div
                      className={`px-3 py-8 text-center text-[13px] ${isLight ? "text-black/50" : "text-[#8a8a8a]"}`}
                    >
                      No nodes found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div
          className={`h-[52px] rounded-2xl border flex items-center px-1 transition-all ${isLight ? "bg-white border-black/5" : "bg-[#0f0f0f] border-[#1f1f1f]"}`}
        >
          <div className="relative group">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="Add node"
              className={`w-11 h-11 rounded-xl border-0 flex items-center justify-center transition-colors ${isMenuOpen ? (isLight ? "bg-black/5" : "bg-[#1f1f1f]") : isLight ? "bg-transparent hover:bg-black/5" : "bg-transparent hover:bg-[#1a1a1a]"} ${isLight ? "text-black" : "text-white"}`}
            >
              <Plus size={22} strokeWidth={2} />
            </button>
          </div>

          <div
            className={`w-px h-6 mx-1 ${isLight ? "bg-black/5" : "bg-[#333]"}`}
          ></div>

          <div className="relative group">
            <button
              onClick={() => setInteractionMode?.("select")}
              title="Select mode"
              className={`w-11 h-11 rounded-xl border-0 flex items-center justify-center transition-colors ${interactionMode === "select" ? (isLight ? "bg-black/5 text-black" : "bg-[#1f1f1f] text-white shadow-inner") : isLight ? "bg-transparent text-black/40 hover:bg-black/5" : "bg-transparent text-white/60 hover:text-white hover:bg-[#1a1a1a]"} ml-1`}
            >
              <MousePointer2 size={20} strokeWidth={2.5} />
            </button>
          </div>

          <button
            onClick={() => setInteractionMode?.("pan")}
            title="Pan mode (Space + Drag)"
            className={`w-11 h-11 rounded-xl border-0 flex items-center justify-center transition-colors ${interactionMode === "pan" ? (isLight ? "bg-black/5 text-black" : "bg-[#1f1f1f] text-white shadow-inner") : isLight ? "bg-transparent text-black/40 hover:bg-black/5" : "bg-transparent text-white/60 hover:text-white hover:bg-[#1a1a1a]"}`}
          >
            <Hand size={22} strokeWidth={2.5} />
          </button>

          <button
            onClick={() =>
              setInteractionMode?.(
                interactionMode === "cut" ? "select" : "cut",
              )
            }
            title="Cut edges (draw to slice)"
            className={`w-11 h-11 rounded-xl border-0 transition-colors flex items-center justify-center ${interactionMode === "cut" ? (isLight ? "bg-red-50 text-red-500" : "bg-red-500/10 text-red-400 shadow-inner") : isLight ? "bg-transparent text-black/40 hover:text-black hover:bg-black/5" : "bg-transparent text-white/60 hover:text-white hover:bg-[#1a1a1a]"}`}
          >
            <Scissors size={22} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </>
  );
}
