import dagre from '@dagrejs/dagre';
import type { GraphState } from '../types/graph';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;
const RADIAL_GAP = 200; // px between parent and child
const RADIAL_SPREAD = 80; // px between siblings

/**
 * Place a single new node relative to its parent without re-laying out the whole graph.
 * Uses a radial approach: finds existing children of parent, places new node at the next
 * angle offset.
 */
export function placeNewNode(graph: GraphState, parentId: string | undefined): { x: number; y: number } {
  if (!parentId || !graph.nodes[parentId]) {
    // No parent — place near root
    const root = graph.nodes[graph.rootNodeId];
    return root ? { x: root.position.x + RADIAL_GAP, y: root.position.y } : { x: RADIAL_GAP, y: 0 };
  }

  const parent = graph.nodes[parentId];
  const existingChildEdges = Object.values(graph.edges).filter((e) => e.source === parentId);
  const siblingCount = existingChildEdges.length;

  // Lay out children in a vertical fan to the right of the parent
  const totalHeight = siblingCount * RADIAL_SPREAD;
  const startY = parent.position.y - totalHeight / 2;
  const newY = startY + siblingCount * RADIAL_SPREAD;

  return {
    x: parent.position.x + RADIAL_GAP,
    y: newY,
  };
}

/**
 * Full Dagre re-layout for explicit "Re-layout" button.
 * Only repositions nodes that are NOT user-positioned.
 */
export function computeDagreLayout(graph: GraphState): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 });

  Object.values(graph.nodes).forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  Object.values(graph.edges).forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  Object.values(graph.nodes).forEach((node) => {
    if (node.isPositionedByUser) {
      positions[node.id] = node.position;
    } else {
      const pos = g.node(node.id);
      positions[node.id] = { x: pos?.x ?? 0, y: pos?.y ?? 0 };
    }
  });

  return positions;
}
