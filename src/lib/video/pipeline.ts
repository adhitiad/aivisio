import fsp from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { getZAI } from '@/lib/zai'
import { chatComplete } from '@/lib/ai/router'
import { moduleLogger } from '@/lib/logger'
import {
  AGENT_COUNT,
  DIMS,
  IMG_SIZE,
  LONG_SCENES,
  SCENE_SEC,
  SHORT_SCENES,
  VIDEO_SIZE,
  type ImageSize,
  VIDEO_SLOTS,
  getDim,
  getStyleById,
  projectDir,
} from './config'
import { buildPlannerMessages, parseStoryboard, type Storyboard } from './prompts'
import { researchTopic } from './research'
import {
  concatScenes,
  ensureDir,
  extractThumb,
  gradientToClip,
  imageToClip,
  makeSilence,
  muxAudio,
  normalizeVideoClip,
  padTts,
  probeDuration,
  run,
  wrapOverlay,
} from './media'

export type SceneStatus = 'pending' | 'processing' | 'done' | 'error'
export type SceneAsset = 'video' | 'image' | 'fallback' | null

export type SceneState = {
  idx: number
  narration: string
  visual: string
  overlay: string
  status: SceneStatus
  agent: number | null
  asset: SceneAsset
  error?: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const log = moduleLogger('video-pipeline')

/** Registry job aktif (bertahan di globalThis agar aman dari hot-reload dev). */
const globalForJobs = globalThis as unknown as { aivisoVideoJobs?: Set<string> }
const runningJobs = globalForJobs.aivisoVideoJobs ?? new Set<string>()
globalForJobs.aivisoVideoJobs = runningJobs

export function isJobRunning(id: string): boolean {
  return runningJobs.has(id)
}

export function startVideoJob(id: string) {
  if (runningJobs.has(id)) return
  runningJobs.add(id)
  log.info({ id }, 'job video dimulai')
  void runVideoPipeline(id)
    .catch(async (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Kesalahan tidak diketahui'
      log.error({ id, err: msg.slice(0, 200) }, 'job video error tak tertangani')
      await db.videoProject
        .update({ where: { id }, data: { status: 'error', error: msg.slice(0, 500) } })
        .catch(() => {})
    })
    .finally(() => {
      runningJobs.delete(id)
      log.info({ id }, 'job video selesai')
    })
}

/** Semaphore pembatas akses paralel (untuk API video yang punya rate-limit). */
function createSemaphore(n: number) {
  let active = 0
  const queue: Array<() => void> = []
  return async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= n) {
      await new Promise<void>((resolve) => queue.push(resolve))
    }
    active++
    try {
      return await fn()
    } finally {
      active--
      queue.shift()?.()
    }
  }
}

type PipelineCtx = {
  id: string
  dir: string
  dim: { w: number; h: number }
  portrait: boolean
  videoSize: string
  imageSize: ImageSize
  renderMode: 'cinematic' | 'fast'
  voice: string
  stylePrompt: string
  zai: Awaited<ReturnType<typeof getZAI>>
  withVideoSlot: <T>(fn: () => Promise<T>) => Promise<T>
  videoFailures: number
  videoBroken: boolean
}

async function createVideoTask(
  ctx: PipelineCtx,
  prompt: string,
  size: string | undefined,
): Promise<string> {
  const res = await ctx.zai.video.generations.create({
    prompt,
    duration: SCENE_SEC,
    quality: 'speed',
    with_audio: false,
    watermark_enabled: false,
    fps: 30,
    ...(size ? { size } : {}),
  })
  if (!res?.id) throw new Error('Task video tidak dibuat')
  return res.id
}

async function pollVideoResult(ctx: PipelineCtx, taskId: string, timeoutMs: number): Promise<string> {
  const t0 = Date.now()
  for (;;) {
    await sleep(5000)
    const st = await ctx.zai.async.result.query(taskId)
    if (st.task_status === 'SUCCESS') {
      const url = st.video_result?.[0]?.url || st.video_url || st.url || st.video || null
      if (!url) throw new Error('Video selesai tapi URL tidak ada')
      return url as string
    }
    if (st.task_status === 'FAIL') throw new Error('Generator video melaporkan gagal')
    if (Date.now() - t0 > timeoutMs) throw new Error('Timeout menunggu klip video AI')
  }
}

