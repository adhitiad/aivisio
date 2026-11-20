'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clapperboard,
  Clock,
  Download,
  Film,
  Loader2,
  RotateCcw,
  Trash2,
  Wand2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useT } from "@/lib/i18n";

type SceneState = {
  idx: number
  narration: string
  overlay: string
  status: 'pending' | 'processing' | 'done' | 'error'
  agent: number | null
  asset: 'video' | 'image' | 'fallback' | null
  error?: string
}

type AgentSummary = {
  id: number
  done: number
  currentIdx: number | null
  state: 'working' | 'standby' | 'idle'
}

type ResearchHit = { title: string; url: string; snippet: string; engine: string }
type ResearchEngine = { engine: string; label: string; ok: boolean; count: number; error?: string; latencyMs: number }
type ResearchData = { engines?: ResearchEngine[]; hits?: ResearchHit[] } | null

type VideoProject = {
  id: string
  topic: string
  title: string | null
  description: string | null
  format: string
  renderMode: string
  aspect: string
  researchEnabled: boolean
  status: string
  stageDetail: string | null
  progress: number
  scenesTotal: number
  scenesDone: number
  durationSec: number
  fileBytes: number
  error: string | null
  scenes: SceneState[]
  research: ResearchData
  createdAt: string
  updatedAt: string
}

type HistoryItem = {
  id: string
  topic: string
  title: string | null
  format: string
  renderMode: string
  status: string
  progress: number
  scenesTotal: number
  scenesDone: number
  durationSec: number
  fileBytes: number
  createdAt: string
}

const STYLE_OPTIONS = [
  { id: 'neon-futuristik', label: 'Neon Futuristik' },
  { id: 'sinematik-realistis', label: 'Sinematik Realistis' },
  { id: 'ilustrasi-3d', label: 'Ilustrasi 3D' },
  { id: 'anime', label: 'Anime' },
  { id: 'dokumenter', label: 'Dokumenter' },
]

const LONG_DURATIONS = [
  { scenes: 18, key: 'videoStudio.longDur1' },
  { scenes: 30, key: 'videoStudio.longDur2' },
  { scenes: 45, key: 'videoStudio.longDur3' },
  { scenes: 64, key: 'videoStudio.longDur4' },
]

const ASPECT_LABEL_KEY: Record<string, string> = {
  '1:1': 'videoStudio.aspect11',
  '9:16': 'videoStudio.aspect916',
  '4:3': 'videoStudio.aspect43',
  '16:9': 'videoStudio.aspect169',
}

const STATUS_LABEL_KEY: Record<string, string> = {
  queued: 'videoStudio.statusQueued',
  planning: 'videoStudio.statusPlanning',
  building: 'videoStudio.statusBuilding',
  stitching: 'videoStudio.statusStitching',
  done: 'videoStudio.statusDone',
  error: 'videoStudio.statusError',
}

const AGENT_STATE_KEY: Record<AgentSummary['state'], string> = {
  working: 'videoStudio.agentStateWorking',
  standby: 'videoStudio.agentStateStandby',
  idle: 'videoStudio.agentStateIdle',
}

