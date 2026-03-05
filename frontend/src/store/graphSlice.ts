import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { GraphState, MindMapNode, GraphOperation, NodeType, EdgeType } from '../types/graph';
import { placeNewNode, computeDagreLayout } from '../engine/layoutEngine';

const ROOT_ID = 'root';

function createRootNode(): MindMapNode {
  return {
    id: ROOT_ID,
    label: 'Main Topic',
    type: 'root',
    position: { x: 0, y: 0 },
    isPositionedByUser: false,
    metadata: { createdAt: Date.now(), source: 'text' },
  };
}

const initialState: GraphState = {
  nodes: { [ROOT_ID]: createRootNode() },
  edges: {},
  rootNodeId: ROOT_ID,
  version: 0,
};

interface GraphStore {
  graph: GraphState;
  applyOperations: (ops: GraphOperation[]) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  moveNode: (nodeId: string, position: { x: number; y: number }) => void;
  reset: (rootLabel?: string) => void;
  loadGraph: (state: GraphState) => void;
}

export const useGraphStore = create<GraphStore>((set) => ({
  graph: loadFromStorage() ?? initialState,

  applyOperations: (ops) =>
    set((state) => {
      const graph = deepCloneGraph(state.graph);
      const newIdMap: Record<string, string> = {};

      for (const op of ops) {
        if (op.type === 'ADD_NODE') {
          const { id: suppliedId, label, nodeType = 'idea', parentId, relationship, confidence, source = 'ai-generated' } = op.payload;
          const normLabel = label.toLowerCase().trim();

          // Skip dedup for manually-created placeholder nodes (empty label, pre-supplied id)
          if (!suppliedId && normLabel) {
            // Exact case-insensitive duplicate → reuse existing node
            const exactMatch = Object.values(graph.nodes).find(
              (n) => n.label.toLowerCase().trim() === normLabel
            );
            if (exactMatch) {
              newIdMap[`__NEW__:${label}`] = exactMatch.id;
              continue;
            }

            // Near-match: substring containment or >=75% fuzzy similarity
            const nearMatch = Object.values(graph.nodes).find((n) => {
              const existing = n.label.toLowerCase().trim();
              const maxLen = Math.max(normLabel.length, existing.length);
              if (maxLen < 3) return false;
              if (normLabel.includes(existing) || existing.includes(normLabel)) return true;
              return (1 - levenshtein(normLabel, existing) / maxLen) >= 0.75;
            });
            if (nearMatch) {
              newIdMap[`__NEW__:${label}`] = nearMatch.id;
              continue;
            }
          }

          const id = suppliedId ?? uuidv4();
          const resolvedParentId = resolveId(parentId, newIdMap, graph) ?? graph.rootNodeId;
          newIdMap[`__NEW__:${label}`] = id;

          const position = placeNewNode(graph, resolvedParentId);
          graph.nodes[id] = {
            id,
            label,
            type: nodeType,
            position,
            isPositionedByUser: false,
            metadata: { createdAt: Date.now(), source, confidence, originalTranscript: undefined },
          };

          if (resolvedParentId && graph.nodes[resolvedParentId]) {
            const edgeId = uuidv4();
            graph.edges[edgeId] = {
              id: edgeId,
              source: resolvedParentId,
              target: id,
              label: relationship,
              type: 'hierarchical',
            };
          }
        } else if (op.type === 'ADD_EDGE') {
          const { sourceId, targetId, label, edgeType = 'associative' } = op.payload;
          const src = resolveId(sourceId, newIdMap, graph);
          const tgt = resolveId(targetId, newIdMap, graph);
          if (src && tgt && graph.nodes[src] && graph.nodes[tgt]) {
            const edgeExists = Object.values(graph.edges).some(
              (e) => e.source === src && e.target === tgt
            );
            if (!edgeExists) {
              const edgeId = uuidv4();
              graph.edges[edgeId] = { id: edgeId, source: src, target: tgt, label, type: edgeType as EdgeType };
            }
          }
        } else if (op.type === 'UPDATE_NODE') {
          const { nodeId, label, nodeType } = op.payload;
          const id = resolveId(nodeId, newIdMap, graph);
          if (id && graph.nodes[id]) {
            if (label !== undefined) graph.nodes[id].label = label;
            if (nodeType !== undefined) graph.nodes[id].type = nodeType as NodeType;
          }
        } else if (op.type === 'DELETE_NODE') {
          const { nodeId, deleteChildren } = op.payload;
          const id = resolveId(nodeId, newIdMap, graph);
          if (!id || id === graph.rootNodeId) continue;

          if (deleteChildren) {
            deleteSubtree(graph, id);
          } else {
            const parentEdge = Object.values(graph.edges).find((e) => e.target === id);
            const children = Object.values(graph.edges)
              .filter((e) => e.source === id)
              .map((e) => e.target);
            if (parentEdge) {
              children.forEach((childId) => {
                const edgeId = uuidv4();
                graph.edges[edgeId] = { id: edgeId, source: parentEdge.source, target: childId, type: 'hierarchical' };
              });
            }
            removeNode(graph, id);
          }
        }
      }

      graph.version++;

      // Auto re-layout: reposition all non-user-dragged nodes via Dagre
      const positions = computeDagreLayout(graph);
      for (const [id, pos] of Object.entries(positions)) {
        if (graph.nodes[id] && !graph.nodes[id].isPositionedByUser) {
          graph.nodes[id].position = pos;
        }
      }

      saveToStorage(graph);
      return { graph };
    }),

  updateNodeLabel: (nodeId, label) =>
    set((state) => {
      if (!state.graph.nodes[nodeId]) return state;
      const graph = deepCloneGraph(state.graph);
      graph.nodes[nodeId].label = label;
      graph.version++;
      saveToStorage(graph);
      return { graph };
    }),

  moveNode: (nodeId, position) =>
    set((state) => {
      if (!state.graph.nodes[nodeId]) return state;
      const graph = deepCloneGraph(state.graph);
      graph.nodes[nodeId].position = position;
      graph.nodes[nodeId].isPositionedByUser = true;
      saveToStorage(graph);
      return { graph };
    }),

  reset: (rootLabel = 'Main Topic') =>
    set(() => {
      const root = createRootNode();
      root.label = rootLabel;
      const graph: GraphState = { nodes: { [ROOT_ID]: root }, edges: {}, rootNodeId: ROOT_ID, version: 0 };
      saveToStorage(graph);
      return { graph };
    }),

  loadGraph: (graph) => set(() => { saveToStorage(graph); return { graph }; }),
}));

