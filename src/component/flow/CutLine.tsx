"use client";

import { useEffect, useRef, useState } from "react";
import { useFlowStore } from "@/store/useFlowStore";
import { useTheme } from "@/hooks/useTheme";

type Point = { x: number; y: number };

/** Cross product of vectors (OA) and (OB). */
function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Check if two line segments (a1-a2) and (b1-b2) intersect. */
function segmentsIntersect(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): boolean {
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }
  return false;
}

/**
 * Query the DOM for rendered edge paths, sample them in screen coordinates,
 * and return edge IDs whose paths intersect the cut line.
 */
function getIntersectedEdgeIds(cutPoints: Point[]): string[] {
  if (cutPoints.length < 2) return [];

  const edgeIds: string[] = [];
  const edgeGroups = document.querySelectorAll(".react-flow__edge");

  for (const group of edgeGroups) {
    const pathEl = group.querySelector(
      "path.react-flow__edge-path",
    ) as SVGPathElement | null;
    // Fall back to any visible path (BaseEdge renders a <path> inside <g>)
    const path =
      pathEl ??
      (group.querySelector("path:not(.react-flow__edge-interaction)") as SVGPathElement | null);
    if (!path) continue;

    const totalLength = path.getTotalLength();
    if (totalLength === 0) continue;

    const ctm = path.getScreenCTM();
    if (!ctm) continue;

    // Sample edge path points in screen coordinates
    const edgePoints: Point[] = [];
    const numSamples = Math.max(20, Math.ceil(totalLength / 4));
    for (let i = 0; i <= numSamples; i++) {
      const l = (i / numSamples) * totalLength;
      const svgPt = path.getPointAtLength(l);
      const sp = svgPt.matrixTransform(ctm);
      edgePoints.push({ x: sp.x, y: sp.y });
    }

    // Check intersection between cut line segments and edge segments
    let hit = false;
    for (let i = 0; i < cutPoints.length - 1 && !hit; i++) {
      for (let j = 0; j < edgePoints.length - 1 && !hit; j++) {
        if (
          segmentsIntersect(
            cutPoints[i],
            cutPoints[i + 1],
            edgePoints[j],
            edgePoints[j + 1],
          )
        ) {
          hit = true;
        }
      }
    }

    if (hit) {
      const edgeId =
        group.getAttribute("data-id") ||
        group.getAttribute("data-testid")?.replace(/^rf__edge-/, "");
      if (edgeId) edgeIds.push(edgeId);
    }
  }

  return edgeIds;
}

function scissorsCursor(light: boolean) {
  const color = light ? "%23000000" : "%23d4d4d4";
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='6' cy='6' r='3'/%3E%3Cpath d='M8.12 8.12 12 12'/%3E%3Cpath d='M20 4 8.12 15.88'/%3E%3Ccircle cx='6' cy='18' r='3'/%3E%3Cpath d='M14.8 14.8 20 20'/%3E%3C/svg%3E") 12 12, crosshair`;
}

export function CutLine() {
  const interactionMode = useFlowStore((s) => s.interactionMode);
  const setInteractionMode = useFlowStore((s) => s.setInteractionMode);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const { isLight } = useTheme();

  const [renderPoints, setRenderPoints] = useState<Point[]>([]);
  const pointsRef = useRef<Point[]>([]);
  const cuttingRef = useRef(false);

  const isCutMode = interactionMode === "cut";

  // Document-level mouse event listeners for cut gesture
  useEffect(() => {
    if (!isCutMode) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      // Only start cutting when clicking on the React Flow canvas
      const target = e.target as HTMLElement;
      if (!target.closest(".react-flow")) return;

      e.preventDefault();
      cuttingRef.current = true;
      pointsRef.current = [{ x: e.clientX, y: e.clientY }];
      setRenderPoints([{ x: e.clientX, y: e.clientY }]);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!cuttingRef.current) return;
      const prev = pointsRef.current[pointsRef.current.length - 1];
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      // Only add point if moved at least 4px (reduce noise)
      if (dx * dx + dy * dy < 16) return;

      const pt = { x: e.clientX, y: e.clientY };
      pointsRef.current.push(pt);
      setRenderPoints([...pointsRef.current]);
    };

    const handleMouseUp = () => {
      if (!cuttingRef.current) return;
      cuttingRef.current = false;

      const ids = getIntersectedEdgeIds(pointsRef.current);
      if (ids.length > 0) {
        // Dispatch through onEdgesChange so undo history is recorded
        onEdgesChange(ids.map((id) => ({ type: "remove" as const, id })));
      }

      pointsRef.current = [];
      setRenderPoints([]);
    };

    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isCutMode, onEdgesChange]);

  // Scissors cursor on the React Flow canvas when in cut mode
  useEffect(() => {
    if (!isCutMode) return;

    const rfEl = document.querySelector(".react-flow") as HTMLElement | null;
    if (rfEl) {
      rfEl.style.cursor = scissorsCursor(isLight);
    }
    return () => {
      if (rfEl) rfEl.style.cursor = "";
    };
  }, [isCutMode, isLight]);

  // Escape to exit cut mode
  useEffect(() => {
    if (!isCutMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cuttingRef.current = false;
        pointsRef.current = [];
        setRenderPoints([]);
        setInteractionMode("select");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCutMode, setInteractionMode]);

  if (!isCutMode || renderPoints.length < 2) return null;

  const pathD = renderPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <svg
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
      width="100%"
      height="100%"
    >
      {/* Glow behind the cut line */}
      <path
        d={pathD}
        fill="none"
        stroke="#ef4444"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.15}
      />
      {/* Main dashed cut line */}
      <path
        d={pathD}
        fill="none"
        stroke="#ef4444"
        strokeWidth={2}
        strokeDasharray="8 4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-24"
          dur="0.6s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}
