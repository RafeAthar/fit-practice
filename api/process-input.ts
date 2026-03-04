/**
 * Edge function: proxies requests to the Anthropic Claude API.
 * Keeps the API key server-side only.
 *
 * Deploy to Vercel, Cloudflare Workers, or run locally with `ts-node api/process-input.ts`
 *
 * Expected POST body:
 * {
 *   systemPrompt: string,
 *   context: string,
 *   userInput: string,
 *   tool: object  (Anthropic tool definition)
 * }
 *
 * Returns: { toolResult: { thinking: string, operations: GraphOperation[] } }
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

interface RequestBody {
  systemPrompt: string;
  context: string;
  userInput: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: any;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { systemPrompt, context, userInput, tool } = body;

  const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [
        {
          role: 'user',
          content: `${context}\n\n## User input:\n"${userInput}"`,
        },
      ],
    }),
  });

  if (!anthropicResponse.ok) {
    const errText = await anthropicResponse.text();
    return new Response(JSON.stringify({ error: errText }), {
      status: anthropicResponse.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  const result = await anthropicResponse.json();

  // Extract tool use block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolUseBlock = result.content?.find((b: any) => b.type === 'tool_use');
  if (!toolUseBlock) {
    return new Response(JSON.stringify({ error: 'No tool use in response', raw: result }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  return new Response(JSON.stringify({ toolResult: toolUseBlock.input }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
