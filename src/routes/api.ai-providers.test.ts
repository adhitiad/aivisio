import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { testProvider } from '@/lib/ai/router'
import { moduleLogger } from '@/lib/logger'
import { adminGate } from '@/lib/admin-gate'
import { sameOriginGuard } from '@/lib/security/http'
import { decryptProviderApiKey } from '@/lib/provider-secrets'

const log = moduleLogger('ai-providers-test')
const schema = z.object({
  key: z.string().min(1).max(80),
  baseUrl: z.string().max(500).optional(),
  model: z.string().max(200).optional(),
  apiKey: z.string().max(4096).optional(),
}).strict()

export const Route = createFileRoute('/api/ai-providers/test')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied
        const denied = await adminGate()
        if (denied) return denied

        try {
          const raw = await request.text()
          if (new TextEncoder().encode(raw).byteLength > 16_000) {
            return Response.json({ error: 'Payload terlalu besar.' }, { status: 413 })
          }
          const parsed = schema.safeParse(JSON.parse(raw))
          if (!parsed.success) {
            return Response.json({ error: 'Parameter provider tidak valid.' }, { status: 400 })
          }

          const input = parsed.data
          const stored = await db.aiProvider.findUnique({ where: { key: input.key } })
          if (!stored) {
            return Response.json({ error: 'Provider tidak ditemukan.' }, { status: 404 })
          }

          const result = await testProvider({
            key: input.key,
            baseUrl: input.baseUrl?.trim() || stored.baseUrl,
            model: input.model?.trim() || stored.model,
            apiKey: input.apiKey || decryptProviderApiKey(stored.apiKey),
          })

          await db.aiProvider.update({
            where: { key: input.key },
            data: {
              status: result.ok ? 'ok' : 'error',
              statusMessage: result.ok
                ? 'OK - ' + result.latencyMs + ' ms'
                : (result.error ?? 'Gagal').slice(0, 300),
              lastCheckedAt: new Date(),
            },
          })

          if (result.ok) {
            log.info({ key: input.key, latencyMs: result.latencyMs }, 'tes koneksi provider sukses')
          } else {
            log.warn({ key: input.key, error: result.error?.slice(0, 160) }, 'tes koneksi provider gagal')
          }
          return Response.json(result)
        } catch (err) {
          log.error({ err: String(err).slice(0, 200) }, 'POST test provider gagal')
          return Response.json({ error: 'Gagal menguji koneksi.' }, { status: 400 })
        }
      },
    },
  },
})
