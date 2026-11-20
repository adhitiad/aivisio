import { useEffect, useState, type FormEvent } from 'react'
import { useT } from '@/lib/i18n'

type MarketCode = 'ID' | 'MY' | 'SG' | 'PH' | 'TH' | 'VN' | 'BN' | 'KH' | 'LA' | 'MM'
type Order = 'relevance' | 'date' | 'viewCount'

type MarketVideo = {
  videoId: string
  title: string
  channelTitle: string
  publishedAt: string | null
  durationSec: number | null
  viewCount: string
  likeCount: string
  commentCount: string
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
}

type MarketResult = {
  query: string
  marketName: string
  source: string
  observedAt: string
  fromCache: boolean
  videos: MarketVideo[]
  dataLimitations: string[]
}

type TrackedTopic = {
  id: string
  query: string
  market: MarketCode
  order: Order
  periodDays: number
  maxResults: number
  active: boolean
  lastSnapshotAt: string | null
  nextRunAt: string
  lastError: string | null
}

const MARKETS: MarketCode[] = ['ID', 'MY', 'SG', 'PH', 'TH', 'VN', 'BN', 'KH', 'LA', 'MM']
const countFormat = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 })
const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })

function formatCount(value: string): string {
  try {
    return countFormat.format(BigInt(value))
  } catch {
    return '0'
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date)
}

function formatDuration(value: number | null): string {
  if (value === null) return '—'
  return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0')
}

