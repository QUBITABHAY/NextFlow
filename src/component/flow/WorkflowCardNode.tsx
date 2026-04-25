import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { WorkflowNodeData } from "./types";
import { triggerNodeAction } from "@/app/actions";
import { useFlowStore } from "@/store/useFlowStore";
import { useTheme } from "@/hooks/useTheme";
import { useState, useRef, useCallback, useEffect } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";
import { useNodeRunRecorder } from "@/hooks/useNodeRunRecorder";

export function WorkflowCardNode({
  id,
  data,
  selected,
}: NodeProps<Node<WorkflowNodeData>>) {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const { isLight } = useTheme();
  const { recordSingleNodeRun } = useNodeRunRecorder();
  const [isHovering, setIsHovering] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [showUploadDropdown, setShowUploadDropdown] = useState(false);

  const isCropNode = data.model === "Crop Image";
  const isExtractFrameNode = data.model === "Extract Frame";
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, isCropNode, isExtractFrameNode, updateNodeInternals]);

  const uploadToTransloadit = useCallback(
    async (file: File) => {
      setUploadStatus("uploading");
      setUploadProgress(0);
      setErrorMsg("");

      try {
        // 1. Get signed params from our server
        const signRes = await fetch("/api/transloadit-sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            steps: { ":original": { robot: "/upload/handle" } },
          }),
        });

        if (!signRes.ok) {
          const errBody = await signRes.json().catch(() => ({}));
          throw new Error(
            signRes.status === 500 && errBody?.error?.includes("credentials")
              ? "Transloadit credentials not configured. Add NEXT_PUBLIC_TRANSLOADIT_KEY and TRANSLOADIT_SECRET to .env.local"
              : (errBody?.error ?? `Signing failed (${signRes.status})`),
          );
        }
        const { params, signature } = await signRes.json();

        // 2. Build multipart form and upload to Transloadit
        const formData = new FormData();
        formData.append("params", params);
        formData.append("signature", signature);
        formData.append("file", file);

        // Use XMLHttpRequest to track progress
        const result = await new Promise<{ url: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 90));
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const response = JSON.parse(xhr.responseText);
              // Poll for assembly completion if still processing
              if (
                response.assembly_id &&
                response.ok !== "ASSEMBLY_COMPLETED"
              ) {
                pollAssembly(
                  response.assembly_ssl_url ?? response.assembly_url,
                  resolve,
                  reject,
                );
              } else {
                const uploadedFiles = Object.values(
                  response.uploads ?? {},
                ).flat() as any[];
                const resultFiles = Object.values(
                  response.results ?? {},
                ).flat() as any[];
                const allFiles = [...resultFiles, ...uploadedFiles];
                if (allFiles.length > 0) {
                  resolve({ url: allFiles[0].ssl_url ?? allFiles[0].url });
                } else {
                  reject(new Error("No files in upload response"));
                }
              }
            } else {
              // Surface the actual Transloadit error for debugging
              try {
                const errBody = JSON.parse(xhr.responseText);
                console.error("[Transloadit] Error response:", errBody);
                const msg =
                  errBody?.message ??
                  errBody?.error ??
                  errBody?.msg ??
                  "Unknown error";
                const code = errBody?.error ?? "";
                reject(
                  new Error(`Transloadit ${xhr.status}: ${code} — ${msg}`),
                );
              } catch {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          });

          xhr.addEventListener("error", () =>
            reject(new Error("Network error during upload")),
          );

          xhr.open("POST", "https://api2.transloadit.com/assemblies");
          xhr.send(formData);
        });

        setUploadProgress(100);
        setUploadStatus("done");
        updateNodeData(id, isExtractFrameNode ? { uploadedVideoUrl: result.url } : { uploadedImageUrl: result.url });
      } catch (err: any) {
        setUploadStatus("error");
        setErrorMsg(err.message ?? "Upload failed");
      }
    },
    [id, updateNodeData],
  );

  function pollAssembly(
    assemblyUrl: string,
    resolve: (v: { url: string }) => void,
    reject: (e: Error) => void,
    attempts = 0,
  ) {
    if (attempts > 60) {
      reject(new Error("Assembly timed out"));
      return;
    }
    setTimeout(async () => {
      try {
        const res = await fetch(assemblyUrl);
        const json = await res.json();
        if (json.ok === "ASSEMBLY_COMPLETED") {
          const uploadedFiles = Object.values(
            json.uploads ?? {},
          ).flat() as any[];
          const resultFiles = Object.values(json.results ?? {}).flat() as any[];
          const allFiles = [...resultFiles, ...uploadedFiles];
          if (allFiles.length > 0) {
            setUploadProgress(100);
            resolve({ url: allFiles[0].ssl_url ?? allFiles[0].url });
          } else {
            reject(new Error("No files found after assembly"));
          }
        } else if (json.error) {
          reject(new Error(json.message ?? "Assembly error"));
        } else {
          setUploadProgress((p) => Math.min(p + 2, 98));
          pollAssembly(assemblyUrl, resolve, reject, attempts + 1);
        }
      } catch {
        pollAssembly(assemblyUrl, resolve, reject, attempts + 1);
      }
    }, 1500);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isExtractFrameNode) {
      const allowedVideo = [
        "video/mp4",
        "video/quicktime",
        "video/webm",
        "video/x-m4v",
      ];
      if (!allowedVideo.includes(file.type)) {
        setUploadStatus("error");
        setErrorMsg("Only MP4, MOV, WEBM, M4V files are allowed");
        return;
      }
    } else {
      const allowed = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
      ];
      if (!allowed.includes(file.type)) {
        setUploadStatus("error");
        setErrorMsg("Only JPG, JPEG, PNG, WEBP, GIF files are allowed");
        return;
      }
    }

    uploadToTransloadit(file);
    e.target.value = "";
    setShowUploadDropdown(false);
  };

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
      .filter(
        (input) => input.nodeType === "mediaNode" && (input.data as any)?.url,
      )
      .map((input) => (input.data as any)?.url);

    // Also pick up outputs from connected workflow nodes (e.g. Extract Frame → Crop Image)
    connectedInputs
      .filter((input) => {
        const result = (input.data as any)?.runResult;
        return (
          input.nodeType === "workflowCard" &&
          result &&
          (result.startsWith("http") || result.startsWith("data:image"))
        );
      })
      .forEach((input) => mediaInputs.push((input.data as any).runResult));

    if (isExtractFrameNode && data.uploadedVideoUrl) {
      mediaInputs.unshift(data.uploadedVideoUrl);
    } else if (data.uploadedImageUrl) {
      mediaInputs.unshift(data.uploadedImageUrl);
    }

    const nodeTypeLabel = data.model || "WorkflowNode";
    const inputSummary = [combinedPrompt, ...mediaInputs].filter(Boolean).join(" | ");

    await recordSingleNodeRun(id, nodeTypeLabel, data.title || nodeTypeLabel, inputSummary, async () => {
      try {
        const response = await triggerNodeAction(
          id,
          nodeTypeLabel,
          {
            prompt: combinedPrompt,
            media: mediaInputs,
            ...(isCropNode && {
              cropX: data.cropX ?? 0,
              cropY: data.cropY ?? 0,
              cropWidth: data.cropWidth ?? 100,
              cropHeight: data.cropHeight ?? 100,
            }),
            ...(isExtractFrameNode && {
              frameTimestamp: data.frameTimestamp ?? 0,
              frameTimestampMode: data.frameTimestampMode ?? "seconds",
            }),
          },
        );

        if (response.success) {
          updateNodeData(id, {
            isRunning: false,
            runResult: response.runResult,
            inputBadge: "Success",
          });
          return { success: true, output: response.runResult };
        } else {
          updateNodeData(id, {
            isRunning: false,
            runResult: response.error || "Task failed",
            inputBadge: "Failed",
          });
          return { success: false, error: response.error || "Task failed" };
        }
      } catch (err: any) {
        updateNodeData(id, {
          isRunning: false,
          runResult: err.message || "Unexpected error",
          inputBadge: "Failed",
        });
        return { success: false, error: err.message || "Unexpected error" };
      }
    });
  };

  return (
    <div className="relative font-(--font-space-grotesk)">
      <div className="absolute top-[-28px] left-3 flex items-center gap-2">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isLight ? "#999" : "#888"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isCropNode ? (
            <path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2" />
          ) : isExtractFrameNode ? (
            <>
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
              <line x1="17" y1="17" x2="22" y2="17" />
            </>
          ) : (
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          )}
        </svg>
        <span
          className={`${isLight ? "text-black/50" : "text-white/40"} text-[15px] font-medium tracking-wide`}
        >
          {data.title}
        </span>
      </div>
      <div
        className={`w-[220px] min-h-[430px] rounded-2xl border text-[11px] relative p-3 transition-all ${isLight ? "bg-white border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-black/80 hover:border-black/10" : "bg-[#202020] border-[#1f1f1f] shadow-[0_22px_50px_rgba(0,0,0,0.45)] text-white/80 hover:border-white/20"} ${data.isRunning ? (isExtractFrameNode ? "node-processing-video" : "node-processing") : ""}`}
        style={{ borderColor: selected ? (isExtractFrameNode ? "#22c55e" : "#1188ff") : undefined }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {!isCropNode && !isExtractFrameNode && (
          <Handle
            type="target"
            id="in-main-yellow"
            position={Position.Left}
            className="w-3! h-3! border-none! transition-transform duration-300 z-50! hover:scale-125"
            style={{
              top: "57%",
              left: "0px",
              backgroundColor: "#e3c92f",
              boxShadow: `0 0 0 4px rgba(227, 201, 47, 0.4)`,
            }}
          />
        )}

        <Handle
          type="source"
          id="out-main-blue"
          position={Position.Right}
          className="w-3! h-3! border-none! transition-transform duration-300 z-50! hover:scale-125"
          style={{
            top: "103px",
            right: "0px",
            backgroundColor: "#1188ff",
            boxShadow: `0 0 0 4px rgba(17, 136, 255, 0.4)`,
          }}
        />

        <div
          className={`h-[182px] relative rounded-xl grid place-items-center text-sm mb-3 overflow-hidden group ${isLight ? "bg-black/3 text-black/40" : "bg-white/2 text-white/40"}`}
        >
          {data.isRunning ? (
            <div className="flex flex-col items-center gap-3">
              <svg
                className="animate-spin h-6 w-6 text-[#1188ff]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Processing...</span>
            </div>
          ) : data.runResult ? (
            <div className="w-full h-full">
              {data.runResult.startsWith("http") ||
              data.runResult.startsWith("data:image") ? (
                <img
                  src={data.runResult}
                  alt="Generated result"
                  className="w-full h-full object-cover"
                />
              ) : data.inputBadge === "Failed" ? (
                <div className="flex flex-col items-center justify-center h-full p-3 gap-2 bg-transparent">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="text-red-400 text-[12px] text-center leading-tight wrap-break-word">
                    {data.runResult}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-2 gap-2 bg-transparent">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <span className="text-[#22c55e] font-medium">
                    Task completed
                  </span>
                </div>
              )}
            </div>
          ) : (
            <span className="font-medium">
              {isCropNode
                ? "Add or connect an image"
                : isExtractFrameNode
                  ? "Add or connect a video"
                  : "Results will appear here"}
            </span>
          )}

          {isHovering && !data.isRunning && (
            <div
              className={`absolute inset-0 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isLight ? "bg-white/40" : "bg-black/40"}`}
            >
              <button
                onClick={handleRun}
                className="px-4 py-1.5 rounded-full bg-[#1188ff] text-white font-medium shadow-[0_0_15px_rgba(17,136,255,0.4)] hover:bg-[#2090ff] hover:scale-105 transition-all flex items-center gap-2"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Run Node
              </button>
            </div>
          )}
        </div>

        {!isCropNode && !isExtractFrameNode && (
          <div className="flex items-center justify-between mb-2">
            <span className={isLight ? "text-black/40" : "text-white/50"}>
              Model
            </span>
            <button
              className={`h-[24px] rounded-lg border text-[11px] px-2.5 transition-colors flex items-center gap-1.5 ${isLight ? "border-black/5 bg-white text-black/80 hover:bg-black/5" : "border-white/10 bg-black/40 text-[#f6f7fb] hover:bg-white/10"}`}
            >
              {data.model}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>
        )}

        {isCropNode ? (
          <>
            <div className="relative mt-1 mb-4 w-full nodrag">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp,.gif"
                onChange={handleFileChange}
              />
              <div
                className={`w-full h-[36px] rounded-xl flex items-center justify-between px-3 cursor-pointer transition-colors border ${isLight ? "bg-white/50 border-black/10 hover:bg-black/5" : "bg-white/5 border-white/5 hover:bg-white/10"}`}
                onClick={() => setShowUploadDropdown(!showUploadDropdown)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span
                    className={`text-[12px] truncate ${isLight ? "text-black/70" : "text-white/70"}`}
                  >
                    {uploadStatus === "uploading"
                      ? `Uploading... ${uploadProgress}%`
                      : uploadStatus === "error"
                        ? "Upload failed"
                        : data.uploadedImageUrl
                          ? "Image uploaded"
                          : "Add file"}
                  </span>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>

                <Handle
                  type="target"
                  id="in-lower-blue"
                  position={Position.Left}
                  className="w-3! h-3! border-none! transition-transform duration-300 z-50! hover:scale-125"
                  style={{
                    top: "50%",
                    left: "-14px",
                    backgroundColor: isExtractFrameNode ? "#22c55e" : "#1188ff",
                    boxShadow: isExtractFrameNode ? `0 0 0 4px rgba(34, 197, 94, 0.4)` : `0 0 0 4px rgba(17, 136, 255, 0.4)`,
                  }}
                />
              </div>

              {showUploadDropdown && (
                <div
                  className={`absolute top-[40px] left-0 w-[180px] rounded-xl border p-1 z-50 shadow-xl ${isLight ? "bg-white border-black/10" : "bg-[#202020] border-[#1f1f1f]"}`}
                >
                  <button
                    onClick={() => {
                      setShowUploadDropdown(false);
                      fileInputRef.current?.click();
                    }}
                    className={`w-full text-left px-3 py-2 text-[12px] rounded-lg transition-colors flex items-center gap-2 ${isLight ? "hover:bg-black/5 text-black/80" : "hover:bg-white/5 text-white/80"}`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload file
                  </button>
                  <button
                    onClick={() => setShowUploadDropdown(false)}
                    className={`w-full text-left px-3 py-2 text-[12px] rounded-lg transition-colors flex items-center gap-2 ${isLight ? "hover:bg-black/5 text-black/80" : "hover:bg-white/5 text-white/80"}`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    Select asset
                  </button>
                </div>
              )}
            </div>

            {uploadStatus === "error" && errorMsg && (
              <div className="mt-2 mb-2 text-red-500 text-[10px] wrap-break-word">
                {errorMsg}
              </div>
            )}

            <div
              className={`my-1.5 font-medium flex items-center gap-1.5 ${isLight ? "text-black/40" : "text-white/45"}`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                <path d="M18 22V8a2 2 0 0 0-2-2H2" />
              </svg>
              Crop Parameters
            </div>
            {(
              [
                { key: "cropX", label: "X" },
                { key: "cropY", label: "Y" },
                { key: "cropWidth", label: "Width" },
                { key: "cropHeight", label: "Height" },
              ] as const
            ).map(({ key, label }) => {
              const defaultValue =
                key.includes("Width") || key.includes("Height") ? 100 : 0;
              const value = data[key] ?? defaultValue;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between mb-2"
                >
                  <span
                    className={`w-[48px] ${isLight ? "text-black/60" : "text-white/60"}`}
                  >
                    {label}
                  </span>

                  <div
                    className={`flex-1 h-[26px] relative rounded-lg overflow-hidden nodrag ml-2 ${isLight ? "bg-black/5" : "bg-white/5"}`}
                  >
                    {/* The fill bar */}
                    <div
                      className={`absolute top-0 left-0 bottom-0 pointer-events-none transition-all ${isLight ? "bg-black/10" : "bg-white/10"}`}
                      style={{ width: `${value}%` }}
                    />
                    {/* The text */}
                    <div
                      className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] font-medium pointer-events-none ${isLight ? "text-black/80" : "text-white/80"}`}
                    >
                      {value}
                    </div>
                    {/* The actual invisible input */}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={value}
                      onChange={(e) =>
                        updateNodeData(id, { [key]: Number(e.target.value) })
                      }
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer nodrag"
                    />
                  </div>

                  <button
                    onClick={() => updateNodeData(id, { [key]: defaultValue })}
                    className={`w-6 h-6 flex items-center justify-center transition-colors ml-1.5 rounded-md ${isLight ? "text-black/30 hover:text-black/70 hover:bg-black/5" : "text-white/30 hover:text-white/70 hover:bg-white/5"}`}
                    title="Reset to default"
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
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </>
        ) : isExtractFrameNode ? (
          <>
            <div className="relative mt-1 mb-4 w-full nodrag">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".mp4,.mov,.webm,.m4v"
                onChange={handleFileChange}
              />
              <div
                className={`w-full h-[36px] rounded-xl flex items-center justify-between px-3 cursor-pointer transition-colors border ${isLight ? "bg-white/50 border-black/10 hover:bg-black/5" : "bg-white/5 border-white/5 hover:bg-white/10"}`}
                onClick={() => setShowUploadDropdown(!showUploadDropdown)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span
                    className={`text-[12px] truncate ${isLight ? "text-black/70" : "text-white/70"}`}
                  >
                    {uploadStatus === "uploading"
                      ? `Uploading... ${uploadProgress}%`
                      : uploadStatus === "error"
                        ? "Upload failed"
                        : data.uploadedVideoUrl
                          ? "Video uploaded"
                          : "Add file"}
                  </span>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>

                <Handle
                  type="target"
                  id="in-lower-green"
                  position={Position.Left}
                  className="w-3! h-3! border-none! transition-transform duration-300 z-50! hover:scale-125"
                  style={{
                    top: "50%",
                    left: "-14px",
                    backgroundColor: "#22c55e",
                    boxShadow: `0 0 0 4px rgba(34, 197, 94, 0.4)`,
                  }}
                />
              </div>

              {showUploadDropdown && (
                <div
                  className={`absolute top-[40px] left-0 w-[180px] rounded-xl border p-1 z-50 shadow-xl ${isLight ? "bg-white border-black/10" : "bg-[#202020] border-[#1f1f1f]"}`}
                >
                  <button
                    onClick={() => {
                      setShowUploadDropdown(false);
                      fileInputRef.current?.click();
                    }}
                    className={`w-full text-left px-3 py-2 text-[12px] rounded-lg transition-colors flex items-center gap-2 ${isLight ? "hover:bg-black/5 text-black/80" : "hover:bg-white/5 text-white/80"}`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload file
                  </button>
                  <button
                    onClick={() => setShowUploadDropdown(false)}
                    className={`w-full text-left px-3 py-2 text-[12px] rounded-lg transition-colors flex items-center gap-2 ${isLight ? "hover:bg-black/5 text-black/80" : "hover:bg-white/5 text-white/80"}`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                      <line x1="7" y1="2" x2="7" y2="22" />
                      <line x1="17" y1="2" x2="17" y2="22" />
                    </svg>
                    Select asset
                  </button>
                </div>
              )}
            </div>

            {uploadStatus === "error" && errorMsg && (
              <div className="mt-2 mb-2 text-red-500 text-[10px] wrap-break-word">
                {errorMsg}
              </div>
            )}

            <div
              className={`w-full h-px mb-3 ${isLight ? "bg-black/5" : "bg-white/5"}`}
            />

            <div
              className={`my-1.5 font-medium flex items-center gap-1.5 ${isLight ? "text-black/40" : "text-white/45"}`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Settings
            </div>

            <div
              className={`flex items-center justify-between mb-2.5 ${isLight ? "text-black/40" : "text-white/45"}`}
            >
              <span>Timestamp</span>
              <button
                onClick={() =>
                  updateNodeData(id, {
                    frameTimestampMode:
                      (data.frameTimestampMode ?? "seconds") === "seconds"
                        ? "percentage"
                        : "seconds",
                  })
                }
                className={`h-[24px] rounded-lg border text-[11px] px-2.5 transition-colors flex items-center gap-1.5 ${isLight ? "border-black/5 bg-white text-black/60 hover:bg-black/5" : "border-white/10 bg-black/40 text-[#f6f7fb] hover:bg-white/10"}`}
              >
                {(data.frameTimestampMode ?? "seconds") === "seconds"
                  ? "Seconds"
                  : "Percent"}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span
                className={`w-[48px] ${isLight ? "text-black/60" : "text-white/60"}`}
              >
                {(data.frameTimestampMode ?? "seconds") === "seconds"
                  ? "Time"
                  : "%"}
              </span>

              <div
                className={`flex-1 h-[26px] relative rounded-lg overflow-hidden nodrag ml-2 ${isLight ? "bg-black/5" : "bg-white/5"}`}
              >
                <div
                  className={`absolute top-0 left-0 bottom-0 pointer-events-none transition-all ${isLight ? "bg-black/10" : "bg-white/10"}`}
                  style={{
                    width:
                      (data.frameTimestampMode ?? "seconds") === "percentage"
                        ? `${data.frameTimestamp ?? 0}%`
                        : `${Math.min(((data.frameTimestamp ?? 0) / 300) * 100, 100)}%`,
                  }}
                />
                <div
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] font-medium pointer-events-none ${isLight ? "text-black/80" : "text-white/80"}`}
                >
                  {(data.frameTimestampMode ?? "seconds") === "seconds"
                    ? `${data.frameTimestamp ?? 0}s`
                    : `${data.frameTimestamp ?? 0}%`}
                </div>
                <input
                  type="range"
                  min={0}
                  max={
                    (data.frameTimestampMode ?? "seconds") === "percentage"
                      ? 100
                      : 300
                  }
                  step={
                    (data.frameTimestampMode ?? "seconds") === "percentage"
                      ? 1
                      : 0.1
                  }
                  value={data.frameTimestamp ?? 0}
                  onChange={(e) =>
                    updateNodeData(id, {
                      frameTimestamp: Number(e.target.value),
                    })
                  }
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer nodrag"
                />
              </div>

              <button
                onClick={() => updateNodeData(id, { frameTimestamp: 0 })}
                className={`w-6 h-6 flex items-center justify-center transition-colors ml-1.5 rounded-md ${isLight ? "text-black/30 hover:text-black/70 hover:bg-black/5" : "text-white/30 hover:text-white/70 hover:bg-white/5"}`}
                title="Reset to default"
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
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className={`my-1.5 font-medium ${isLight ? "text-black/40" : "text-white/45"}`}
            >
              Prompt
            </div>
            <textarea
              className={`w-full h-[82px] resize-none rounded-xl border leading-relaxed p-2.5 outline-none mb-2 transition-colors shadow-inner ${isLight ? "bg-[#f9fafb] border-black/5 text-black/80 focus:border-black/10 focus:bg-white" : "bg-[#171717] border-[#202020] text-white/80 focus:border-[#2a2a2a]"}`}
              defaultValue={data.prompt}
              placeholder={data.placeholder}
            />

            <div
              className={`flex items-center justify-between mb-2 text-[10px] ${isLight ? "text-black/30" : "text-white/45"}`}
            >
              <span>{data.lowerLeft}</span>
              <span>{data.lowerRight}</span>
            </div>

            <div
              className={`w-full h-px mb-3 ${isLight ? "bg-black/5" : "bg-white/5"}`}
            />

            <div
              className={`my-1.5 font-medium mt-1 flex items-center gap-1.5 ${isLight ? "text-black/40" : "text-white/45"}`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 3v19M5 8h14M5 16h14"></path>
              </svg>
              Settings
            </div>
            <div
              className={`flex items-center justify-between mb-1.5 ${isLight ? "text-black/40" : "text-white/45"}`}
            >
              <span>Reference Image</span>
              <button
                className={`h-[24px] rounded-lg border text-[11px] px-2.5 transition-colors ${isLight ? "border-black/5 bg-white text-black/60 hover:bg-black/5" : "border-white/10 bg-black/40 text-[#f6f7fb] hover:bg-white/10"}`}
              >
                Add file
              </button>
            </div>
            <div
              className={`flex items-center justify-between mb-1.5 ${isLight ? "text-black/40" : "text-white/45"}`}
            >
              <span>Aspect Ratio</span>
              <button
                className={`h-[24px] rounded-lg border text-[11px] px-2.5 transition-colors flex items-center gap-1.5 ${isLight ? "border-black/5 bg-white text-black/60 hover:bg-black/5" : "border-white/10 bg-black/40 text-[#f6f7fb] hover:bg-white/10"}`}
              >
                1:1
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
          </>
        )}

        {!isCropNode && !isExtractFrameNode && (
          <div
            className={`absolute right-[-46px] top-[192px] text-[10px] uppercase tracking-wider rotate-90 origin-left ${isLight ? "text-black/30" : "text-white/40"}`}
          >
            {data.rightLabel}
          </div>
        )}
      </div>
    </div>
  );
}
