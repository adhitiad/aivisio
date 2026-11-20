import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { deriveObservedMomentum, scoreYoutubeOpportunity } from './scoring'

export const MARKET_CODES = ['ID', 'MY', 'SG', 'PH', 'TH', 'VN', 'BN', 'KH', 'LA', 'MM'] as const
export type MarketCode = (typeof MARKET_CODES)[number]
export type MarketOrder = 'relevance' | 'date' | 'viewCount'

export const MARKET_CONFIG: Record<MarketCode, { name: string; language: string }> = {
  ID: { name: 'Indonesia', language: 'id' },
  MY: { name: 'Malaysia', language: 'ms' },
  SG: { name: 'Singapore', language: 'en' },
  PH: { name: 'Philippines', language: 'tl' },
  TH: { name: 'Thailand', language: 'th' },
  VN: { name: 'Vietnam', language: 'vi' },
  BN: { name: 'Brunei', language: 'ms' },
  KH: { name: 'Cambodia', language: 'km' },
  LA: { name: 'Laos', language: 'lo' },
  MM: { name: 'Myanmar', language: 'my' },
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const MAX_SEARCH_CALLS_PER_PACIFIC_DAY = 80
const MAX_DATA_API_UNITS_PER_PACIFIC_DAY = 9000

export class YoutubeMarketError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = 'YoutubeMarketError'
  }
}

export type YoutubeMarketSearchInput = {
  query: string
  market: MarketCode
  order: MarketOrder
  periodDays: 7 | 30 | 90 | 365
  maxResults: number
}

type SearchListResponse = {
  items?: Array<{
    id?: { videoId?: string }
  }>
}

type VideoListResponse = {
  items?: Array<{
    id?: string
    snippet?: {
      title?: string
      description?: string
      channelId?: string
      channelTitle?: string
      publishedAt?: string
      thumbnails?: {
        high?: { url?: string }
        medium?: { url?: string }
        default?: { url?: string }
      }
    }
    statistics?: {
      viewCount?: string
      likeCount?: string
      commentCount?: string
    }
    contentDetails?: { duration?: string }
  }>
}

type ChannelListResponse = {
  items?: Array<{
    id?: string
    statistics?: {
      subscriberCount?: string
      hiddenSubscriberCount?: boolean
    }
  }>
}

type StoredVideo = {
  videoId: string
  channelId: string
  channelTitle: string
  title: string
  description: string | null
  publishedAt: Date | null
  durationSec: number | null
  viewCount: bigint
  likeCount: bigint
  commentCount: bigint
  subscriberCount: bigint | null
  viewsPerDay: number
  engagementRate: number
  velocityIndex: number
  thumbnailUrl: string | null
  videoUrl: string
}

type ScoredStoredVideo = StoredVideo & {
  momentumViewsPerDay: number | null
  momentumGrowthPct: number | null
  momentumSampleHours: number | null
  opportunityScore: number
  scoringConfidence: 'high' | 'medium' | 'limited'
  scoringComponents: string
  opportunityRationale: string
  momentumObservationCount: number
}

const globalForMarket = globalThis as unknown as {
  aivisoMarketInFlight?: Map<string, Promise<YoutubeMarketSearchResult>>
}
const inFlight = globalForMarket.aivisoMarketInFlight ?? new Map<string, Promise<YoutubeMarketSearchResult>>()
globalForMarket.aivisoMarketInFlight = inFlight

export type YoutubeMarketSearchResult = {
  queryId: string
  query: string
  market: MarketCode
  marketName: string
  language: string
  source: 'youtube-data-api-v3'
  observedAt: string
  expiresAt: string
  fromCache: boolean
  resultCount: number
  videos: Array<{
    videoId: string
    title: string
    description: string | null
    channelId: string
    channelTitle: string
    publishedAt: string | null
    durationSec: number | null
    viewCount: string
    likeCount: string
    commentCount: string
    subscriberCount: string | null
    viewsPerDay: number
    engagementRate: number
    velocityIndex: number
    momentumViewsPerDay: number | null
    momentumGrowthPct: number | null
    momentumSampleHours: number | null
    opportunityScore: number
    scoringConfidence: 'high' | 'medium' | 'limited'
    scoringComponents: Record<string, { score: number; available: boolean; weight: number; rationale: string }>
    opportunityRationale: string[]
    momentumObservationCount: number
    thumbnailUrl: string | null
    videoUrl: string
  }>
  dataLimitations: string[]
}

