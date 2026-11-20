import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getApiSession } from '@/lib/session'
import { sameOriginGuard } from '@/lib/security/http'
import { rateLimit } from '@/lib/rate-limit'
import { MARKET_CODES, type MarketOrder } from '@/lib/youtube/market'
import {
  listTrackedMarketTopics,
  removeTrackedMarketTopic,
  saveTrackedMarketTopic,
} from '@/lib/youtube/market-tracking'
import { moduleLogger } from '@/lib/logger'

const log = moduleLogger('youtube-market-topics')
const inputSchema = z.object({
  query: z.string().trim().min(2).max(100),
  market: z.enum(MARKET_CODES),
  order: z.enum(['relevance', 'date', 'viewCount']).default('relevance'),
  periodDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]).default(90),
  maxResults: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(50),
}).strict()
const deleteSchema = z.object({ id: z.string().uuid() }).strict()

async function readJson(request: Request): Promise<unknown> {
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > 8_000) {
    throw new Error('Payload terlalu besar.')
  }
  return JSON.parse(raw)
}

export const Route = createFileRoute('/api/youtube/market/topics')({
  server: {
    handlers: {
      GET: async () => {
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
        const topics = await listTrackedMarketTopics(session.user.id)
        return Response.json({ topics }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
      POST: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
        if (!rateLimit('youtube-market-track:' + session.user.id, 8, 60 * 60 * 1000)) {
          return Response.json({ error: 'Batas perubahan topik pemantauan tercapai.' }, { status: 429 })
        }

        let body: unknown
        try {
          body = await readJson(request)
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : 'Body tidak valid.' }, { status: 400 })
        }
        const parsed = inputSchema.safeParse(body)
        if (!parsed.success) {
          return Response.json({ error: 'Parameter topik pemantauan tidak valid.' }, { status: 400 })
        }

        try {
          const topic = await saveTrackedMarketTopic(session.user.id, {
            ...parsed.data,
            order: parsed.data.order as MarketOrder,
          })
          return Response.json({ topic }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Gagal menyimpan topik.'
          const status = message.includes('Maksimal lima') ? 409 : 400
          return Response.json({ error: message }, { status })
        }
      },
      DELETE: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })

        let body: unknown
        try {
          body = await readJson(request)
        } catch {
          return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
        }
        const parsed = deleteSchema.safeParse(body)
        if (!parsed.success) return Response.json({ error: 'ID topik tidak valid.' }, { status: 400 })

        const removed = await removeTrackedMarketTopic(session.user.id, parsed.data.id)
        return Response.json({ success: removed }, {
          status: removed ? 200 : 404,
          headers: { 'Cache-Control': 'private, no-store' },
        })
      },
    },
  },
})
