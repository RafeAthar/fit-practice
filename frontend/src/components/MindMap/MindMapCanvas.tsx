import { useCallback, useMemo } from 'react';
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

export function MindMapCanvas() {
  const { graph, moveNode, loadGraph } = useGraphStore();
  const { snapshot } = useHistoryStore();

  // Convert graph state to React Flow format
  const rfNodes: Node[] = useMemo(
    () =>
      Object.values(graph.nodes).map((n) => ({
        id: n.id,
        type: 'mindmap',
        position: n.position,
        data: { label: n.label, nodeType: n.type, confidence: n.metadata.confidence },
        draggable: true,
      })),
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
    [graph.edges, graph.version]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const posChanges = changes.filter((c) => c.type === 'position' && c.dragging === false);
      posChanges.forEach((c) => {
        if (c.type === 'position' && c.position) {
          moveNode(c.id, c.position);
        }
      });
      // For other changes (selection, etc.) apply normally via applyNodeChanges
      applyNodeChanges(changes, rfNodes);
    },
    [rfNodes, moveNode]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      applyEdgeChanges(changes, rfEdges);
    },
    [rfEdges]
  );

  const handleRelayout = useCallback(() => {
    snapshot(graph);
    const positions = computeDagreLayout(graph);
    const updated = { ...graph, nodes: { ...graph.nodes } };
    Object.entries(positions).forEach(([id, pos]) => {
      if (updated.nodes[id]) {
        updated.nodes[id] = { ...updated.nodes[id], position: pos, isPositionedByUser: false };
      }
    });
    loadGraph(updated);
  }, [graph, snapshot, loadGraph]);

  return (
    <div className="w-full h-full bg-gray-950">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
    </div>
  );
}
