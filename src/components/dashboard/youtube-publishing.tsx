"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { RefreshCw, UploadCloud, Clapperboard, CheckCircle2, Clock3, AlertCircle, RotateCcw, XCircle, ExternalLink, Activity, Server, BellRing, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"

type Channel = { id: string; title: string; thumbnailUrl: string | null }
type Project = { id: string; topic: string; title: string | null; fileBytes: number; createdAt: string }
type Publication = {
  id: string; channelId: string; videoProjectId: string; status: string; title: string;
  privacyStatus: string; scheduledAt: string | null; approvedAt: string | null;
  youtubeVideoId: string | null; publishedAt: string | null; uploadOffset: string;
  uploadAttempts: number; maxUploadAttempts: number; nextAttemptAt: string;
  lastError: string | null; createdAt: string;
  channel: { title: string }; videoProject: { topic: string; fileBytes: number };
}
type Payload = { items: Publication[]; channels: Channel[]; projects: Project[] }
type Operations = {
  observedAt: string
  status: "ok" | "running" | "degraded" | "unknown"
  queue: Record<string, number>
  worker: { staleUploads: number; overdueJobs: number; heartbeatAgeSeconds: number | null; lastRun: { runId: string; status: string; startedAt: string; completedAt?: string; durationMs?: number; eligible?: number; attempted?: number } | null }
  alerts: Array<{ id: string; severity: "critical" | "warning"; title: string; detail: string; firstSeenAt: string; lastSeenAt: string; notificationId: string | null }>
  executionHistory: Array<{ runId: string; status: string; startedAt: string; completedAt: string | null; durationMs: number | null; eligible: number | null; attempted: number | null; error: string | null }>
  recentActivity: Array<{ id: string; title: string; channel: string; status: string; attempts: number; maxAttempts: number; lastError: string | null; updatedAt: string; nextAttemptAt: string }>
}

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_approval: { label: "Menunggu persetujuan", variant: "outline" },
  scheduled: { label: "Dalam antrean", variant: "secondary" },
  uploading: { label: "Mengunggah", variant: "default" },
  published: { label: "Terunggah", variant: "default" },
  failed: { label: "Gagal", variant: "destructive" },
  cancelled: { label: "Dibatalkan", variant: "outline" },
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—"
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes, unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++ }
  return value.toFixed(unit === 0 ? 0 : 1) + " " + units[unit]
}
function formatDate(value: string | null) {
  if (!value) return "Belum dijadwalkan"
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
}
function percent(item: Publication) {
  const total = item.videoProject.fileBytes
  if (item.status === "published") return 100
  if (!total) return 0
  return Math.max(0, Math.min(99, Math.floor((Number(item.uploadOffset) / total) * 100)))
}