function quotaDatePacific(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function cacheKeyFor(input: YoutubeMarketSearchInput): string {
  const normalized = [
    input.query.trim().toLowerCase().replace(/\s+/g, ' '),
    input.market,
    MARKET_CONFIG[input.market].language,
    input.order,
    input.periodDays,
    input.maxResults,
  ].join('|')
  return createHash('sha256').update(normalized).digest('hex')
}

export function parseYoutubeDuration(duration: string | undefined): number | null {
  if (!duration) return null
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return null
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  return hours * 3600 + minutes * 60 + seconds
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

function parseCount(value: string | undefined): bigint {
  if (!value) return 0n
  try {
    const parsed = BigInt(value)
    return parsed >= 0n ? parsed : 0n
  } catch {
    return 0n
  }
}

async function reserveSearchCall(quotaDate: string): Promise<void> {
  await db.youtubeApiUsage.upsert({
    where: { quotaDate },
    create: { quotaDate },
    update: {},
  })

  const reserved = await db.youtubeApiUsage.updateMany({
    where: {
      quotaDate,
      searchCalls: { lt: MAX_SEARCH_CALLS_PER_PACIFIC_DAY },
    },
    data: { searchCalls: { increment: 1 } },
  })
  if (reserved.count === 0) {
    throw new YoutubeMarketError(
      'Kuota pencarian YouTube untuk hari ini hampir habis. Coba lagi setelah reset kuota Pacific Time.',
      429,
      'YOUTUBE_SEARCH_QUOTA_LIMIT',
    )
  }
}

async function reserveDataApiUnit(quotaDate: string): Promise<void> {
  await db.youtubeApiUsage.upsert({
    where: { quotaDate },
    create: { quotaDate },
    update: {},
  })
  const reserved = await db.youtubeApiUsage.updateMany({
    where: {
      quotaDate,
      dataApiUnits: { lt: MAX_DATA_API_UNITS_PER_PACIFIC_DAY },
    },
    data: { dataApiUnits: { increment: 1 } },
  })
  if (reserved.count === 0) {
    throw new YoutubeMarketError(
      'Kuota data YouTube API internal AIVISIO telah mencapai batas aman harian.',
      429,
      'YOUTUBE_DATA_QUOTA_LIMIT',
    )
  }
}

async function youtubeApiGet<T>(resource: string, params: Record<string, string>): Promise<T> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY
  if (!apiKey) {
    throw new YoutubeMarketError(
      'YOUTUBE_DATA_API_KEY belum dikonfigurasi pada server.',
      503,
      'YOUTUBE_API_NOT_CONFIGURED',
    )
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/' + resource)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.set('key', apiKey)

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
      cache: 'no-store',
    })
  } catch {
    throw new YoutubeMarketError('Tidak dapat menghubungi YouTube Data API.', 502, 'YOUTUBE_API_NETWORK_ERROR')
  }

  const payload = await response.json().catch(() => null) as {
    error?: { message?: string; errors?: Array<{ reason?: string }> }
  } | null

  if (!response.ok) {
    const reason = payload?.error?.errors?.[0]?.reason ?? ''
    if (response.status === 403 && /quotaExceeded|dailyLimitExceeded/i.test(reason)) {
      throw new YoutubeMarketError('Kuota resmi YouTube Data API telah habis.', 429, 'YOUTUBE_GOOGLE_QUOTA_EXCEEDED')
    }
    throw new YoutubeMarketError(
      'YouTube Data API menolak permintaan (' + response.status + ').',
      response.status === 400 ? 400 : 502,
      'YOUTUBE_API_ERROR',
    )
  }

  return (payload ?? {}) as T
}

