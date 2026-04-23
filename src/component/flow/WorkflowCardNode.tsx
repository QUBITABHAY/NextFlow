import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { WorkflowNodeData } from "./types";
import { triggerNodeAction } from "@/app/actions";
import { useFlowStore } from "@/store/useFlowStore";
import { useState } from "react";

export function WorkflowCardNode({
  id,
  data,
  selected
}: NodeProps<Node<WorkflowNodeData>>) {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const theme = useFlowStore((state) => state.theme);
  const [isHovering, setIsHovering] = useState(false);

  const isLight = theme === "light";

  const handleRun = async () => {
    updateNodeData(id, { isRunning: true, runResult: null });

    const connectedEdges = edges.filter((edge) => edge.target === id);
    const connectedInputs = connectedEdges.map((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      return {
        handleId: edge.targetHandle,
        nodeType: sourceNode?.type,
        data: sourceNode?.data,
      };
    });

    const combinedPrompt =
      connectedInputs
        .filter((input) => input.nodeType === "textNode")
        .map((input) => (input.data as any)?.text)
        .filter(Boolean)
        .join("\n") || data.prompt;

    const mediaInputs = connectedInputs
      .filter((input) => input.nodeType === "mediaNode" && (input.data as any)?.url)
      .map((input) => (input.data as any)?.url);

    const response = await triggerNodeAction(id, data.model || "WorkflowNode", {
      prompt: combinedPrompt,
      media: mediaInputs,
    });

    if (response.success) {
      updateNodeData(id, {
        isRunning: false,
        runResult: response.runResult,
        inputBadge: "Success",
      });
    } else {
      updateNodeData(id, {
        isRunning: false,
        inputBadge: "Failed",
      });
    }
  };

  return (
    <div
      className={`w-[220px] min-h-[430px] rounded-2xl border text-[11px] relative p-3 transition-all ${isLight ? 'bg-white border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-black/80 hover:border-black/10' : 'bg-[#1c1e24] border-white/10 shadow-[0_22px_50px_rgba(0,0,0,0.45)] text-white/80 hover:border-white/20'}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Handle
        type="target"
        id="in-main-yellow"
        position={Position.Left}
        className="!w-3 !h-3 !border-none transition-all duration-300 !z-50 hover:scale-125"
        style={{ 
          top: "57%", 
          left: "0px", 
          backgroundColor: "#e3c92f", 
          boxShadow: `0 0 0 4px rgba(227, 201, 47, 0.4)`
        }}
      />
      <Handle
        type="target"
        id="in-lower-blue"
        position={Position.Left}
        className="!w-3 !h-3 !border-none transition-all duration-300 !z-50 hover:scale-125"
        style={{ 
          top: "90%", 
          left: "0px", 
          backgroundColor: "#1188ff", 
          boxShadow: `0 0 0 4px rgba(17, 136, 255, 0.4)`
        }}
      />
      <Handle
        type="source"
        id="out-main-blue"
        position={Position.Right}
        className="!w-3 !h-3 !border-none transition-all duration-300 !z-50 hover:scale-125"
        style={{ 
          top: "46%", 
          right: "0px", 
          backgroundColor: "#1188ff", 
          boxShadow: `0 0 0 4px rgba(17, 136, 255, 0.4)`
        }}
      />

      <div className={`flex items-center justify-between mb-2 font-medium ${isLight ? 'text-black/70' : 'text-white/70'}`}>
        <span>{data.title}</span>
        <div className={`flex items-center gap-1 ${isLight ? 'text-black/30' : 'text-white/40'}`}>
          <span className="text-[10px]">{data.gpu}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        </div>
      </div>

      <div className={`h-[182px] relative rounded-xl border grid place-items-center text-xs mb-3 overflow-hidden shadow-inner group ${isLight ? 'bg-[#f9fafb] border-black/5 text-black/30' : 'bg-[#08090b]/90 border-white/5 text-white/30'}`}>
        {data.isRunning ? (
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-6 w-6 text-[#1188ff]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Processing...</span>
          </div>
        ) : data.runResult ? (
          <div className="w-full h-full">
            {data.runResult.startsWith("http") ? (
              <img src={data.runResult} alt="Generated result" className="w-full h-full object-cover" />
            ) : (
              <div className={`flex flex-col items-center justify-center h-full p-2 gap-2 ${isLight ? 'bg-[#f9fafb]' : 'bg-[#0a0c10]'}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <span className="text-[#22c55e] font-medium">Task completed</span>
              </div>
            )}
          </div>
        ) : (
          <span>Results will appear here</span>
        )}

        {isHovering && !data.isRunning && (
          <div className={`absolute inset-0 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isLight ? 'bg-white/40' : 'bg-black/40'}`}>
            <button onClick={handleRun} className="px-4 py-1.5 rounded-full bg-[#1188ff] text-white font-medium shadow-[0_0_15px_rgba(17,136,255,0.4)] hover:bg-[#2090ff] hover:scale-105 transition-all flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Run Node
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className={isLight ? 'text-black/40' : 'text-white/50'}>Model</span>
        <button className={`h-[24px] rounded-lg border text-[11px] px-2.5 transition-colors flex items-center gap-1.5 ${isLight ? 'border-black/5 bg-white text-black/80 hover:bg-black/5' : 'border-white/10 bg-black/40 text-[#f6f7fb] hover:bg-white/10'}`}>
          {data.model}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
      </div>

      <div className={`my-1.5 font-medium ${isLight ? 'text-black/40' : 'text-white/45'}`}>Prompt</div>
      <textarea 
        className={`w-full h-[82px] resize-none rounded-xl border leading-relaxed p-2.5 outline-none mb-2 transition-colors shadow-inner ${isLight ? 'bg-[#f9fafb] border-black/5 text-black/80 focus:border-black/10 focus:bg-white' : 'bg-black/30 border-white/5 text-white/80 focus:border-white/20'}`} 
        defaultValue={data.prompt} 
        placeholder={data.placeholder}
      />

      <div className={`flex items-center justify-between mb-2 text-[10px] ${isLight ? 'text-black/30' : 'text-white/45'}`}>
        <span>{data.lowerLeft}</span>
        <span>{data.lowerRight}</span>
      </div>

      <div className={`w-full h-[1px] mb-3 ${isLight ? 'bg-black/5' : 'bg-white/5'}`} />

      <div className={`my-1.5 font-medium mt-1 flex items-center gap-1.5 ${isLight ? 'text-black/40' : 'text-white/45'}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3v19M5 8h14M5 16h14"></path></svg>
        Settings
      </div>
      <div className={`flex items-center justify-between mb-1.5 ${isLight ? 'text-black/40' : 'text-white/45'}`}>
        <span>Reference Image</span>
        <button className={`h-[24px] rounded-lg border text-[11px] px-2.5 transition-colors ${isLight ? 'border-black/5 bg-white text-black/60 hover:bg-black/5' : 'border-white/10 bg-black/40 text-[#f6f7fb] hover:bg-white/10'}`}>Add file</button>
      </div>
      <div className={`flex items-center justify-between mb-1.5 ${isLight ? 'text-black/40' : 'text-white/45'}`}>
        <span>Aspect Ratio</span>
        <button className={`h-[24px] rounded-lg border text-[11px] px-2.5 transition-colors flex items-center gap-1.5 ${isLight ? 'border-black/5 bg-white text-black/60 hover:bg-black/5' : 'border-white/10 bg-black/40 text-[#f6f7fb] hover:bg-white/10'}`}>
          1:1
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
      </div>

      <div className={`absolute -right-[46px] top-[192px] text-[10px] uppercase tracking-wider rotate-90 origin-left ${isLight ? 'text-black/30' : 'text-white/40'}`}>{data.rightLabel}</div>
    </div>
  );
}
