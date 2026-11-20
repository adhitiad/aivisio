import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { removeMediaDir, type SceneState } from '@/lib/video/pipeline'
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
import { deleteObject } from '@/lib/storage/neon-object-storage'
import { enqueueVideoJob } from '@/lib/redis/video-queue'
import { getApiSession } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginGuard } from '@/lib/security/http'

const log = moduleLogger('api-video')
const createSchema = z.object({
  topic: z.string().trim().min(5).max(300),
  format: z.enum(['short', 'long']).optional(),
  renderMode: z.enum(['cinematic', 'fast']).optional(),
  style: z.string().max(80).optional(),
  voice: z.enum(['off', 'on', 'tongtong']).optional(),
  researchEnabled: z.boolean().optional(),
  targetScenes: z.number().int().optional(),
  aspect: z.string().max(8).optional(),
}).strict()

function agentSummary(scenes: SceneState[]) {
  return Array.from({ length: AGENT_COUNT }, (_, index) => {
    const mine = scenes.filter((scene) => scene.agent === index + 1)
    const current = mine.find((scene) => scene.status === 'processing')
    return {
      id: index + 1,
      done: mine.filter((scene) => scene.status === 'done').length,
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
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied

        try {
          const session = await getApiSession()
          if (!session) {
            return Response.json(
              { error: 'Masuk terlebih dahulu untuk membuat project video.' },
              { status: 401 },
            )
          }

          if (!rateLimit('video:create:' + session.user.id, 2, 15 * 60 * 1000)) {
            return Response.json(
              { error: 'Batas pembuatan video sementara tercapai. Coba lagi nanti.' },
              { status: 429 },
            )
          }

          const raw = await request.text()
          if (new TextEncoder().encode(raw).byteLength > 16_000) {
            return Response.json({ error: 'Payload terlalu besar.' }, { status: 413 })
          }

          let body: unknown
          try {
            body = JSON.parse(raw)
          } catch {
            return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
          }

          const parsed = createSchema.safeParse(body)
          if (!parsed.success) {
            return Response.json({ error: 'Parameter video tidak valid.' }, { status: 400 })
          }

          const input = parsed.data
          const format = input.format ?? 'short'
          const renderMode = input.renderMode ?? 'cinematic'
          const styleId = STYLES.some((style) => style.id === input.style)
            ? input.style!
            : STYLES[0].id
          const voice = input.voice === 'off' ? 'off' : 'tongtong'
          const researchEnabled = input.researchEnabled === true && format === 'short'

          let targetScenes: number
          if (format === 'short') {
            targetScenes = SHORT_SCENES
          } else {
            targetScenes = LONG_DURATIONS.some((duration) => duration.scenes === input.targetScenes)
              ? input.targetScenes!
              : 30
          }

          const requestedAspect = input.aspect ?? ''
          const aspect: Aspect = isAspectAllowed(requestedAspect, format)
            ? (requestedAspect as Aspect)
            : DEFAULT_ASPECT[format]

          const activeJobs = await db.videoProject.count({
            where: {
              userId: session.user.id,
              status: { in: ['queued', 'planning', 'building', 'stitching'] },
            },
          })
          if (activeJobs >= 2) {
            return Response.json(
              { error: 'Maksimal dua project video dapat diproses bersamaan.' },
              { status: 409 },
            )
          }

          const created = await db.$transaction(async (tx) => {
            const project = await tx.videoProject.create({
              data: {
                userId: session.user.id,
                topic: input.topic,
                format,
                style: styleId,
                renderMode,
                voice,
                aspect,
                researchEnabled,
                targetScenes,
                status: 'queued',
                stageDetail: 'Menunggu worker video...',
              },
            })
            await tx.videoJob.create({ data: { videoProjectId: project.id } })
            return project
          })
          try {
            await enqueueVideoJob(created.id)
          } catch (queueError) {
            // PostgreSQL remains the durable queue; the worker reconciles rows when Redis is unavailable.
            log.warn({ id: created.id, err: queueError instanceof Error ? queueError.message.slice(0, 180) : 'unknown' }, 'Redis enqueue unavailable; PostgreSQL fallback retained')
          }
          log.info(
            { id: created.id, userId: session.user.id, format, aspect, renderMode, researchEnabled },
            'project video dibuat',
          )
          return Response.json({ id: created.id, status: created.status, queue: 'queued' }, { status: 202 })
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
            return Response.json({ list }, { headers: { 'Cache-Control': 'private, no-store' } })
          }

          const project = await db.videoProject.findFirst({
            where: { id, userId: session.user.id },
          })
          if (!project) {
            return Response.json({ error: 'Project video tidak ditemukan.' }, { status: 404 })
          }
          const queueJob = await db.videoJob.findUnique({
            where: { videoProjectId: project.id },
            select: { status: true, attempts: true, maxAttempts: true, availableAt: true, heartbeatAt: true, lastError: true },
          })

          let scenes: SceneState[] = []
          try {
            const parsed = JSON.parse(project.scenes) as SceneState[]
            if (Array.isArray(parsed)) scenes = parsed
          } catch {
            scenes = []
          }

          return Response.json(
            {
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
                queue: queueJob ? {
                  status: queueJob.status,
                  attempts: queueJob.attempts,
                  maxAttempts: queueJob.maxAttempts,
                  availableAt: queueJob.availableAt,
                  heartbeatAt: queueJob.heartbeatAt,
                  lastError: queueJob.lastError,
                } : null,
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
            },
            { headers: { 'Cache-Control': 'private, no-store' } },
          )
        } catch (err) {
          log.error(
            { err: err instanceof Error ? err.message.slice(0, 200) : 'unknown' },
            'video GET error',
          )
          return Response.json({ error: 'Gagal mengambil status video.' }, { status: 500 })
        }
      },

      DELETE: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied
        try {
          const session = await getApiSession()
          if (!session) {
            return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
          }
          const id = new URL(request.url).searchParams.get('id')
          if (!id || id.length > 80) {
            return Response.json({ error: 'Parameter id tidak valid.' }, { status: 400 })
          }
          const queueJob = await db.videoJob.findUnique({ where: { videoProjectId: id }, select: { status: true } })
          if (queueJob?.status === 'processing') {
            return Response.json({ error: 'Video sedang diproses worker. Tunggu sampai selesai.' }, { status: 409 })
          }
          const project = await db.videoProject.findFirst({
            where: { id, userId: session.user.id },
            select: { id: true },
          })
          if (!project) {
            return Response.json({ error: 'Project video tidak ditemukan.' }, { status: 404 })
          }
          const mediaAssets = await db.mediaAsset.findMany({
            where: { videoProjectId: project.id },
            select: { objectKey: true },
          })
          for (const asset of mediaAssets) await deleteObject(asset.objectKey)
          await db.videoProject.delete({ where: { id: project.id } })
          await removeMediaDir(id)
          return Response.json({ ok: true })
        } catch (err) {
          log.error(
            { err: err instanceof Error ? err.message.slice(0, 200) : 'unknown' },
            'video DELETE error',
          )
          return Response.json({ error: 'Gagal menghapus project video.' }, { status: 500 })
        }
      },
    },
  },
})
