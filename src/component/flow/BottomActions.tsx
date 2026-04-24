import { useState, useRef, useEffect } from "react";
import { useFlowStore } from "@/store/useFlowStore";
import { useTheme } from "@/hooks/useTheme";

export function BottomActions() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const addNode = useFlowStore((state) => state.addNode);
  const interactionMode = useFlowStore((state) => state.interactionMode);
  const setInteractionMode = useFlowStore((state) => state.setInteractionMode);
  const { isLight } = useTheme();
  const undo = useFlowStore((state) => state.undo);
  const redo = useFlowStore((state) => state.redo);
  const canUndo = useFlowStore((state) => state.canUndo);
  const canRedo = useFlowStore((state) => state.canRedo);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const handleAdd = (label: string, model: string) => {
    if (addNode) {
      addNode({ label, model });
    }
    setIsMenuOpen(false);
  };

  return (
    <>
      <div className="absolute left-6 bottom-6 z-50 flex gap-2">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
          className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${isLight ? "border-black/5 bg-white text-black/60 hover:bg-black/5" : "border-white/10 bg-[#12151b]/95 text-white/70 hover:bg-white/10 hover:text-white"} disabled:opacity-30 disabled:cursor-not-allowed`}
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
            <path d="M11 17L6 12L11 7" />
            <path d="M6 12H13.5C15.93 12 18 14.07 18 16.5V16.5" />
          </svg>
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
          className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${isLight ? "border-black/5 bg-white text-black/60 hover:bg-black/5" : "border-white/10 bg-[#12151b]/95 text-white/70 hover:bg-white/10 hover:text-white"} disabled:opacity-30 disabled:cursor-not-allowed`}
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
            <path d="M13 17L18 12L13 7" />
            <path d="M18 12H10.5C8.07 12 6 14.07 6 16.5V16.5" />
          </svg>
        </button>
        <button
          className={`h-9 rounded-xl border text-xs font-medium px-4 transition-all shadow-sm hidden md:flex items-center gap-2 ${isLight ? "border-black/5 bg-white text-black/60 hover:bg-black/5" : "border-white/10 bg-[#12151b]/95 text-white/80 hover:bg-white/10 hover:text-white"}`}
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
            <path d="M18 3a3 3 0 1 1-3 3V6a3 3 0 1 1 3-3ZM18 3v3ZM18 18a3 3 0 1 1-3-3v3a3 3 0 1 1 3 3ZM18 18h-3ZM6 18a3 3 0 1 1 3-3v3a3 3 0 1 1-3 3ZM6 18v-3ZM6 6a3 3 0 1 1 3 3H6a3 3 0 1 1-3-3ZM6 6h3ZM6 18h12ZM18 6v12ZM18 6H6ZM6 6v12" />
          </svg>
          <span>Keyboard shortcuts</span>
        </button>
      </div>

      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-4 z-50 flex flex-col items-start gap-3"
        ref={menuRef}
      >
        {/* Popover Menu */}
        {isMenuOpen && (
          <div
            className={`w-[300px] border rounded-[16px] shadow-2xl overflow-hidden flex flex-col transform origin-bottom animate-in fade-in zoom-in-95 duration-150 relative -left-8 ${isLight ? "bg-white border-black/5 shadow-black/5" : "bg-[#111111] border-[#2a2a2a] shadow-black/50"}`}
          >
            <div
              className={`p-3 border-b ${isLight ? "border-black/5" : "border-[#2a2a2a]"}`}
            >
              <div
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isLight ? "bg-black/5" : "bg-[#1a1a1a]"}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isLight ? "#999" : "#666"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Search nodes or models..."
                  className={`bg-transparent border-none outline-none text-[15px] w-full ${isLight ? "text-black placeholder:text-black/30" : "text-white placeholder:text-[#666]"}`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[400px] p-2 space-y-4 pb-4">
              {/* Recent Section */}
              <div>
                <div
                  className={`flex items-center gap-2 px-2 py-1 mb-1 text-[12px] font-medium uppercase tracking-wider ${isLight ? "text-black/30" : "text-[#666]"}`}
                >
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
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Recent
                </div>
                <button
                  onClick={() => handleAdd("Image", "Image")}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-[15px] font-medium mt-1 ${isLight ? "hover:bg-black/5 text-black" : "hover:bg-[#1a1a1a] text-white"}`}
                >
                  <div className="w-5 h-5 flex items-center justify-center opacity-70">
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
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  Image
                </button>
                <button
                  onClick={() => handleAdd("Video", "Video")}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-[15px] font-medium mt-1 ${isLight ? "hover:bg-black/5 text-black" : "hover:bg-[#1a1a1a] text-white"}`}
                >
                  <div className="w-5 h-5 flex items-center justify-center opacity-70">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </div>
                  Video
                </button>
                <button
                  onClick={() => handleAdd("Text", "Text")}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-[15px] font-medium mt-1 ${isLight ? "hover:bg-black/5 text-black" : "hover:bg-[#1a1a1a] text-white"}`}
                >
                  <div className="w-5 h-5 flex items-center justify-center opacity-70">
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
                      <path d="M4 7V4h16v3" />
                      <path d="M9 20h6" />
                      <path d="M12 4v16" />
                    </svg>
                  </div>
                  Text
                </button>
                <button
                  onClick={() => handleAdd("Crop Image", "Crop Image")}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-[15px] font-medium mt-1 ${isLight ? "hover:bg-black/5 text-black" : "hover:bg-[#1a1a1a] text-white"}`}
                >
                  <div className="w-5 h-5 flex items-center justify-center opacity-70">
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
                      <path d="M3 3h18v18H3z" />
                      <path d="M8 3v18" />
                      <path d="M16 3v18" />
                      <path d="M3 8h18" />
                      <path d="M3 16h18" />
                    </svg>
                  </div>
                  Crop Image
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div
          className={`h-[52px] rounded-2xl border flex items-center px-1 shadow-2xl transition-all ${isLight ? "bg-white border-black/5 shadow-black/5" : "bg-[#1a1a1a] border-[#2a2a2a] shadow-black/50"}`}
        >
          <div className="relative group">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`w-11 h-11 rounded-xl border-0 flex items-center justify-center transition-colors ${isMenuOpen ? (isLight ? "bg-black/5" : "bg-[#333]") : isLight ? "bg-transparent hover:bg-black/5" : "bg-transparent hover:bg-[#2a2a2a]"} ${isLight ? "text-black" : "text-white"}`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>

          <div
            className={`w-[1px] h-6 mx-1 ${isLight ? "bg-black/5" : "bg-[#333]"}`}
          ></div>

          <div className="relative group">
            <button
              onClick={() => setInteractionMode?.("select")}
              className={`w-11 h-11 rounded-xl border-0 flex items-center justify-center transition-colors ${interactionMode === "select" ? (isLight ? "bg-black/5 text-black" : "bg-[#333] text-white shadow-inner") : isLight ? "bg-transparent text-black/40 hover:bg-black/5" : "bg-transparent text-white/60 hover:text-white hover:bg-[#2a2a2a]"} ml-1`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              </svg>
            </button>
          </div>

          <button
            onClick={() => setInteractionMode?.("pan")}
            className={`w-11 h-11 rounded-xl border-0 flex items-center justify-center transition-colors ${interactionMode === "pan" ? (isLight ? "bg-black/5 text-black" : "bg-[#333] text-white shadow-inner") : isLight ? "bg-transparent text-black/40 hover:bg-black/5" : "bg-transparent text-white/60 hover:text-white hover:bg-[#2a2a2a]"}`}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 11V6a2 2 0 0 0-4 0v4" />
              <path d="M14 10V5a2 2 0 0 0-4 0v5" />
              <path d="M10 10.5V4a2 2 0 0 0-4 0v9" />
              <path d="M6 13v-1a2 2 0 0 0-4 0v5c0 4.4 3.6 8 8 8h3c3.3 0 6-2.7 6-6v-5a2 2 0 0 0-4 0v1" />
            </svg>
          </button>

          <button
            className={`w-11 h-11 rounded-xl border-0 bg-transparent transition-colors flex items-center justify-center ${isLight ? "text-black/40 hover:text-black hover:bg-black/5" : "text-white/60 hover:text-white hover:bg-[#2a2a2a]"}`}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
          </button>

          <button
            className={`w-11 h-11 rounded-xl border-0 bg-transparent transition-colors flex items-center justify-center ${isLight ? "text-black/40 hover:text-black hover:bg-black/5" : "text-white/60 hover:text-white hover:bg-[#2a2a2a]"}`}
          >
            <div className="grid grid-cols-3 gap-[2px]">
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full opacity-0"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
            </div>
          </button>

          <button
            className={`w-11 h-11 rounded-xl border-0 bg-transparent transition-colors flex items-center justify-center ${isLight ? "text-black/40 hover:text-black hover:bg-black/5" : "text-white/60 hover:text-white hover:bg-[#2a2a2a]"}`}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="14" width="7" height="7" rx="2" />
              <rect x="14" y="3" width="7" height="7" rx="2" />
              <path d="M6.5 14v-2c0-2.2 1.8-4 4-4h3.5" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
