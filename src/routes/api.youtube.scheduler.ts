import { timingSafeEqual } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { moduleLogger } from '@/lib/logger'
import { syncYoutubeAnalyticsBatch } from '@/lib/youtube/oauth'
import { syncTrackedMarketTopics } from '@/lib/youtube/market-tracking'

const log = moduleLogger('youtube-scheduler')

function authorized(request: Request): boolean {
  const secret = process.env.YOUTUBE_CRON_SECRET ?? process.env.CRON_SECRET
  const authorization = request.headers.get('authorization') ?? ''
  if (!secret || secret.length < 32 || !authorization.startsWith('Bearer ')) return false

  const supplied = Buffer.from(authorization.slice(7))
  const expected = Buffer.from(secret)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export const Route = createFileRoute('/api/youtube/scheduler')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        if (!authorized(request)) {
          return Response.json({ error: 'Unauthorized scheduler request.' }, { status: 401 })
        }

        const startedAt = Date.now()
        const [analytics, market] = await Promise.allSettled([
          syncYoutubeAnalyticsBatch(20),
          syncTrackedMarketTopics(20),
        ])

        const result = {
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          analytics: analytics.status === 'fulfilled'
            ? analytics.value
            : { error: 'Private Analytics sync failed.' },
          market: market.status === 'fulfilled'
            ? market.value
            : { error: 'Historical market snapshot sync failed.' },
        }

        if (analytics.status === 'rejected') {
          log.error({ err: String(analytics.reason).slice(0, 300) }, 'Scheduled YouTube Analytics sync failed')
        }
        if (market.status === 'rejected') {
          log.error({ err: String(market.reason).slice(0, 300) }, 'Scheduled YouTube market sync failed')
        }

        return Response.json(result, {
          status: analytics.status === 'rejected' || market.status === 'rejected' ? 207 : 200,
          headers: { 'Cache-Control': 'private, no-store' },
        })
      },
    },
  },
})
