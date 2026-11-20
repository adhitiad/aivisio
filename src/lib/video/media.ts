import { execFile } from 'child_process'
import { promisify } from 'util'
import fsp from 'fs/promises'
import path from 'path'
import { FONT_PATH, SCENE_SEC, WATERMARK } from './config'

const execFileAsync = promisify(execFile)

/** Jalankan perintah dengan timeout; lempar error berisi potongan stderr. */
export async function run(cmd: string, args: string[], timeoutMs = 120000): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    })
    return stdout
  } catch (err) {
    const e = err as { stderr?: string; message?: string; killed?: boolean }
    const tail = (e.stderr || e.message || '').split('\n').filter(Boolean).slice(-4).join(' | ')
    throw new Error(`${cmd} gagal${e.killed ? ' (timeout)' : ''}: ${tail.slice(0, 400)}`)
  }
}

export async function ensureDir(dir: string) {
  await fsp.mkdir(dir, { recursive: true })
}

export async function probeDuration(file: string): Promise<number> {
  const out = await run(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    30000,
  )
  const d = parseFloat(out.trim())
  return Number.isFinite(d) ? d : 0
}

export async function fileExists(file: string): Promise<boolean> {
  try {
    const st = await fsp.stat(file)
    return st.size > 0
  } catch {
    return false
  }
}

/** Bungkus teks overlay jadi beberapa baris pendek. */
export function wrapOverlay(text: string, maxChars = 20, maxLines = 2): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxChars) {
      cur = (cur + ' ' + w).trim()
    } else {
      if (cur) lines.push(cur)
      cur = w
      if (lines.length === maxLines) break
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  return lines.slice(0, maxLines)
}

type Dim = { w: number; h: number }

/**
 * Rantai filter drawtext: caption (multi-baris) + watermark brand.
 * Teks ditulis ke file agar aman dari masalah escaping shell.
 */
export async function buildDrawtextChain(
  lines: string[],
  dir: string,
  sceneIdx: number,
  dim: Dim,
): Promise<string> {
  const portrait = dim.h > dim.w
  const fontSize = portrait ? 48 : 44
  const lineH = Math.round(fontSize * 1.5)
  const bottomMargin = portrait ? 320 : 190
  const parts: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const tf = path.join(dir, `ov-${sceneIdx}-${i}.txt`)
    await fsp.writeFile(tf, lines[i], 'utf8')
    const y = bottomMargin + (lines.length - 1 - i) * lineH
    parts.push(
      `drawtext=fontfile=${FONT_PATH}:textfile=${tf}:expansion=none:` +
        `fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black@0.7:` +
        `box=1:boxcolor=black@0.38:boxborderw=14:` +
        `x=(w-text_w)/2:y=h-text_h-${y}`,
    )
  }
  const wtf = path.join(dir, `ov-${sceneIdx}-wm.txt`)
  await fsp.writeFile(wtf, WATERMARK, 'utf8')
  parts.push(
    `drawtext=fontfile=${FONT_PATH}:textfile=${wtf}:expansion=none:` +
      `fontsize=${portrait ? 34 : 30}:fontcolor=white@0.55:x=34:y=h-${portrait ? 96 : 78}`,
  )
  return parts.join(',')
}

const FADE = `fade=t=in:st=0:d=0.4,fade=t=out:st=${SCENE_SEC - 0.7}:d=0.7`

