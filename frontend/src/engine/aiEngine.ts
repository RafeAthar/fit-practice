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

export function clearHistory() {
  utteranceHistory.length = 0;
}
