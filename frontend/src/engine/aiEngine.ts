import { SYSTEM_PROMPT, buildContextSnapshot, UPDATE_MIND_MAP_TOOL } from './prompts';
import { resolveOperations } from './operationResolver';
import type { GraphOperation, GraphState } from '../types/graph';

interface AIEngineResult {
  ops: GraphOperation[];
  thinking: string;
  warnings: string[];
}

const MAX_UTTERANCE_HISTORY = 5;
const utteranceHistory: string[] = [];

export async function processInput(input: string, graph: GraphState): Promise<AIEngineResult> {
  utteranceHistory.push(input);
  if (utteranceHistory.length > MAX_UTTERANCE_HISTORY) utteranceHistory.shift();

  const contextSnapshot = buildContextSnapshot(graph, utteranceHistory.slice(0, -1));

  const response = await fetch('/api/process-input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt: SYSTEM_PROMPT,
      context: contextSnapshot,
      userInput: input,
      tool: UPDATE_MIND_MAP_TOOL,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const toolResult = data.toolResult;

  if (!toolResult || !Array.isArray(toolResult.operations)) {
    throw new Error('Invalid response from API: missing operations array');
  }

  const thinking = toolResult.thinking ?? '';
  const { ops, warnings } = resolveOperations(toolResult.operations, graph);

  return { ops, thinking, warnings };
}

export async function expandBranch(nodeId: string, nodeLabel: string, graph: GraphState): Promise<AIEngineResult> {
  // Build context showing the subtree under this node so AI doesn't duplicate
  const contextSnapshot = buildContextSnapshot(graph, []);

  const systemPrompt = `You are an AI assistant helping expand a mind map node with relevant child ideas.
The user wants to brainstorm and explore the concept: "${nodeLabel}".

## CRITICAL: No Duplicate Nodes
Check the existing nodes list below. Do NOT create any node that already exists under this node or anywhere in the map.

## Rules
1. Generate 3-6 meaningful, distinct child concepts for the given node
2. Each child should be a concise label (2-6 words)
3. Cover different angles: sub-topics, examples, related questions, actions, etc.
4. Use nodeType: "topic" for major sub-areas, "idea" for specific concepts, "question" for unknowns, "action" for tasks
5. Set parentId to the node's exact ID: "${nodeId}"
6. All operations must be ADD_NODE only — no edges, no updates, no deletes
7. Set confidence = 1 for all suggestions

Call update_mind_map with only ADD_NODE operations for the children.`;

  const userInput = `Suggest 3-6 child nodes to expand the concept: "${nodeLabel}" (id: ${nodeId})`;

  const response = await fetch('/api/process-input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt,
      context: contextSnapshot,
      userInput,
      tool: UPDATE_MIND_MAP_TOOL,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const toolResult = data.toolResult;

  if (!toolResult || !Array.isArray(toolResult.operations)) {
    throw new Error('Invalid response from API: missing operations array');
  }

  const thinking = toolResult.thinking ?? '';
  // Filter to ADD_NODE only and force parentId
  const filteredOps = (toolResult.operations as GraphOperation[]).filter(
    (op) => op.type === 'ADD_NODE'
  ).map((op) => ({
    ...op,
    payload: { ...op.payload, parentId: op.payload.parentId || nodeId },
  }));

  const { ops, warnings } = resolveOperations(filteredOps, graph);

  return { ops, thinking, warnings };
}

export function clearHistory() {
  utteranceHistory.length = 0;
}
