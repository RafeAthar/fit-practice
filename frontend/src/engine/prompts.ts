import type { GraphState } from '../types/graph';

export const SYSTEM_PROMPT = `You are an AI assistant that helps build mind maps from free-form thinking.
The user will speak or type their thoughts, and you extract concepts and relationships.

## CRITICAL: No Duplicate Nodes
The current mind map node list is your single source of truth.
BEFORE creating any node, scan the entire node list below.
If a concept with the same or very similar label already exists → use its existing ID. Do NOT create a new node.
This is the most important rule. Duplicates break the map.

## Rules
1. Extract concepts as concise node labels (2-7 words)
2. Infer relationships and create edges with short labels ("causes", "requires", "leads to", "part of", "type of", etc.)
3. Always reference existing node IDs from the node list for concepts already present
4. For NEW nodes referenced within the same batch use the sentinel: __NEW__:{label}
5. "and" = sibling nodes under the same parent, not an edge between them
6. Correction phrases ("no wait", "actually", "I mean", "scratch that") → UPDATE the most recent node, not a new one
7. Ambiguous input → emit fewer, higher-confidence operations
8. Set confidence < 0.7 for anything uncertain

## Node types: root | topic | idea | question | action
- root: central topic  |  topic: major branches  |  idea: specific concepts
- question: unknowns/exploration  |  action: things to do

## Output format
Call the update_mind_map tool with a list of operations.`;

export function buildContextSnapshot(graph: GraphState, lastUtterances: string[]): string {
  const nodeLines = Object.values(graph.nodes)
    .map((n) => `  id="${n.id}"  label="${n.label}"  type=${n.type}`)
    .join('\n');

  const edgeLines = Object.values(graph.edges)
    .slice(0, 100)
    .map((e) => `  ${e.source} -[${e.label ?? ''}]-> ${e.target}`)
    .join('\n');

  return `## EXISTING NODES — check these before creating anything new (${Object.keys(graph.nodes).length} total)
${nodeLines || '  (none yet)'}

## Existing edges:
${edgeLines || '  (none)'}

## Recent conversation:
${lastUtterances.map((u, i) => `[${i + 1}] ${u}`).join('\n') || '(none)'}`;
}

export const UPDATE_MIND_MAP_TOOL = {
  name: 'update_mind_map',
  description: "Apply a batch of graph operations to update the mind map. ALWAYS check existing nodes first — never create a node if one with the same label already exists.",
  input_schema: {
    type: 'object',
    properties: {
      thinking: {
        type: 'string',
        description: 'Brief reasoning: which existing nodes you identified, what is genuinely new, and why.',
      },
      operations: {
        type: 'array',
        description: 'Ordered list of graph operations to apply.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['ADD_NODE', 'ADD_EDGE', 'UPDATE_NODE', 'DELETE_NODE'] },
            label: { type: 'string', description: 'Node label (ADD_NODE only) — must not match any existing node label' },
            nodeType: { type: 'string', enum: ['root', 'topic', 'idea', 'question', 'action'] },
            parentId: { type: 'string', description: 'Exact existing node ID or __NEW__:{label} sentinel (ADD_NODE)' },
            relationship: { type: 'string', description: 'Edge label to parent, e.g. "type of", "part of" (ADD_NODE, optional)' },
            confidence: { type: 'number', description: 'Confidence 0-1 (default 1). Use <0.7 if uncertain.' },
            sourceId: { type: 'string', description: 'Exact existing node ID or __NEW__:{label} (ADD_EDGE)' },
            targetId: { type: 'string', description: 'Exact existing node ID or __NEW__:{label} (ADD_EDGE)' },
            edgeType: { type: 'string', enum: ['hierarchical', 'associative', 'causal', 'contradicts'] },
            nodeId: { type: 'string', description: 'Exact existing node ID (UPDATE_NODE, DELETE_NODE)' },
            deleteChildren: { type: 'boolean', description: 'Delete entire subtree? (DELETE_NODE)' },
          },
          required: ['type'],
        },
      },
    },
    required: ['operations'],
  },
};