async function downloadTo(url: string, outPath: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(180000) })
  if (!res.ok) throw new Error(`Unduh klip gagal: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 10000) throw new Error('Klip video kosong/korup')
  await fsp.writeFile(outPath, buf)
}

async function generateSceneImage(ctx: PipelineCtx, prompt: string, outPath: string) {
  const sizes: ImageSize[] = [ctx.imageSize, '1024x1024']
  let lastErr: unknown = null
  for (const size of sizes) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await ctx.zai.images.generations.create({ prompt, size })
        const b64 = res.data?.[0]?.base64
        if (!b64) throw new Error('Gambar kosong')
        await fsp.writeFile(outPath, Buffer.from(b64, 'base64'))
        return
      } catch (err) {
        lastErr = err
        await sleep(1200 * attempt)
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Generator gambar gagal')
}

async function generateNarrationAudio(ctx: PipelineCtx, narration: string, outWav: string, rawPath: string) {
  let lastErr: unknown = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await ctx.zai.audio.tts.create({
        input: narration.slice(0, 1000),
        voice: ctx.voice,
        speed: 1.05,
        response_format: 'wav',
        stream: false,
      })
      const ab = await resp.arrayBuffer()
      if (ab.byteLength < 2000) throw new Error('Audio TTS kosong')
      await fsp.writeFile(rawPath, Buffer.from(new Uint8Array(ab)))
      await padTts(rawPath, outWav)
      return
    } catch (err) {
      lastErr = err
      await sleep(1000 * attempt)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('TTS gagal')
}

/** Proses satu scene: visual (klip video AI / gambar bergerak) + audio + mux. */
async function processScene(ctx: PipelineCtx, scene: SceneState, agentId: number) {
  const { dir, dim } = ctx
  const overlayLines = wrapOverlay(scene.overlay, 20, 2)
  const srcPath = path.join(dir, `scene-${scene.idx}-src.mp4`)
  const imgPath = path.join(dir, `scene-${scene.idx}.png`)
  const clipPath = path.join(dir, `scene-${scene.idx}.mp4`)
  const wavPath = path.join(dir, `scene-${scene.idx}.wav`)
  const ttsRawPath = path.join(dir, `scene-${scene.idx}-tts-raw.wav`)
  const finalPath = path.join(dir, `scene-${scene.idx}-final.mp4`)
  const thumbPath = path.join(dir, `scene-${scene.idx}.jpg`)
  const fullPrompt = `${scene.visual}. ${ctx.stylePrompt}. No text, no watermark, high quality, detailed.`

  try {
    let visualDone = false

    // Jalur 1 (mode sinematik): generator klip video AI, tiap klip <= 10 detik.
    // Gateway hanya mengizinkan 1 task video bersamaan -> pakai slot + backoff.
    if (ctx.renderMode === 'cinematic' && !ctx.videoBroken) {
      visualDone = await ctx.withVideoSlot(async () => {
        const sizeCandidates: Array<string | undefined> = [ctx.videoSize, undefined]
        let lastVideoErr = 'tidak diketahui'
        for (let attempt = 0; attempt < sizeCandidates.length; attempt++) {
          try {
            const taskId = await createVideoTask(ctx, fullPrompt, sizeCandidates[attempt])
            const url = await pollVideoResult(ctx, taskId, 6 * 60_000)
            await downloadTo(url, srcPath)
            await normalizeVideoClip({
              srcPath,
              outPath: clipPath,
              dim,
              overlayLines,
              dir,
              sceneIdx: scene.idx,
            })
            scene.asset = 'video'
            return true
          } catch (err) {
            lastVideoErr = err instanceof Error ? err.message.slice(0, 160) : 'tidak diketahui'
            const rateLimited = lastVideoErr.includes('429') || lastVideoErr.toLowerCase().includes('too many')
            if (attempt < sizeCandidates.length - 1) {
              await sleep(rateLimited ? 120000 : 8000)
            }
          }
        }
        ctx.videoFailures += 1
        if (ctx.videoFailures >= 4) ctx.videoBroken = true
        scene.error = `klip video gagal (${lastVideoErr}) - fallback gambar`
        return false
      })
    }

    // Jalur 2 (mode cepat / fallback): gambar AI + gerakan kamera Ken Burns.
    if (!visualDone) {
      try {
        await generateSceneImage(ctx, fullPrompt, imgPath)
        await imageToClip({
          imgPath,
          outPath: clipPath,
          dim,
          overlayLines,
          dir,
          sceneIdx: scene.idx,
          zoomIn: scene.idx % 2 === 1,
        })
        scene.asset = 'image'
      } catch {
        // Jalur 3: latar gradient brand + caption (jaminan scene tetap jadi).
        await gradientToClip({ outPath: clipPath, dim, overlayLines, dir, sceneIdx: scene.idx })
        scene.asset = 'fallback'
      }
    }

    // Audio: narasi TTS atau diam.
    try {
      if (ctx.voice !== 'off' && scene.narration) {
        await generateNarrationAudio(ctx, scene.narration, wavPath, ttsRawPath)
      } else {
        await makeSilence(wavPath)
      }
    } catch {
      await makeSilence(wavPath)
    }

    await muxAudio(clipPath, wavPath, finalPath)
    try {
      await extractThumb(finalPath, thumbPath)
    } catch {
      // thumbnail boleh gagal, tidak fatal
    }
    scene.status = 'done'
    scene.agent = agentId
  } catch (err) {
    scene.status = 'error'
    scene.agent = agentId
    scene.error = err instanceof Error ? err.message.slice(0, 300) : 'Gagal memproses scene'
  }
}

export async function runVideoPipeline(id: string) {
  const project = await db.videoProject.findUnique({ where: { id } })
  if (!project) return

  try {
    // ===== Tahap 0: RISET WEB (khusus Short, opsional) =====
    let researchDigest: string | undefined
    if (project.format === 'short' && project.researchEnabled) {
      await db.videoProject.update({
        where: { id },
        data: {
          status: 'planning',
          stageDetail: 'Mencari referensi nyata di web (YouTube, Google, Bing, DuckDuckGo, Yandex)...',
          progress: 1,
        },
      })
      try {
        const research = await researchTopic(project.topic)
        researchDigest = research.digest || undefined
        await db.videoProject.update({
          where: { id },
          data: { research: JSON.stringify({ engines: research.engines, hits: research.hits }) },
        })
      } catch (err) {
        log.warn({ err: err instanceof Error ? err.message.slice(0, 120) : 'unknown' }, 'riset web gagal, lanjut tanpa riset')
      }
    }

    // ===== Tahap 1: PLANNING (storyboard) =====
    await db.videoProject.update({
      where: { id },
      data: {
        status: 'planning',
        stageDetail: researchDigest ? 'Menyusun storyboard berbasis hasil riset...' : 'Menyusun storyboard dengan AI...',
        error: null,
        progress: 2,
      },
    })

    const zai = await getZAI()
    const format = project.format === 'long' ? 'long' : 'short'
    const maxScenes = format === 'short' ? SHORT_SCENES : LONG_SCENES
    const sceneCount = Math.max(3, Math.min(project.targetScenes || maxScenes, maxScenes))
    const style = getStyleById(project.style)

    let sb: Storyboard | null = null
    let plannerErr: unknown = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await chatComplete(
          buildPlannerMessages(project.topic, format, style.label, style.prompt, sceneCount, researchDigest),
        )
        sb = parseStoryboard(raw, sceneCount)
        break
      } catch (err) {
        plannerErr = err
        await sleep(1500)
      }
    }
    if (!sb) {
      throw plannerErr instanceof Error ? plannerErr : new Error('Storyboard gagal dibuat')
    }

    const scenes: SceneState[] = sb.scenes.map((s, i) => ({
      idx: i + 1,
      narration: s.narration,
      visual: s.visual,
      overlay: s.overlay,
      status: 'pending',
      agent: null,
      asset: null,
    }))

    await db.videoProject.update({
      where: { id },
      data: {
        title: sb.title,
        description: sb.description,
        scenes: JSON.stringify(scenes),
        scenesTotal: scenes.length,
        scenesDone: 0,
        status: 'building',
        stageDetail: `${scenes.length} scene x ${SCENE_SEC} dtk`,
        progress: 3,
      },
    })

    // ===== Tahap 2: BUILDING (5 agent paralel) =====
    const dir = projectDir(id)
    await ensureDir(dir)
    const dim = getDim(project.aspect, format)
    const aspectKey = (project.aspect in DIMS ? project.aspect : (format === 'long' ? '16:9' : '9:16')) as keyof typeof DIMS
    const ctx: PipelineCtx = {
      id,
      dir,
      dim,
      portrait: dim.h > dim.w,
      videoSize: VIDEO_SIZE[aspectKey],
      imageSize: IMG_SIZE[aspectKey],
      renderMode: project.renderMode === 'fast' ? 'fast' : 'cinematic',
      voice: project.voice || 'off',
      stylePrompt: style.prompt,
      zai,
      withVideoSlot: createSemaphore(VIDEO_SLOTS),
      videoFailures: 0,
      videoBroken: false,
    }

    const persist = async () => {
      const done = scenes.filter((s) => s.status === 'done').length
      const settled = scenes.filter((s) => s.status === 'done' || s.status === 'error').length
      await db.videoProject
        .update({
          where: { id },
          data: {
            scenes: JSON.stringify(scenes),
            scenesDone: done,
            progress: Math.min(95, 5 + Math.round((settled / scenes.length) * 90)),
            stageDetail: `${AGENT_COUNT} agent paralel merender scene`,
          },
        })
        .catch(() => {})
    }

    const worker = async (agentId: number) => {
      for (;;) {
        // Klaim scene secara sinkron (aman: JS single-threaded, tanpa await di antara).
        const scene = scenes.find((s) => s.status === 'pending')
        if (!scene) return
        scene.status = 'processing'
        scene.agent = agentId
        await persist()
        await processScene(ctx, scene, agentId)
        await persist()
      }
    }

    await Promise.all(Array.from({ length: AGENT_COUNT }, (_, i) => worker(i + 1)))

    const doneCount = scenes.filter((s) => s.status === 'done').length
    if (doneCount === 0) {
      throw new Error('Semua scene gagal diproses. Coba lagi atau ganti topik/mode render.')
    }

    // ===== Tahap 3: STITCHING =====
    await db.videoProject.update({
      where: { id },
      data: {
        status: 'stitching',
        stageDetail: `Merakit ${doneCount} scene menjadi video final...`,
        progress: 96,
        scenes: JSON.stringify(scenes),
      },
    })

    const orderedClips = scenes
      .filter((s) => s.status === 'done')
      .sort((a, b) => a.idx - b.idx)
      .map((s) => path.join(dir, `scene-${s.idx}-final.mp4`))

    const finalPath = path.join(dir, 'final.mp4')
    await concatScenes(orderedClips, finalPath, path.join(dir, 'list.txt'))
    const duration = await probeDuration(finalPath)
    const bytes = (await fsp.stat(finalPath)).size

    await db.videoProject.update({
      where: { id },
      data: {
        status: 'done',
        progress: 100,
        stageDetail: 'Video siap ditonton',
        durationSec: Math.round(duration),
        filePath: finalPath,
        fileBytes: bytes,
        scenes: JSON.stringify(scenes),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Kesalahan tidak diketahui'
    log.error({ id, err: msg.slice(0, 200) }, 'pipeline video gagal')
    await db.videoProject
      .update({ where: { id }, data: { status: 'error', error: msg.slice(0, 500) } })
      .catch(() => {})
    throw err
  }
}

/** Hapus direktori media sebuah project. */
export async function removeMediaDir(id: string) {
  await fsp.rm(projectDir(id), { recursive: true, force: true }).catch(() => {})
}

// pastikan `run` tetap terpakai bila dibutuhkan ekspansi berikutnya
void run
