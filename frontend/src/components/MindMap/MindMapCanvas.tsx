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
  type NodeDragHandler,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../store/graphSlice';
import { useHistoryStore } from '../../store/historySlice';
import { useUIStore } from '../../store/uiSlice';
import { computeDagreLayout } from '../../engine/layoutEngine';
import type { GraphState } from '../../types/graph';
import { MindMapNodeComponent } from './nodes/MindMapNode';
import { LabeledEdge } from './edges/LabeledEdge';

const nodeTypes = { mindmap: MindMapNodeComponent };
const edgeTypes = { labeled: LabeledEdge };

interface ContextMenu { x: number; y: number }

/** Collect all descendant IDs of a collapsed node */
function getCollapsedDescendants(graph: GraphState): Set<string> {
  const hidden = new Set<string>();
  const collect = (nodeId: string) => {
    for (const e of Object.values(graph.edges)) {
      if (e.source === nodeId && !hidden.has(e.target)) {
        hidden.add(e.target);
        collect(e.target);
      }
    }
  };
  for (const node of Object.values(graph.nodes)) {
    if (node.collapsed) collect(node.id);
  }
  return hidden;
}

/** Count direct children */
function childCount(graph: GraphState, nodeId: string): number {
  return Object.values(graph.edges).filter((e) => e.source === nodeId).length;
}

/** Count all descendants */
function descendantCount(graph: GraphState, nodeId: string): number {
  let count = 0;
  const visit = (id: string) => {
    for (const e of Object.values(graph.edges)) {
      if (e.source === id) { count++; visit(e.target); }
    }
  };
  visit(nodeId);
  return count;
}

export function MindMapCanvas() {
  const { graph, moveNode, reparentNode, loadGraph, applyOperations } = useGraphStore();
  const { snapshot } = useHistoryStore();
  const { searchQuery, isSearchActive } = { isSearchActive: useUIStore((s) => s.isSearchOpen && s.searchQuery.length > 0), searchQuery: useUIStore((s) => s.searchQuery) };
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const hiddenIds = useMemo(() => getCollapsedDescendants(graph), [graph]);

  const rfNodes: Node[] = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return Object.values(graph.nodes)
      .filter((n) => !hiddenIds.has(n.id))
      .map((n) => {
        const cc = childCount(graph, n.id);
        const dc = descendantCount(graph, n.id);
        const isSearchMatch = isSearchActive ? n.label.toLowerCase().includes(q) : false;
        return {
          id: n.id,
          type: 'mindmap',
          position: n.position,
          data: {
            label: n.label,
            nodeType: n.type,
            confidence: n.metadata.confidence,
            collapsed: n.collapsed,
            childCount: n.collapsed ? dc : cc,
            color: n.color,
            hasNotes: !!(n.notes?.trim()),
            isSearchMatch,
            isSearchActive,
          },
          draggable: true,
        };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, hiddenIds, searchQuery, isSearchActive]);

  const rfEdges: Edge[] = useMemo(() =>
    Object.values(graph.edges)
      .filter((e) => !hiddenIds.has(e.source) && !hiddenIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'labeled',
        label: e.label,
        animated: e.type === 'causal',
      })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [graph.edges, hiddenIds, graph.version]);

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

  const REPARENT_DISTANCE = 80; // px proximity threshold

  const onNodeDragStop: NodeDragHandler = useCallback((_event, draggedNode) => {
    if (draggedNode.id === graph.rootNodeId) return;
    // Find the closest other node within threshold
    let closest: { id: string; dist: number } | null = null;
    for (const n of Object.values(graph.nodes)) {
      if (n.id === draggedNode.id || hiddenIds.has(n.id)) continue;
      const dx = n.position.x - draggedNode.position.x;
      const dy = n.position.y - draggedNode.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < REPARENT_DISTANCE && (!closest || dist < closest.dist)) {
        closest = { id: n.id, dist };
      }
    }
    if (closest) {
      // Check if it's already the parent
      const currentParentEdge = Object.values(graph.edges).find(
        (e) => e.target === draggedNode.id && e.type === 'hierarchical'
      );
      if (currentParentEdge?.source !== closest.id) {
        snapshot(graph);
        reparentNode(draggedNode.id, closest.id);
      }
    }
  }, [graph, hiddenIds, snapshot, reparentNode]);

  const handleRelayout = useCallback(() => {
    snapshot(graph);
    const positions = computeDagreLayout(graph);
    const updated = { ...graph, nodes: { ...graph.nodes } };
    Object.entries(positions).forEach(([id, pos]) => {
      if (updated.nodes[id]) updated.nodes[id] = { ...updated.nodes[id], position: pos, isPositionedByUser: false };
    });
    loadGraph(updated);
  }, [graph, snapshot, loadGraph]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onPaneContextMenu = useCallback((e: any) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleAddStandaloneNode = useCallback(() => {
    setContextMenu(null);
    const newId = uuidv4();
    snapshot(graph);
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
        onNodeDragStop={onNodeDragStop}
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
            const d = n.data as Record<string, string | undefined>;
            if (d.color) return d.color;
            return d.nodeType === 'root' ? '#7c3aed' : d.nodeType === 'topic' ? '#1d4ed8' : d.nodeType === 'question' ? '#92400e' : d.nodeType === 'action' ? '#065f46' : '#374151';
          }}
          className="!bg-gray-900 !border-gray-700"
        />
      </ReactFlow>

      <button
        onClick={handleRelayout}
        className="absolute bottom-4 right-28 px-3 py-1.5 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors z-10"
      >Re-layout</button>

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