export function YoutubeMarketResearch() {
  const t = useT('dashboard')
  const label = (key: string) => t('marketResearch.' + key)
  const [query, setQuery] = useState('')
  const [market, setMarket] = useState<MarketCode>('ID')
  const [order, setOrder] = useState<Order>('relevance')
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90 | 365>(90)
  const [maxResults, setMaxResults] = useState(50)
  const [result, setResult] = useState<MarketResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [trackedTopics, setTrackedTopics] = useState<TrackedTopic[]>([])
  const [trackingBusy, setTrackingBusy] = useState(false)
  const [trackingError, setTrackingError] = useState('')

  async function loadTrackedTopics() {
    try {
      const response = await fetch('/api/youtube/market/topics', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (response.ok) setTrackedTopics((payload?.topics ?? []) as TrackedTopic[])
    } catch {
      setTrackingError(label('trackingLoadFailed'))
    }
  }

  useEffect(() => {
    void loadTrackedTopics()
  }, [])

  async function saveTrackedTopic() {
    setTrackingBusy(true)
    setTrackingError('')
    try {
      const response = await fetch('/api/youtube/market/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, market, order, periodDays, maxResults }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || label('trackingSaveFailed'))
      await loadTrackedTopics()
    } catch (err) {
      setTrackingError(err instanceof Error ? err.message : label('trackingSaveFailed'))
    } finally {
      setTrackingBusy(false)
    }
  }

  async function removeTrackedTopic(id: string) {
    setTrackingError('')
    try {
      const response = await fetch('/api/youtube/market/topics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || label('trackingDeleteFailed'))
      setTrackedTopics((current) => current.filter((topic) => topic.id !== id))
    } catch (err) {
      setTrackingError(err instanceof Error ? err.message : label('trackingDeleteFailed'))
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const response = await fetch('/api/youtube/market/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, market, order, periodDays, maxResults }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        if (payload?.code === 'YOUTUBE_API_NOT_CONFIGURED') {
          throw new Error(label('notConfigured'))
        }
        throw new Error(payload?.error || label('error'))
      }

      setResult(payload as MarketResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : label('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{label('title')}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {label('subtitle')}
        </p>
      </header>

      <form
        onSubmit={submit}
        className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-5"
      >
        <label className="space-y-2 text-sm xl:col-span-2">
          <span className="font-medium">{label('queryLabel')}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            minLength={2}
            maxLength={100}
            required
            placeholder={label('queryPlaceholder')}
            className="h-10 w-full rounded-md border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">{label('marketLabel')}</span>
          <select
            value={market}
            onChange={(event) => setMarket(event.target.value as MarketCode)}
            className="h-10 w-full rounded-md border border-input bg-background px-3"
          >
            {MARKETS.map((code) => (
              <option key={code} value={code}>{label('markets.' + code)}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">{label('orderLabel')}</span>
          <select
            value={order}
            onChange={(event) => setOrder(event.target.value as Order)}
            className="h-10 w-full rounded-md border border-input bg-background px-3"
          >
            {(['relevance', 'date', 'viewCount'] as const).map((value) => (
              <option key={value} value={value}>{label('orders.' + value)}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">{label('periodLabel')}</span>
          <select
            value={periodDays}
            onChange={(event) => setPeriodDays(Number(event.target.value) as 7 | 30 | 90 | 365)}
            className="h-10 w-full rounded-md border border-input bg-background px-3"
          >
            {([7, 30, 90, 365] as const).map((value) => (
              <option key={value} value={value}>{label('periods.' + value)}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">{label('resultsLabel')}</span>
          <select
            value={maxResults}
            onChange={(event) => setMaxResults(Number(event.target.value))}
            className="h-10 w-full rounded-md border border-input bg-background px-3"
          >
            {[10, 25, 50].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-2 xl:col-span-5">
          <button
            type="submit"
            disabled={loading || query.trim().length < 2}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? label('searching') : label('search')}
          </button>
          <button
            type="button"
            onClick={saveTrackedTopic}
            disabled={trackingBusy || query.trim().length < 2}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {trackingBusy ? label('trackingSaving') : label('trackTopic')}
          </button>
        </div>
      </form>

      {trackingError ? (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {trackingError}
        </div>
      ) : null}

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">{label('trackingTitle')}</h2>
            <p className="text-xs text-muted-foreground">{label('trackingDescription')}</p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs tabular-nums">
            {trackedTopics.length}/5
          </span>
        </div>
        {trackedTopics.length === 0 ? (
          <p className="text-sm text-muted-foreground">{label('trackingEmpty')}</p>
        ) : (
          <div className="divide-y divide-border">
            {trackedTopics.map((topic) => (
              <div key={topic.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{topic.query} · {label('markets.' + topic.market)}</p>
                  <p className="text-xs text-muted-foreground">
                    {label('lastSnapshot')}: {formatDate(topic.lastSnapshotAt)} · {label('nextSnapshot')}: {formatDate(topic.nextRunAt)}
                  </p>
                  {topic.lastError ? (
                    <p className="mt-1 text-xs text-destructive">{topic.lastError}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeTrackedTopic(topic.id)}
                  className="h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                >
                  {label('stopTracking')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">{label('searching')}</p>
      ) : null}

      {result ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{result.query} · {result.marketName}</h2>
              <p className="text-xs text-muted-foreground">
                {label('observed')}: {formatDate(result.observedAt)} · {label('source')}: {result.source}
              </p>
            </div>
            <span className="rounded-full border border-border px-3 py-1 text-xs">
              {result.fromCache ? label('cache') : label('live')}
            </span>
          </div>

          {result.videos.length === 0 ? (
            <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              {label('noResults')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Video</th>
                    <th className="px-3 py-3">{label('views')}</th>
                    <th className="px-3 py-3">{label('viewsPerDay')}</th>
                    <th className="px-3 py-3">{label('observedMomentum')}</th>
                    <th className="px-3 py-3">{label('opportunityScore')}</th>
                    <th className="px-3 py-3">{label('engagement')}</th>
                    <th className="px-3 py-3">{label('published')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.videos.map((video) => (
                    <tr key={video.videoId} className="align-top">
                      <td className="max-w-[430px] px-3 py-3">
                        <div className="flex gap-3">
                          {video.thumbnailUrl ? (
                            <img
                              src={video.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              className="h-16 w-28 rounded object-cover"
                            />
                          ) : null}
                          <div className="min-w-0 space-y-1">
                            <a
                              href={video.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium hover:underline"
                            >
                              {video.title}
                            </a>
                            <p className="text-xs text-muted-foreground">
                              {video.channelTitle} · {formatDuration(video.durationSec)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {label('likes')}: {formatCount(video.likeCount)} · {label('comments')}: {formatCount(video.commentCount)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatCount(video.viewCount)}</td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums">{countFormat.format(video.viewsPerDay)}</td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                        {video.momentumViewsPerDay === null
                          ? label('waitingMomentum')
                          : (
                            <>
                              <div>{countFormat.format(video.momentumViewsPerDay)} /hari</div>
                              <div className="text-xs text-muted-foreground">
                                {video.momentumGrowthPct === null ? '—' : (video.momentumGrowthPct >= 0 ? '+' : '') + numberFormat.format(video.momentumGrowthPct) + '%'}
                                {' · '}{Math.round(video.momentumSampleHours ?? 0)}h
                              </div>
                            </>
                          )}
                      </td>
                      <td className="min-w-[150px] px-3 py-3">
                        <div className="font-semibold tabular-nums">{video.opportunityScore}/100</div>
                        <div className="text-xs text-muted-foreground">{label('confidence.' + video.scoringConfidence)}</div>
                        <details className="mt-1 max-w-[240px]">
                          <summary className="cursor-pointer text-xs text-primary">{label('scoreDetails')}</summary>
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                            {video.opportunityRationale.map((reason, index) => <li key={index}>{reason}</li>)}
                          </ul>
                        </details>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums">{numberFormat.format(video.engagementRate)}%</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatDate(video.publishedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <h3 className="mb-2 text-sm font-semibold">{label('limitations')}</h3>
            <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
              {result.dataLimitations.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  )
}
