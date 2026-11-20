import { randomUUID } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'
import { sameOriginGuard } from '@/lib/security/http'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  channelId: z.string().min(1).max(80), videoProjectId: z.string().min(1).max(80),
  title: z.string().trim().min(1).max(100), description: z.string().max(5000).default(''),
  tags: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  privacyStatus: z.enum(['private', 'unlisted', 'public']).default('private'),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
})
export const Route = createFileRoute('/api/youtube/publish')({
  server: { handlers: {
    GET: async () => {
      const session = await getApiSession()
      if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
      const items = await db.youtubePublication.findMany({
        where: { userId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 100,
        select: { id: true, channelId: true, videoProjectId: true, status: true, title: true, privacyStatus: true, scheduledAt: true, approvedAt: true, youtubeVideoId: true, publishedAt: true, uploadOffset: true, lastError: true, createdAt: true },
      })
      return Response.json({ items: items.map(x => ({ ...x, uploadOffset: x.uploadOffset.toString() })) }, { headers: { 'Cache-Control': 'private, no-store' } })
    },
    POST: async ({ request }: { request: Request }) => {
      const denied = sameOriginGuard(request); if (denied) return denied
      const session = await getApiSession()
      if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
      if (!rateLimit('youtube-publish-create:' + session.user.id, 10, 3600000)) return Response.json({ error: 'Batas pembuatan publikasi tercapai.' }, { status: 429 })
      const parsed = schema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) return Response.json({ error: 'Metadata publikasi tidak valid.', issues: parsed.error.flatten() }, { status: 400 })
      const input = parsed.data
      if (input.scheduledAt && (new Date(input.scheduledAt).getTime() < Date.now() + 10 * 60000 || input.privacyStatus !== 'private')) {
        return Response.json({ error: 'Jadwal minimal 10 menit ke depan dan hanya mendukung privacy private.' }, { status: 400 })
      }
      const [channel, project] = await Promise.all([
        db.youtubeChannel.findFirst({ where: { id: input.channelId, userId: session.user.id, connectionStatus: 'connected' }, select: { id: true, oauthConnection: { select: { connectionStatus: true, scopes: true } } } }),
        db.videoProject.findFirst({ where: { id: input.videoProjectId, userId: session.user.id, status: 'done', fileObjectKey: { not: null }, fileBytes: { gt: 0 } }, select: { id: true } }),
      ])
      if (!channel || channel.oauthConnection?.connectionStatus !== 'connected') return Response.json({ error: 'Channel YouTube tidak terhubung.' }, { status: 404 })
      if (!channel.oauthConnection.scopes.split(/\s+/).includes('https://www.googleapis.com/auth/youtube.upload')) return Response.json({ error: 'Izin youtube.upload belum diberikan. Hubungkan ulang akun Google.' }, { status: 403 })
      if (!project) return Response.json({ error: 'Video harus selesai diproses dan merupakan milik akun ini.' }, { status: 409 })
      const active = await db.youtubePublication.findFirst({ where: { userId: session.user.id, channelId: channel.id, videoProjectId: project.id, status: { in: ['pending_approval', 'scheduled', 'uploading', 'published'] } }, select: { id: true } })
      if (active) return Response.json({ error: 'Video ini sudah memiliki publikasi aktif.', publication: active }, { status: 409 })
      const publication = await db.youtubePublication.create({ data: {
        userId: session.user.id, channelId: channel.id, videoProjectId: project.id, idempotencyKey: randomUUID(),
        title: input.title, description: input.description, tags: JSON.stringify(input.tags), privacyStatus: input.privacyStatus,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      }, select: { id: true, status: true, title: true, scheduledAt: true, createdAt: true } })
      return Response.json({ publication }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    },
    PATCH: async ({ request }: { request: Request }) => {
      const denied = sameOriginGuard(request); if (denied) return denied
      const session = await getApiSession()
      if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
      const body = await request.json().catch(() => null) as { id?: string; action?: string } | null
      if (!body?.id || body.id.length > 80 || !['approve', 'cancel', 'retry'].includes(body.action ?? '')) return Response.json({ error: 'Aksi publikasi tidak valid.' }, { status: 400 })
      if (body.action === 'approve') {
        const result = await db.youtubePublication.updateMany({ where: { id: body.id, userId: session.user.id, status: 'pending_approval', approvedAt: null }, data: { status: 'scheduled', approvedAt: new Date(), approvedBy: session.user.id } })
        return result.count ? Response.json({ success: true, status: 'scheduled' }) : Response.json({ error: 'Publikasi tidak ditemukan atau sudah diproses.' }, { status: 409 })
      }
      if (body.action === 'retry') {
        const result = await db.youtubePublication.updateMany({ where: { id: body.id, userId: session.user.id, status: 'failed', approvedAt: { not: null }, youtubeVideoId: null }, data: { status: 'scheduled', lastError: null } })
        return result.count ? Response.json({ success: true, status: 'scheduled' }) : Response.json({ error: 'Publikasi tidak dapat dicoba ulang.' }, { status: 409 })
      }
      const result = await db.youtubePublication.updateMany({ where: { id: body.id, userId: session.user.id, status: { in: ['pending_approval', 'scheduled', 'failed'] } }, data: { status: 'cancelled' } })
      return result.count ? Response.json({ success: true, status: 'cancelled' }) : Response.json({ error: 'Publikasi tidak dapat dibatalkan.' }, { status: 409 })
    },
  } },
})
