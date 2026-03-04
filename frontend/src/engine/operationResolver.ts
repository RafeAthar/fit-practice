import type { GraphOperation, GraphState } from '../types/graph';

/**
 * Post-processes raw LLM tool-use output into typed GraphOperations,
 * resolving __NEW__:{label} sentinels and flagging near-duplicates.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveOperations(rawOps: any[], graph: GraphState): { ops: GraphOperation[]; warnings: string[] } {
  const warnings: string[] = [];
  const ops: GraphOperation[] = [];

  for (const raw of rawOps) {
    try {
      const op = normalizeOp(raw, graph, warnings);
      if (op) ops.push(op);
    } catch (e) {
      warnings.push(`Skipped malformed operation: ${JSON.stringify(raw)}`);
    }
  }

  return { ops, warnings };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeOp(raw: any, graph: GraphState, warnings: string[]): GraphOperation | null {
  switch (raw.type) {
    case 'ADD_NODE': {
      if (!raw.label) { warnings.push('ADD_NODE missing label, skipped'); return null; }

      // Fuzzy dedup check
      const duplicate = findNearDuplicate(raw.label, graph);
      if (duplicate) {
        warnings.push(`Node "${raw.label}" is similar to existing "${duplicate.label}" (id: ${duplicate.id}). Consider using UPDATE_NODE instead.`);
      }

      return {
        type: 'ADD_NODE',
        payload: {
          label: raw.label,
          nodeType: raw.nodeType,
          parentId: raw.parentId,
          relationship: raw.relationship,
          confidence: raw.confidence,
          source: 'ai-generated',
        },
      };
    }

    case 'ADD_EDGE': {
      if (!raw.sourceId || !raw.targetId) { warnings.push('ADD_EDGE missing sourceId/targetId, skipped'); return null; }
      return {
        type: 'ADD_EDGE',
        payload: {
          sourceId: raw.sourceId,
          targetId: raw.targetId,
          label: raw.label ?? raw.edgeLabel,
          edgeType: raw.edgeType,
        },
      };
    }

    case 'UPDATE_NODE': {
      if (!raw.nodeId) { warnings.push('UPDATE_NODE missing nodeId, skipped'); return null; }
      return {
        type: 'UPDATE_NODE',
        payload: { nodeId: raw.nodeId, label: raw.label, nodeType: raw.nodeType },
      };
    }

    case 'DELETE_NODE': {
      if (!raw.nodeId) { warnings.push('DELETE_NODE missing nodeId, skipped'); return null; }
      return {
        type: 'DELETE_NODE',
        payload: { nodeId: raw.nodeId, deleteChildren: raw.deleteChildren ?? false },
      };
    }

    default:
      warnings.push(`Unknown operation type: ${raw.type}`);
      return null;
  }
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function findNearDuplicate(label: string, graph: GraphState): { id: string; label: string } | null {
  const norm = label.toLowerCase().trim();
  for (const node of Object.values(graph.nodes)) {
    const existing = node.label.toLowerCase().trim();
    const maxLen = Math.max(norm.length, existing.length);
    if (maxLen === 0) continue;
    const similarity = 1 - levenshtein(norm, existing) / maxLen;
    if (similarity >= 0.85 && norm !== existing) {
      return { id: node.id, label: node.label };
    }
  }
  return null;
}
