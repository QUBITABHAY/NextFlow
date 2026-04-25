import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);
  const { isLight } = useTheme();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = () => {
    setEdges((edges) => edges.filter((e) => e.id !== id));
  };

  // Determine base color from style.stroke
  const strokeColor = style.stroke || "#e3c92f";

  return (
    <>
      <g
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="cursor-pointer"
      >
        {/* Invisible wider path for easier hovering */}
        <path
          d={edgePath}
          fill="none"
          strokeOpacity={0}
          strokeWidth={24}
          className="react-flow__edge-interaction"
        />
        <BaseEdge
          path={edgePath}
          markerEnd={markerEnd}
          style={{ ...style, strokeOpacity: isLight ? 0.6 : 0.4 }}
        />
      </g>
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            zIndex: 1000,
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button
            onClick={onEdgeClick}
            style={{
              backgroundColor: strokeColor,
              opacity: isHovered ? 1 : 0,
              transition: "opacity 0.2s ease-in-out",
            }}
            className="w-[22px] h-[22px] flex items-center justify-center rounded-full text-white shadow-lg hover:scale-110 transition-transform"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
