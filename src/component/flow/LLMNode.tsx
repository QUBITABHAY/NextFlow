import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { useFlowStore } from "@/store/useFlowStore";
import { useTheme } from "@/hooks/useTheme";
import { useState, useEffect } from "react";

const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
];

export type LLMNodeData = {
  systemPrompt: string;
  userMessage: string;
  selectedModel: string;
  isRunning?: boolean;
  runResult?: string | null;
};

export function LLMNode({ id, data, selected }: NodeProps<Node<LLMNodeData>>) {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const { isLight } = useTheme();
  const [showModelMenu, setShowModelMenu] = useState(false);
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  const accentColor = "#a855f7";

  return (
    <div className="relative font-(--font-space-grotesk)">
      <div className="absolute top-[-28px] left-3 flex items-center gap-2">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93V12h2.75a2.5 2.5 0 0 1 2.5 2.5V16a4 4 0 1 1-2 0v-1.5a.5.5 0 0 0-.5-.5h-6.5a.5.5 0 0 0-.5.5V16a4 4 0 1 1-2 0v-1.5A2.5 2.5 0 0 1 9 12h2.75V9.93A4.002 4.002 0 0 1 12 2z" />
        </svg>
        <span
          className={`${isLight ? "text-black/50" : "text-white/40"} text-[15px] font-medium tracking-wide`}
        >
          LLM Call
        </span>
      </div>

      {/* Main Card */}
      <div
        className={`w-[360px] rounded-2xl transition-all box-border border-2 p-4 ${isLight ? "bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-black/5" : "bg-[#202020] shadow-2xl border-[#1f1f1f]"}`}
        style={{
          borderColor: selected
            ? accentColor
            : isLight
              ? "rgba(0,0,0,0.05)"
              : "rgba(255,255,255,0.0)",
        }}
      >
        {/* Header Row with Image + Output handles */}
        <div className="relative mb-3">
          <Handle
            type="target"
            id="in-blue"
            position={Position.Left}
            className="w-4! h-4! border-none! transition-all duration-300 z-50!"
            style={{
              top: "50%",
              left: "-18px",
              backgroundColor: "#1188ff",
              boxShadow: "0 0 0 6px rgba(17, 136, 255, 0.4)",
              pointerEvents: "auto",
            }}
          />
          <Handle
            type="source"
            id="out-yellow"
            position={Position.Right}
            className="w-4! h-4! border-none! transition-all duration-300 z-50!"
            style={{
              top: "50%",
              right: "-18px",
              backgroundColor: "#e3c92f",
              boxShadow: "0 0 0 6px rgba(227, 201, 47, 0.4)",
              pointerEvents: "auto",
            }}
          />
          <div
            className={`flex justify-between items-center text-[13px] font-medium px-1 ${isLight ? "text-black/30" : "text-white/40"}`}
          >
            <span>Image</span>
            <span>Output</span>
          </div>
        </div>

        {/* Model Selector */}
        <div className="mb-3 flex items-center justify-between px-1">
          <label
            className={`text-[11px] font-semibold tracking-wider uppercase ${isLight ? "text-black/40" : "text-white/30"}`}
          >
            Model
          </label>
          <div className="relative">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className={`h-[26px] rounded-lg border text-[11px] px-2.5 transition-all flex items-center gap-1.5 font-medium ${
                isLight
                  ? "border-black/5 bg-white text-black/60 hover:bg-black/5"
                  : "border-white/10 bg-black/40 text-[#f6f7fb] hover:bg-white/10"
              } ${showModelMenu ? (isLight ? "bg-black/5" : "bg-white/10") : ""}`}
            >
              {GEMINI_MODELS.find((m) => m.id === data.selectedModel)?.label ||
                "Select Model"}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className={`transition-transform duration-200 ${showModelMenu ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {showModelMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowModelMenu(false)}
                />
                <div
                  className={`absolute top-[32px] right-0 w-[180px] rounded-xl border p-1.5 z-50 shadow-xl animate-in fade-in zoom-in-95 duration-200 ${
                    isLight
                      ? "bg-white border-black/10"
                      : "bg-[#202020] border-[#1f1f1f]"
                  }`}
                >
                  {GEMINI_MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        updateNodeData(id, { selectedModel: m.id });
                        setShowModelMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-[12px] rounded-lg transition-colors font-medium ${
                        data.selectedModel === m.id
                          ? isLight
                            ? "bg-black/5 text-black"
                            : "bg-white/10 text-white"
                          : isLight
                            ? "hover:bg-black/5 text-black/60"
                            : "hover:bg-white/5 text-white/60"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* System Prompt */}
        <div className="mb-3 relative">
          <Handle
            type="target"
            id="in-yellow-system"
            position={Position.Left}
            className="w-4! h-4! border-none! transition-all duration-300 z-50!"
            style={{
              top: "12px",
              left: "-18px",
              backgroundColor: "#e3c92f",
              boxShadow: "0 0 0 6px rgba(227, 201, 47, 0.4)",
              pointerEvents: "auto",
            }}
          />
          <label
            className={`block text-[11px] font-semibold tracking-wider uppercase mb-1.5 px-1 ${isLight ? "text-black/40" : "text-white/30"}`}
          >
            System Prompt
          </label>
          <textarea
            className={`w-full h-[60px] rounded-xl border leading-relaxed p-3 text-[13px] outline-none transition-all shadow-inner resize-none ${isLight ? "bg-[#f9fafb] border-black/5 text-black/80 focus:bg-white focus:border-black/10" : "bg-[#171717] border-[#202020] text-white/90 focus:bg-[#171717] focus:border-[#2a2a2a]"}`}
            value={data.systemPrompt}
            onChange={(e) =>
              updateNodeData(id, { systemPrompt: e.target.value })
            }
            placeholder="You are a helpful assistant..."
          />
        </div>

        {/* User Message */}
        <div className="mb-3 relative">
          <Handle
            type="target"
            id="in-yellow-user"
            position={Position.Left}
            className="w-4! h-4! border-none! transition-all duration-300 z-50!"
            style={{
              top: "12px",
              left: "-18px",
              backgroundColor: "#e3c92f",
              boxShadow: "0 0 0 6px rgba(227, 201, 47, 0.4)",
              pointerEvents: "auto",
            }}
          />
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <label
              className={`text-[11px] font-semibold tracking-wider uppercase ${isLight ? "text-black/40" : "text-white/30"}`}
            >
              User Message
            </label>
            <span
              className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: isLight
                  ? "rgba(168,85,247,0.1)"
                  : "rgba(168,85,247,0.15)",
                color: accentColor,
              }}
            >
              Required
            </span>
          </div>
          <textarea
            className={`w-full h-[80px] rounded-xl border leading-relaxed p-3 text-[13px] outline-none transition-all shadow-inner resize-none ${isLight ? "bg-[#f9fafb] border-black/5 text-black/80 focus:bg-white focus:border-black/10" : "bg-[#171717] border-[#202020] text-white/90 focus:bg-[#171717] focus:border-[#2a2a2a]"}`}
            value={data.userMessage}
            onChange={(e) =>
              updateNodeData(id, { userMessage: e.target.value })
            }
            placeholder="Enter your message..."
          />
        </div>

        {/* Running indicator */}
        {data.isRunning && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium mb-3"
            style={{
              backgroundColor: isLight
                ? "rgba(168,85,247,0.08)"
                : "rgba(168,85,247,0.1)",
              color: accentColor,
            }}
          >
            <svg
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Generating response...
          </div>
        )}

        {/* Response Output */}
        {data.runResult && !data.isRunning && (
          <div>
            <label
              className={`block text-[11px] font-semibold tracking-wider uppercase mb-1.5 px-1 ${isLight ? "text-black/40" : "text-white/30"}`}
            >
              Response
            </label>
            <div
              className={`w-full max-h-[160px] overflow-y-auto rounded-xl border p-3 text-[13px] leading-relaxed whitespace-pre-wrap ${isLight ? "bg-[#f9fafb] border-black/5 text-black/80" : "bg-[#171717] border-[#202020] text-white/80"}`}
            >
              {data.runResult}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