function parseJsonRecord(value: string): Record<string, { score: number; available: boolean; weight: number; rationale: string }> {
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, { score: number; available: boolean; weight: number; rationale: string }>
      : {}
  } catch {
    return {}
  }
}

function parseJsonStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function serializeCached(
  query: {
    id: string
    query: string
    market: string
    languageCode: string
    resultCount: number
    observedAt: Date
    expiresAt: Date
    videos: Array<{
      videoId: string
      title: string
      description: string | null
      channelId: string
      channelTitle: string
      publishedAt: Date | null
      durationSec: number | null
      viewCount: bigint
      likeCount: bigint
      commentCount: bigint
      subscriberCount: bigint | null
      viewsPerDay: number
      engagementRate: number
      velocityIndex: number
      momentumViewsPerDay: number | null
      momentumGrowthPct: number | null
      momentumSampleHours: number | null
      opportunityScore: number | null
      scoringConfidence: string | null
      scoringComponents: string
      opportunityRationale: string
      momentumObservationCount: number
      thumbnailUrl: string | null
      videoUrl: string
    }>
  },
  fromCache: boolean,
): YoutubeMarketSearchResult {
  const market = query.market as MarketCode
  return {
    queryId: query.id,
    query: query.query,
    market,
    marketName: MARKET_CONFIG[market]?.name ?? market,
    language: query.languageCode,
    source: 'youtube-data-api-v3',
    observedAt: query.observedAt.toISOString(),
    expiresAt: query.expiresAt.toISOString(),
    fromCache,
    resultCount: query.resultCount,
    videos: query.videos.map((video) => ({
      videoId: video.videoId,
      title: video.title,
      description: video.description,
      channelId: video.channelId,
      channelTitle: video.channelTitle,
      publishedAt: video.publishedAt?.toISOString() ?? null,
      durationSec: video.durationSec,
      viewCount: video.viewCount.toString(),
      likeCount: video.likeCount.toString(),
      commentCount: video.commentCount.toString(),
      subscriberCount: video.subscriberCount?.toString() ?? null,
      viewsPerDay: video.viewsPerDay,
      engagementRate: video.engagementRate,
      velocityIndex: video.velocityIndex,
      momentumViewsPerDay: video.momentumViewsPerDay,
      momentumGrowthPct: video.momentumGrowthPct,
      momentumSampleHours: video.momentumSampleHours,
      opportunityScore: video.opportunityScore ?? 0,
      scoringConfidence: video.scoringConfidence === 'high' || video.scoringConfidence === 'medium'
        ? video.scoringConfidence
        : 'limited',
      scoringComponents: parseJsonRecord(video.scoringComponents),
      opportunityRationale: parseJsonStringArray(video.opportunityRationale),
      momentumObservationCount: video.momentumObservationCount,
      thumbnailUrl: video.thumbnailUrl,
      videoUrl: video.videoUrl,
    })),
    dataLimitations: [
      'Hasil search.list adalah hasil discovery yang dipengaruhi ranking dan relevansi, bukan volume pencarian keyword.',
      'Statistik video adalah data publik saat pengambilan dan tidak menunjukkan impressions, CTR, watch time, atau revenue channel.',
      'Velocity index membandingkan views per hari dengan median sampel hasil query ini; bukan skor viralitas universal.',
    ],
  }
}

async function readCache(cacheKey: string): Promise<YoutubeMarketSearchResult | null> {
  const cached = await db.youtubeMarketQuery.findUnique({
    where: { cacheKey },
    include: {
      videos: {
        orderBy: [{ velocityIndex: 'desc' }, { viewsPerDay: 'desc' }],
      },
    },
  })
  if (!cached || cached.expiresAt.getTime() <= Date.now()) return null
  return serializeCached(cached, true)
}

