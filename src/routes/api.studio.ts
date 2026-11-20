import { createFileRoute } from '@tanstack/react-router'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'
import { adminGate } from '@/lib/admin-gate'
import { getZAI } from '@/lib/zai'
import { projectDir } from '@/lib/video/config'
import { ensureDir } from '@/lib/video/media'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginGuard } from '@/lib/security/http'
import { hasYoutubeMonetaryScope } from '@/lib/youtube/oauth'
import { percentageChange, summarizeRevenue } from '@/lib/youtube/revenue'
import { moduleLogger } from '@/lib/logger'

const log = moduleLogger('creator-studio')
const licenses = ['public_domain', 'cc0', 'cc_by', 'cc_by_sa', 'commercial_stock', 'editorial_only', 'cc_by_nc', 'cc_by_nd', 'custom', 'unknown'] as const
const footageSchema = z.object({
  title: z.string().trim().min(2).max(140),
  sourceName: z.string().trim().min(2).max(120),
  sourceUrl: z.string().url().max(1500),
  assetUrl: z.string().url().max(1500),
  licenseType: z.enum(licenses).default('unknown'),
  commercialUse: z.boolean().default(false),
  modificationAllowed: z.boolean().default(false),
  attributionRequired: z.boolean().default(false),
  attributionText: z.string().trim().max(800).optional(),
  rightsEvidenceUrl: z.string().url().max(1500).optional(),
  rightsEvidenceNotes: z.string().trim().max(1200).optional(),
}).strict()
const reviewSchema = z.object({
  id: z.string().uuid(),
  reviewStatus: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().trim().max(1200).optional(),
}).strict()
const deleteSchema = z.object({ id: z.string().uuid() }).strict()
const thumbnailSchema = z.object({
  videoProjectId: z.string().uuid(),
  prompt: z.string().trim().min(8).max(900),
}).strict()
const selectSchema = z.object({ variantId: z.string().uuid() }).strict()
const revenueSchema = z.object({
  channelId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict()

function httpsOnly(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
  } catch { return false }
}
async function readJson(request: Request) {
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > 10_000) throw new Error('Payload terlalu besar.')
  return JSON.parse(raw)
}
const utcDate = (value: string) => new Date(value + 'T00:00:00.000Z')

