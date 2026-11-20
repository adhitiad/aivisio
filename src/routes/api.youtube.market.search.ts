import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getApiSession } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginGuard } from '@/lib/security/http'
import {
  MARKET_CODES,
  searchYoutubeMarket,
  YoutubeMarketError,
} from '@/lib/youtube/market'
import { moduleLogger } from '@/lib/logger'

const log = moduleLogger('youtube-market-api')
const requestSchema = z.object({
  query: z.string().trim().min(2).max(100),
  market: z.enum(MARKET_CODES),
  order: z.enum(['relevance', 'date', 'viewCount']).default('relevance'),
  periodDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]).default(90),
  maxResults: z.number().int().min(10).max(50).default(50),
}).strict()

export const Route = createFileRoute('/api/youtube/market/search')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied

        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })

        if (!rateLimit('youtube-market:' + session.user.id, 4, 60 * 60 * 1000)) {
          return Response.json(
            { error: 'Batas riset pasar per jam tercapai. Coba lagi nanti.' },
            { status: 429 },
          )
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

        const parsed = requestSchema.safeParse(body)
        if (!parsed.success) {
          return Response.json({ error: 'Parameter riset YouTube tidak valid.' }, { status: 400 })
        }

        try {
          const result = await searchYoutubeMarket(parsed.data)
          return Response.json(result, {
            headers: { 'Cache-Control': 'private, no-store' },
          })
        } catch (error) {
          if (error instanceof YoutubeMarketError) {
            return Response.json(
              { error: error.message, code: error.code },
              { status: error.status },
            )
          }
          log.error(
            { err: error instanceof Error ? error.message.slice(0, 180) : 'unknown' },
            'YouTube market research failed',
          )
          return Response.json(
            { error: 'Riset YouTube gagal diproses.' },
            { status: 500 },
          )
        }
      },
    },
  },
})
