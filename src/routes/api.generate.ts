import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { chatComplete } from '@/lib/ai/router'
import { buildMessages, buildTitle } from '@/lib/prompts'
import { getToolById } from '@/lib/tools'
import { moduleLogger } from '@/lib/logger'
import { getApiSession } from '@/lib/session'

const log = moduleLogger('generate')

type ChatMessage = { role: 'assistant' | 'user'; content: string }

export const Route = createFileRoute('/api/generate')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const session = await getApiSession()
          if (!session) {
            return Response.json({ error: 'Masuk terlebih dahulu untuk membuat dan menyimpan hasil.' }, { status: 401 })
          }
          const body = await request.json().catch(() => null)
          const toolId = typeof body?.toolId === 'string' ? body.toolId : ''
          const inputs: Record<string, string> =
            body?.inputs && typeof body.inputs === 'object' ? body.inputs : {}

          const tool = getToolById(toolId)
          if (!tool) {
            return Response.json({ error: 'Tool tidak dikenali.' }, { status: 400 })
          }

          for (const field of tool.fields) {
            const value = String(inputs[field.id] ?? '').trim()
            if (field.required && !value) {
              return Response.json(
                { error: `Kolom "${field.label}" wajib diisi.` },
                { status: 400 },
              )
            }
          }

          const messages: ChatMessage[] = buildMessages(tool.id, inputs)

          let output = ''
          let lastError: unknown = null
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              output = await chatComplete(messages)
              if (output.trim()) break
              throw new Error('Respons AI kosong')
            } catch (err) {
              lastError = err
              output = ''
              if (attempt < 2) await new Promise((r) => setTimeout(r, 1500))
            }
          }

          if (!output.trim()) {
            log.error(
              {
                toolId: tool.id,
                err: lastError instanceof Error ? lastError.message.slice(0, 200) : 'unknown',
              },
              'AI gagal menghasilkan jawaban',
            )
            return Response.json(
              { error: 'AI gagal menghasilkan jawaban. Silakan coba lagi.' },
              { status: 502 },
            )
          }

          const title = buildTitle(tool.id, inputs)
          const saved = await db.generation.create({
            data: {
              userId: session.user.id,
              toolId: tool.id,
              title,
              inputs: JSON.stringify(inputs),
              output,
            },
          })

          return Response.json({
            id: saved.id,
            toolId: tool.id,
            title: saved.title,
            output: saved.output,
            createdAt: saved.createdAt,
          })
        } catch (err) {
          log.error(
            { err: err instanceof Error ? err.message.slice(0, 200) : 'unknown' },
            'generate error',
          )
          return Response.json(
            { error: 'Terjadi kesalahan di server. Silakan coba lagi.' },
            { status: 500 },
          )
        }
      },
    },
  },
})
