import { useEffect, useState, type FormEvent } from 'react'
import { useT } from '@/lib/i18n'

type Channel = { id: string; title: string }
type VideoRow = {
  videoId: string; views: string; estimatedMinutesWatched: number; averageViewDuration: number
  averageViewPercentage: number; estimatedRevenue: number | null; estimatedAdRevenue: number | null
}
type CountryRow = { countryCode: string; views: string; estimatedMinutesWatched: number; estimatedRevenue: number | null; estimatedAdRevenue: number | null; rpm: number | null }
type Report = {
  channel: Channel; startDate: string; endDate: string; observedAt: string
  revenueStatus: 'actual'|'not_available'|'scope_missing'
  actual: { views: string; estimatedRevenue: number|null; estimatedAdRevenue: number|null; rpm: number|null; adRpm: number|null; daysWithRevenue: number; watchHours: number; averageViewPercentage: number|null; dailyRows: number; currencyCode: string }
  daily: Array<{ date: string; views: string; estimatedRevenue: number|null; estimatedAdRevenue: number|null; estimatedMinutesWatched: number; averageViewPercentage: number }>
  topVideos: VideoRow[]; countries: CountryRow[]; recommendations: string[]; limitations: string[]
}
type Forecast = {
  id: string; targetRevenue: number; rpm: number; baselineDailyViews: number; projectionDays: number
  projectedViews: number; projectedRevenue: number; lowerForecast: number; upperForecast: number
  requiredViews: number; requiredDailyViews: number; rpmSource: string; createdAt: string
}
const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 })
const numeric = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })
function dateValue(ago: number) {
  const date = new Date()
  date.setDate(date.getDate() - ago)
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-')
}
function amount(value: number | null | undefined) { return value === null || value === undefined ? '—' : money.format(value) }
function count(value: string | number) { return compact.format(Number(value)) }

