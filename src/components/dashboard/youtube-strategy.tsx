import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/lib/i18n'

type Channel = { id: string; title: string }
type Idea = {
  id: string
  title: string
  angle: string | null
  format: 'short' | 'long'
  status: string
  createdAt: string
  strategySnapshots?: Array<{ id: string; profileVersion: number; createdAt: string }>
  videoProjects?: Array<{ id: string; status: string; createdAt: string }>
}
type StrategyForm = {
  niche: string
  subNiche: string
  primaryMarket: string
  secondaryMarkets: string
  audiencePersona: string
  audienceProblems: string
  channelPositioning: string
  contentPillars: string
  languages: string
  weeklyShorts: string
  weeklyLongVideos: string
  shortStrategy: string
  longFormStrategy: string
  targetShortDurationSec: string
  targetLongDurationMin: string
  defaultHook: string
  outlineTemplate: string
  callToAction: string
  yppValidPublicWatchHours: string
  yppRequiredPublicWatchHours: string
  yppValidShortsViews: string
  yppRequiredShortsViews: string
}
const emptyForm: StrategyForm = {
  niche: '', subNiche: '', primaryMarket: 'ID', secondaryMarkets: 'MY, SG',
  audiencePersona: '', audienceProblems: '', channelPositioning: '', contentPillars: '',
  languages: 'id', weeklyShorts: '3', weeklyLongVideos: '1', shortStrategy: '',
  longFormStrategy: '', targetShortDurationSec: '45', targetLongDurationMin: '8',
  defaultHook: '', outlineTemplate: '', callToAction: '', yppValidPublicWatchHours: '',
  yppRequiredPublicWatchHours: '', yppValidShortsViews: '', yppRequiredShortsViews: '',
}
const list = (value: string) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
const optionalNumber = (value: string) => value.trim() === '' ? null : Number(value)
function percent(current: string, required: string): number | null {
  const a = Number(current)
  const b = Number(required)
  if (!current || !required || !Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null
  return Math.min(100, Math.max(0, a / b * 100))
}
function formFromProfile(value: Record<string, unknown> | null): StrategyForm {
  if (!value) return emptyForm
  const str = (key: keyof StrategyForm, fallback = '') => {
    const item = value[key]
    return item === null || item === undefined ? fallback : String(item)
  }
  const arr = (key: string) => Array.isArray(value[key]) ? (value[key] as string[]).join(', ') : ''
  return {
    niche: str('niche'), subNiche: str('subNiche'), primaryMarket: str('primaryMarket', 'ID'),
    secondaryMarkets: arr('secondaryMarkets'), audiencePersona: str('audiencePersona'),
    audienceProblems: arr('audienceProblems'), channelPositioning: str('channelPositioning'),
    contentPillars: arr('contentPillars'), languages: arr('languages'),
    weeklyShorts: str('weeklyShorts', '3'), weeklyLongVideos: str('weeklyLongVideos', '1'),
    shortStrategy: str('shortStrategy'), longFormStrategy: str('longFormStrategy'),
    targetShortDurationSec: str('targetShortDurationSec', '45'),
    targetLongDurationMin: str('targetLongDurationMin', '8'), defaultHook: str('defaultHook'),
    outlineTemplate: str('outlineTemplate'), callToAction: str('callToAction'),
    yppValidPublicWatchHours: str('yppValidPublicWatchHours'),
    yppRequiredPublicWatchHours: str('yppRequiredPublicWatchHours'),
    yppValidShortsViews: str('yppValidShortsViews'),
    yppRequiredShortsViews: str('yppRequiredShortsViews'),
  }
}

export function YoutubeStrategyDashboard() {
  const t = useT('dashboard')
  const label = (key: string) => t('youtubeStrategy.' + key)
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelId, setChannelId] = useState('')
  const [form, setForm] = useState<StrategyForm>(emptyForm)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [profileVersion, setProfileVersion] = useState(0)
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaAngle, setIdeaAngle] = useState('')
  const [ideaFormat, setIdeaFormat] = useState<'short' | 'long'>('long')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [producingIdeaId, setProducingIdeaId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/youtube/channels', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || label('loadFailed'))
        if (!active) return
        const list = (payload.channels ?? []) as Channel[]
        setChannels(list)
        setChannelId(list[0]?.id ?? '')
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : label('loadFailed')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!channelId) return
    let active = true
    setError('')
    fetch('/api/youtube/strategy?channelId=' + encodeURIComponent(channelId), { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || label('loadFailed'))
        if (!active) return
        setForm(formFromProfile(payload.profile ?? null))
        setProfileVersion(Number(payload.profile?.profileVersion ?? 0))
        setIdeas((payload.ideas ?? []) as Idea[])
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : label('loadFailed')) })
    return () => { active = false }
  }, [channelId])

  const watchProgress = useMemo(
    () => percent(form.yppValidPublicWatchHours, form.yppRequiredPublicWatchHours),
    [form.yppValidPublicWatchHours, form.yppRequiredPublicWatchHours],
  )
  const shortsProgress = useMemo(
    () => percent(form.yppValidShortsViews, form.yppRequiredShortsViews),
    [form.yppValidShortsViews, form.yppRequiredShortsViews],
  )
  const update = (key: keyof StrategyForm, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const inputClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm'
  const textareaClass = 'min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm'

  async function saveProfile() {
    if (!channelId) return
    setSaving(true); setError(''); setNotice('')
    try {
      const body = {
        channelId, niche: form.niche, subNiche: form.subNiche || null,
        primaryMarket: form.primaryMarket, secondaryMarkets: list(form.secondaryMarkets),
        audiencePersona: form.audiencePersona || null, audienceProblems: list(form.audienceProblems),
        channelPositioning: form.channelPositioning || null, contentPillars: list(form.contentPillars),
        languages: list(form.languages), weeklyShorts: Number(form.weeklyShorts),
        weeklyLongVideos: Number(form.weeklyLongVideos), shortStrategy: form.shortStrategy || null,
        longFormStrategy: form.longFormStrategy || null, targetShortDurationSec: Number(form.targetShortDurationSec),
        targetLongDurationMin: Number(form.targetLongDurationMin), defaultHook: form.defaultHook || null,
        outlineTemplate: form.outlineTemplate || null, callToAction: form.callToAction || null,
        yppValidPublicWatchHours: optionalNumber(form.yppValidPublicWatchHours),
        yppRequiredPublicWatchHours: optionalNumber(form.yppRequiredPublicWatchHours),
        yppValidShortsViews: optionalNumber(form.yppValidShortsViews),
        yppRequiredShortsViews: optionalNumber(form.yppRequiredShortsViews),
      }
      const response = await fetch('/api/youtube/strategy', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || label('saveFailed'))
      setProfileVersion(Number(payload.profile?.profileVersion ?? profileVersion + 1))
      setNotice(label('saved'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : label('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function createIdea() {
    if (!channelId || ideaTitle.trim().length < 3) return
    setCreating(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/youtube/strategy/snapshot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, title: ideaTitle, angle: ideaAngle || null, format: ideaFormat }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || label('ideaFailed'))
      setIdeas((current) => [payload.idea as Idea, ...current].slice(0, 12))
      setIdeaTitle(''); setIdeaAngle('')
      setNotice(label('snapshotCreated'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : label('ideaFailed'))
    } finally {
      setCreating(false)
    }
  }

  async function createVideoProject(idea: Idea) {
    if (producingIdeaId) return
    const activeProject = idea.videoProjects?.[0]
    if (activeProject && ['queued', 'planning', 'building', 'stitching'].includes(activeProject.status)) {
      setError(label('videoAlreadyRunning'))
      return
    }
    setProducingIdeaId(idea.id)
    setError('')
    setNotice('')
    try {
      const topic = [idea.title, idea.angle].filter(Boolean).join(' — ').slice(0, 300)
      if (topic.trim().length < 5) {
        setError(label('videoTopicTooShort'))
        return
      }
      const response = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          contentIdeaId: idea.id,
          format: idea.format,
          renderMode: 'cinematic',
          style: 'dokumenter',
          voice: 'tongtong',
          researchEnabled: idea.format === 'short',
          aspect: idea.format === 'short' ? '9:16' : '16:9',
          targetScenes: idea.format === 'long' ? 30 : undefined,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || label('videoFailed'))
      setIdeas((current) => current.map((item) => item.id === idea.id
        ? {
            ...item,
            status: 'producing',
            videoProjects: [{ id: payload.id as string, status: 'queued', createdAt: new Date().toISOString() }],
          }
        : item))
      setNotice(label('videoQueued'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : label('videoFailed'))
    } finally {
      setProducingIdeaId(null)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{label('loading')}</p>

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{label('title')}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{label('subtitle')}</p>
      </header>

      {error ? <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}
      {notice ? <div role="status" className="rounded-lg border border-border bg-muted/30 p-3 text-sm">{notice}</div> : null}

      {channels.length === 0 ? (
        <section className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{label('connectChannel')}</section>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-4">
            <label className="block max-w-lg space-y-2 text-sm">
              <span className="font-medium">{label('channel')}</span>
              <select className={inputClass} value={channelId} onChange={(event) => setChannelId(event.target.value)}>
                {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.title}</option>)}
              </select>
            </label>
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-semibold">{label('profileTitle')}</h2><p className="text-xs text-muted-foreground">{label('profileVersion')}: v{profileVersion || 0}</p></div>
              <button type="button" onClick={saveProfile} disabled={saving || !form.niche.trim()} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? label('saving') : label('save')}</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('niche')} *</span><input className={inputClass} value={form.niche} maxLength={120} onChange={(e) => update('niche', e.target.value)} placeholder={label('nichePlaceholder')} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('subNiche')}</span><input className={inputClass} value={form.subNiche} onChange={(e) => update('subNiche', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('primaryMarket')}</span><select className={inputClass} value={form.primaryMarket} onChange={(e) => update('primaryMarket', e.target.value)}>{['ID','MY','SG','PH','TH','VN','BN','KH','LA','MM'].map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('secondaryMarkets')}</span><input className={inputClass} value={form.secondaryMarkets} onChange={(e) => update('secondaryMarkets', e.target.value)} placeholder="MY, SG, PH" /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('languages')}</span><input className={inputClass} value={form.languages} onChange={(e) => update('languages', e.target.value)} placeholder="id, en" /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('audiencePersona')}</span><input className={inputClass} value={form.audiencePersona} onChange={(e) => update('audiencePersona', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">{label('channelPositioning')}</span><textarea className={textareaClass} value={form.channelPositioning} onChange={(e) => update('channelPositioning', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('audienceProblems')}</span><textarea className={textareaClass} value={form.audienceProblems} onChange={(e) => update('audienceProblems', e.target.value)} placeholder={label('listPlaceholder')} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('contentPillars')}</span><textarea className={textareaClass} value={form.contentPillars} onChange={(e) => update('contentPillars', e.target.value)} placeholder={label('listPlaceholder')} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('weeklyShorts')}</span><input type="number" min="0" max="21" className={inputClass} value={form.weeklyShorts} onChange={(e) => update('weeklyShorts', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('weeklyLongVideos')}</span><input type="number" min="0" max="14" className={inputClass} value={form.weeklyLongVideos} onChange={(e) => update('weeklyLongVideos', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('targetShortDurationSec')}</span><input type="number" min="10" max="180" className={inputClass} value={form.targetShortDurationSec} onChange={(e) => update('targetShortDurationSec', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('targetLongDurationMin')}</span><input type="number" min="1" max="240" className={inputClass} value={form.targetLongDurationMin} onChange={(e) => update('targetLongDurationMin', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">{label('shortStrategy')}</span><textarea className={textareaClass} value={form.shortStrategy} onChange={(e) => update('shortStrategy', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">{label('longFormStrategy')}</span><textarea className={textareaClass} value={form.longFormStrategy} onChange={(e) => update('longFormStrategy', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('defaultHook')}</span><textarea className={textareaClass} value={form.defaultHook} onChange={(e) => update('defaultHook', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('outlineTemplate')}</span><textarea className={textareaClass} value={form.outlineTemplate} onChange={(e) => update('outlineTemplate', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('callToAction')}</span><textarea className={textareaClass} value={form.callToAction} onChange={(e) => update('callToAction', e.target.value)} /></label>
            </div>
            <div className="flex flex-wrap justify-end"><button type="button" onClick={saveProfile} disabled={saving || !form.niche.trim()} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? label('saving') : label('save')}</button></div>
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div><h2 className="font-semibold">{label('yppTitle')}</h2><p className="text-xs text-muted-foreground">{label('yppDescription')}</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="text-sm font-medium">{label('watchHours')}</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs text-muted-foreground">{label('validNow')}<input type="number" min="0" className={inputClass} value={form.yppValidPublicWatchHours} onChange={(e) => update('yppValidPublicWatchHours', e.target.value)} /></label>
                  <label className="space-y-1 text-xs text-muted-foreground">{label('requiredTarget')}<input type="number" min="0" className={inputClass} value={form.yppRequiredPublicWatchHours} onChange={(e) => update('yppRequiredPublicWatchHours', e.target.value)} /></label>
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">{watchProgress === null ? label('manualThresholdMissing') : Math.round(watchProgress) + '% ' + label('progress')}</p>
              </div>
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="text-sm font-medium">{label('shortsViews')}</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs text-muted-foreground">{label('validNow')}<input type="number" min="0" className={inputClass} value={form.yppValidShortsViews} onChange={(e) => update('yppValidShortsViews', e.target.value)} /></label>
                  <label className="space-y-1 text-xs text-muted-foreground">{label('requiredTarget')}<input type="number" min="0" className={inputClass} value={form.yppRequiredShortsViews} onChange={(e) => update('yppRequiredShortsViews', e.target.value)} /></label>
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">{shortsProgress === null ? label('manualThresholdMissing') : Math.round(shortsProgress) + '% ' + label('progress')}</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{label('yppDisclaimer')}</p>
            <button type="button" onClick={saveProfile} disabled={saving || !form.niche.trim()} className="h-10 rounded-md border border-border px-4 text-sm font-semibold disabled:opacity-50">{saving ? label('saving') : label('saveYpp')}</button>
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div><h2 className="font-semibold">{label('ideaTitle')}</h2><p className="text-xs text-muted-foreground">{label('snapshotDescription')}</p></div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">{label('ideaName')}</span><input className={inputClass} value={ideaTitle} onChange={(e) => setIdeaTitle(e.target.value)} maxLength={160} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">{label('format')}</span><select className={inputClass} value={ideaFormat} onChange={(e) => setIdeaFormat(e.target.value as 'short'|'long')}><option value="short">{label('short')}</option><option value="long">{label('long')}</option></select></label>
              <label className="space-y-1.5 text-sm md:col-span-3"><span className="font-medium">{label('angle')}</span><textarea className={textareaClass} value={ideaAngle} onChange={(e) => setIdeaAngle(e.target.value)} maxLength={800} /></label>
            </div>
            <button type="button" onClick={createIdea} disabled={creating || profileVersion < 1 || ideaTitle.trim().length < 3} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{creating ? label('creating') : label('createSnapshot')}</button>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{label('recentIdeas')}</h3>
              {ideas.length === 0 ? <p className="text-sm text-muted-foreground">{label('emptyIdeas')}</p> : ideas.map((idea) => (
                <article key={idea.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0"><p className="font-medium">{idea.title}</p><p className="text-xs text-muted-foreground">{idea.format.toUpperCase()} · {idea.status}</p>{idea.angle ? <p className="mt-1 text-sm text-muted-foreground">{idea.angle}</p> : null}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs">{label('snapshotVersion')} v{idea.strategySnapshots?.[0]?.profileVersion ?? '—'}</span>
                    {idea.videoProjects?.[0] ? <span className="rounded-full border border-border px-2.5 py-1 text-xs">{label('productionStatus')}: {idea.videoProjects[0].status}</span> : null}
                    <button type="button" onClick={() => createVideoProject(idea)} disabled={producingIdeaId !== null || Boolean(idea.videoProjects?.[0] && ['queued', 'planning', 'building', 'stitching'].includes(idea.videoProjects[0].status))} className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">{producingIdeaId === idea.id ? label('creatingVideo') : label(idea.videoProjects?.[0]?.status === 'done' ? 'createAnotherVideo' : 'createVideo')}</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