function fmtDuration(totalSec: number): string {
  if (!totalSec) return '-'
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtBytes(bytes: number): string {
  if (!bytes) return '-'
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ASPECT_THUMB_CLASS: Record<string, string> = {
  '1:1': 'aspect-square',
  '9:16': 'aspect-[9/16]',
  '4:3': 'aspect-[4/3]',
  '16:9': 'aspect-video',
}

function thumbAspect(aspect: string, format: string): string {
  return ASPECT_THUMB_CLASS[aspect] ?? (format === 'short' ? 'aspect-[9/16]' : 'aspect-video')
}

export function VideoStudio() {
  const { toast } = useToast()
  const t = useT()

  const [topic, setTopic] = useState('')
  const [format, setFormat] = useState<'short' | 'long'>('short')
  const [aspect, setAspect] = useState('9:16')
  const [researchOn, setResearchOn] = useState(true)
  const [targetScenes, setTargetScenes] = useState(30)
  const [style, setStyle] = useState('neon-futuristik')
  const [renderMode, setRenderMode] = useState<'cinematic' | 'fast'>('cinematic')
  const [voiceOn, setVoiceOn] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [project, setProject] = useState<VideoProject | null>(null)
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const statusRef = useRef<string>('')

  const isActive = (status: string) =>
    ['queued', 'planning', 'building', 'stitching'].includes(status)

  const fetchDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/video?id=${id}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (data.project) {
        setProject(data.project)
        setAgents(data.agents ?? [])
        if (data.project.status !== statusRef.current) {
          statusRef.current = data.project.status
          if (data.project.status === 'done') {
            toast({
              title: t('videoStudio.toastDone'),
              description: t('videoStudio.toastDoneDesc', { title: data.project.title ?? t('videoStudio.videoFallbackName') }),
            })
          } else if (data.project.status === 'error') {
            toast({
              title: t('videoStudio.toastError'),
              description: data.project.error ?? t('videoStudio.toastErrorDesc'),
              variant: 'destructive',
            })
          }
        }
      }
    } catch {
      // biarkan polling lanjut pada iterasi berikutnya
    }
  }, [toast, t])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/video', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setHistory(data.list ?? [])
    } catch {
      // abaikan
    }
  }, [])

  // Polling status project aktif
  useEffect(() => {
    if (!project) return
    if (!isActive(project.status)) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      fetchHistory()
      return
    }
    if (!pollRef.current) {
      pollRef.current = setInterval(() => fetchDetail(project.id), 2500)
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [project?.id, project?.status])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const submit = async () => {
    if (topic.trim().length < 5) {
      toast({ title: t('videoStudio.topicTooShort'), description: t('videoStudio.topicTooShortDesc'), variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          format,
          aspect,
          style,
          renderMode,
          voice: voiceOn ? 'on' : 'off',
          researchEnabled: format === 'short' ? researchOn : false,
          targetScenes: format === 'long' ? targetScenes : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: t('videoStudio.startFailed'), description: data.error ?? t('common.retry'), variant: 'destructive' })
        return
      }
      statusRef.current = 'queued'
      setProject({
        id: data.id,
        topic: topic.trim(),
        title: null,
        description: null,
        format,
        aspect,
        researchEnabled: format === 'short' ? researchOn : false,
        renderMode,
        status: 'queued',
        stageDetail: 'Antre...',
        progress: 0,
        scenesTotal: 0,
        scenesDone: 0,
        durationSec: 0,
        fileBytes: 0,
        error: null,
        scenes: [],
        research: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setAgents([])
      fetchHistory()
    } catch {
      toast({ title: t('videoStudio.networkError'), description: t('videoStudio.networkErrorDesc'), variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const openFromHistory = async (id: string) => {
    statusRef.current = ''
    await fetchDetail(id)
    document.getElementById('video-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const deleteHistory = async (id: string) => {
    const res = await fetch(`/api/video?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      if (project?.id === id) setProject(null)
      fetchHistory()
      toast({ title: t('videoStudio.deletedToast'), description: t('videoStudio.deletedToastDesc') })
    } else {
      const data = await res.json().catch(() => null)
      toast({ title: t('videoStudio.deleteFailed'), description: data?.error ?? t('common.retry'), variant: 'destructive' })
    }
  }

  const reset = () => {
    statusRef.current = ''
    setProject(null)
    setAgents([])
  }

  const active = project ? isActive(project.status) : false
  const doneScenes = project ? project.scenes.filter((s) => s.status === 'done') : []

  return (
    <section id="video" aria-label={t('videoStudio.sectionAria')} className="scroll-mt-20 space-y-6">
      <div className="space-y-2 text-center">
        <Badge className="border-0 bg-brand-gradient font-semibold text-slate-950">{t('videoStudio.badge')}</Badge>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t('videoStudio.titleA')} <span className="text-brand-gradient">{t('videoStudio.titleB')}</span>
        </h2>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t('videoStudio.subtitle')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr] items-start">
        {/* ===== Formulir ===== */}
        <Card className="border-border bg-card/70">
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="video-topic">{t('videoStudio.topicLabel')}</Label>
              <Textarea
                id="video-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t('videoStudio.topicPlaceholder')}
                rows={3}
                maxLength={300}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('videoStudio.formatLabel')}</Label>
              <Select
                value={format}
                onValueChange={(v) => {
                  const f = v as 'short' | 'long'
                  setFormat(f)
                  setAspect(f === 'short' ? '9:16' : '16:9')
                }}
              >
                <SelectTrigger aria-label={t('videoStudio.formatLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">{t('videoStudio.formatShort')}</SelectItem>
                  <SelectItem value="long">{t('videoStudio.formatLong')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('videoStudio.aspectLabel')}</Label>
              <Select value={aspect} onValueChange={setAspect}>
                <SelectTrigger aria-label={t('videoStudio.aspectLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(format === 'short'
                    ? ['9:16', '1:1']
                    : ['16:9', '4:3']
                  ).map((id) => (
                    <SelectItem key={id} value={id}>
                      {t(ASPECT_LABEL_KEY[id])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {format === 'short' && (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div className="space-y-0.5">
                  <Label htmlFor="video-research" className="text-sm">{t('videoStudio.researchTitle')}</Label>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {t('videoStudio.researchDesc')}
                  </p>
                </div>
                <Switch id="video-research" checked={researchOn} onCheckedChange={setResearchOn} />
              </div>
            )}

            {format === 'long' && (
              <div className="space-y-2">
                <Label>{t('videoStudio.targetDuration')}</Label>
                <Select
                  value={String(targetScenes)}
                  onValueChange={(v) => setTargetScenes(Number(v))}
                >
                  <SelectTrigger aria-label={t('videoStudio.targetDuration')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LONG_DURATIONS.map((d) => (
                      <SelectItem key={d.scenes} value={String(d.scenes)}>
                        {t(d.key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('videoStudio.styleLabel')}</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger aria-label={t('videoStudio.styleLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('videoStudio.renderModeLabel')}</Label>
              <Select value={renderMode} onValueChange={(v) => setRenderMode(v as 'cinematic' | 'fast')}>
                <SelectTrigger aria-label={t('videoStudio.renderModeLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cinematic">{t('videoStudio.renderCinematic')}</SelectItem>
                  <SelectItem value="fast">{t('videoStudio.renderFast')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {renderMode === 'cinematic'
                  ? t('videoStudio.renderHelpCinematic')
                  : t('videoStudio.renderHelpFast')}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="video-voice" className="text-sm">{t('videoStudio.voiceTitle')}</Label>
                <p className="text-[11px] text-muted-foreground">{t('videoStudio.voiceDesc')}</p>
              </div>
              <Switch id="video-voice" checked={voiceOn} onCheckedChange={setVoiceOn} />
            </div>

            <Button
              onClick={submit}
              disabled={submitting || active}
              className="h-11 w-full bg-brand-gradient font-semibold text-slate-950 hover:opacity-90 hover:text-slate-950"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('videoStudio.starting')}
                </>
              ) : (
                <>
                  <Clapperboard className="h-4 w-4" aria-hidden="true" />
                  {t('videoStudio.generate')}
                </>
              )}
            </Button>
            {active && (
              <p className="text-center text-[11px] text-muted-foreground">
                {t('videoStudio.runningNote')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ===== Panel pipeline ===== */}
        <div id="video-panel" className="space-y-4 scroll-mt-20">
          {!project && (
            <Card className="border-border bg-muted/30">
              <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-6 text-center">
                <Film className="h-10 w-10 text-cyan-600/70 dark:text-cyan-300/70" aria-hidden="true" />
                <p className="font-medium">{t('videoStudio.emptyTitle')}</p>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  {t('videoStudio.emptyDesc')}
                </p>
              </CardContent>
            </Card>
          )}

          {project && (
            <>
              <Card className="border-border bg-card/70">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {project.status === 'done' ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
                      ) : project.status === 'error' ? (
                        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                      ) : (
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-600 dark:text-cyan-300" aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {project.title ?? project.topic}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t(STATUS_LABEL_KEY[project.status] ?? 'videoStudio.statusQueued')}
                          {project.stageDetail ? ` - ${project.stageDetail}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {project.durationSec > 0 && (
                        <Badge variant="outline" className="border-border text-muted-foreground">
                          <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
                          {fmtDuration(project.durationSec)}
                        </Badge>
                      )}
                      {!active && project.status !== 'done' && (
                        <Button size="sm" variant="outline" onClick={reset} className="border-border">
                          <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                          {t('videoStudio.restart')}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-brand-gradient transition-all duration-700"
                      style={{ width: `${Math.max(2, project.progress)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {t('videoStudio.scenesDone', {
                        done: project.scenesDone,
                        total: project.scenesTotal || '?',
                      })}
                      {project.fileBytes ? ` - ${fmtBytes(project.fileBytes)}` : ''}
                    </span>
                    <span>{project.progress}%</span>
                  </div>

                  {project.error && (
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {project.error}
                    </p>
                  )}

                  {/* 5 agent */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {agents.map((a) => (
                      <div
                        key={a.id}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                          a.state === 'working'
                            ? 'border-cyan-500/40 bg-cyan-500/10'
                            : 'border-border bg-muted/40'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <Bot
                            className={`h-5 w-5 ${a.state === 'working' ? 'text-cyan-600 dark:text-cyan-300' : 'text-muted-foreground'}`}
                            aria-hidden="true"
                          />
                          {a.state === 'working' && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-cyan-500 dark:bg-cyan-300" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0 leading-tight">
                          <p className="text-xs font-semibold">Agent {a.id}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {a.state === 'working' ? `Scene ${a.currentIdx}` : t(AGENT_STATE_KEY[a.state])}
                            {a.done > 0 ? ` - ${a.done} ${t('videoStudio.agentDone')}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

              {/* Riset web (sumber nyata) */}
                  {project.research?.engines && project.research.engines.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {t('videoStudio.researchSummary', { count: project.research.hits?.length ?? 0 })}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {project.research.engines.map((e) => (
                          <Badge
                            key={e.engine}
                            variant="outline"
                            title={e.ok ? `${e.count} — ${e.latencyMs} ms` : e.error}
                            className={`text-[10px] ${
                              e.ok
                                ? 'border-emerald-500/40 text-emerald-700 dark:border-emerald-400/40 dark:text-emerald-300'
                                : 'border-border text-muted-foreground line-through opacity-60'
                            }`}
                          >
                            {e.label} {e.ok ? `- ${e.count}` : `- ${t('videoStudio.researchFailed')}`}
                          </Badge>
                        ))}
                      </div>
                      {project.research.hits && project.research.hits.length > 0 && (
                        <ul className="space-y-1 max-h-36 overflow-y-auto aiviso-scroll">
                          {project.research.hits.slice(0, 8).map((h, i) => (
                            <li key={`${h.engine}-${i}`} className="text-[11px] leading-snug">
                              <a
                                href={h.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-700 underline-offset-2 hover:text-cyan-600 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200"
                              >
                                {h.title}
                              </a>
                              <span className="text-muted-foreground"> - {h.engine}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Strip scene */}
                  {project.scenes.length > 0 && (
                    <div className="aiviso-scroll overflow-x-auto pb-1">
                      <div className="flex gap-2">
                        {project.scenes.map((s) => (
                          <div
                            key={s.idx}
                            title={s.narration}
                            className={`relative w-[86px] shrink-0 overflow-hidden rounded-md border ${thumbAspect(project.aspect, project.format)} ${
                              s.status === 'done'
                                ? 'border-emerald-500/40 dark:border-emerald-400/40'
                                : s.status === 'error'
                                  ? 'border-destructive/40'
                                  : s.status === 'processing'
                                    ? 'animate-pulse border-cyan-500/50 dark:border-cyan-400/50'
                                    : 'border-border'
                            }`}
                          >
                            {s.status === 'done' ? (
                              <img
                                src={`/api/video/file?id=${project.id}&scene=${s.idx}`}
                                alt={`Scene ${s.idx}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/50">
                                {s.status === 'processing' ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-cyan-600 dark:text-cyan-300" aria-hidden="true" />
                                ) : s.status === 'error' ? (
                                  <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">Scene</span>
                                )}
                                <span className="text-[11px] font-semibold">{s.idx}</span>
                              </div>
                            )}
                            {s.status === 'done' && (
                              <span className="absolute top-1 left-1 text-[10px] bg-black/60 rounded px-1">
                                {s.idx}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Hasil final */}
              {project.status === 'done' && (
                <Card className="border-border bg-card/70">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-lg leading-snug">{project.title}</p>
                        {project.description && (
                          <p className="text-sm text-muted-foreground">{project.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/video/file?id=${project.id}&download=1`}
                          download
                          className="inline-flex items-center gap-1.5 rounded-md bg-brand-gradient px-4 h-9 text-sm font-semibold text-slate-950 hover:opacity-90"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          {t('videoStudio.downloadMp4')}
                        </a>
                        <Button size="sm" variant="outline" onClick={reset} className="border-border">
                          <Wand2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                          {t('videoStudio.makeAnother')}
                        </Button>
                      </div>
                    </div>
                    <video
                      key={project.id}
                      controls
                      className="w-full rounded-xl border border-border bg-black"
                      src={`/api/video/file?id=${project.id}`}
                    >
                      {t('videoStudio.videoFallbackName')}
                    </video>
                    <p className="text-[11px] text-muted-foreground">
                      {t('videoStudio.sceneStats', {
                        videoClips: project.scenes.filter((s) => s.asset === 'video').length,
                        imageClips: project.scenes.filter((s) => s.asset === 'image').length,
                        fallback: project.scenes.some((s) => s.asset === 'fallback')
                          ? t('videoStudio.sceneStatsFallback', {
                              count: project.scenes.filter((s) => s.asset === 'fallback').length,
                            })
                          : '',
                        duration: fmtDuration(project.durationSec),
                        size: fmtBytes(project.fileBytes),
                      })}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Riwayat video */}
          {history.length > 0 && (
            <Card className="border-border bg-muted/30">
              <CardContent className="space-y-3 p-5">
                <p className="text-sm font-semibold">{t('videoStudio.historyTitle')}</p>
                <div className="aiviso-scroll max-h-72 space-y-2 overflow-y-auto">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      <button
                        onClick={() => openFromHistory(h.id)}
                        className="group min-w-0 flex-1 text-left"
                        aria-label={`${t('common.view')} ${h.title ?? h.topic}`}
                      >
                        <p className="truncate text-sm transition-colors group-hover:text-primary">
                          {h.title ?? h.topic}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {h.format === 'short' ? t('videoStudio.formatShort9') : t('videoStudio.formatLong169')} -{' '}
                          {h.renderMode === 'cinematic'
                            ? t('videoStudio.renderCinematicShort')
                            : t('videoStudio.renderFastShort')}{' '}
                          - {t(STATUS_LABEL_KEY[h.status] ?? 'videoStudio.statusQueued')}
                          {h.durationSec ? ` - ${fmtDuration(h.durationSec)}` : ''}
                        </p>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteHistory(h.id)}
                        aria-label={`${t('common.delete')} ${h.title ?? h.topic}`}
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  )
}