export function YoutubePublishingDashboard() {
  const { toast } = useToast()
  const [data, setData] = useState<Payload>({ items: [], channels: [], projects: [] })
  const [loading, setLoading] = useState(true)
  const [operations, setOperations] = useState<Operations | null>(null)
  const [operationsError, setOperationsError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [preflightBusy, setPreflightBusy] = useState(false)
  const [preflightResult, setPreflightResult] = useState<{ ready: boolean; message: string } | null>(null)
  const [channelId, setChannelId] = useState("")
  const [videoProjectId, setVideoProjectId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [privacyStatus, setPrivacyStatus] = useState("private")
  const [scheduledAt, setScheduledAt] = useState("")

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await fetch("/api/youtube/publish", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Gagal memuat publikasi.")
      setData(payload as Payload)
      const opsResponse = await fetch("/api/youtube/publish/operations", { cache: "no-store" })
      const opsPayload = await opsResponse.json()
      if (!opsResponse.ok) throw new Error(opsPayload.error || "Gagal memuat operational dashboard.")
      setOperations(opsPayload as Operations)
      setOperationsError(null)
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Data operasional tidak tersedia.")
      if (!silent) toast({ title: error instanceof Error ? error.message : "Gagal memuat publikasi.", variant: "destructive" })
    } finally {
      if (!silent) setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(true), 5000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const selectedProject = useMemo(() => data.projects.find(x => x.id === videoProjectId), [data.projects, videoProjectId])
  const stats = useMemo(() => ({
    waiting: data.items.filter(x => x.status === "pending_approval" || x.status === "scheduled").length,
    uploading: data.items.filter(x => x.status === "uploading").length,
    published: data.items.filter(x => x.status === "published").length,
    failed: data.items.filter(x => x.status === "failed").length,
  }), [data.items])

  async function runPreflight() {
    if (!channelId || !videoProjectId) return
    setPreflightBusy(true)
    setPreflightResult(null)
    try {
      const response = await fetch("/api/youtube/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preflight", channelId, videoProjectId }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ready) throw new Error(payload.error || "Preflight YouTube gagal.")
      setPreflightResult({ ready: true, message: payload.message || "Semua prasyarat upload terpenuhi." })
      toast({ title: "Kesiapan upload tervalidasi", description: "Token, izin, channel, dan file siap. Belum ada video yang diunggah." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Preflight YouTube gagal."
      setPreflightResult({ ready: false, message })
      toast({ title: message, variant: "destructive" })
    } finally {
      setPreflightBusy(false)
    }
  }

  async function createPublication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    try {
      const response = await fetch("/api/youtube/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId, videoProjectId, title: title.trim(), description,
          tags: tags.split(",").map(x => x.trim()).filter(Boolean).slice(0, 30),
          privacyStatus, ...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Gagal membuat publikasi.")
      toast({ title: "Publikasi dibuat", description: "Periksa metadata lalu setujui publikasi pada daftar." })
      setTitle(""); setDescription(""); setTags(""); setScheduledAt("")
      await refresh(true)
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Gagal membuat publikasi.", variant: "destructive" })
    } finally { setCreating(false) }
  }

  async function action(id: string, actionName: "approve" | "retry" | "cancel") {
    if (actionName === "retry" && !window.confirm("Retry akan membuat sesi upload baru. Pastikan video tidak sudah terbit di YouTube Studio agar tidak terjadi duplikasi. Lanjutkan?")) return
    setBusyId(id)
    try {
      const response = await fetch("/api/youtube/publish", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: actionName }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Aksi publikasi gagal.")
      toast({ title: actionName === "approve" ? "Publikasi disetujui" : actionName === "retry" ? "Upload dijadwalkan ulang" : "Publikasi dibatalkan" })
      await refresh(true)
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Aksi publikasi gagal.", variant: "destructive" })
    } finally { setBusyId(null) }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clapperboard className="h-4 w-4" /> YouTube Studio</div>
          <h1 className="text-2xl font-bold tracking-tight">Publishing & Automation</h1>
          <p className="text-sm text-muted-foreground">Kelola persetujuan, jadwal, progres upload, dan riwayat publikasi.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} /> Perbarui
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Menunggu / antrean", value: stats.waiting, icon: Clock3 },
          { label: "Sedang upload", value: stats.uploading, icon: UploadCloud },
          { label: "Berhasil diunggah", value: stats.published, icon: CheckCircle2 },
          { label: "Perlu perhatian", value: stats.failed, icon: AlertCircle },
        ].map(item => <Card key={item.label}><CardContent className="flex items-center justify-between p-4">
          <div><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</p></div>
          <item.icon className="h-5 w-5 text-muted-foreground" />
        </CardContent></Card>)}
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="flex items-center gap-2 text-sm text-muted-foreground"><Activity className="h-4 w-4" /> Operational monitoring</div><h2 className="text-lg font-semibold">Worker health & alerting</h2></div>
          <span className="text-xs text-muted-foreground">{operations ? "Diperbarui " + formatDate(operations.observedAt) : "Menunggu data operasional"}</span>
        </div>
        {operationsError && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{operationsError}</div>}
        {!operations && !operationsError && <div className="rounded-lg border p-5 text-sm text-muted-foreground">Memuat status worker...</div>}
        {operations && <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: "Menunggu approval", value: operations.queue.pending_approval ?? 0 },
              { label: "Terjadwal", value: operations.queue.scheduled ?? 0 },
              { label: "Sedang upload", value: operations.queue.uploading ?? 0 },
              { label: "Berhasil", value: operations.queue.published ?? 0 },
              { label: "Gagal", value: operations.queue.failed ?? 0 },
            ].map(metric => <Card key={metric.label}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{metric.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{metric.value}</p></CardContent></Card>)}
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr]">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Server className="h-4 w-4" /> Kondisi scheduler</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Health</span><Badge variant={operations.status === "ok" ? "default" : operations.status === "running" ? "secondary" : "destructive"}>{operations.status.toUpperCase()}</Badge></div>
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Heartbeat</span><span className="tabular-nums">{operations.worker.heartbeatAgeSeconds === null ? "Belum ada" : operations.worker.heartbeatAgeSeconds + " detik lalu"}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Lease stale</span><span className="font-medium tabular-nums">{operations.worker.staleUploads}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Antrean terlambat</span><span className="font-medium tabular-nums">{operations.worker.overdueJobs}</span></div>
                {operations.worker.lastRun && <div className="border-t pt-3 text-xs text-muted-foreground">
                  <p>Eksekusi terakhir: {formatDate(operations.worker.lastRun.completedAt || operations.worker.lastRun.startedAt)}</p>
                  <p className="mt-1">Run {operations.worker.lastRun.runId.slice(0, 8)} · {operations.worker.lastRun.status} · {operations.worker.lastRun.durationMs == null ? "durasi belum tersedia" : (operations.worker.lastRun.durationMs / 1000).toFixed(1) + " detik"}</p>
                  <p className="mt-1">Diproses: {operations.worker.lastRun.attempted ?? 0}/{operations.worker.lastRun.eligible ?? 0}</p>
                </div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4" /> Peringatan operasional <Badge variant="outline">{operations.alerts.length}</Badge></CardTitle><CardDescription>Alert tersimpan dan dikirim sebagai notifikasi in-app saat pertama kali aktif.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {operations.alerts.length === 0 ? <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Tidak ada alert aktif.</div> : operations.alerts.map(alert => <div key={alert.id} role="status" className={alert.severity === "critical" ? "rounded-md border border-destructive/30 bg-destructive/5 p-3" : "rounded-md border border-amber-500/30 bg-amber-500/5 p-3"}><div className="flex items-center gap-2 text-sm font-medium"><AlertCircle className="h-4 w-4" />{alert.title}</div><p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p><p className="mt-1 text-[11px] text-muted-foreground">Aktif sejak {formatDate(alert.firstSeenAt)} · diperbarui {formatDate(alert.lastSeenAt)}</p></div>)}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Timer className="h-4 w-4" /> Riwayat eksekusi worker</CardTitle><CardDescription>20 eksekusi scheduler terbaru, termasuk durasi dan hasil batch.</CardDescription></CardHeader>
            <CardContent>
              {operations.executionHistory.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Belum ada riwayat eksekusi worker.</p> : <div className="space-y-3">{operations.executionHistory.map(run => <div key={run.runId} className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">Run {run.runId.slice(0, 8)}</p><p className="text-xs text-muted-foreground">{formatDate(run.startedAt)} · {run.durationMs == null ? "Durasi tidak tersedia" : (run.durationMs / 1000).toFixed(1) + " detik"}</p>{run.error && <p className="mt-1 text-xs text-destructive">{run.error}</p>}</div><div className="flex items-center gap-2"><Badge variant={run.status === "success" ? "default" : run.status === "running" ? "secondary" : "destructive"}>{run.status}</Badge><span className="text-xs tabular-nums text-muted-foreground">{run.attempted ?? 0}/{run.eligible ?? 0} diproses</span></div></div>)}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Timer className="h-4 w-4" /> Aktivitas yang perlu dipantau</CardTitle><CardDescription>Publikasi gagal, upload aktif, dan antrean terjadwal milik akun ini.</CardDescription></CardHeader>
            <CardContent>
              {operations.recentActivity.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Belum ada aktivitas yang memerlukan pemantauan.</p> : <div className="space-y-3">{operations.recentActivity.map(item => <div key={item.id} className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.channel} · {formatDate(item.updatedAt)}</p>{item.lastError && <p className="mt-1 line-clamp-2 text-xs text-destructive">{item.lastError}</p>}</div><div className="flex shrink-0 items-center gap-2"><Badge variant={item.status === "failed" ? "destructive" : "secondary"}>{STATUS[item.status]?.label ?? item.status}</Badge><span className="text-xs tabular-nums text-muted-foreground">{item.attempts}/{item.maxAttempts}</span></div></div>)}</div>}
            </CardContent>
          </Card>
        </>}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buat publikasi baru</CardTitle>
          <CardDescription>Video harus selesai dirender. Publikasi baru selalu menunggu persetujuan manual.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.channels.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Belum ada channel YouTube terhubung dengan izin upload. Hubungkan akun Google dan berikan izin YouTube upload terlebih dahulu.</p>
          ) : data.projects.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Belum ada video selesai yang siap dipublikasikan.</p>
          ) : (
            <form onSubmit={createPublication} className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm">Channel
                <select required value={channelId} onChange={e => { setChannelId(e.target.value); setPreflightResult(null) }} className="h-10 rounded-md border bg-background px-3">
                  <option value="">Pilih channel</option>
                  {data.channels.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">Video siap terbit
                <select required value={videoProjectId} onChange={e => {
                  const value = e.target.value; setVideoProjectId(value); setPreflightResult(null)
                  const project = data.projects.find(x => x.id === value)
                  if (project && !title) setTitle(project.title || project.topic)
                }} className="h-10 rounded-md border bg-background px-3">
                  <option value="">Pilih video</option>
                  {data.projects.map(x => <option key={x.id} value={x.id}>{x.title || x.topic} · {formatBytes(x.fileBytes)}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm md:col-span-2">Judul YouTube
                <Input required maxLength={100} value={title} onChange={e => setTitle(e.target.value)} placeholder="Judul video (maks. 100 karakter)" />
              </label>
              <label className="grid gap-1.5 text-sm md:col-span-2">Deskripsi
                <Textarea maxLength={5000} rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Deskripsi video..." />
              </label>
              <label className="grid gap-1.5 text-sm md:col-span-2">Tag (pisahkan dengan koma)
                <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="aiviso, edukasi, teknologi" />
              </label>
              <label className="grid gap-1.5 text-sm">Privasi
                <select value={privacyStatus} onChange={e => setPrivacyStatus(e.target.value)} className="h-10 rounded-md border bg-background px-3">
                  <option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">Jadwalkan tayang (opsional)
                <Input type="datetime-local" value={scheduledAt} onChange={e => { setScheduledAt(e.target.value); if (e.target.value) setPrivacyStatus("private") }} />
                <span className="text-xs text-muted-foreground">Jadwal minimal 10 menit ke depan. Video akan diunggah sebagai private.</span>
              </label>
              <div className="flex flex-col gap-3 border-t pt-4 md:col-span-2">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <p className="text-xs text-muted-foreground">{selectedProject ? "Ukuran video: " + formatBytes(selectedProject.fileBytes) : "Pilih video yang akan dipublikasikan."}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void runPreflight()} disabled={preflightBusy || creating || !channelId || !videoProjectId}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> {preflightBusy ? "Memeriksa..." : "Periksa kesiapan"}
                    </Button>
                    <Button type="submit" disabled={creating || preflightBusy || !channelId || !videoProjectId || !title.trim()}>
                      <UploadCloud className="mr-2 h-4 w-4" /> {creating ? "Membuat..." : "Buat publikasi"}
                    </Button>
                  </div>
                </div>
                {preflightResult && <div className={preflightResult.ready ? "rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300" : "rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"}>
                  <div className="flex items-start gap-2">
                    {preflightResult.ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>{preflightResult.message}</span>
                  </div>
                </div>}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Riwayat publikasi</h2><span className="text-xs text-muted-foreground">{data.items.length} item terakhir</span></div>
        {loading ? <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Memuat publikasi...</div> : data.items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center"><Clapperboard className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="font-medium">Belum ada publikasi</p><p className="mt-1 text-sm text-muted-foreground">Buat publikasi dari video yang sudah selesai diproses.</p></div>
        ) : <div className="grid gap-3">
          {data.items.map(item => {
            const status = STATUS[item.status] ?? { label: item.status, variant: "outline" as const }
            const progress = percent(item)
            const busy = busyId === item.id
            return <Card key={item.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1"><p className="break-words font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{item.channel.title} · {item.videoProject.topic}</p></div>
                  <Badge variant={status.variant} className="w-fit">{status.label}</Badge>
                </div>
                {item.status === "uploading" && <div className="space-y-1.5"><div className="flex justify-between text-xs text-muted-foreground"><span>Upload {formatBytes(Number(item.uploadOffset))} / {formatBytes(item.videoProject.fileBytes)}</span><span>{progress}%</span></div><Progress value={progress} /></div>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Dibuat: {formatDate(item.createdAt)}</span>
                  {item.scheduledAt && <span>Tayang: {formatDate(item.scheduledAt)}</span>}
                  <span>Percobaan: {item.uploadAttempts}/{item.maxUploadAttempts}</span>
                </div>
                {item.lastError && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{item.lastError}</div>}
                {item.youtubeVideoId && <a href={"https://www.youtube.com/watch?v=" + encodeURIComponent(item.youtubeVideoId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Buka video <ExternalLink className="h-3.5 w-3.5" /></a>}
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {item.status === "pending_approval" && <Button size="sm" onClick={() => void action(item.id, "approve")} disabled={busy}><CheckCircle2 className="mr-1.5 h-4 w-4" />Setujui & upload</Button>}
                  {item.status === "failed" && <Button size="sm" variant="outline" onClick={() => void action(item.id, "retry")} disabled={busy}><RotateCcw className="mr-1.5 h-4 w-4" />Coba lagi</Button>}
                  {["pending_approval", "scheduled", "failed"].includes(item.status) && <Button size="sm" variant="ghost" onClick={() => void action(item.id, "cancel")} disabled={busy}><XCircle className="mr-1.5 h-4 w-4" />Batalkan</Button>}
                </div>
              </CardContent>
            </Card>
          })}
        </div>}
      </section>
    </div>
  )
}