// --- helpers ---

function resolveId(id: string | undefined, newIdMap: Record<string, string>, graph: GraphState): string | undefined {
  if (!id) return undefined;
  if (id.startsWith('__NEW__:')) return newIdMap[id];
  if (graph.nodes[id]) return id;
  return newIdMap[id] ?? id;
}

function deepCloneGraph(g: GraphState): GraphState {
  return {
    nodes: { ...Object.fromEntries(Object.entries(g.nodes).map(([k, v]) => [k, { ...v, metadata: { ...v.metadata }, position: { ...v.position } }])) },
    edges: { ...Object.fromEntries(Object.entries(g.edges).map(([k, v]) => [k, { ...v }])) },
    rootNodeId: g.rootNodeId,
    version: g.version,
  };
}

function removeNode(graph: GraphState, nodeId: string) {
  delete graph.nodes[nodeId];
  Object.keys(graph.edges).forEach((eid) => {
    const e = graph.edges[eid];
    if (e.source === nodeId || e.target === nodeId) delete graph.edges[eid];
  });
}

function deleteSubtree(graph: GraphState, nodeId: string) {
  const children = Object.values(graph.edges).filter((e) => e.source === nodeId).map((e) => e.target);
  children.forEach((childId) => deleteSubtree(graph, childId));
  removeNode(graph, nodeId);
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

const STORAGE_KEY = 'mindmap-graph';

function saveToStorage(graph: GraphState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(graph)); } catch {}
}

function loadFromStorage(): GraphState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
