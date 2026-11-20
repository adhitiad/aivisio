import { timingSafeEqual } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { runYoutubePublishingBatch } from '@/lib/youtube/publishing-worker'
import { moduleLogger } from '@/lib/logger'
const log = moduleLogger('youtube-publishing-scheduler')
function authorized(request: Request): boolean {
  const secret = process.env.YOUTUBE_CRON_SECRET ?? process.env.CRON_SECRET
  const value = request.headers.get('authorization') ?? ''
  if (!secret || secret.length < 32 || !value.startsWith('Bearer ')) return false
  const a = Buffer.from(value.slice(7)), b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}
export const Route = createFileRoute('/api/youtube/publish/scheduler')({
  server: { handlers: { POST: async ({ request }: { request: Request }) => {
    if (!authorized(request)) return Response.json({ error: 'Unauthorized scheduler request.' }, { status: 401 })
    try { return Response.json(await runYoutubePublishingBatch(3), { headers: { 'Cache-Control': 'no-store' } }) }
    catch (error) {
      log.error({ err: error instanceof Error ? error.message.slice(0, 250) : 'unknown' }, 'YouTube publishing scheduler failed')
      return Response.json({ error: 'Publishing worker gagal dijalankan.' }, { status: 500 })
    }
  } } },
})
