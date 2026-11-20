import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'
import { sameOriginGuard } from '@/lib/security/http'
import { rateLimit } from '@/lib/rate-limit'

const requestSchema = z.object({
  channelId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  angle: z.string().trim().max(800).nullable().default(null),
  format: z.enum(['short', 'long']),
  plannedFor: z.string().datetime().nullable().optional(),
}).strict()

function readArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const Route = createFileRoute('/api/youtube/strategy/snapshot')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const denied = sameOriginGuard(request)
        if (denied) return denied
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
        if (!rateLimit('youtube-strategy-snapshot:' + session.user.id, 30, 60 * 60 * 1000)) {
          return Response.json({ error: 'Batas pembuatan ide tercapai.' }, { status: 429 })
        }

        let body: unknown
        try {
          const raw = await request.text()
          if (new TextEncoder().encode(raw).byteLength > 4_000) return Response.json({ error: 'Payload terlalu besar.' }, { status: 413 })
          body = JSON.parse(raw)
        } catch {
          return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
        }
        const parsed = requestSchema.safeParse(body)
        if (!parsed.success) return Response.json({ error: 'Ide konten tidak valid.' }, { status: 400 })
        const input = parsed.data

        const channel = await db.youtubeChannel.findFirst({
          where: { id: input.channelId, userId: session.user.id },
          select: { id: true },
        })
        if (!channel) return Response.json({ error: 'Channel tidak ditemukan.' }, { status: 404 })
        const profile = await db.youtubeNicheProfile.findUnique({ where: { channelId: channel.id } })
        if (!profile) return Response.json({ error: 'Simpan profil niche terlebih dahulu sebelum membuat snapshot strategi.' }, { status: 409 })

        const snapshot = {
          profileVersion: profile.profileVersion,
          niche: profile.niche,
          subNiche: profile.subNiche,
          primaryMarket: profile.primaryMarket,
          secondaryMarkets: readArray(profile.secondaryMarkets),
          audiencePersona: profile.audiencePersona,
          audienceProblems: readArray(profile.audienceProblems),
          channelPositioning: profile.channelPositioning,
          contentPillars: readArray(profile.contentPillars),
          languages: readArray(profile.languages),
          weeklyShorts: profile.weeklyShorts,
          weeklyLongVideos: profile.weeklyLongVideos,
          shortStrategy: profile.shortStrategy,
          longFormStrategy: profile.longFormStrategy,
          targetShortDurationSec: profile.targetShortDurationSec,
          targetLongDurationMin: profile.targetLongDurationMin,
          defaultHook: profile.defaultHook,
          outlineTemplate: profile.outlineTemplate,
          callToAction: profile.callToAction,
        }
        const idea = await db.contentIdea.create({
          data: {
            channelId: channel.id,
            title: input.title,
            angle: input.angle,
            format: input.format,
            plannedFor: input.plannedFor ? new Date(input.plannedFor) : null,
            strategySnapshots: {
              create: {
                channelId: channel.id,
                profileVersion: profile.profileVersion,
                payload: JSON.stringify(snapshot),
              },
            },
          },
          select: {
            id: true, title: true, angle: true, format: true, status: true, createdAt: true,
            strategySnapshots: { select: { id: true, profileVersion: true, payload: true, createdAt: true } },
          },
        })
        return Response.json({ idea }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
      },
    },
  },
})
