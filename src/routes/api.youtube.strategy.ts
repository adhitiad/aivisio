import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'
import { sameOriginGuard } from '@/lib/security/http'
import { rateLimit } from '@/lib/rate-limit'
import { MARKET_CODES } from '@/lib/youtube/market'

const channelQuery = z.string().uuid()
const stringList = z.array(z.string().trim().min(1).max(120)).max(12)
const profileSchema = z.object({
  channelId: z.string().uuid(),
  niche: z.string().trim().min(2).max(120),
  subNiche: z.string().trim().max(120).nullable(),
  primaryMarket: z.enum(MARKET_CODES),
  secondaryMarkets: z.array(z.enum(MARKET_CODES)).max(9),
  audiencePersona: z.string().trim().max(600).nullable(),
  audienceProblems: stringList,
  channelPositioning: z.string().trim().max(600).nullable(),
  contentPillars: stringList,
  languages: z.array(z.string().trim().min(2).max(5)).max(8),
  weeklyShorts: z.number().int().min(0).max(21),
  weeklyLongVideos: z.number().int().min(0).max(14),
  shortStrategy: z.string().trim().max(1200).nullable(),
  longFormStrategy: z.string().trim().max(1200).nullable(),
  targetShortDurationSec: z.number().int().min(10).max(180),
  targetLongDurationMin: z.number().int().min(1).max(240),
  defaultHook: z.string().trim().max(800).nullable(),
  outlineTemplate: z.string().trim().max(1600).nullable(),
  callToAction: z.string().trim().max(500).nullable(),
  yppValidPublicWatchHours: z.number().min(0).max(100_000_000).nullable(),
  yppRequiredPublicWatchHours: z.number().min(0).max(100_000_000).nullable(),
  yppValidShortsViews: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  yppRequiredShortsViews: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
}).strict()

function readStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

async function ownedChannel(userId: string, channelId: string) {
  return db.youtubeChannel.findFirst({
    where: { id: channelId, userId },
    select: { id: true, title: true },
  })
}

export const Route = createFileRoute('/api/youtube/strategy')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
        const channelId = channelQuery.safeParse(new URL(request.url).searchParams.get('channelId'))
        if (!channelId.success) return Response.json({ error: 'Channel tidak valid.' }, { status: 400 })
        const channel = await ownedChannel(session.user.id, channelId.data)
        if (!channel) return Response.json({ error: 'Channel tidak ditemukan.' }, { status: 404 })

        const [profile, ideas] = await Promise.all([
          db.youtubeNicheProfile.findUnique({ where: { channelId: channel.id } }),
          db.contentIdea.findMany({
            where: { channelId: channel.id },
            orderBy: { createdAt: 'desc' },
            take: 12,
            select: {
              id: true, title: true, angle: true, format: true, status: true,
              plannedFor: true, createdAt: true,
              strategySnapshots: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { id: true, profileVersion: true, payload: true, createdAt: true },
              },
              videoProjects: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { id: true, status: true, createdAt: true },
              },
            },
          }),
        ])

        return Response.json({
          channel,
          profile: profile ? {
            ...profile,
            secondaryMarkets: readStringArray(profile.secondaryMarkets),
            audienceProblems: readStringArray(profile.audienceProblems),
            contentPillars: readStringArray(profile.contentPillars),
            languages: readStringArray(profile.languages),
            yppValidShortsViews: profile.yppValidShortsViews === null ? null : Number(profile.yppValidShortsViews),
            yppRequiredShortsViews: profile.yppRequiredShortsViews === null ? null : Number(profile.yppRequiredShortsViews),
          } : null,
          ideas,
        }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
      PUT: async ({ request }: { request: Request }) => {
        const denied = sameOriginGuard(request)
        if (denied) return denied
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
        if (!rateLimit('youtube-strategy:' + session.user.id, 20, 60 * 60 * 1000)) {
          return Response.json({ error: 'Batas penyimpanan strategi per jam tercapai.' }, { status: 429 })
        }

        let body: unknown
        try {
          const raw = await request.text()
          if (new TextEncoder().encode(raw).byteLength > 12_000) return Response.json({ error: 'Payload terlalu besar.' }, { status: 413 })
          body = JSON.parse(raw)
        } catch {
          return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
        }
        const parsed = profileSchema.safeParse(body)
        if (!parsed.success) return Response.json({ error: 'Data profil niche tidak valid.' }, { status: 400 })
        const input = parsed.data
        const channel = await ownedChannel(session.user.id, input.channelId)
        if (!channel) return Response.json({ error: 'Channel tidak ditemukan.' }, { status: 404 })

        const data = {
          niche: input.niche,
          subNiche: input.subNiche,
          primaryMarket: input.primaryMarket,
          secondaryMarkets: JSON.stringify([...new Set(input.secondaryMarkets.filter((item) => item !== input.primaryMarket))]),
          audiencePersona: input.audiencePersona,
          audienceProblems: JSON.stringify(input.audienceProblems),
          channelPositioning: input.channelPositioning,
          contentPillars: JSON.stringify(input.contentPillars),
          languages: JSON.stringify([...new Set(input.languages.map((item) => item.toLowerCase()))]),
          weeklyShorts: input.weeklyShorts,
          weeklyLongVideos: input.weeklyLongVideos,
          shortStrategy: input.shortStrategy,
          longFormStrategy: input.longFormStrategy,
          targetShortDurationSec: input.targetShortDurationSec,
          targetLongDurationMin: input.targetLongDurationMin,
          defaultHook: input.defaultHook,
          outlineTemplate: input.outlineTemplate,
          callToAction: input.callToAction,
          yppValidPublicWatchHours: input.yppValidPublicWatchHours,
          yppRequiredPublicWatchHours: input.yppRequiredPublicWatchHours,
          yppValidShortsViews: input.yppValidShortsViews === null ? null : BigInt(input.yppValidShortsViews),
          yppRequiredShortsViews: input.yppRequiredShortsViews === null ? null : BigInt(input.yppRequiredShortsViews),
          yppManualCheckedAt: [input.yppValidPublicWatchHours, input.yppRequiredPublicWatchHours, input.yppValidShortsViews, input.yppRequiredShortsViews].some((value) => value !== null) ? new Date() : null,
        }
        const profile = await db.youtubeNicheProfile.upsert({
          where: { channelId: channel.id },
          create: { channelId: channel.id, ...data, profileVersion: 1 },
          update: { ...data, profileVersion: { increment: 1 } },
        })
        return Response.json({
          profile: {
            ...profile,
            secondaryMarkets: readStringArray(profile.secondaryMarkets),
            audienceProblems: readStringArray(profile.audienceProblems),
            contentPillars: readStringArray(profile.contentPillars),
            languages: readStringArray(profile.languages),
            yppValidShortsViews: profile.yppValidShortsViews === null ? null : Number(profile.yppValidShortsViews),
            yppRequiredShortsViews: profile.yppRequiredShortsViews === null ? null : Number(profile.yppRequiredShortsViews),
          },
        }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
    },
  },
})
