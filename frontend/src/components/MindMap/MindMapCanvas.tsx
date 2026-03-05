import { useCallback, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../store/graphSlice';
import { useHistoryStore } from '../../store/historySlice';
import { computeDagreLayout } from '../../engine/layoutEngine';
import { MindMapNodeComponent } from './nodes/MindMapNode';
import { LabeledEdge } from './edges/LabeledEdge';

const nodeTypes = { mindmap: MindMapNodeComponent };
const edgeTypes = { labeled: LabeledEdge };

interface ContextMenu { x: number; y: number; canvasX: number; canvasY: number }

export function MindMapCanvas() {
  const { graph, moveNode, loadGraph, applyOperations } = useGraphStore();
  const { snapshot } = useHistoryStore();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const rfNodes: Node[] = useMemo(
    () =>
      Object.values(graph.nodes).map((n) => ({
        id: n.id,
        type: 'mindmap',
        position: n.position,
        data: { label: n.label, nodeType: n.type, confidence: n.metadata.confidence },
        draggable: true,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph.nodes, graph.version]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      Object.values(graph.edges).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'labeled',
        label: e.label,
        animated: e.type === 'causal',
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph.edges, graph.version]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      changes.filter((c) => c.type === 'position' && c.dragging === false).forEach((c) => {
        if (c.type === 'position' && c.position) moveNode(c.id, c.position);
      });
      applyNodeChanges(changes, rfNodes);
    },
    [rfNodes, moveNode]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => { applyEdgeChanges(changes, rfEdges); },
    [rfEdges]
  );

  const handleRelayout = useCallback(() => {
    snapshot(graph);
    const positions = computeDagreLayout(graph);
    const updated = { ...graph, nodes: { ...graph.nodes } };
    Object.entries(positions).forEach(([id, pos]) => {
      if (updated.nodes[id]) updated.nodes[id] = { ...updated.nodes[id], position: pos, isPositionedByUser: false };
    });
    loadGraph(updated);
  }, [graph, snapshot, loadGraph]);

  // Right-click on empty canvas → context menu
  const onPaneContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ x: e.clientX, y: e.clientY, canvasX: e.clientX - rect.left, canvasY: e.clientY - rect.top });
  }, []);

  const handleAddStandaloneNode = useCallback(() => {
    setContextMenu(null);
    const newId = uuidv4();
    snapshot(graph);
    // Create with empty label — node auto-enters edit mode on mount
    applyOperations([{ type: 'ADD_NODE', payload: { id: newId, label: '', parentId: graph.rootNodeId, source: 'text' } }]);
  }, [graph, snapshot, applyOperations]);

  return (
    <div className="w-full h-full bg-gray-950" onClick={() => setContextMenu(null)}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneContextMenu={onPaneContextMenu}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.04)" />
        <Controls className="!bg-gray-900 !border-gray-700" />
        <MiniMap
          nodeColor={(n) => {
            const type = (n.data as { nodeType?: string }).nodeType;
            return type === 'root' ? '#7c3aed' : type === 'topic' ? '#1d4ed8' : type === 'question' ? '#92400e' : type === 'action' ? '#065f46' : '#374151';
          }}
          className="!bg-gray-900 !border-gray-700"
        />
      </ReactFlow>

      {/* Re-layout button */}
      <button
        onClick={handleRelayout}
        className="absolute bottom-4 right-28 px-3 py-1.5 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors z-10"
        title="Auto re-layout all nodes"
      >
        Re-layout
      </button>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="absolute z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleAddStandaloneNode}
            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/8 flex items-center gap-2 transition-colors"
          >
            <span className="text-emerald-400 text-base leading-none">+</span>
            Add node here
          </button>
          <div className="text-[10px] text-gray-600 px-4 pb-1.5">connects to root by default</div>
        </div>
      )}
    </div>
  );
}
