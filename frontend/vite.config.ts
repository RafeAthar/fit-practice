import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import Anthropic from '@anthropic-ai/sdk'
import { loadEnv } from 'vite'
import type { Plugin, Connect } from 'vite'
import type { ServerResponse } from 'node:http'

function mindmapApiPlugin(): Plugin {
  return {
    name: 'mindmap-api',
    configureServer(server) {
      server.middlewares.use('/api/process-input', async (req: Connect.IncomingMessage, res: ServerResponse) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204)
          res.end()
          return
        }
        if (req.method !== 'POST') {
          res.writeHead(405)
          res.end('Method Not Allowed')
          return
        }

        // Load .env from one directory up (repo root)
        const env = loadEnv('development', process.cwd() + '/..', '')
        const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY

        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in .env' }))
          return
        }

        // Read request body
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const body = JSON.parse(Buffer.concat(chunks).toString())
        const { systemPrompt, context, userInput, tool } = body

        try {
          const client = new Anthropic({ apiKey })
          const message = await client.messages.create({
            model: 'claude-sonnet-4-6',
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
          })

          const toolUseBlock = message.content.find((b) => b.type === 'tool_use')
          if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'No tool_use block in response' }))
            return
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ toolResult: toolUseBlock.input }))
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mindmapApiPlugin()],
})
