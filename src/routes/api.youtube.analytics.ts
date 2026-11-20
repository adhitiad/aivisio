import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getApiSession } from '@/lib/session'
import { sameOriginGuard } from '@/lib/security/http'
import { rateLimit } from '@/lib/rate-limit'
import { queryYoutubeAnalytics, YoutubeIntegrationError } from '@/lib/youtube/oauth'
import { moduleLogger } from '@/lib/logger'

const log = moduleLogger('youtube-analytics-api')
const querySchema = z.object({
  channelId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  includeRevenue: z.boolean().default(false),
}).strict()

export const Route = createFileRoute('/api/youtube/analytics')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied

        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })

        if (!rateLimit('youtube-analytics:' + session.user.id, 12, 60 * 60 * 1000)) {
          return Response.json({ error: 'Batas permintaan Analytics per jam tercapai.' }, { status: 429 })
        }

        let body: unknown
        try {
          const raw = await request.text()
          if (new TextEncoder().encode(raw).byteLength > 8_000) {
            return Response.json({ error: 'Payload terlalu besar.' }, { status: 413 })
          }
          body = JSON.parse(raw)
        } catch {
          return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
        }

        const parsed = querySchema.safeParse(body)
        if (!parsed.success) {
          return Response.json({ error: 'Parameter laporan YouTube Analytics tidak valid.' }, { status: 400 })
        }

        try {
          const result = await queryYoutubeAnalytics({
            userId: session.user.id,
            ...parsed.data,
          })
          return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
        } catch (error) {
          if (error instanceof YoutubeIntegrationError) {
            return Response.json(
              { error: error.message, code: error.code },
              { status: error.status, headers: { 'Cache-Control': 'private, no-store' } },
            )
          }
          log.error({ err: error instanceof Error ? error.message.slice(0, 180) : 'unknown' }, 'YouTube Analytics query failed')
          return Response.json({ error: 'Laporan YouTube Analytics gagal diproses.' }, { status: 500 })
        }
      },
    },
  },
})
