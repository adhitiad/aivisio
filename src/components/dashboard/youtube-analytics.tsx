import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useT } from '@/lib/i18n'

type Channel = {
  id: string
  youtubeChannelId: string
  title: string
  handle: string | null
  thumbnailUrl: string | null
  country: string | null
  connectionStatus: string
  lastSyncedAt: string | null
  lastAnalyticsSyncedAt: string | null
  analyticsSyncError: string | null
}

type ChannelsPayload = {
  connected: boolean
  connectionStatus: string
  googleEmail: string | null
  hasAnalyticsAccess: boolean
  hasMonetaryAccess: boolean
  channels: Channel[]
}

type AnalyticsRow = {
  date: string
  views: string
  estimatedMinutesWatched: number
  averageViewDuration: number
  averageViewPercentage: number
  likes: string
  comments: string
  shares: string
  subscribersGained: number
  subscribersLost: number
  estimatedRevenue: number | null
  estimatedAdRevenue: number | null
}

type AnalyticsPayload = {
  channel: { id: string; title: string }
  startDate: string
  endDate: string
  currency: string | null
  hasMonetaryAccess: boolean
  includesRevenue: boolean
  observedAt: string
  rowCount: number
  rows: AnalyticsRow[]
  limitations: string[]
}

const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 })
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })
const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

function dateValue(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDate(value: string): string {
  const date = new Date(value + 'T00:00:00')
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date)
}

function sumViews(rows: AnalyticsRow[]): bigint {
  return rows.reduce((sum, row) => {
    try { return sum + BigInt(row.views) } catch { return sum }
  }, 0n)
}

function sumMetric(rows: AnalyticsRow[], key: 'estimatedMinutesWatched' | 'subscribersGained' | 'subscribersLost' | 'estimatedRevenue' | 'estimatedAdRevenue'): number {
  return rows.reduce((sum, row) => sum + (row[key] ?? 0), 0)
}

