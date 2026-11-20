import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'
import {
  isJobRunning,
  removeMediaDir,
  startVideoJob,
  type SceneState,
} from '@/lib/video/pipeline'
import {
  AGENT_COUNT,
  DEFAULT_ASPECT,
  LONG_DURATIONS,
  SHORT_SCENES,
  STYLES,
  isAspectAllowed,
  type Aspect,
} from '@/lib/video/config'
import { moduleLogger } from '@/lib/logger'
import { getApiSession } from '@/lib/session'

const log = moduleLogger('api-video')

function agentSummary(scenes: SceneState[]) {
  return Array.from({ length: AGENT_COUNT }, (_, i) => {
    const mine = scenes.filter((s) => s.agent === i + 1)
    const current = mine.find((s) => s.status === 'processing')
    return {
      id: i + 1,
      done: mine.filter((s) => s.status === 'done').length,
      currentIdx: current?.idx ?? null,
      state: current
        ? ('working' as const)
        : mine.length > 0
          ? ('standby' as const)
          : ('idle' as const),
    }
  })
}

export const Route = createFileRoute('/api/video')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const session = await getApiSession()
          if (!session) {
            return Response.json({ error: 'Masuk terlebih dahulu untuk membuat project video.' }, { status: 401 })
          }
          const body = await request.json().catch(() => null)
          const topic = String(body?.topic ?? '').trim()
          const format = body?.format === 'long' ? 'long' : 'short'
          const renderMode = body?.renderMode === 'fast' ? 'fast' : 'cinematic'
          const styleId = STYLES.some((s) => s.id === body?.style)
            ? String(body.style)
            : STYLES[0].id
          const voice = body?.voice === 'off' ? 'off' : 'tongtong'
          const researchEnabled = body?.researchEnabled === true && format === 'short'

          if (topic.length < 5) {
            return Response.json({ error: 'Topik video minimal 5 karakter.' }, { status: 400 })
          }
          if (topic.length > 300) {
            return Response.json(
              { error: 'Topik video terlalu panjang (maks 300 karakter).' },
              { status: 400 },
            )
          }

          let targetScenes: number
          if (format === 'short') {
            targetScenes = SHORT_SCENES
          } else {
            const requested = Number(body?.targetScenes)
            targetScenes = LONG_DURATIONS.some((d) => d.scenes === requested)
              ? requested
              : 30
          }

          const requestedAspect = String(body?.aspect ?? '')
          const aspect: Aspect = isAspectAllowed(requestedAspect, format)
            ? (requestedAspect as Aspect)
            : DEFAULT_ASPECT[format]

          const created = await db.videoProject.create({
            data: {
              userId: session.user.id,
              topic,
              format,
              style: styleId,
              renderMode,
              voice,
              aspect,
              researchEnabled,
              targetScenes,
              status: 'queued',
              stageDetail: 'Antre...',
            },
          })

          startVideoJob(created.id)
          log.info(
            { id: created.id, format, aspect, renderMode, researchEnabled },
            'project video dibuat',
          )
          return Response.json({ id: created.id, status: created.status })
        } catch (err) {
          log.error(
            { err: err instanceof Error ? err.message.slice(0, 200) : 'unknown' },
            'video POST error',
          )
          return Response.json({ error: 'Gagal membuat project video.' }, { status: 500 })
        }
      },

      GET: async ({ request }: { request: Request }) => {
        try {
          const session = await getApiSession()
          if (!session) {
            return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
          }
          const { searchParams } = new URL(request.url)
          const id = searchParams.get('id')

          if (!id) {
            const list = await db.videoProject.findMany({
              where: { userId: session.user.id },
              orderBy: { createdAt: 'desc' },
              take: 12,
              select: {
                id: true,
                topic: true,
                title: true,
                format: true,
                renderMode: true,
                status: true,
                progress: true,
                scenesTotal: true,
                scenesDone: true,
                durationSec: true,
                fileBytes: true,
                createdAt: true,
              },
            })
            return Response.json({ list })
          }

          let project = await db.videoProject.findFirst({
            where: { id, userId: session.user.id },
          })
          if (!project) {
            return Response.json(
              { error: 'Project video tidak ditemukan.' },
              { status: 404 },
            )
          }

          const activeStatus = ['queued', 'planning', 'building', 'stitching']
          if (activeStatus.includes(project.status) && !isJobRunning(project.id)) {
            const age = Date.now() - new Date(project.updatedAt).getTime()
            if (age > 90_000) {
              project = await db.videoProject.update({
                where: { id: project.id },
                data: {
                  status: 'error',
                  error: 'Proses terhenti (server dimuat ulang). Silakan buat ulang video.',
                },
              })
            }
          }

          let scenes: SceneState[] = []
          try {
            const parsed = JSON.parse(project.scenes) as SceneState[]
            if (Array.isArray(parsed)) scenes = parsed
          } catch {
            scenes = []
          }

          return Response.json({
            project: {
              id: project.id,
              topic: project.topic,
              title: project.title,
              description: project.description,
              format: project.format,
              style: project.style,
              renderMode: project.renderMode,
              voice: project.voice,
              aspect: project.aspect,
              researchEnabled: project.researchEnabled,
              status: project.status,
              stageDetail: project.stageDetail,
              progress: project.progress,
              scenesTotal: project.scenesTotal,
              scenesDone: project.scenesDone,
              durationSec: project.durationSec,
              fileBytes: project.fileBytes,
              error: project.error,
              createdAt: project.createdAt,
              updatedAt: project.updatedAt,
              scenes,
              research: (() => {
                try {
                  return JSON.parse(project.research) as unknown
                } catch {
                  return null
                }
              })(),
            },
            agents: agentSummary(scenes),
          })
        } catch (err) {
          log.error(
            { err: err instanceof Error ? err.message.slice(0, 200) : 'unknown' },
            'video GET error',
          )
          return Response.json(
            { error: 'Gagal mengambil status video.' },
            { status: 500 },
          )
        }
      },

      DELETE: async ({ request }: { request: Request }) => {
        try {
          const session = await getApiSession()
          if (!session) {
            return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
          }
          const id = new URL(request.url).searchParams.get('id')
          if (!id) {
            return Response.json({ error: 'Parameter id wajib.' }, { status: 400 })
          }
          if (isJobRunning(id)) {
            return Response.json(
              { error: 'Video sedang diproses, tunggu sampai selesai.' },
              { status: 409 },
            )
          }
          const project = await db.videoProject.findFirst({
            where: { id, userId: session.user.id },
            select: { id: true },
          })
          if (!project) {
            return Response.json({ error: 'Project video tidak ditemukan.' }, { status: 404 })
          }
          await db.videoProject.delete({ where: { id: project.id } })
          await removeMediaDir(id)
          return Response.json({ ok: true })
        } catch (err) {
          log.error(
            { err: err instanceof Error ? err.message.slice(0, 200) : 'unknown' },
            'video DELETE error',
          )
          return Response.json(
            { error: 'Gagal menghapus project video.' },
            { status: 500 },
          )
        }
      },
    },
  },
})
