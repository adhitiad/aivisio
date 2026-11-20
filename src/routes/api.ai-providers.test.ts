import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { testProvider } from '@/lib/ai/router'
import { moduleLogger } from '@/lib/logger'
import { adminGate } from '@/lib/admin-gate'

const log = moduleLogger('ai-providers-test')

export const Route = createFileRoute('/api/ai-providers/test')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const gated = await adminGate()
        if (gated) return gated
        try {
          const body = await request.json().catch(() => null)
          const key = String(body?.key ?? '')
          if (!key) {
            return Response.json({ error: 'Parameter key wajib.' }, { status: 400 })
          }
          const stored = await db.aiProvider.findUnique({ where: { key } })
          if (!stored) {
            return Response.json({ error: 'Provider tidak ditemukan.' }, { status: 404 })
          }

          const baseUrl =
            typeof body.baseUrl === 'string' && body.baseUrl.trim()
              ? body.baseUrl.trim()
              : stored.baseUrl
          const model =
            typeof body.model === 'string' && body.model.trim()
              ? body.model.trim()
              : stored.model
          const apiKey =
            typeof body.apiKey === 'string' && body.apiKey
              ? body.apiKey
              : stored.apiKey

          const result = await testProvider({ key, baseUrl, apiKey, model })

          await db.aiProvider.update({
            where: { key },
            data: {
              status: result.ok ? 'ok' : 'error',
              statusMessage: result.ok
                ? `OK - ${result.latencyMs} ms${result.sample ? ` (${result.sample})` : ''}`
                : (result.error ?? 'Gagal').slice(0, 300),
              lastCheckedAt: new Date(),
            },
          })

          if (result.ok) {
            log.info({ key, latencyMs: result.latencyMs }, 'tes koneksi provider sukses')
          } else {
            log.warn({ key, error: result.error?.slice(0, 160) }, 'tes koneksi provider gagal')
          }
          return Response.json(result)
        } catch (err) {
          log.error({ err: String(err).slice(0, 200) }, 'POST test provider gagal')
          return Response.json({ error: 'Gagal menguji koneksi.' }, { status: 500 })
        }
      },
    },
  },
})