async function performMarketSearch(input: YoutubeMarketSearchInput, cacheKey: string): Promise<YoutubeMarketSearchResult> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY
  if (!apiKey) {
    throw new YoutubeMarketError(
      'YOUTUBE_DATA_API_KEY belum dikonfigurasi pada server.',
      503,
      'YOUTUBE_API_NOT_CONFIGURED',
    )
  }

  const quotaDate = quotaDatePacific()
  const marketConfig = MARKET_CONFIG[input.market]
  const observedAt = new Date()
  const expiresAt = new Date(observedAt.getTime() + CACHE_TTL_MS)
  const publishedAfter = new Date(
    observedAt.getTime() - input.periodDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  await reserveSearchCall(quotaDate)
  const search = await youtubeApiGet<SearchListResponse>('search', {
    part: 'snippet',
    type: 'video',
    q: input.query,
    regionCode: input.market,
    relevanceLanguage: marketConfig.language,
    order: input.order,
    maxResults: String(input.maxResults),
    publishedAfter,
  })

  const videoIds = [...new Set(
    (search.items ?? [])
      .map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id)),
  )]

  let videos: VideoListResponse['items'] = []
  let channels: ChannelListResponse['items'] = []

  if (videoIds.length > 0) {
    await reserveDataApiUnit(quotaDate)
    const videoResponse = await youtubeApiGet<VideoListResponse>('videos', {
      part: 'snippet,statistics,contentDetails',
      id: videoIds.join(','),
    })
    videos = videoResponse.items ?? []

    const channelIds = [...new Set(
      videos.map((item) => item.snippet?.channelId).filter((id): id is string => Boolean(id)),
    )]
    if (channelIds.length > 0) {
      await reserveDataApiUnit(quotaDate)
      const channelResponse = await youtubeApiGet<ChannelListResponse>('channels', {
        part: 'statistics',
        id: channelIds.join(','),
      })
      channels = channelResponse.items ?? []
    }
  }

  const channelStats = new Map(
    channels.map((channel) => [
      channel.id ?? '',
      channel.statistics?.hiddenSubscriberCount
        ? null
        : parseCount(channel.statistics?.subscriberCount),
    ]),
  )

  const staged = (videos ?? []).flatMap((item): StoredVideo[] => {
    const videoId = item.id
    const snippet = item.snippet
    if (!videoId || !snippet?.channelId) return []

    const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt) : null
    const validPublishedAt = publishedAt && Number.isFinite(publishedAt.getTime()) ? publishedAt : null
    const viewCount = parseCount(item.statistics?.viewCount)
    const likeCount = parseCount(item.statistics?.likeCount)
    const commentCount = parseCount(item.statistics?.commentCount)
    const views = Number(viewCount)
    const ageDays = validPublishedAt
      ? Math.max(1, (observedAt.getTime() - validPublishedAt.getTime()) / 86_400_000)
      : 1
    const viewsPerDay = views / ageDays
    const engagementRate = views > 0
      ? (Number(likeCount + commentCount) / views) * 100
      : 0
    const thumbnails = snippet.thumbnails
    const thumbnailUrl = thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? null

    return [{
      videoId,
      channelId: snippet.channelId,
      channelTitle: (snippet.channelTitle ?? '').slice(0, 200),
      title: (snippet.title ?? '').slice(0, 500),
      description: snippet.description?.slice(0, 4000) ?? null,
      publishedAt: validPublishedAt,
      durationSec: parseYoutubeDuration(item.contentDetails?.duration),
      viewCount,
      likeCount,
      commentCount,
      subscriberCount: channelStats.get(snippet.channelId) ?? null,
      viewsPerDay: Number.isFinite(viewsPerDay) ? viewsPerDay : 0,
      engagementRate: Number.isFinite(engagementRate) ? engagementRate : 0,
      velocityIndex: 0,
      thumbnailUrl,
      videoUrl: 'https://www.youtube.com/watch?v=' + videoId,
    }]
  })

  const baseline = median(staged.map((video) => video.viewsPerDay))
  const normalized = staged.map((video) => ({
    ...video,
    velocityIndex: baseline > 0 ? Number(((video.viewsPerDay / baseline) * 100).toFixed(2)) : 100,
  }))

  const queryRow = await db.youtubeMarketQuery.upsert({
    where: { cacheKey },
    create: {
      cacheKey,
      query: input.query,
      market: input.market,
      languageCode: marketConfig.language,
      order: input.order,
      periodDays: input.periodDays,
      resultCount: normalized.length,
      source: 'youtube-data-api-v3',
      observedAt,
      expiresAt,
    },
    update: {
      query: input.query,
      market: input.market,
      languageCode: marketConfig.language,
      order: input.order,
      periodDays: input.periodDays,
      resultCount: normalized.length,
      source: 'youtube-data-api-v3',
      observedAt,
      expiresAt,
    },
  })

  const observedVideoIds = normalized.map((video) => video.videoId)
  const previousObservations = observedVideoIds.length > 0
    ? await db.youtubeMarketVideoObservation.findMany({
        where: {
          queryId: queryRow.id,
          videoId: { in: observedVideoIds },
          capturedAt: {
            lt: observedAt,
            gte: new Date(observedAt.getTime() - 10 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { capturedAt: 'desc' },
        select: { videoId: true, viewCount: true, capturedAt: true },
      })
    : []

  const observationsByVideo = new Map<string, typeof previousObservations>()
  for (const observation of previousObservations) {
    const existing = observationsByVideo.get(observation.videoId) ?? []
    existing.push(observation)
    observationsByVideo.set(observation.videoId, existing)
  }

  const scored: ScoredStoredVideo[] = normalized.map((video) => {
    const history = observationsByVideo.get(video.videoId) ?? []
    const previous = history[0]
    const sampleHours = previous
      ? (observedAt.getTime() - previous.capturedAt.getTime()) / 3_600_000
      : null
    const momentum = previous && sampleHours !== null
      ? deriveObservedMomentum({
          currentViews: video.viewCount,
          previousViews: previous.viewCount,
          sampleHours,
        })
      : null

    const opportunity = scoreYoutubeOpportunity({
      viewsPerDay: video.viewsPerDay,
      engagementRate: video.engagementRate,
      subscriberCount: video.subscriberCount,
      publishedAt: video.publishedAt,
      momentumViewsPerDay: momentum?.viewsPerDay ?? null,
      momentumGrowthPct: momentum?.growthPct ?? null,
      momentumSampleHours: momentum?.sampleHours ?? null,
      sampleVelocityIndex: video.velocityIndex,
      observationCount: history.length + 1,
    }, observedAt)

    return {
      ...video,
      momentumViewsPerDay: momentum?.viewsPerDay ?? null,
      momentumGrowthPct: momentum?.growthPct ?? null,
      momentumSampleHours: momentum?.sampleHours ?? null,
      opportunityScore: opportunity.score,
      scoringConfidence: opportunity.confidence,
      scoringComponents: JSON.stringify(opportunity.components),
      opportunityRationale: JSON.stringify(opportunity.rationale),
      momentumObservationCount: history.length + 1,
    }
  })

  await db.$transaction(async (tx) => {
    await tx.youtubeMarketVideo.deleteMany({ where: { queryId: queryRow.id } })
    if (scored.length > 0) {
      await tx.youtubeMarketVideo.createMany({
        data: scored.map((video) => ({
          queryId: queryRow.id,
          videoId: video.videoId,
          channelId: video.channelId,
          channelTitle: video.channelTitle,
          title: video.title,
          description: video.description,
          publishedAt: video.publishedAt,
          durationSec: video.durationSec,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount: video.commentCount,
          subscriberCount: video.subscriberCount,
          viewsPerDay: video.viewsPerDay,
          engagementRate: video.engagementRate,
          velocityIndex: video.velocityIndex,
          momentumViewsPerDay: video.momentumViewsPerDay,
          momentumGrowthPct: video.momentumGrowthPct,
          momentumSampleHours: video.momentumSampleHours,
          opportunityScore: video.opportunityScore,
          scoringConfidence: video.scoringConfidence,
          scoringComponents: video.scoringComponents,
          opportunityRationale: video.opportunityRationale,
          momentumObservationCount: video.momentumObservationCount,
          thumbnailUrl: video.thumbnailUrl,
          videoUrl: video.videoUrl,
          createdAt: observedAt,
          updatedAt: observedAt,
        })),
      })

      await tx.youtubeMarketVideoObservation.createMany({
        data: scored.map((video) => ({
          queryId: queryRow.id,
          videoId: video.videoId,
          channelId: video.channelId,
          channelTitle: video.channelTitle,
          title: video.title,
          publishedAt: video.publishedAt,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount: video.commentCount,
          subscriberCount: video.subscriberCount,
          viewsPerDay: video.viewsPerDay,
          engagementRate: video.engagementRate,
          velocityIndex: video.velocityIndex,
          capturedAt: observedAt,
          createdAt: observedAt,
          updatedAt: observedAt,
        })),
        skipDuplicates: true,
      })

      await tx.youtubeOpportunityScoreSnapshot.createMany({
        data: scored.map((video) => {
          const component = parseJsonRecord(video.scoringComponents)
          return {
            queryId: queryRow.id,
            videoId: video.videoId,
            score: video.opportunityScore,
            confidence: video.scoringConfidence,
            algorithmVersion: 'v1',
            momentumScore: component.momentum?.score ?? 0,
            demandScore: component.demand?.score ?? 0,
            engagementScore: component.engagement?.score ?? 0,
            competitionScore: component.competition?.score ?? 0,
            freshnessScore: component.freshness?.score ?? 0,
            components: video.scoringComponents,
            rationale: video.opportunityRationale,
            capturedAt: observedAt,
            createdAt: observedAt,
            updatedAt: observedAt,
          }
        }),
        skipDuplicates: true,
      })
    }
    await tx.youtubeMarketQuery.update({
      where: { id: queryRow.id },
      data: { resultCount: scored.length, observedAt, expiresAt },
    })
  })

  const fresh = await db.youtubeMarketQuery.findUnique({
    where: { id: queryRow.id },
    include: {
      videos: {
        orderBy: [{ velocityIndex: 'desc' }, { viewsPerDay: 'desc' }],
      },
    },
  })
  if (!fresh) {
    throw new YoutubeMarketError('Hasil riset tidak dapat disimpan.', 500, 'YOUTUBE_MARKET_PERSIST_FAILED')
  }
  return serializeCached(fresh, false)
}

/**
 * Cached public market discovery. This deliberately does not claim to measure
 * keyword search volume; it ranks only the public videos returned by YouTube.
 */
export async function searchYoutubeMarket(
  input: YoutubeMarketSearchInput,
  options: { forceRefresh?: boolean } = {},
): Promise<YoutubeMarketSearchResult> {
  const normalizedInput: YoutubeMarketSearchInput = {
    ...input,
    query: input.query.trim().replace(/\s+/g, ' '),
  }
  if (normalizedInput.query.length < 2 || normalizedInput.query.length > 100) {
    throw new YoutubeMarketError('Query harus berisi 2 sampai 100 karakter.', 400, 'INVALID_QUERY')
  }
  const cacheKey = cacheKeyFor(normalizedInput)
  if (!options.forceRefresh) {
    const cached = await readCache(cacheKey)
    if (cached) return cached
  }

  const running = inFlight.get(cacheKey)
  if (running) return running

  const task = performMarketSearch(normalizedInput, cacheKey)
  inFlight.set(cacheKey, task)
  try {
    return await task
  } finally {
    inFlight.delete(cacheKey)
  }
}
