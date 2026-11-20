"use client";

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  Clock,
  Download,
  History,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  PenLine,
  Wand2,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useLocale, useT } from "@/lib/i18n";
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { MarkdownView } from '@/components/aiviso/markdown-view'
import { TOOLS, getToolById, type Tool } from '@/lib/tools'

const TOOL_ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  target: Target,
  pen: PenLine,
  trending: TrendingUp,
  zap: Zap,
}

interface ResultState {
  id?: string
  toolId: string
  title: string
  output: string
}

interface HistoryItem {
  id: string
  toolId: string
  title: string
  inputs: string
  createdAt: string
}

export function Studio({
  activeToolId,
  setActiveToolId,
}: {
  activeToolId: string | null
  setActiveToolId: (id: string | null) => void
}) {
  const t = useT()
  const locale = useLocale()
  const { toast } = useToast()
  const [values, setValues] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(false)
  const [statusIdx, setStatusIdx] = useState(0)
  const [result, setResult] = useState<ResultState | null>(null)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [viewing, setViewing] = useState<HistoryItem | null>(null)
  const [viewingOutput, setViewingOutput] = useState<string | null>(null)
  const [viewingLoading, setViewingLoading] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  const loadingSteps = t.raw('studio.loadingSteps') as string[]
  const activeTool: Tool | null = activeToolId ? (getToolById(activeToolId) ?? null) : null

  const formatTime = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history')
      if (!res.ok) return
      const data = await res.json()
      setHistory(Array.isArray(data.items) ? data.items : [])
    } catch {
      /* riwayat bersifat opsional, abaikan kegagalan */
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (!loading) return
    setStatusIdx(0)
    const timer = setInterval(() => {
      setStatusIdx((i) => (i + 1) % loadingSteps.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [loading, loadingSteps.length])

  const setFieldValue = (toolId: string, fieldId: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      [toolId]: { ...(prev[toolId] ?? {}), [fieldId]: value },
    }))
  }

  const generate = async () => {
    if (!activeTool || loading) return
    const inputs: Record<string, string> = values[activeTool.id] ?? {}

    const missing = activeTool.fields.filter(
      (f) => f.required && !(inputs[f.id] ?? '').trim(),
    )
    if (missing.length > 0) {
      toast({
        title: t('studio.fillFirst'),
        description: `${t('studio.fillFirstDesc')} ${missing.map((f) => f.label).join(', ')}`,
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: activeTool.id, inputs }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? t('studio.generateFailed'))
      }
      setResult({ id: data.id, toolId: data.toolId, title: data.title, output: data.output })
      toast({
        title: t('studio.doneTitle'),
        description: t('studio.doneDesc'),
      })
      loadHistory()
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 150)
    } catch (err) {
      toast({
        title: t('studio.generateFailed'),
        description: err instanceof Error ? err.message : t('common.error'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const copyOutput = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: t('common.copied'), description: t('studio.copiedDesc') })
    } catch {
      toast({
        title: t('studio.copyFailed'),
        description: t('studio.copyFailedDesc'),
        variant: 'destructive',
      })
    }
  }

  const downloadOutput = () => {
    if (!result) return
    const blob = new Blob([result.output], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aiviso-${result.toolId}-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const openHistoryItem = async (item: HistoryItem) => {
    setViewing(item)
    setViewingOutput(null)
    setViewingLoading(true)
    try {
      const res = await fetch(`/api/history?id=${encodeURIComponent(item.id)}`)
      const data = await res.json()
      setViewingOutput(res.ok ? (data.output ?? '') : '')
    } catch {
      setViewingOutput('')
    } finally {
      setViewingLoading(false)
    }
  }

  const deleteHistoryItem = async (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id))
    try {
      await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch {
      loadHistory()
    }
  }

  const showResult = result && activeTool && result.toolId === activeTool.id ? result : null

  return (
    <>
      <section id="studio" className="scroll-mt-24 space-y-8">
        <div className="space-y-3 text-center">
          <Badge
            variant="outline"
            className="border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/30 dark:text-cyan-300"
          >
            AI STUDIO
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t('studio.titleA')}{' '}
            <span className="text-brand-gradient">{t('studio.titleB')}</span>
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">{t('studio.subtitle')}</p>
        </div>

        {!activeTool ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => {
              const Icon = TOOL_ICONS[tool.icon] ?? Sparkles
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveToolId(tool.id)}
                  className="group rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="h-full border-border bg-card/70 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-cyan-500/40 group-hover:shadow-[0_0_50px_-12px_rgba(34,211,238,0.35)]">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${tool.accent} text-slate-950 shadow-lg`}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span
                          aria-hidden="true"
                          className="text-4xl font-bold text-foreground/50 transition-colors group-hover:text-cyan-600/70 dark:group-hover:text-cyan-400/45"
                        >
                          0{tool.step}
                        </span>
                      </div>
                      <CardTitle className="pt-2 text-lg leading-snug">{tool.title}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        {tool.tagline}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-700 transition-all group-hover:gap-2.5 dark:text-cyan-300">
                        {t('studio.openTool')}
                        <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
                      </span>
                    </CardContent>
                  </Card>
                </button>
              )
            })}
            <Card className="flex flex-col items-center justify-center gap-3 border-dashed border-border bg-transparent p-6 text-center">
              <Sparkles className="h-8 w-8 text-fuchsia-500 dark:text-fuchsia-400" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {t('studio.savedNoteA')}{' '}
                <a href="#riwayat" className="text-cyan-700 underline underline-offset-4 dark:text-cyan-300">
                  {t('studio.historyTitle')}
                </a>{' '}
                {t('studio.savedNoteB')}
              </p>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveToolId(null)}
                className="text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t('studio.allTools')}
              </Button>
              <Badge variant="outline" className="border-border text-muted-foreground">
                {t('studio.stepLabel', { step: activeTool.step })}
              </Badge>
              <h3 className="text-xl font-semibold">{activeTool.title}</h3>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[400px_1fr]">
              {/* Formulir */}
              <Card className="border-border bg-card/70">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wand2 className="h-4 w-4 text-cyan-600 dark:text-cyan-300" aria-hidden="true" />
                    {t('studio.formTitle')}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t('studio.formDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeTool.fields.map((field) => {
                    const value = values[activeTool.id]?.[field.id] ?? ''
                    const id = `${activeTool.id}-${field.id}`
                    return (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={id} className="text-sm">
                          {field.label}
                          {field.required && <span className="text-fuchsia-500 dark:text-fuchsia-400"> *</span>}
                        </Label>
                        {field.type === 'textarea' ? (
                          <Textarea
                            id={id}
                            value={value}
                            onChange={(e) => setFieldValue(activeTool.id, field.id, e.target.value)}
                            placeholder={field.placeholder}
                            rows={3}
                            className="resize-none"
                          />
                        ) : field.type === 'select' ? (
                          <Select
                            value={value || undefined}
                            onValueChange={(v) => setFieldValue(activeTool.id, field.id, v)}
                          >
                            <SelectTrigger id={id} className="w-full">
                              <SelectValue placeholder={t('studio.selectPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              {(field.options ?? []).map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={id}
                            value={value}
                            onChange={(e) => setFieldValue(activeTool.id, field.id, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        )}
                      </div>
                    )
                  })}
                  <Button
                    onClick={generate}
                    disabled={loading}
                    className="w-full bg-brand-gradient text-slate-950 font-semibold shadow-[0_0_30px_-8px_rgba(168,85,247,0.6)] hover:opacity-90 hover:text-slate-950"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        {t('studio.working')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        {t('studio.generate')}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Output */}
              <Card className="min-h-[420px] border-border bg-card/70">
                <CardHeader className="border-b border-border pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {showResult ? showResult.title : activeTool.resultLabel}
                    </CardTitle>
                    {showResult && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={copyOutput} aria-label={t('studio.copyResult')}>
                          {copied ? (
                            <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
                          ) : (
                            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span className="sr-only">{t('studio.copyResult')}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={downloadOutput}
                          aria-label={t('studio.downloadResult')}
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">{t('studio.downloadResult')}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={generate}
                          disabled={loading}
                          aria-label={t('studio.regenerate')}
                        >
                          <RefreshCw className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">{t('studio.regenerate')}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                      <div className="relative">
                        <span className="absolute inset-0 animate-pulse rounded-full bg-fuchsia-500/20 blur-xl" />
                        <Loader2 className="relative h-10 w-10 animate-spin text-cyan-600 dark:text-cyan-300" aria-hidden="true" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-cyan-700 dark:text-cyan-200">{t('studio.aiWorking')}</p>
                        <p className="min-h-[1.25rem] text-sm text-muted-foreground">
                          {loadingSteps[statusIdx]}
                        </p>
                      </div>
                    </div>
                  ) : showResult ? (
                    <div
                      ref={outputRef}
                      className="aiviso-scroll max-h-[65vh] overflow-y-auto pr-2"
                    >
                      <MarkdownView content={showResult.output} />
                    </div>
                  ) : (
                    <div className="mx-3 my-3 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
                      <Sparkles className="h-8 w-8 text-foreground/20" aria-hidden="true" />
                      <p className="max-w-xs text-sm text-muted-foreground">
                        {t('studio.emptyOutputA')}{' '}
                        <span className="font-medium text-foreground">{t('studio.generate')}</span>
                        {t('studio.emptyOutputB')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </section>

      {/* Riwayat */}
      <section id="riwayat" className="scroll-mt-24 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <History className="h-5 w-5 text-violet-600 dark:text-violet-300" aria-hidden="true" />
          <h2 className="text-2xl font-bold tracking-tight">{t('studio.historyTitle')}</h2>
          <Badge variant="outline" className="border-border text-muted-foreground">
            {t('studio.historyCount', { count: history.length })}
          </Badge>
        </div>
        {history.length === 0 ? (
          <Card className="border-dashed border-border bg-transparent">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t('studio.historyEmpty')}
            </CardContent>
          </Card>
        ) : (
          <div className="aiviso-scroll max-h-96 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {history.map((item) => {
              const tool = getToolById(item.toolId)
              const Icon = TOOL_ICONS[tool?.icon ?? ''] ?? Sparkles
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-card/40 px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${tool?.accent ?? 'from-cyan-400 to-fuchsia-500'} text-slate-950`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{tool?.name ?? item.toolId}</span>
                      <span aria-hidden="true">•</span>
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      <span>{formatTime(item.createdAt)}</span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openHistoryItem(item)}
                    className="shrink-0"
                  >
                    {t('common.view')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteHistoryItem(item.id)}
                    aria-label={`${t('common.delete')} ${item.title}`}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Dialog detail riwayat */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-lg leading-snug">{viewing?.title}</DialogTitle>
            <DialogDescription>
              {getToolById(viewing?.toolId ?? '')?.name ?? t('studio.resultAI')} •{' '}
              {viewing ? formatTime(viewing.createdAt) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="aiviso-scroll -mx-1 overflow-y-auto px-1 pb-1">
            {viewingLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                {t('studio.viewLoading')}
              </div>
            ) : (
              <MarkdownView content={viewingOutput ?? ''} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
