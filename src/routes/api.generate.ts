import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { chatComplete } from '@/lib/ai/router'
import { buildMessages, buildTitle } from '@/lib/prompts'
import { getToolById } from '@/lib/tools'
import { moduleLogger } from '@/lib/logger'
import { getApiSession } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginGuard } from '@/lib/security/http'

const log = moduleLogger('generate')
const requestSchema = z.object({
  toolId: z.string().min(1).max(80),
  inputs: z.record(z.string(), z.string().max(10000)),
}).strict()

type ChatMessage = { role: 'assistant' | 'user'; content: string }

export const Route = createFileRoute('/api/generate')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied

        try {
          const session = await getApiSession()
          if (!session) {
            return Response.json(
              { error: 'Masuk terlebih dahulu untuk membuat dan menyimpan hasil.' },
              { status: 401 },
            )
          }

          if (!rateLimit('generate:' + session.user.id, 8, 10 * 60 * 1000)) {
            return Response.json(
              { error: 'Batas generasi tercapai. Coba lagi beberapa menit.' },
              { status: 429 },
              )
          }

          const raw = await request.text()
          if (new TextEncoder().encode(raw).byteLength > 64_000) {
            return Response.json({ error: 'Payload terlalu besar.' }, { status: 413 })
          }

          let body: unknown
          try {
            body = JSON.parse(raw)
          } catch {
            return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
          }

          const parsed = requestSchema.safeParse(body)
          if (!parsed.success) {
            return Response.json({ error: 'Input generasi tidak valid.' }, { status: 400 })
          }

          const tool = getToolById(parsed.data.toolId)
          if (!tool) {
            return Response.json({ error: 'Tool tidak dikenali.' }, { status: 400 })
          }

          const allowedFields = new Set(tool.fields.map((field) => field.id))
          if (Object.keys(parsed.data.inputs).some((key) => !allowedFields.has(key))) {
            return Response.json({ error: 'Field input tidak dikenal.' }, { status: 400 })
          }

          const inputs: Record<string, string> = {}
          for (const field of tool.fields) {
            const value = (parsed.data.inputs[field.id] ?? '').trim()
            if (field.required && !value) {
              return Response.json(
                { error: 'Kolom "' + field.label + '" wajib diisi.' },
                { status: 400 },
              )
            }
            if (field.type === 'select' && value && field.options && !field.options.includes(value)) {
              return Response.json({ error: 'Pilihan pada kolom "' + field.label + '" tidak valid.' }, { status: 400 })
            }
            inputs[field.id] = value
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
              if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500))
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
            toolId: saved.toolId,
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