/** Scene clip dari gambar AI (Ken Burns zoom pelan). Output 10 dtk tanpa audio. */
export async function imageToClip(opts: {
  imgPath: string
  outPath: string
  dim: Dim
  overlayLines: string[]
  dir: string
  sceneIdx: number
  zoomIn: boolean
}) {
  const { imgPath, outPath, dim, overlayLines, dir, sceneIdx, zoomIn } = opts
  const chain = [
    `scale=${dim.w}:${dim.h}:force_original_aspect_ratio=increase`,
    `crop=${dim.w}:${dim.h}`,
    zoomIn
      ? `zoompan=z='min(1+0.0012*on,1.30)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${SCENE_SEC * 30}:fps=30:s=${dim.w}x${dim.h}`
      : `zoompan=z='max(1.30-0.0012*on,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${SCENE_SEC * 30}:fps=30:s=${dim.w}x${dim.h}`,
    await buildDrawtextChain(overlayLines, dir, sceneIdx, dim),
    FADE,
    'format=yuv420p',
  ].join(',')
  await run(
    'ffmpeg',
    ['-y', '-i', imgPath, '-vf', chain, '-frames:v', String(SCENE_SEC * 30), '-r', '30', '-t', String(SCENE_SEC), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-an', outPath],
    180000,
  )
}

/** Clip darurat: latar gradient brand + teks, bila generator gambar gagal total. */
export async function gradientToClip(opts: {
  outPath: string
  dim: Dim
  overlayLines: string[]
  dir: string
  sceneIdx: number
}) {
  const { outPath, dim, overlayLines, dir, sceneIdx } = opts
  const source = `gradients=s=${dim.w}x${dim.h}:c0=0x0a0f2e:c1=0x30104a:c2=0x06222e:nb_colors=3:speed=0.02:d=${SCENE_SEC}`
  const chain = [
    await buildDrawtextChain(overlayLines, dir, sceneIdx, dim),
    FADE,
    'format=yuv420p',
  ].join(',')
  await run(
    'ffmpeg',
    ['-y', '-f', 'lavfi', '-i', source, '-vf', chain, '-t', String(SCENE_SEC), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-an', outPath],
    180000,
  )
}

/** Normalisasi klip video AI: crop ke rasio target, fps seragam, tepat 10 dtk, overlay teks. */
export async function normalizeVideoClip(opts: {
  srcPath: string
  outPath: string
  dim: Dim
  overlayLines: string[]
  dir: string
  sceneIdx: number
}) {
  const { srcPath, outPath, dim, overlayLines, dir, sceneIdx } = opts
  const chain = [
    `scale=${dim.w}:${dim.h}:force_original_aspect_ratio=increase`,
    `crop=${dim.w}:${dim.h}`,
    'fps=30',
    `tpad=stop_mode=clone:stop_duration=${SCENE_SEC}`,
    await buildDrawtextChain(overlayLines, dir, sceneIdx, dim),
    FADE,
    'format=yuv420p',
  ].join(',')
  await run(
    'ffmpeg',
    ['-y', '-i', srcPath, '-vf', chain, '-t', String(SCENE_SEC), '-frames:v', String(SCENE_SEC * 30), '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-an', outPath],
    240000,
  )
}

/** Thumbnail kecil untuk UI. */
export async function extractThumb(videoPath: string, outJpg: string) {
  await run(
    'ffmpeg',
    ['-y', '-ss', '2', '-i', videoPath, '-frames:v', '1', '-vf', 'scale=270:-2', outJpg],
    60000,
  )
}

/** Samakan durasi TTS ke tepat 10 detik (pad diam / percepat bila kepanjangan / fade out). */
export async function padTts(ttsPath: string, outWav: string) {
  const dur = await probeDuration(ttsPath)
  let af = 'apad,atrim=0:10,afade=t=out:st=9.4:d=0.6'
  if (dur > 9.4) {
    const tempo = Math.min(1.3, Math.max(1.0, dur / 9.2))
    af = `atempo=${tempo.toFixed(3)},apad,atrim=0:10,afade=t=out:st=9.4:d=0.6`
  }
  await run(
    'ffmpeg',
    ['-y', '-i', ttsPath, '-af', af, '-ar', '44100', '-ac', '2', '-t', String(SCENE_SEC), '-c:a', 'pcm_s16le', outWav],
    60000,
  )
}

/** Audio diam 10 detik (scene tanpa narasi). */
export async function makeSilence(outWav: string) {
  await run(
    'ffmpeg',
    ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', String(SCENE_SEC), '-c:a', 'pcm_s16le', outWav],
    30000,
  )
}

/** Gabungkan video + audio narasi jadi scene clip final (codec seragam). */
export async function muxAudio(videoPath: string, wavPath: string, outPath: string) {
  await run(
    'ffmpeg',
    ['-y', '-i', videoPath, '-i', wavPath, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2', '-t', String(SCENE_SEC), '-movflags', '+faststart', outPath],
    120000,
  )
}

/** Gabungkan semua scene clip menjadi video final. */
export async function concatScenes(clips: string[], outPath: string, listPath: string) {
  const listContent = clips.map((c) => `file '${c}'`).join('\n') + '\n'
  await fsp.writeFile(listPath, listContent, 'utf8')
  try {
    await run(
      'ffmpeg',
      ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', outPath],
      600000,
    )
  } catch {
    // Fallback: re-encode bila param codec tidak identik
    await run(
      'ffmpeg',
      ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', outPath],
      1500000,
    )
  }
}
