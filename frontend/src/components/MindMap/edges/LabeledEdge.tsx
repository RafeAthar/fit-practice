import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps } from '@xyflow/react';

export function LabeledEdge({ id, sourceX, sourceY, targetX, targetY, label, markerEnd, style }: EdgeProps) {
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 1.5, stroke: 'rgba(148,163,184,0.4)' }} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="absolute pointer-events-none px-1.5 py-0.5 rounded text-[10px] text-gray-400 bg-gray-900/80 border border-gray-700/40"
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
