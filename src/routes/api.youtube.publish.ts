import { randomUUID } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'
import { sameOriginGuard } from '@/lib/security/http'
import { rateLimit } from '@/lib/rate-limit'

const UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload'
const schema = z.object({
  channelId: z.string().min(1).max(80),
  videoProjectId: z.string().min(1).max(80),
  title: z.string().trim().min(1).max(100),
  description: z.string().max(5000).default(''),
  tags: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  privacyStatus: z.enum(['private', 'unlisted', 'public']).default('private'),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
})

export const Route = createFileRoute('/api/youtube/publish')({
  server: { handlers: {
    GET: async () => {
      const session = await getApiSession()
      if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })

      const [items, channels, projects] = await Promise.all([
        db.youtubePublication.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true, channelId: true, videoProjectId: true, status: true, title: true,
            privacyStatus: true, scheduledAt: true, approvedAt: true, youtubeVideoId: true,
            publishedAt: true, uploadOffset: true, uploadAttempts: true, maxUploadAttempts: true,
            nextAttemptAt: true, lastError: true, createdAt: true,
            channel: { select: { title: true } },
            videoProject: { select: { topic: true, fileBytes: true } },
          },
        }),
        db.youtubeChannel.findMany({
          where: { userId: session.user.id, connectionStatus: 'connected', oauthConnection: { is: { connectionStatus: 'connected', scopes: { contains: UPLOAD_SCOPE } } } },
          orderBy: { title: 'asc' },
          select: { id: true, title: true, thumbnailUrl: true },
        }),
        db.videoProject.findMany({
          where: { userId: session.user.id, status: 'done', fileObjectKey: { not: null }, fileBytes: { gt: 0 } },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, topic: true, title: true, fileBytes: true, createdAt: true },
        }),
      ])

      return Response.json({
        items: items.map(x => ({ ...x, uploadOffset: x.uploadOffset.toString() })),
        channels,
        projects,
      }, { headers: { 'Cache-Control': 'private, no-store' } })
    },

    POST: async ({ request }: { request: Request }) => {
      const denied = sameOriginGuard(request)
      if (denied) return denied
      const session = await getApiSession()
      if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
      if (!rateLimit('youtube-publish-create:' + session.user.id, 10, 3600000)) {
        return Response.json({ error: 'Batas pembuatan publikasi tercapai.' }, { status: 429 })
      }

      const raw = await request.text()
      if (new TextEncoder().encode(raw).byteLength > 12_000) return Response.json({ error: 'Payload terlalu besar.' }, { status: 413 })
      let body: unknown
      try { body = JSON.parse(raw) } catch { return Response.json({ error: 'Body JSON tidak valid.' }, { status: 400 }) }
      const parsed = schema.safeParse(body)
      if (!parsed.success) return Response.json({ error: 'Metadata publikasi tidak valid.', issues: parsed.error.flatten() }, { status: 400 })

      const input = parsed.data
      if (input.scheduledAt && (new Date(input.scheduledAt).getTime() < Date.now() + 10 * 60_000 || input.privacyStatus !== 'private')) {
        return Response.json({ error: 'Jadwal minimal 10 menit ke depan dan hanya mendukung privacy private.' }, { status: 400 })
      }

      const [channel, project] = await Promise.all([
        db.youtubeChannel.findFirst({
          where: { id: input.channelId, userId: session.user.id, connectionStatus: 'connected' },
          select: { id: true, oauthConnection: { select: { connectionStatus: true, scopes: true } } },
        }),
        db.videoProject.findFirst({
          where: { id: input.videoProjectId, userId: session.user.id, status: 'done', fileObjectKey: { not: null }, fileBytes: { gt: 0 } },
          select: { id: true },
        }),
      ])
      if (!channel || channel.oauthConnection?.connectionStatus !== 'connected') {
        return Response.json({ error: 'Channel YouTube tidak terhubung.' }, { status: 404 })
      }
      if (!channel.oauthConnection.scopes.split(/\s+/).includes(UPLOAD_SCOPE)) {
        return Response.json({ error: 'Izin youtube.upload belum diberikan. Hubungkan ulang akun Google.' }, { status: 403 })
      }
      if (!project) return Response.json({ error: 'Video harus selesai diproses dan merupakan milik akun ini.' }, { status: 409 })

      try {
        const result = await db.$transaction(async (tx) => {
          const active = await tx.youtubePublication.findFirst({
            where: { userId: session.user.id, channelId: channel.id, videoProjectId: project.id, status: { in: ['pending_approval', 'scheduled', 'uploading', 'published'] } },
            select: { id: true },
          })
          if (active) return { active, publication: null }
          const publication = await tx.youtubePublication.create({
            data: {
              userId: session.user.id, channelId: channel.id, videoProjectId: project.id,
              idempotencyKey: randomUUID(), title: input.title, description: input.description,
              tags: JSON.stringify(input.tags), privacyStatus: input.privacyStatus,
              scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
            },
            select: { id: true, status: true, title: true, scheduledAt: true, createdAt: true },
          })
          return { active: null, publication }
        }, { isolationLevel: 'Serializable' })

        if (result.active) return Response.json({ error: 'Video ini sudah memiliki publikasi aktif.', publication: result.active }, { status: 409 })
        return Response.json({ publication: result.publication }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
      } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
        if (code === 'P2034' || code === 'P2002') {
          return Response.json({ error: 'Publikasi duplikat terdeteksi. Muat ulang daftar publikasi.' }, { status: 409 })
        }
        throw error
      }
    },

    PATCH: async ({ request }: { request: Request }) => {
      const denied = sameOriginGuard(request)
      if (denied) return denied
      const session = await getApiSession()
      if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
      if (!rateLimit('youtube-publish-action:' + session.user.id, 30, 60_000)) {
        return Response.json({ error: 'Terlalu banyak aksi publikasi. Coba kembali sebentar lagi.' }, { status: 429 })
      }

      const body = await request.json().catch(() => null) as { id?: string; action?: string } | null
      if (!body?.id || body.id.length > 80 || !['approve', 'cancel', 'retry'].includes(body.action ?? '')) {
        return Response.json({ error: 'Aksi publikasi tidak valid.' }, { status: 400 })
      }

      if (body.action === 'approve') {
        const result = await db.youtubePublication.updateMany({
          where: { id: body.id, userId: session.user.id, status: 'pending_approval', approvedAt: null },
          data: { status: 'scheduled', approvedAt: new Date(), approvedBy: session.user.id, nextAttemptAt: new Date() },
        })
        return result.count ? Response.json({ success: true, status: 'scheduled' }) : Response.json({ error: 'Publikasi tidak ditemukan atau sudah diproses.' }, { status: 409 })
      }

      if (body.action === 'retry') {
        const result = await db.youtubePublication.updateMany({
          where: { id: body.id, userId: session.user.id, status: 'failed', approvedAt: { not: null }, youtubeVideoId: null },
          data: { status: 'scheduled', nextAttemptAt: new Date(), lastError: null, uploadAttempts: 0, uploadOffset: 0n, uploadSessionUriEncrypted: null, lockedAt: null, lockedBy: null },
        })
        return result.count ? Response.json({ success: true, status: 'scheduled' }) : Response.json({ error: 'Publikasi tidak dapat dicoba ulang.' }, { status: 409 })
      }

      const result = await db.youtubePublication.updateMany({
        where: { id: body.id, userId: session.user.id, status: { in: ['pending_approval', 'scheduled', 'failed'] } },
        data: { status: 'cancelled', lockedAt: null, lockedBy: null },
      })
      return result.count ? Response.json({ success: true, status: 'cancelled' }) : Response.json({ error: 'Publikasi tidak dapat dibatalkan.' }, { status: 409 })
    },
  } },
})
