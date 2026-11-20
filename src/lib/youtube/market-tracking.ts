import { db } from '@/lib/db'
import { searchYoutubeMarket, type MarketCode, type MarketOrder, type YoutubeMarketSearchInput } from './market'

const TOPIC_LIMIT_PER_USER = 5
const DEFAULT_REFRESH_HOURS = 6

export type TrackedMarketTopicInput = {
  query: string
  market: MarketCode
  order: MarketOrder
  periodDays: 7 | 30 | 90 | 365
  maxResults: 10 | 25 | 50
}

export async function listTrackedMarketTopics(userId: string) {
  return db.youtubeTrackedMarketTopic.findMany({
    where: { userId },
    orderBy: [{ active: 'desc' }, { nextRunAt: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      query: true,
      market: true,
      order: true,
      periodDays: true,
      maxResults: true,
      active: true,
      lastSnapshotAt: true,
      nextRunAt: true,
      lastError: true,
      createdAt: true,
    },
  })
}

export async function saveTrackedMarketTopic(
  userId: string,
  input: TrackedMarketTopicInput,
) {
  const query = input.query.trim().replace(/\s+/g, ' ')
  if (query.length < 2 || query.length > 100) {
    throw new Error('Query pemantauan harus berisi 2 sampai 100 karakter.')
  }

  const existing = await db.youtubeTrackedMarketTopic.findUnique({
    where: { userId_query_market: { userId, query, market: input.market } },
  })
  if (!existing || !existing.active) {
    const activeCount = await db.youtubeTrackedMarketTopic.count({
      where: { userId, active: true },
    })
    if (activeCount >= TOPIC_LIMIT_PER_USER) {
      throw new Error('Maksimal lima topik pasar aktif per pengguna.')
    }
  }

  return db.youtubeTrackedMarketTopic.upsert({
    where: { userId_query_market: { userId, query, market: input.market } },
    create: {
      userId,
      query,
      market: input.market,
      order: input.order,
      periodDays: input.periodDays,
      maxResults: input.maxResults,
      active: true,
      nextRunAt: new Date(),
    },
    update: {
      order: input.order,
      periodDays: input.periodDays,
      maxResults: input.maxResults,
      active: true,
      nextRunAt: new Date(),
      lastError: null,
    },
    select: {
      id: true,
      query: true,
      market: true,
      order: true,
      periodDays: true,
      maxResults: true,
      active: true,
      lastSnapshotAt: true,
      nextRunAt: true,
      lastError: true,
    },
  })
}

export async function removeTrackedMarketTopic(userId: string, id: string) {
  const result = await db.youtubeTrackedMarketTopic.deleteMany({
    where: { id, userId },
  })
  return result.count === 1
}

export async function syncTrackedMarketTopics(limit = 20) {
  const now = new Date()
  const due = await db.youtubeTrackedMarketTopic.findMany({
    where: { active: true, nextRunAt: { lte: now } },
    orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }],
    take: Math.max(1, Math.min(40, limit)),
  })

  let succeeded = 0
  let failed = 0
  const processed = new Set<string>()

  for (const topic of due) {
    const fingerprint = [
      topic.query.trim().toLowerCase(),
      topic.market,
      topic.order,
      topic.periodDays,
      topic.maxResults,
    ].join('|')

    if (processed.has(fingerprint)) {
      continue
    }
    processed.add(fingerprint)

    const input: YoutubeMarketSearchInput = {
      query: topic.query,
      market: topic.market as MarketCode,
      order: topic.order as MarketOrder,
      periodDays: topic.periodDays as TrackedMarketTopicInput['periodDays'],
      maxResults: topic.maxResults,
    }

    try {
      const snapshot = await searchYoutubeMarket(input, { forceRefresh: true })
      const nextRunAt = new Date(now.getTime() + DEFAULT_REFRESH_HOURS * 60 * 60 * 1000)
      await db.youtubeTrackedMarketTopic.updateMany({
        where: {
          active: true,
          query: topic.query,
          market: topic.market,
          order: topic.order,
          periodDays: topic.periodDays,
          maxResults: topic.maxResults,
        },
        data: {
          queryId: snapshot.queryId,
          lastSnapshotAt: new Date(snapshot.observedAt),
          nextRunAt,
          lastError: null,
        },
      })
      succeeded++
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 400) : 'Market snapshot failed.'
      await db.youtubeTrackedMarketTopic.updateMany({
        where: {
          active: true,
          query: topic.query,
          market: topic.market,
          order: topic.order,
          periodDays: topic.periodDays,
          maxResults: topic.maxResults,
        },
        data: {
          nextRunAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          lastError: message,
        },
      })
      failed++
    }
  }

  return {
    dueTopics: due.length,
    uniqueQueries: processed.size,
    succeeded,
    failed,
    skippedDuplicateTopics: Math.max(0, due.length - processed.size),
  }
}