export function YoutubeRevenueDashboard() {
  const t = useT('dashboard')
  const label = (key: string) => t('youtubeRevenue.' + key)
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelId, setChannelId] = useState('')
  const [startDate, setStartDate] = useState(() => dateValue(30))
  const [endDate, setEndDate] = useState(() => dateValue(2))
  const [report, setReport] = useState<Report | null>(null)
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [targetRevenue, setTargetRevenue] = useState('2000000')
  const [projectionDays, setProjectionDays] = useState('30')
  const [assumedRPM, setAssumedRPM] = useState('')
  const [baselineDailyViews, setBaselineDailyViews] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [forecasting, setForecasting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/youtube/channels', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || label('loadFailed'))
        if (!active) return
        const items = (payload.channels ?? []) as Channel[]
        setChannels(items)
        setChannelId(items[0]?.id ?? '')
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : label('loadFailed')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function sync(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!channelId) return
    setSyncing(true); setError(''); setReport(null)
    try {
      const response = await fetch('/api/youtube/revenue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', channelId, startDate, endDate }),
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || label('syncFailed'))
      setReport(payload as Report)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : label('syncFailed'))
    } finally {
      setSyncing(false)
    }
  }

  async function createForecast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!channelId) return
    setForecasting(true); setError(''); setForecast(null)
    try {
      const response = await fetch('/api/youtube/revenue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'forecast', channelId, targetRevenue: Number(targetRevenue),
          projectionDays: Number(projectionDays),
          assumedRPM: assumedRPM.trim() ? Number(assumedRPM) : null,
          baselineDailyViews: baselineDailyViews.trim() ? Number(baselineDailyViews) : null,
        }),
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || label('forecastFailed'))
      setForecast(payload.forecast as Forecast)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : label('forecastFailed'))
    } finally {
      setForecasting(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{label('loading')}</p>
  const fieldClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm'
  const revenueStatusText = report?.revenueStatus === 'actual'
    ? label('actualAvailable')
    : report?.revenueStatus === 'scope_missing' ? label('scopeMissing') : label('monetizationUnavailable')

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{label('title')}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{label('subtitle')}</p>
      </header>
      {error ? <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}

      {channels.length === 0 ? (
        <section className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{label('connectChannel')}</section>
      ) : (
        <>
          <form onSubmit={sync} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
            <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">{label('channel')}</span><select className={fieldClass} value={channelId} onChange={(e) => setChannelId(e.target.value)}>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.title}</option>)}</select></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">{label('startDate')}</span><input className={fieldClass} type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} required /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">{label('endDate')}</span><input className={fieldClass} type="date" value={endDate} max={dateValue(1)} min={startDate} onChange={(e) => setEndDate(e.target.value)} required /></label>
            <div className="md:col-span-4"><button type="submit" disabled={syncing || !channelId || startDate > endDate} className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{syncing ? label('syncing') : label('sync')}</button></div>
          </form>

          {report ? (
            <>
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{label('actualSection')}</h2><p className="text-xs text-muted-foreground">{report.channel.title} · {report.startDate} — {report.endDate}</p></div><span className="rounded-full border border-border px-3 py-1 text-xs">{revenueStatusText}</span></div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label('views')}</p><p className="mt-2 text-xl font-semibold tabular-nums">{count(report.actual.views)}</p></article>
                  <article className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label('watchHours')}</p><p className="mt-2 text-xl font-semibold tabular-nums">{numeric.format(report.actual.watchHours)}</p></article>
                  <article className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label('actualRevenue')}</p><p className="mt-2 text-xl font-semibold tabular-nums">{amount(report.actual.estimatedRevenue)}</p></article>
                  <article className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label('actualRpm')}</p><p className="mt-2 text-xl font-semibold tabular-nums">{amount(report.actual.rpm)}</p></article>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{label('actualHint')}</p>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                  <div><h2 className="font-semibold">{label('topVideos')}</h2><p className="text-xs text-muted-foreground">{label('topVideosHint')}</p></div>
                  {report.topVideos.length === 0 ? <p className="text-sm text-muted-foreground">{label('emptyBreakdown')}</p> : (
                    <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="py-2">{label('video')}</th><th className="py-2">{label('views')}</th><th className="py-2">{label('avgViewed')}</th><th className="py-2">{label('revenue')}</th></tr></thead><tbody className="divide-y divide-border">{report.topVideos.slice(0,12).map((video) => <tr key={video.videoId}><td className="py-2 pr-3 font-medium">{video.videoId}</td><td className="py-2 tabular-nums">{count(video.views)}</td><td className="py-2 tabular-nums">{numeric.format(video.averageViewPercentage)}%</td><td className="py-2 tabular-nums">{amount(video.estimatedRevenue)}</td></tr>)}</tbody></table></div>
                  )}
                </div>
                <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                  <div><h2 className="font-semibold">{label('countryPerformance')}</h2><p className="text-xs text-muted-foreground">{label('countryHint')}</p></div>
                  {report.countries.length === 0 ? <p className="text-sm text-muted-foreground">{label('emptyBreakdown')}</p> : (
                    <div className="overflow-x-auto"><table className="w-full min-w-[360px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="py-2">{label('country')}</th><th className="py-2">{label('views')}</th><th className="py-2">{label('rpm')}</th></tr></thead><tbody className="divide-y divide-border">{report.countries.slice(0,12).map((row) => <tr key={row.countryCode}><td className="py-2 font-medium">{row.countryCode}</td><td className="py-2 tabular-nums">{count(row.views)}</td><td className="py-2 tabular-nums">{amount(row.rpm)}</td></tr>)}</tbody></table></div>
                  )}
                </div>
              </section>

              <section className="space-y-3 rounded-xl border border-border bg-card p-4">
                <h2 className="font-semibold">{label('recommendations')}</h2>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">{report.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul>
              </section>
              <details className="rounded-xl border border-border bg-card p-4">
                <summary className="cursor-pointer text-sm font-semibold">{label('limitations')}</summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">{report.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul>
              </details>
            </>
          ) : null}

          <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div><h2 className="font-semibold">{label('forecastTitle')}</h2><p className="text-xs text-muted-foreground">{label('forecastSubtitle')}</p></div>
            <form onSubmit={createForecast} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('targetRevenue')}</span><input className={fieldClass} type="number" min="1" value={targetRevenue} onChange={(e) => setTargetRevenue(e.target.value)} required /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('projectionDays')}</span><select className={fieldClass} value={projectionDays} onChange={(e) => setProjectionDays(e.target.value)}><option value="30">30</option><option value="60">60</option><option value="90">90</option><option value="180">180</option><option value="365">365</option></select></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('assumedRPM')}</span><input className={fieldClass} type="number" min="1" value={assumedRPM} onChange={(e) => setAssumedRPM(e.target.value)} placeholder={label('useActualRpm')} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('baselineDailyViews')}</span><input className={fieldClass} type="number" min="1" value={baselineDailyViews} onChange={(e) => setBaselineDailyViews(e.target.value)} placeholder={label('useActualViews')} /></label>
              <div className="md:col-span-2 xl:col-span-4"><button type="submit" disabled={forecasting || !channelId} className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{forecasting ? label('forecasting') : label('createForecast')}</button></div>
            </form>
            {forecast ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{label('forecastResult')}</h3><span className="rounded-full border border-border px-2.5 py-1 text-xs">{forecast.rpmSource === 'actual-channel-rpm' ? label('actualBaseline') : label('manualBaseline')}</span></div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">{label('projectedRevenue')}</p><p className="mt-1 text-lg font-semibold">{amount(forecast.projectedRevenue)}</p></div>
                  <div><p className="text-xs text-muted-foreground">{label('scenarioRange')}</p><p className="mt-1 text-lg font-semibold">{amount(forecast.lowerForecast)} – {amount(forecast.upperForecast)}</p></div>
                  <div><p className="text-xs text-muted-foreground">{label('requiredViews')}</p><p className="mt-1 text-lg font-semibold">{count(forecast.requiredViews)}</p></div>
                  <div><p className="text-xs text-muted-foreground">{label('requiredDailyViews')}</p><p className="mt-1 text-lg font-semibold">{count(forecast.requiredDailyViews)}</p></div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{label('forecastNotice')}</p>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  )
}
