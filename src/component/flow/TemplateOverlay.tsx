"use client";

import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from "@/lib/templates";
import { useFlowStore } from "@/store/useFlowStore";

const NODE_COLORS: Record<string, string> = {
  workflowCard: "#22c55e",
  textNode: "#e3c92f",
  mediaNode: "#1188ff",
  llmNode: "#a855f7",
  groupNode: "#6b7280",
};

/** Tiny SVG minimap for a template */
function TemplateMinimap({
  nodes,
  edges,
  isLight,
}: {
  nodes: WorkflowTemplate["nodes"];
  edges: WorkflowTemplate["edges"];
  isLight: boolean;
}) {
  if (nodes.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const defaultW = 200;
  const defaultH = 120;

  for (const n of nodes) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + defaultW);
    maxY = Math.max(maxY, n.position.y + defaultH);
  }

  const pad = 30;
  const bw = maxX - minX + pad * 2;
  const bh = maxY - minY + pad * 2;

  const nodeCenters = new Map<string, { cx: number; cy: number }>();
  for (const n of nodes) {
    nodeCenters.set(n.id, {
      cx: n.position.x - minX + pad + defaultW / 2,
      cy: n.position.y - minY + pad + defaultH / 2,
    });
  }

  return (
    <svg
      viewBox={`0 0 ${bw} ${bh}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {edges.map((e) => {
        const src = nodeCenters.get(e.source);
        const tgt = nodeCenters.get(e.target);
        if (!src || !tgt) return null;
        const dx = tgt.cx - src.cx;
        return (
          <path
            key={e.id}
            d={`M${src.cx},${src.cy} C${src.cx + dx * 0.4},${src.cy} ${tgt.cx - dx * 0.4},${tgt.cy} ${tgt.cx},${tgt.cy}`}
            fill="none"
            stroke={isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)"}
            strokeWidth={Math.max(2, bw * 0.005)}
          />
        );
      })}
      {nodes.map((n) => {
        const color = NODE_COLORS[n.type || ""] || "#6b7280";
        return (
          <rect
            key={n.id}
            x={n.position.x - minX + pad}
            y={n.position.y - minY + pad}
            width={defaultW}
            height={defaultH}
            rx={8}
            fill={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)"}
            stroke={color}
            strokeWidth={Math.max(2, bw * 0.005)}
            strokeOpacity={0.6}
          />
        );
      })}
    </svg>
  );
}

export function TemplateOverlay({
  onDismiss,
  onSelectTemplate,
}: {
  onDismiss: () => void;
  onSelectTemplate: (template: WorkflowTemplate) => void;
}) {
  const { isLight } = useTheme();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/10 pointer-events-auto"
        onClick={onDismiss}
      />
      <div>
        {/* Header */}
        <div className="flex flex-col items-center pt-6 pb-4 px-6">
          <p
            className={`text-[14px] ${isLight ? "text-black/50" : "text-white/50"}`}
          >
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[13px] font-medium mr-1 ${isLight ? "bg-black/5 text-black/70" : "bg-white/10 text-white/70"}`}
            >
              Add a node
            </span>
            or drag and drop media files, or select a preset
          </p>
        </div>

        {/* Template cards */}
        <div className="px-6 pb-4 overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {/* Empty Workflow card */}
            <button
              onClick={onDismiss}
              className={`flex-shrink-0 w-[140px] flex flex-col gap-2`}
            >
              <div
                className={`w-full aspect-[1.3] rounded-xl border flex items-center justify-center transition-all hover:scale-[1.02] ${
                  isLight
                    ? "border-black/5 bg-black/[0.02] hover:bg-black/[0.04]"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full border flex items-center justify-center ${isLight ? "border-black/10 text-black/30" : "border-white/10 text-white/30"}`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
              </div>
              <span
                className={`text-[13px] font-semibold ${isLight ? "text-black" : "text-white"}`}
              >
                Empty Workflow
              </span>
            </button>

            {/* Template cards */}
            {WORKFLOW_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => onSelectTemplate(tpl)}
                className="flex-shrink-0 w-[140px] flex flex-col gap-2 text-left"
              >
                <div
                  className={`w-full aspect-[1.3] rounded-xl border overflow-hidden transition-all hover:scale-[1.02] ${
                    isLight
                      ? "border-black/5 bg-black/[0.02] hover:bg-black/[0.04]"
                      : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="w-full h-full p-2">
                    <TemplateMinimap
                      nodes={tpl.nodes}
                      edges={tpl.edges}
                      isLight={isLight}
                    />
                  </div>
                </div>
                <div>
                  <span
                    className={`text-[13px] font-semibold block leading-tight ${isLight ? "text-black" : "text-white"}`}
                  >
                    {tpl.title}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Dismiss */}
        <div className="flex justify-center pb-5 pt-1">
          <button
            onClick={onDismiss}
            className={`flex items-center gap-1.5 text-[13px] font-medium transition-colors ${isLight ? "text-black/40 hover:text-black/60" : "text-white/40 hover:text-white/60"}`}
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
