"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useFlowStore } from "@/store/useFlowStore";
import { useTheme } from "@/hooks/useTheme";
import { useRef, useState, useCallback } from "react";

export type MediaNodeData = {
  type: "image" | "video";
  url?: string;
  fileType?: string;
};

const IMAGE_ACCEPT = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];
const VIDEO_ACCEPT = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
];
const IMAGE_EXT = ".jpg,.jpeg,.png,.webp,.gif";
const VIDEO_EXT = ".mp4,.mov,.webm,.m4v";

type UploadStatus = "idle" | "uploading" | "done" | "error";

export function MediaNode({
  id,
  data,
  selected,
}: NodeProps<Node<MediaNodeData>>) {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isImage = data.type === "image";
  const label = isImage ? "Image" : "Video";
  const color = isImage ? "#1188ff" : "#22c55e";
  const handleId = isImage ? "blue" : "green";

  const [isHovering, setIsHovering] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const { isLight } = useTheme();

  const hideTargetDot = data.url && !isHovering && !selected;
  const hideSourceDot = data.url && !isHovering && !selected;

  const Icon = isImage ? (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ) : (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={color}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );

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
        updateNodeData(id, { url: result.url, fileType: file.type });
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

    const allowed = isImage ? IMAGE_ACCEPT : VIDEO_ACCEPT;
    if (!allowed.includes(file.type)) {
      setUploadStatus("error");
      setErrorMsg(
        isImage
          ? "Only JPG, JPEG, PNG, WEBP, GIF files are allowed"
          : "Only MP4, MOV, WEBM, M4V files are allowed",
      );
      return;
    }

    uploadToTransloadit(file);
    // Reset input so same file can be re-uploaded
    e.target.value = "";
  };

  const handleClear = () => {
    updateNodeData(id, { url: undefined, fileType: undefined });
    setUploadStatus("idle");
    setUploadProgress(0);
    setErrorMsg("");
  };

  return (
    <div className="relative font-(--font-space-grotesk)">
      {/* Floating Top Label */}
      <div className="absolute top-[-28px] left-3 flex items-center gap-2">
        {Icon}
        <span
          className={`${isLight ? "text-black/50" : "text-white/40"} text-[15px] font-medium tracking-wide`}
        >
          {label}
        </span>
      </div>

      {/* Main Card */}
      <div
        className={`rounded-3xl transition-all box-border flex items-center justify-evenly relative ${isLight ? "bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-transparent" : "bg-[#1c1e24] shadow-2xl border-transparent"} ${data.url ? "p-0 w-auto h-auto border-none" : "w-[320px] h-[210px] p-4 border-2"}`}
        style={{
          borderColor:
            selected && !data.url
              ? color
              : isLight && !data.url
                ? "rgba(0,0,0,0.05)"
                : "rgba(255,255,255,0.0)",
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {data.url ? (
          <div
            className={`relative group rounded-[22px] overflow-hidden flex items-center justify-center transition-all duration-200`}
          >
            {/* Selection ring */}
            <div
              className={`absolute inset-0 z-20 pointer-events-none rounded-[22px] transition-all duration-200 ${selected ? "border-[3.5px]" : "border-0"}`}
              style={{ borderColor: color }}
            />

            {isImage ? (
              <img
                src={data.url}
                alt="Uploaded media"
                className="max-w-[400px] max-h-[600px] w-auto h-auto block"
              />
            ) : (
              <video
                src={data.url}
                controls
                className="max-w-[400px] max-h-[600px] w-auto h-auto block bg-black"
              />
            )}

            {/* Dark overlay on hover */}
            <div
              className={`absolute inset-0 bg-black/20 transition-opacity duration-200 pointer-events-none ${isHovering ? "opacity-100" : "opacity-0"}`}
            />

            {/* Top Toolbar (Hover) */}
            <div
              className={`absolute top-0 left-0 w-full p-4 flex justify-between items-center bg-linear-to-b from-black/60 to-transparent transition-opacity duration-200 ${isHovering ? "opacity-100" : "opacity-0"} z-30`}
            >
              <button
                onClick={handleClear}
                className="text-white hover:text-red-400 transition-colors pointer-events-auto"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
              <div className="flex items-center gap-4 text-white pointer-events-auto">
                {/* Copy URL */}
                <button
                  onClick={() => navigator.clipboard.writeText(data.url ?? "")}
                  title="Copy URL"
                  className="hover:text-white/80 transition-colors"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect
                      x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      ry="2"
                    ></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
                {/* Open in new tab */}
                <button
                  onClick={() => window.open(data.url, "_blank")}
                  title="Open in new tab"
                  className="hover:text-white/80 transition-colors"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <polyline points="9 21 3 21 3 15"></polyline>
                    <line x1="21" y1="3" x2="14" y2="10"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </svg>
                </button>
              </div>
            </div>

            {/* URL badge at bottom */}
            <div
              className={`absolute bottom-0 left-0 w-full px-3 py-2 flex items-center gap-2 bg-linear-to-t from-black/60 to-transparent transition-opacity duration-200 z-30 ${isHovering ? "opacity-100" : "opacity-0"}`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span className="text-white/80 text-[11px] truncate max-w-[280px] font-mono">
                {data.url}
              </span>
            </div>
          </div>
        ) : (
          <>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept={isImage ? IMAGE_EXT : VIDEO_EXT}
              onChange={handleFileChange}
            />

            {/* Uploading state */}
            {uploadStatus === "uploading" ? (
              <div className="flex flex-col items-center justify-center gap-4 w-full px-8">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLight ? "bg-black/5" : "bg-white/5"}`}
                >
                  <svg
                    className="animate-spin"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </div>
                <div className="w-full">
                  <div
                    className={`flex justify-between text-[12px] mb-1.5 ${isLight ? "text-black/40" : "text-white/40"}`}
                  >
                    <span>Uploading…</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div
                    className={`w-full h-1 rounded-full ${isLight ? "bg-black/10" : "bg-white/10"}`}
                  >
                    <div
                      className="h-1 rounded-full transition-all duration-300"
                      style={{
                        width: `${uploadProgress}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : uploadStatus === "error" ? (
              <div className="flex flex-col items-center justify-center gap-3 w-full px-6 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-500/10">
                  <svg
                    width="22"
                    height="22"
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
                </div>
                <p className="text-red-400 text-[13px] font-medium">
                  {errorMsg}
                </p>
                <button
                  onClick={() => {
                    setUploadStatus("idle");
                    setErrorMsg("");
                  }}
                  className="text-[13px] font-medium px-3 py-1 rounded-lg transition-colors nodrag"
                  style={{
                    color,
                    borderColor: `${color}33`,
                    border: "1px solid",
                  }}
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                {/* Upload Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-3 transition-all w-[130px] h-[160px] rounded-2xl nodrag ${isLight ? "text-black/30 hover:text-black/70 hover:bg-black/5" : "text-white/40 hover:text-white/80 hover:bg-[#2a2a2a]"}`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isLight ? "bg-black/5" : "bg-white/5"}`}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <span className="text-[14px] font-medium block">
                      Upload
                    </span>
                  </div>
                </button>

                {/* Select Asset Button */}
                <button
                  className={`flex flex-col items-center justify-center gap-3 transition-all w-[130px] h-[160px] rounded-2xl ${isLight ? "text-black/30 hover:text-black/70 hover:bg-black/5" : "text-white/40 hover:text-white/80 hover:bg-[#2a2a2a]"}`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isLight ? "bg-black/5" : "bg-white/5"}`}
                  >
                    {isImage ? (
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
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
                    ) : (
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="2"
                          y="2"
                          width="20"
                          height="20"
                          rx="2.18"
                          ry="2.18"
                        />
                        <line x1="7" y1="2" x2="7" y2="22" />
                        <line x1="17" y1="2" x2="17" y2="22" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <line x1="2" y1="7" x2="7" y2="7" />
                        <line x1="2" y1="17" x2="7" y2="17" />
                        <line x1="17" y1="17" x2="22" y2="17" />
                        <line x1="17" y1="7" x2="22" y2="7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[14px] font-medium">Select asset</span>
                </button>
              </>
            )}
          </>
        )}

        <Handle
          type="target"
          id={`in-${handleId}`}
          position={Position.Left}
          className="w-4! h-4! border-none! transition-all duration-300 z-50!"
          style={{
            top: "50%",
            left: "0px",
            backgroundColor: color,
            boxShadow: !hideTargetDot ? `0 0 0 6px ${color}66` : "none",
            opacity: hideTargetDot ? 0 : 1,
            pointerEvents: "auto",
          }}
        />
        <Handle
          type="source"
          id={`out-${handleId}`}
          position={Position.Right}
          className="w-4! h-4! border-none! transition-all duration-300 z-50!"
          style={{
            top: "50%",
            right: "0px",
            backgroundColor: color,
            boxShadow: !hideSourceDot ? `0 0 0 6px ${color}66` : "none",
            opacity: hideSourceDot ? 0 : 1,
            pointerEvents: "auto",
          }}
        />
      </div>
    </div>
  );
}
