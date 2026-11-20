'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Globe,
  KeyRound,
  Loader2,
  Radio,
  Save,
  XCircle,
  Zap,
} from 'lucide-react'
import { useT } from "@/lib/i18n";
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

type ProviderItem = {
  key: string
  label: string
  baseUrl: string
  model: string
  enabled: boolean
  active: boolean
  status: string
  statusMessage: string | null
  lastCheckedAt: string | null
  note: string | null
  hasKey: boolean
  keyMask: string | null
}

type TestResult = { ok: boolean; latencyMs?: number; sample?: string; error?: string }

function statusDot(status: string, testing: boolean) {
  if (testing)
    return <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500 dark:bg-cyan-400" aria-hidden="true" />
  if (status === 'ok') return <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden="true" />
  if (status === 'error') return <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
  return <span className="h-2 w-2 rounded-full bg-muted-foreground/60" aria-hidden="true" />
}

export function AiProvidersDialog() {
  const { toast } = useToast()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [selected, setSelected] = useState<string>('zai-bawaan')
  const [form, setForm] = useState({ baseUrl: '', apiKey: '', model: '', enabled: false })
  const [apiKeyDirty, setApiKeyDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  const load = useCallback(
    async (keepSelection = true) => {
      setLoading(true)
      try {
        const res = await fetch('/api/ai-providers', { cache: 'no-store' })
        const data = await res.json()
        const list: ProviderItem[] = data.list ?? []
        setProviders(list)
        setSelected((prev) => {
          if (keepSelection && list.some((p) => p.key === prev)) return prev
          return list.find((p) => p.active)?.key ?? list[0]?.key ?? 'zai-bawaan'
        })
      } catch {
        toast({
          title: t('providers.loadFailed'),
          description: t('providers.loadFailedDesc'),
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    },
    [toast, t],
  )

  const current = providers.find((p) => p.key === selected)

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  useEffect(() => {
    if (current) {
      setForm({ baseUrl: current.baseUrl, apiKey: '', model: current.model, enabled: current.enabled })
      setApiKeyDirty(false)
      setTestResult(null)
    }
     
  }, [selected])

  const save = async (extra?: Record<string, unknown>) => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        key: selected,
        baseUrl: form.baseUrl,
        model: form.model,
        enabled: form.enabled,
        ...extra,
      }
      if (apiKeyDirty) payload.apiKey = form.apiKey
      const res = await fetch('/api/ai-providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: t('providers.saveFailed'), description: data.error ?? t('common.retry'), variant: 'destructive' })
        return
      }
      await load()
      toast({ title: t('providers.savedToast'), description: t('providers.savedToastDesc', { label: current?.label ?? 'Provider' }) })
    } finally {
      setSaving(false)
    }
  }

  const runTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/ai-providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: selected, baseUrl: form.baseUrl, model: form.model, ...(apiKeyDirty ? { apiKey: form.apiKey } : {}) }),
      })
      const data = await res.json()
      setTestResult(data)
      await load()
    } catch {
      setTestResult({ ok: false, error: t('providers.networkError') })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          aria-label={t('providers.settingsAria')}
        >
          <BrainCircuit className="h-3.5 w-3.5 text-fuchsia-500 dark:text-fuchsia-300" aria-hidden="true" />
          <span className="hidden sm:inline">{t('providers.trigger')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BrainCircuit className="h-5 w-5 text-fuchsia-500 dark:text-fuchsia-300" aria-hidden="true" />
            {t('providers.title')}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('providers.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[280px_1fr]">
          {/* Provider list */}
          <div className="aiviso-scroll max-h-[300px] space-y-2 overflow-y-auto pr-1 md:max-h-[460px]">
            {loading && (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t('providers.loading')}
              </div>
            )}
            {providers.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelected(p.key)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  p.key === selected
                    ? 'border-cyan-500/50 bg-cyan-500/10'
                    : 'border-border bg-muted/40 hover:bg-accent'
                }`}
                aria-label={`${t('providers.activate')}: ${p.label}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {statusDot(p.status, false)}
                    <span className="truncate text-sm font-medium">{p.label}</span>
                  </span>
                  {p.active && (
                    <Badge className="shrink-0 border-0 bg-brand-gradient text-[10px] text-slate-950">
                      {t('providers.active')}
                    </Badge>
                  )}
                </span>
                <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  {p.hasKey ? (
                    <>
                      <KeyRound className="h-3 w-3 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                      {p.keyMask}
                    </>
                  ) : (
                    <span className="truncate">{p.model || t('providers.notConfigured')}</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Editor */}
          <div className="aiviso-scroll min-h-0 max-h-[460px] space-y-4 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4">
            {current ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-cyan-600 dark:text-cyan-300" aria-hidden="true" />
                    <p className="font-semibold">{current.label}</p>
                    {current.status === 'ok' && (
                      <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-700 dark:border-emerald-400/40 dark:text-emerald-300">
                        {t('providers.okBadge')}
                      </Badge>
                    )}
                    {current.status === 'error' && (
                      <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
                        {t('providers.errorBadge')}
                      </Badge>
                    )}
                  </div>
                  {current.active ? (
                    <Badge className="border-0 bg-brand-gradient text-slate-950">
                      <Radio className="mr-1 h-3 w-3" aria-hidden="true" />
                      {t('providers.inUse')}
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => save({ active: true })}
                      disabled={saving}
                      className="h-8"
                    >
                      <Zap className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-300" aria-hidden="true" />
                      {t('providers.activate')}
                    </Button>
                  )}
                </div>

                {current.note && (
                  <p className="rounded-md border border-border bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                    {current.note}
                  </p>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="prov-url" className="text-xs text-muted-foreground">
                    {t('providers.baseUrl')}
                  </Label>
                  <div className="relative">
                    <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="prov-url"
                      value={form.baseUrl}
                      onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                      placeholder="https://api.example.com/v1"
                      className="pl-8 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prov-key" className="text-xs text-muted-foreground">
                    {t('providers.apiKey')}{' '}
                    {current.hasKey && !apiKeyDirty && (
                      <span className="text-emerald-600 dark:text-emerald-300">
                        {t('providers.storedKey', { mask: current.keyMask ?? '' })}
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="prov-key"
                      type="password"
                      value={form.apiKey}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, apiKey: e.target.value }))
                        setApiKeyDirty(true)
                      }}
                      placeholder={current.hasKey ? t('providers.apiKeyKeep') : 'sk-...'}
                      className="pl-8 font-mono text-xs"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prov-model" className="text-xs text-muted-foreground">
                    {t('providers.model')}
                  </Label>
                  <Input
                    id="prov-model"
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    placeholder={t('providers.modelPlaceholder')}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div>
                    <Label htmlFor="prov-enabled" className="text-sm">{t('providers.enableProvider')}</Label>
                    <p className="text-[11px] text-muted-foreground">{t('providers.enableProviderDesc')}</p>
                  </div>
                  <Switch
                    id="prov-enabled"
                    checked={form.enabled}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    onClick={() => save()}
                    disabled={saving}
                    size="sm"
                    className="bg-brand-gradient font-semibold text-slate-950 hover:opacity-90 hover:text-slate-950"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {t('providers.save')}
                  </Button>
                  <Button
                    onClick={runTest}
                    disabled={testing}
                    size="sm"
                    variant="outline"
                  >
                    {testing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Zap className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-300" aria-hidden="true" />
                    )}
                    {t('providers.test')}
                  </Button>
                </div>

                {testResult && (
                  <p
                    className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                      testResult.ok
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-destructive/30 bg-destructive/10 text-destructive'
                    }`}
                  >
                    {testResult.ok ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span className="break-all">
                      {testResult.ok
                        ? t('providers.connected', { ms: testResult.latencyMs ?? 0, sample: testResult.sample ?? '' })
                        : testResult.error}
                    </span>
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('providers.selectProvider')}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