export function YoutubeAnalyticsDashboard() {
  const t = useT('dashboard')
  const label = (key: string) => t('youtubeAnalytics.' + key)
  const [channels, setChannels] = useState<Channel[]>([])
  const [connection, setConnection] = useState<ChannelsPayload | null>(null)
  const [channelId, setChannelId] = useState('')
  const [startDate, setStartDate] = useState(() => dateValue(29))
  const [endDate, setEndDate] = useState(() => dateValue(2))
  const [includeRevenue, setIncludeRevenue] = useState(false)
  const [report, setReport] = useState<AnalyticsPayload | null>(null)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadChannels() {
    setLoadingChannels(true)
    setError('')
    try {
      const response = await fetch('/api/youtube/channels', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || label('loadFailed'))
      const value = payload as ChannelsPayload
      setConnection(value)
      setChannels(value.channels)
      setChannelId((current) =>
        current && value.channels.some((channel) => channel.id === current)
          ? current
          : value.channels[0]?.id ?? '',
      )
      if (!value.hasMonetaryAccess) setIncludeRevenue(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : label('loadFailed'))
    } finally {
      setLoadingChannels(false)
    }
  }

  useEffect(() => {
    void loadChannels()
    const status = new URLSearchParams(window.location.search).get('youtube')
    const notices: Record<string, string> = {
      connected: label('connectedNotice'),
      denied: label('deniedNotice'),
      failed: label('connectFailed'),
      'not-configured': label('notConfigured'),
      'channel-conflict': label('channelConflict'),
      'session-expired': label('sessionExpired'),
    }
    if (status && notices[status]) setNotice(notices[status])
  }, [])

  const summary = useMemo(() => {
    if (!report) return null
    const views = sumViews(report.rows)
    const watchMinutes = sumMetric(report.rows, 'estimatedMinutesWatched')
    const likes = report.rows.reduce((sum, row) => sum + BigInt(row.likes), 0n)
    const comments = report.rows.reduce((sum, row) => sum + BigInt(row.comments), 0n)
    const gained = sumMetric(report.rows, 'subscribersGained')
    const lost = sumMetric(report.rows, 'subscribersLost')
    const revenue = sumMetric(report.rows, 'estimatedRevenue')
    const adRevenue = sumMetric(report.rows, 'estimatedAdRevenue')
    const weightedDuration = report.rows.reduce(
      (sum, row) => sum + Number(row.views) * row.averageViewDuration,
      0,
    )
    const viewCount = Number(views)
    return {
      views: compact.format(views),
      likes: compact.format(likes),
      comments: compact.format(comments),
      watchHours: number.format(watchMinutes / 60),
      avgDuration: viewCount > 0 ? number.format(weightedDuration / viewCount) + 's' : '—',
      netSubscribers: number.format(gained - lost),
      revenue: currency.format(revenue),
      adRevenue: currency.format(adRevenue),
    }
  }, [report])

  async function runReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!channelId) return
    setError('')
    setReport(null)
    setLoadingReport(true)
    try {
      const response = await fetch('/api/youtube/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, startDate, endDate, includeRevenue }),
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || label('reportFailed'))
      setReport(payload as AnalyticsPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : label('reportFailed'))
    } finally {
      setLoadingReport(false)
    }
  }

  async function disconnect() {
    if (!window.confirm(label('disconnectConfirm'))) return
    setDisconnecting(true)
    setError('')
    try {
      const response = await fetch('/api/youtube/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || label('disconnectFailed'))
      setReport(null)
      await loadChannels()
      setNotice(label('disconnectedNotice'))
    } catch (err) {
      setError(err instanceof Error ? err.message : label('disconnectFailed'))
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{label('title')}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{label('subtitle')}</p>
      </header>

      {notice ? (
        <div role="status" className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loadingChannels ? (
        <p className="text-sm text-muted-foreground">{label('loading')}</p>
      ) : !connection?.connected ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">{label('connectTitle')}</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{label('connectDescription')}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{label('scopeChannel')}</li>
            <li>{label('scopeAnalytics')}</li>
            <li>{label('scopeRevenue')}</li>
          </ul>
          <form method="post" action="/api/youtube/oauth/connect">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {label('connectButton')}
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{label('googleAccount')}</p>
              <p className="truncate text-sm font-medium">{connection.googleEmail || label('accountConnected')}</p>
              <p className="text-xs text-muted-foreground">
                {connection.hasMonetaryAccess ? label('revenueAccess') : label('noRevenueAccess')}
              </p>
              <p className="text-xs text-muted-foreground">
                {label('lastSync')}: {channels.find((channel) => channel.id === channelId)?.lastAnalyticsSyncedAt
                  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(channels.find((channel) => channel.id === channelId)!.lastAnalyticsSyncedAt!))
                  : label('neverSynced')}
              </p>
              {channels.find((channel) => channel.id === channelId)?.analyticsSyncError ? (
                <p className="text-xs text-destructive">
                  {label('syncWarning')}: {channels.find((channel) => channel.id === channelId)?.analyticsSyncError}
                </p>
              ) : null}
            </div>
            <form method="post" action="/api/youtube/oauth/connect">
              <button type="submit" className="h-9 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">
                {label('reauthorize')}
              </button>
            </form>
            <button
              type="button"
              onClick={disconnect}
              disabled={disconnecting}
              className="h-9 rounded-md border border-border px-3 text-sm font-medium disabled:opacity-50"
            >
              {disconnecting ? label('disconnecting') : label('disconnect')}
            </button>
          </section>

          {channels.length === 0 ? (
            <section className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
              {label('noChannels')}
            </section>
          ) : (
            <form onSubmit={runReport} className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-2 text-sm xl:col-span-2">
                <span className="font-medium">{label('channel')}</span>
                <select
                  value={channelId}
                  onChange={(event) => setChannelId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                >
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>{channel.title}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">{label('startDate')}</span>
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">{label('endDate')}</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={dateValue(1)}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                />
              </label>
              <div className="flex flex-col justify-end gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeRevenue}
                    disabled={!connection.hasMonetaryAccess}
                    onChange={(event) => setIncludeRevenue(event.target.checked)}
                    className="size-4"
                  />
                  {label('includeRevenue')}
                </label>
                <button
                  type="submit"
                  disabled={loadingReport || !channelId || !startDate || !endDate}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingReport ? label('loadingReport') : label('loadReport')}
                </button>
              </div>
            </form>
          )}

          {report && summary ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{report.channel.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(report.startDate)} — {formatDate(report.endDate)} · {label('dailyRows')}: {report.rowCount}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{label('observed')}: {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.observedAt))}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label={label('views')} value={summary.views} />
                <Metric label={label('watchHours')} value={summary.watchHours} suffix="jam" />
                <Metric label={label('likes')} value={summary.likes} />
                <Metric label={label('comments')} value={summary.comments} />
                <Metric label={label('averageDuration')} value={summary.avgDuration} />
                <Metric label={label('netSubscribers')} value={summary.netSubscribers} />
                {report.includesRevenue ? (
                  <>
                    <Metric label={label('estimatedRevenue')} value={summary.revenue} />
                    <Metric label={label('estimatedAdRevenue')} value={summary.adRevenue} />
                  </>
                ) : null}
              </div>

              {report.rows.length === 0 ? (
                <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">{label('noRows')}</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-muted/60 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">{label('date')}</th>
                        <th className="px-3 py-3">{label('views')}</th>
                        <th className="px-3 py-3">{label('watchMinutes')}</th>
                        <th className="px-3 py-3">{label('averageDuration')}</th>
                        <th className="px-3 py-3">{label('averagePercentage')}</th>
                        <th className="px-3 py-3">{label('likes')}</th>
                        <th className="px-3 py-3">{label('comments')}</th>
                        <th className="px-3 py-3">{label('shares')}</th>
                        <th className="px-3 py-3">{label('subscribersGained')}</th>
                        <th className="px-3 py-3">{label('subscribersLost')}</th>
                        {report.includesRevenue ? <th className="px-3 py-3">{label('estimatedRevenue')}</th> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[...report.rows].reverse().map((row) => (
                        <tr key={row.date}>
                          <td className="whitespace-nowrap px-3 py-3">{formatDate(row.date)}</td>
                          <td className="px-3 py-3 tabular-nums">{compact.format(BigInt(row.views))}</td>
                          <td className="px-3 py-3 tabular-nums">{number.format(row.estimatedMinutesWatched)}</td>
                          <td className="px-3 py-3 tabular-nums">{number.format(row.averageViewDuration)}s</td>
                          <td className="px-3 py-3 tabular-nums">{number.format(row.averageViewPercentage)}%</td>
                          <td className="px-3 py-3 tabular-nums">{compact.format(BigInt(row.likes))}</td>
                          <td className="px-3 py-3 tabular-nums">{compact.format(BigInt(row.comments))}</td>
                          <td className="px-3 py-3 tabular-nums">{compact.format(BigInt(row.shares))}</td>
                          <td className="px-3 py-3 tabular-nums">{number.format(row.subscribersGained)}</td>
                          <td className="px-3 py-3 tabular-nums">{number.format(row.subscribersLost)}</td>
                          {report.includesRevenue ? <td className="whitespace-nowrap px-3 py-3 tabular-nums">{currency.format(row.estimatedRevenue ?? 0)}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <h3 className="mb-2 text-sm font-semibold">{label('limitations')}</h3>
                <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
                  {report.limitations.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

function Metric({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}{suffix ? <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span> : null}</p>
    </div>
  )
}
