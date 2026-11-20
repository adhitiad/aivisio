import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'
import { sameOriginGuard } from '@/lib/security/http'
import { rateLimit } from '@/lib/rate-limit'
import {
  hasYoutubeMonetaryScope,
  queryYoutubeAnalytics,
  queryYoutubeOptimizationBreakdowns,
  YoutubeIntegrationError,
} from '@/lib/youtube/oauth'
import { summarizeRevenue } from '@/lib/youtube/revenue'
import { buildRevenueRecommendations, calculateRevenueForecast } from '@/lib/youtube/optimization'
import { moduleLogger } from '@/lib/logger'

const log = moduleLogger('youtube-revenue-api')
const syncSchema = z.object({
  action: z.literal('sync'),
  channelId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict()
const forecastSchema = z.object({
  action: z.literal('forecast'),
  channelId: z.string().uuid(),
  targetRevenue: z.number().finite().positive().max(1_000_000_000_000),
  projectionDays: z.number().int().min(1).max(365),
  assumedRPM: z.number().finite().positive().max(100_000_000).nullable().optional(),
  baselineDailyViews: z.number().finite().min(0).max(1_000_000_000_000).nullable().optional(),
}).strict()
const requestSchema = z.discriminatedUnion('action', [syncSchema, forecastSchema])

function utcDate(value: string): Date {
  return new Date(value + 'T00:00:00.000Z')
}

function dayAfter(value: string): Date {
  const date = utcDate(value)
  date.setUTCDate(date.getUTCDate() + 1)
  return date
}

async function readBody(request: Request): Promise<unknown> {
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > 8_000) throw new Error('Payload terlalu besar.')
  return JSON.parse(raw)
}

export const Route = createFileRoute('/api/youtube/revenue')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const denied = sameOriginGuard(request)
        if (denied) return denied
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })

        let body: unknown
        try { body = await readBody(request) }
        catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : 'Body tidak valid.' }, { status: 400 })
        }
        const parsed = requestSchema.safeParse(body)
        if (!parsed.success) return Response.json({ error: 'Parameter Revenue Optimization tidak valid.' }, { status: 400 })
        const input = parsed.data
        const channel = await db.youtubeChannel.findFirst({
          where: { id: input.channelId, userId: session.user.id },
          select: {
            id: true,
            title: true,
            oauthConnection: { select: { scopes: true, connectionStatus: true } },
          },
        })
        if (!channel || channel.oauthConnection?.connectionStatus !== 'connected') {
          return Response.json({ error: 'Channel tidak ditemukan atau koneksi Google tidak aktif.' }, { status: 404 })
        }

        if (input.action === 'sync') {
          if (!rateLimit('youtube-revenue-sync:' + session.user.id, 6, 60 * 60 * 1000)) {
            return Response.json({ error: 'Batas sinkronisasi revenue per jam tercapai.' }, { status: 429 })
          }
          const start = utcDate(input.startDate)
          const end = utcDate(input.endDate)
          const now = new Date()
          const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
          const dayCount = Math.floor((end.getTime() - start.getTime()) / 86_400_000)
          if (end < start || end >= today || dayCount > 364) {
            return Response.json({ error: 'Rentang tanggal harus berakhir sebelum hari ini dan maksimal 365 hari.' }, { status: 400 })
          }

          const requestedRevenue = hasYoutubeMonetaryScope(channel.oauthConnection.scopes)
          let actualRevenueQuerySucceeded = false
          try {
            if (requestedRevenue) {
              try {
                await queryYoutubeAnalytics({
                  userId: session.user.id,
                  channelId: channel.id,
                  startDate: input.startDate,
                  endDate: input.endDate,
                  includeRevenue: true,
                })
                actualRevenueQuerySucceeded = true
              } catch (error) {
                if (!(error instanceof YoutubeIntegrationError) || error.status !== 403) throw error
                await queryYoutubeAnalytics({
                  userId: session.user.id,
                  channelId: channel.id,
                  startDate: input.startDate,
                  endDate: input.endDate,
                  includeRevenue: false,
                })
              }
            } else {
              await queryYoutubeAnalytics({
                userId: session.user.id,
                channelId: channel.id,
                startDate: input.startDate,
                endDate: input.endDate,
                includeRevenue: false,
              })
            }

            const breakdowns = await queryYoutubeOptimizationBreakdowns({
              userId: session.user.id,
              channelId: channel.id,
              startDate: input.startDate,
              endDate: input.endDate,
              includeRevenue: actualRevenueQuerySucceeded,
            })
            const dailyRows = await db.youtubeAnalyticsDailyMetric.findMany({
              where: {
                channelId: channel.id,
                metricDate: { gte: start, lt: dayAfter(input.endDate) },
              },
              orderBy: { metricDate: 'asc' },
              select: {
                metricDate: true, views: true, estimatedMinutesWatched: true,
                averageViewDuration: true, averageViewPercentage: true,
                likes: true, comments: true, shares: true, subscribersGained: true,
                subscribersLost: true, estimatedRevenue: true, estimatedAdRevenue: true,
                currencyCode: true,
              },
            })
            const summary = summarizeRevenue(dailyRows)
            const totalWatchMinutes = dailyRows.reduce((sum, row) => sum + row.estimatedMinutesWatched, 0)
            const weightedAveragePercentage = dailyRows.reduce((sum, row) => sum + Number(row.views) * row.averageViewPercentage, 0)
            const viewCount = dailyRows.reduce((sum, row) => sum + row.views, 0n)
            const averageViewPercentage = viewCount > 0n ? weightedAveragePercentage / Number(viewCount) : null
            const revenueAvailable = actualRevenueQuerySucceeded && summary.estimatedRevenue !== null
            const countryRows = breakdowns.countries.map((row) => ({
              ...row,
              rpm: row.estimatedRevenue !== null && Number(row.views) > 0
                ? row.estimatedRevenue / Number(row.views) * 1000
                : null,
            }))
            const topCountry = [...countryRows]
              .filter((row) => row.rpm !== null)
              .sort((a, b) => (b.rpm ?? 0) - (a.rpm ?? 0))[0]
            const recommendations = buildRevenueRecommendations({
              revenueAvailable,
              views: Number(viewCount),
              averageViewPercentage,
              rpm: summary.rpm,
              topCountryName: topCountry?.countryCode ?? null,
              topCountryRpm: topCountry?.rpm ?? null,
            })

            return Response.json({
              channel: { id: channel.id, title: channel.title },
              startDate: input.startDate,
              endDate: input.endDate,
              observedAt: new Date().toISOString(),
              revenueStatus: revenueAvailable ? 'actual' : requestedRevenue ? 'not_available' : 'scope_missing',
              actual: {
                ...summary,
                estimatedRevenue: revenueAvailable ? summary.estimatedRevenue : null,
                estimatedAdRevenue: revenueAvailable ? summary.estimatedAdRevenue : null,
                rpm: revenueAvailable ? summary.rpm : null,
                adRpm: revenueAvailable ? summary.adRpm : null,
                watchHours: totalWatchMinutes / 60,
                averageViewPercentage,
                currencyCode: dailyRows[0]?.currencyCode ?? 'IDR',
                dailyRows: dailyRows.length,
              },
              daily: dailyRows.map((row) => ({
                date: row.metricDate.toISOString().slice(0, 10),
                views: row.views.toString(),
                estimatedRevenue: row.estimatedRevenue,
                estimatedAdRevenue: row.estimatedAdRevenue,
                estimatedMinutesWatched: row.estimatedMinutesWatched,
                averageViewPercentage: row.averageViewPercentage,
              })),
              topVideos: breakdowns.videos,
              countries: countryRows,
              recommendations,
              limitations: [
                'Revenue dan RPM adalah metrik aktual estimasi dari YouTube Analytics, bukan pembayaran final.',
                'Laporan monetisasi dapat tidak tersedia untuk channel di luar YPP atau akun tanpa izin yt-analytics-monetary.readonly.',
                'CTR thumbnail dan audience retention per video tidak diestimasi. Nilai hanya ditampilkan bila metrik API yang didukung tersedia.',
                'Jam tayang publik valid dan views Shorts yang memenuhi syarat YPP harus diverifikasi dan dimasukkan dari YouTube Studio.',
              ],
            }, { headers: { 'Cache-Control': 'private, no-store' } })
          } catch (error) {
            if (error instanceof YoutubeIntegrationError) {
              return Response.json({ error: error.message, code: error.code }, {
                status: error.status,
                headers: { 'Cache-Control': 'private, no-store' },
              })
            }
            log.error({ err: error instanceof Error ? error.message.slice(0, 180) : 'unknown' }, 'YouTube revenue sync failed')
            return Response.json({ error: 'Sinkronisasi Revenue Optimization gagal diproses.' }, { status: 500 })
          }
        }

        if (!rateLimit('youtube-revenue-forecast:' + session.user.id, 20, 60 * 60 * 1000)) {
          return Response.json({ error: 'Batas pembuatan proyeksi tercapai.' }, { status: 429 })
        }
        const rows = await db.youtubeAnalyticsDailyMetric.findMany({
          where: {
            channelId: channel.id,
            metricDate: {
              gte: new Date(Date.now() - 30 * 86_400_000),
              lt: new Date(),
            },
          },
          select: { views: true, estimatedRevenue: true, estimatedAdRevenue: true },
        })
        const actualSummary = summarizeRevenue(rows)
        const baselineFromHistory = rows.length
          ? rows.reduce((sum, row) => sum + Number(row.views), 0) / 30
          : null
        const baselineDailyViews = input.baselineDailyViews ?? baselineFromHistory
        const hasActualRpm = actualSummary.rpm !== null && actualSummary.rpm > 0
        const rpm = hasActualRpm ? actualSummary.rpm! : input.assumedRPM
        if (rpm === null || rpm === undefined || rpm <= 0) {
          return Response.json({ error: 'RPM aktual belum tersedia. Masukkan asumsi RPM sendiri untuk membuat simulasi.' }, { status: 422 })
        }
        if (baselineDailyViews === null || baselineDailyViews <= 0) {
          return Response.json({ error: 'Views harian belum tersedia. Sinkronkan Analytics atau masukkan baseline views/hari.' }, { status: 422 })
        }

        try {
          const forecast = calculateRevenueForecast({
            targetRevenue: input.targetRevenue,
            rpm,
            baselineDailyViews,
            projectionDays: input.projectionDays,
          })
          const saved = await db.youtubeRevenueForecast.create({
            data: {
              channelId: channel.id,
              targetRevenue: input.targetRevenue,
              assumedRpm: rpm,
              baselineDailyViews,
              projectionDays: input.projectionDays,
              projectedViews: forecast.projectedViews,
              lowerForecast: forecast.lowerForecast,
              upperForecast: forecast.upperForecast,
              requiredViews: forecast.requiredViews,
              rpmSource: hasActualRpm ? 'actual-channel-rpm' : 'manual-assumption',
              assumptions: JSON.stringify({
                baselineSource: input.baselineDailyViews === null || input.baselineDailyViews === undefined
                  ? '30-day-channel-analytics-average'
                  : 'manual-user-input',
                rpmSource: hasActualRpm ? '30-day-channel-actual-rpm' : 'manual-user-input',
                lowerScenarioFactor: 0.8,
                upperScenarioFactor: 1.2,
              }),
            },
          })
          return Response.json({
            forecast: { ...forecast, id: saved.id, rpmSource: saved.rpmSource, createdAt: saved.createdAt },
            notice: 'Simulasi berdasarkan baseline views dan RPM yang disebutkan. Ini bukan pendapatan aktual atau jaminan hasil.',
          }, { headers: { 'Cache-Control': 'private, no-store' } })
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : 'Parameter proyeksi tidak valid.' }, { status: 400 })
        }
      },
    },
  },
})
