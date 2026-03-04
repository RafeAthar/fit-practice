import type { GraphState } from '../types/graph';

export const SYSTEM_PROMPT = `You are an AI assistant that helps build mind maps from free-form thinking.
The user will speak or type their thoughts, and you extract concepts and relationships.

## Rules
1. Extract concepts as concise node labels (2-7 words)
2. Infer relationships between concepts and create edges with short labels ("causes", "requires", "leads to", "part of", etc.)
3. Reference existing node IDs exactly when connecting to them — NEVER create a duplicate node for an existing concept
4. For NEW nodes you need to reference within the same batch (forward references), use the sentinel: __NEW__:{label}
5. "and" generally means sibling nodes under the same parent — not an edge between them
6. Correction phrases ("no wait", "actually", "I mean", "scratch that") → UPDATE the most recently added node instead of creating a new one
7. Ambiguous input → emit fewer operations with higher confidence; never guess wildly
8. Set confidence < 0.7 for anything you are not sure about

## Node types: root | topic | idea | question | action
- root: the central topic
- topic: major branches
- idea: specific concepts
- question: things framed as unknowns/exploration
- action: things to do

## Output format
Call the update_mind_map tool with a list of operations.`;

export function buildContextSnapshot(graph: GraphState, lastUtterances: string[]): string {
  const nodeList = Object.values(graph.nodes)
    .map((n) => `  { "id": "${n.id}", "label": "${n.label}", "type": "${n.type}" }`)
    .join('\n');
  const edgeList = Object.values(graph.edges)
    .slice(0, 100) // cap to avoid context overflow
    .map((e) => `  { "from": "${e.source}", "to": "${e.target}", "label": "${e.label ?? ''}" }`)
    .join('\n');

  return `## Current Mind Map (${Object.keys(graph.nodes).length} nodes)
Nodes:
${nodeList || '  (none)'}

Edges:
${edgeList || '  (none)'}

## Recent conversation history:
${lastUtterances.map((u, i) => `[${i + 1}] ${u}`).join('\n') || '(none)'}`;
}

export const UPDATE_MIND_MAP_TOOL = {
  name: 'update_mind_map',
  description: 'Apply a batch of graph operations to update the mind map based on the user\'s input.',
  input_schema: {
    type: 'object',
    properties: {
      thinking: {
        type: 'string',
        description: 'Brief reasoning about what the user is trying to express and how you mapped it to operations.',
      },
      operations: {
        type: 'array',
        description: 'Ordered list of graph operations to apply.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['ADD_NODE', 'ADD_EDGE', 'UPDATE_NODE', 'DELETE_NODE'] },
            label: { type: 'string', description: 'Node label (ADD_NODE only)' },
            nodeType: { type: 'string', enum: ['root', 'topic', 'idea', 'question', 'action'], description: 'Node type (ADD_NODE only)' },
            parentId: { type: 'string', description: 'ID of parent node (ADD_NODE). Use exact node ID or __NEW__:{label} sentinel.' },
            relationship: { type: 'string', description: 'Label for the auto-created edge to parent (ADD_NODE, optional)' },
            confidence: { type: 'number', description: 'Confidence 0-1 (ADD_NODE, optional, default 1)' },
            sourceId: { type: 'string', description: 'Source node ID (ADD_EDGE). Use exact ID or __NEW__:{label}.' },
            targetId: { type: 'string', description: 'Target node ID (ADD_EDGE). Use exact ID or __NEW__:{label}.' },
            edgeType: { type: 'string', enum: ['hierarchical', 'associative', 'causal', 'contradicts'] },
            nodeId: { type: 'string', description: 'Node ID to update/delete (UPDATE_NODE, DELETE_NODE)' },
            deleteChildren: { type: 'boolean', description: 'Whether to delete the entire subtree (DELETE_NODE)' },
          },
          required: ['type'],
        },
      },
    },
    required: ['operations'],
  },
};