export const Route = createFileRoute('/api/studio')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
        const url = new URL(request.url)
        const resource = url.searchParams.get('resource')

        if (resource === 'footage') {
          const assets = await db.footageAsset.findMany({
            where: { userId: session.user.id }, orderBy: { createdAt: 'desc' },
          })
          const adminDenied = await adminGate()
          const reviewQueue = adminDenied ? [] : await db.footageAsset.findMany({
            where: { reviewStatus: 'pending' }, orderBy: { createdAt: 'asc' }, take: 100,
          })
          const serialize = (asset: typeof assets[number]) => ({
            ...asset,
            effectiveStatus: asset.expiresAt && asset.expiresAt.getTime() < Date.now() ? 'expired' : asset.reviewStatus,
          })
          return Response.json({ assets: assets.map(serialize), reviewQueue: reviewQueue.map(serialize) }, {
            headers: { 'Cache-Control': 'private, no-store' },
          })
        }

        if (resource === 'thumbnails') {
          const fileId = url.searchParams.get('file')
          if (fileId) {
            const variant = await db.thumbnailVariant.findFirst({
              where: { id: fileId, userId: session.user.id }, select: { imagePath: true },
            })
            if (!variant) return new Response('Thumbnail tidak ditemukan.', { status: 404 })
            try {
              const image = await fs.readFile(variant.imagePath)
              return new Response(new Uint8Array(image), {
                headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
              })
            } catch { return new Response('File thumbnail tidak tersedia.', { status: 404 }) }
          }
          const projectId = url.searchParams.get('projectId')
          if (!projectId || projectId.length > 80) return Response.json({ error: 'Project video wajib dipilih.' }, { status: 400 })
          const project = await db.videoProject.findFirst({
            where: { id: projectId, userId: session.user.id }, select: { id: true },
          })
          if (!project) return Response.json({ error: 'Project video tidak ditemukan.' }, { status: 404 })
          const variants = await db.thumbnailVariant.findMany({
            where: { videoProjectId: project.id, userId: session.user.id },
            orderBy: { createdAt: 'desc' },
            select: { id: true, prompt: true, aspect: true, isSelected: true, createdAt: true },
          })
          return Response.json({
            variants: variants.map((variant) => ({ ...variant, previewUrl: '/api/studio?resource=thumbnails&file=' + variant.id })),
          }, { headers: { 'Cache-Control': 'private, no-store' } })
        }

        if (resource === 'revenue') {
          const parsed = revenueSchema.safeParse({
            channelId: url.searchParams.get('channelId'),
            startDate: url.searchParams.get('startDate'),
            endDate: url.searchParams.get('endDate'),
          })
          if (!parsed.success) return Response.json({ error: 'Parameter laporan pendapatan tidak valid.' }, { status: 400 })
          const { channelId, startDate, endDate } = parsed.data
          const start = utcDate(startDate)
          const end = utcDate(endDate)
          const today = new Date()
          const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
          const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
          if (end < start || end >= todayUtc || days > 365) {
            return Response.json({ error: 'Rentang tanggal harus berakhir sebelum hari ini dan maksimal 365 hari.' }, { status: 400 })
          }
          const channel = await db.youtubeChannel.findFirst({
            where: { id: channelId, userId: session.user.id },
            select: {
              id: true, title: true, youtubeChannelId: true,
              oauthConnection: { select: { scopes: true, connectionStatus: true } },
            },
          })
          if (!channel || channel.oauthConnection?.connectionStatus !== 'connected') {
            return Response.json({ error: 'Channel tidak ditemukan atau koneksi Google tidak aktif.' }, { status: 404 })
          }
          if (!hasYoutubeMonetaryScope(channel.oauthConnection.scopes)) {
            return Response.json({ error: 'Akses monetisasi YouTube belum diberikan. Hubungkan ulang akun dengan izin pendapatan.' }, { status: 403 })
          }
          if (!rateLimit('studio-revenue:' + session.user.id, 30, 60 * 60 * 1000)) {
            return Response.json({ error: 'Batas akses laporan pendapatan tercapai.' }, { status: 429 })
          }
          const previousStart = new Date(start.getTime() - days * 86_400_000)
          const rows = await db.youtubeAnalyticsDailyMetric.findMany({
            where: { channelId, metricDate: { gte: previousStart, lt: new Date(end.getTime() + 86_400_000) } },
            orderBy: { metricDate: 'asc' },
            select: { metricDate: true, views: true, estimatedRevenue: true, estimatedAdRevenue: true, currencyCode: true },
          })
          const currentRows = rows.filter((row) => row.metricDate >= start)
          const previousRows = rows.filter((row) => row.metricDate < start)
          const current = summarizeRevenue(currentRows)
          const previous = summarizeRevenue(previousRows)
          return Response.json({
            channel: { id: channel.id, title: channel.title, youtubeChannelId: channel.youtubeChannelId },
            currency: currentRows[0]?.currencyCode ?? previousRows[0]?.currencyCode ?? 'IDR',
            startDate, endDate, current, previous,
            revenueChangePct: percentageChange(current.estimatedRevenue, previous.estimatedRevenue),
            adRevenueChangePct: percentageChange(current.estimatedAdRevenue, previous.estimatedAdRevenue),
            daily: currentRows.map((row) => ({
              date: row.metricDate.toISOString().slice(0, 10),
              views: row.views.toString(),
              estimatedRevenue: row.estimatedRevenue,
              estimatedAdRevenue: row.estimatedAdRevenue,
            })),
            limitations: [
              'Pendapatan adalah estimatedRevenue dan estimatedAdRevenue dari YouTube Analytics, bukan payout final.',
              'RPM dihitung sebagai estimasi pendapatan per 1.000 views, bukan CPM.',
              'Perbandingan memakai rentang sebelumnya dengan jumlah hari yang sama.',
              'Data hanya tersedia jika akun memiliki akses monetisasi.',
            ],
          }, { headers: { 'Cache-Control': 'private, no-store' } })
        }

        return Response.json({ error: 'Resource Creator Studio tidak dikenal.' }, { status: 400 })
      },

      POST: async ({ request }: { request: Request }) => {
        const denied = sameOriginGuard(request)
        if (denied) return denied
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
        const resource = new URL(request.url).searchParams.get('resource')
        let body: unknown
        try { body = await readJson(request) }
        catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Body tidak valid.' }, { status: 400 }) }

        if (resource === 'footage') {
          const parsed = footageSchema.safeParse(body)
          if (!parsed.success) return Response.json({ error: 'Metadata footage tidak valid.' }, { status: 400 })
          const urls = [parsed.data.sourceUrl, parsed.data.assetUrl, ...(parsed.data.rightsEvidenceUrl ? [parsed.data.rightsEvidenceUrl] : [])]
          if (!urls.every(httpsOnly)) return Response.json({ error: 'Semua URL harus HTTPS dan tidak boleh menyertakan kredensial.' }, { status: 400 })
          if (!rateLimit('studio-footage:' + session.user.id, 20, 60 * 60 * 1000)) return Response.json({ error: 'Batas pendaftaran footage tercapai.' }, { status: 429 })
          const asset = await db.footageAsset.create({
            data: { userId: session.user.id, ...parsed.data, reviewStatus: 'pending' },
          })
          return Response.json({ asset, message: 'Footage terdaftar dan menunggu pemeriksaan hak penggunaan.' }, { status: 201 })
        }

        if (resource === 'thumbnails') {
          const parsed = thumbnailSchema.safeParse(body)
          if (!parsed.success) return Response.json({ error: 'Prompt thumbnail tidak valid.' }, { status: 400 })
          if (!rateLimit('studio-thumbnail:' + session.user.id, 4, 60 * 60 * 1000)) return Response.json({ error: 'Batas generasi thumbnail per jam tercapai.' }, { status: 429 })
          const project = await db.videoProject.findFirst({
            where: { id: parsed.data.videoProjectId, userId: session.user.id, status: 'done' },
            select: { id: true, topic: true, title: true },
          })
          if (!project) return Response.json({ error: 'Thumbnail hanya tersedia untuk video selesai milik akun ini.' }, { status: 404 })
          const count = await db.thumbnailVariant.count({ where: { userId: session.user.id, videoProjectId: project.id } })
          if (count >= 12) return Response.json({ error: 'Maksimal 12 variasi thumbnail per project.' }, { status: 409 })
          let generatedImagePath: string | null = null
          try {
            const prompt = [
              'Create a professional high-click-through-rate YouTube thumbnail, landscape 16:9.',
              'One unmistakable focal subject, clear hierarchy, strong contrast, cinematic lighting, simple uncluttered background, readable at mobile size.',
              'No logos, watermark, interface, borders, or tiny details. Avoid garbled typography; do not render words unless explicitly included in the creative direction.',
              'Video context: ' + (project.title || project.topic),
              'Creative direction: ' + parsed.data.prompt,
            ].join('\n')
            const zai = await getZAI()
            const generated = await zai.images.generations.create({ prompt, size: '1344x768' })
            const base64 = generated.data?.[0]?.base64
            if (!base64) throw new Error('Provider tidak mengembalikan gambar.')
            const image = Buffer.from(base64, 'base64')
            if (image.byteLength < 1024 || image.byteLength > 15 * 1024 * 1024) throw new Error('Ukuran thumbnail tidak valid.')
            const directory = path.join(projectDir(project.id), 'thumbnail-lab')
            await ensureDir(directory)
            const id = randomUUID()
            const imagePath = path.join(directory, id + '.png')
            await fs.writeFile(imagePath, image, { flag: 'wx' })
            generatedImagePath = imagePath
            const variant = await db.thumbnailVariant.create({
              data: { id, userId: session.user.id, videoProjectId: project.id, prompt: parsed.data.prompt, aspect: '16:9', imagePath, provider: 'z-ai' },
              select: { id: true, prompt: true, aspect: true, isSelected: true, createdAt: true },
            })
            return Response.json({ variant: { ...variant, previewUrl: '/api/studio?resource=thumbnails&file=' + id } }, { status: 201 })
          } catch (error) {
            if (generatedImagePath) await fs.rm(generatedImagePath, { force: true }).catch(() => {})
            log.error({ err: error instanceof Error ? error.message.slice(0, 180) : 'unknown' }, 'thumbnail generation failed')
            return Response.json({ error: 'Gagal membuat thumbnail. Periksa konfigurasi provider AI.' }, { status: 502 })
          }
        }
        return Response.json({ error: 'Resource Creator Studio tidak dikenal.' }, { status: 400 })
      },

      PATCH: async ({ request }: { request: Request }) => {
        const denied = sameOriginGuard(request)
        if (denied) return denied
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
        const resource = new URL(request.url).searchParams.get('resource')
        let body: unknown
        try { body = await readJson(request) }
        catch { return Response.json({ error: 'Body tidak valid.' }, { status: 400 }) }

        if (resource === 'footage') {
          const parsed = reviewSchema.safeParse(body)
          if (!parsed.success) return Response.json({ error: 'Perintah review tidak valid.' }, { status: 400 })
          const deniedAdmin = await adminGate()
          if (deniedAdmin) return deniedAdmin
          const asset = await db.footageAsset.findUnique({ where: { id: parsed.data.id } })
          if (!asset) return Response.json({ error: 'Footage tidak ditemukan.' }, { status: 404 })
          if (parsed.data.reviewStatus === 'approved' && (!asset.rightsEvidenceUrl || asset.licenseType === 'unknown')) {
            return Response.json({ error: 'Persetujuan memerlukan jenis lisensi dan URL bukti hak penggunaan.' }, { status: 422 })
          }
          const updated = await db.footageAsset.update({
            where: { id: asset.id },
            data: { reviewStatus: parsed.data.reviewStatus, reviewNotes: parsed.data.reviewNotes ?? null, reviewedById: session.user.id, reviewedAt: new Date() },
          })
          return Response.json({ asset: updated })
        }
        if (resource === 'thumbnails') {
          const parsed = selectSchema.safeParse(body)
          if (!parsed.success) return Response.json({ error: 'ID variasi thumbnail tidak valid.' }, { status: 400 })
          const variant = await db.thumbnailVariant.findFirst({
            where: { id: parsed.data.variantId, userId: session.user.id },
            select: { id: true, videoProjectId: true },
          })
          if (!variant) return Response.json({ error: 'Variasi thumbnail tidak ditemukan.' }, { status: 404 })
          await db.$transaction([
            db.thumbnailVariant.updateMany({
              where: { userId: session.user.id, videoProjectId: variant.videoProjectId },
              data: { isSelected: false },
            }),
            db.thumbnailVariant.update({ where: { id: variant.id }, data: { isSelected: true } }),
          ])
          return Response.json({ success: true })
        }
        return Response.json({ error: 'Resource Creator Studio tidak dikenal.' }, { status: 400 })
      },

      DELETE: async ({ request }: { request: Request }) => {
        const denied = sameOriginGuard(request)
        if (denied) return denied
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
        const url = new URL(request.url)
        const resource = url.searchParams.get('resource')
        if (resource === 'footage') {
          let body: unknown
          try { body = await readJson(request) } catch { return Response.json({ error: 'Body tidak valid.' }, { status: 400 }) }
          const parsed = deleteSchema.safeParse(body)
          if (!parsed.success) return Response.json({ error: 'ID footage tidak valid.' }, { status: 400 })
          const deleted = await db.footageAsset.deleteMany({ where: { id: parsed.data.id, userId: session.user.id } })
          return Response.json({ success: deleted.count === 1 }, { status: deleted.count === 1 ? 200 : 404 })
        }
        if (resource === 'thumbnails') {
          const id = url.searchParams.get('id')
          if (!id || id.length > 80) return Response.json({ error: 'ID variasi thumbnail tidak valid.' }, { status: 400 })
          const variant = await db.thumbnailVariant.findFirst({
            where: { id, userId: session.user.id }, select: { id: true, imagePath: true },
          })
          if (!variant) return Response.json({ error: 'Variasi thumbnail tidak ditemukan.' }, { status: 404 })
          await db.thumbnailVariant.delete({ where: { id: variant.id } })
          await fs.rm(variant.imagePath, { force: true }).catch(() => {})
          return Response.json({ success: true })
        }
        return Response.json({ error: 'Resource Creator Studio tidak dikenal.' }, { status: 400 })
      },
    },
  },
})
