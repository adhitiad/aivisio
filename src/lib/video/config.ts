import path from 'path'

/** Durasi tiap scene/segmen dalam detik (batas maksimum generator video AI). */
export const SCENE_SEC = 10

/** Jumlah agent paralel yang memproses scene. */
export const AGENT_COUNT = 5

/** Batas durasi video: Short maks 90 detik, Video panjang maks 10:45 (645 dtk). */
export const MAX_SHORT_SEC = 90
export const MAX_LONG_SEC = 645

/** Scene: Short = 9 x 10 dtk = 90 dtk; Long maksimal 64 x 10 dtk = 640 dtk (10:40, di bawah 10:45). */
export const SHORT_SCENES = Math.floor(MAX_SHORT_SEC / SCENE_SEC) // 9
export const LONG_SCENES = Math.floor(MAX_LONG_SEC / SCENE_SEC) // 64

/** Slot paralel untuk API pembuatan video AI (gateway membatasi 1 task bersamaan). */
export const VIDEO_SLOTS = 1

/** Rasio aspek render yang didukung: Short = 1:1 & 9:16; Video panjang = 4:3 & 16:9. */
export const DIMS = {
  '1:1': { w: 1080, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '4:3': { w: 1440, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
} as const

export type Aspect = keyof typeof DIMS

export const ASPECT_OPTIONS: Record<'short' | 'long', Array<{ id: Aspect; label: string }>> = {
  short: [
    { id: '9:16', label: 'Vertikal 9:16 (Shorts/Reels/TikTok)' },
    { id: '1:1', label: 'Kotak 1:1 (feed)' },
  ],
  long: [
    { id: '16:9', label: 'Landscape 16:9 (YouTube)' },
    { id: '4:3', label: 'Klasik 4:3' },
  ],
}

export const DEFAULT_ASPECT: Record<'short' | 'long', Aspect> = {
  short: '9:16',
  long: '16:9',
}

export function isAspectAllowed(aspect: string, format: 'short' | 'long'): boolean {
  return ASPECT_OPTIONS[format].some((a) => a.id === aspect)
}

export function getDim(aspect: string, format: 'short' | 'long'): { w: number; h: number } {
  if ((DIMS as Record<string, unknown>)[aspect]) return DIMS[aspect as Aspect]
  return DIMS[DEFAULT_ASPECT[format]]
}

/** Ukuran gambar yang didukung generator gambar, per rasio. */
export type ImageSize =
  | '1024x1024'
  | '768x1344'
  | '864x1152'
  | '1344x768'
  | '1152x864'
  | '1440x720'
  | '720x1440'

export const IMG_SIZE: Record<Aspect, ImageSize> = {
  '1:1': '1024x1024',
  '9:16': '768x1344',
  '4:3': '1152x864',
  '16:9': '1344x768',
}

/** Ukuran klip video AI (cogvideox), per rasio. Rasio tak didukung otomatis fallback tanpa size. */
export const VIDEO_SIZE: Record<Aspect, string> = {
  '1:1': '1024x1024',
  '9:16': '720x1280',
  '4:3': '1152x864',
  '16:9': '1280x720',
}

export const FONT_PATH = '/usr/share/fonts/truetype/chinese/NotoSansSC-Bold.ttf'
export const WATERMARK = 'aiviso'

export const MEDIA_ROOT = path.join(process.cwd(), 'media', 'videos')

export type VideoFormat = 'short' | 'long'
export type RenderMode = 'cinematic' | 'fast'

export const STYLES: Array<{ id: string; label: string; prompt: string }> = [
  {
    id: 'neon-futuristik',
    label: 'Neon Futuristik',
    prompt: 'futuristic neon cyberpunk aesthetic, glowing cyan and magenta lights, dark moody atmosphere, high contrast, cinematic glow',
  },
  {
    id: 'sinematik-realistis',
    label: 'Sinematik Realistis',
    prompt: 'cinematic realistic photography, dramatic natural lighting, shallow depth of field, 35mm film look, rich color grading',
  },
  {
    id: 'ilustrasi-3d',
    label: 'Ilustrasi 3D',
    prompt: 'polished 3D illustration render, soft studio lighting, vibrant clean colors, smooth surfaces, pixar-like style',
  },
  {
    id: 'anime',
    label: 'Anime',
    prompt: 'modern anime key visual, vibrant colors, dynamic composition, detailed backgrounds, cel shading',
  },
  {
    id: 'dokumenter',
    label: 'Dokumenter',
    prompt: 'documentary photography style, natural light, candid realistic scenes, muted authentic colors',
  },
]

export function getStyleById(id: string): { label: string; prompt: string } {
  const s = STYLES.find((x) => x.id === id) ?? STYLES[0]
  return { label: s.label, prompt: s.prompt }
}

export function projectDir(id: string): string {
  return path.join(MEDIA_ROOT, id)
}

/** Pilihan durasi untuk format panjang (jumlah scene x 10 detik). */
export const LONG_DURATIONS = [
  { scenes: 18, label: '3:00 menit (18 scene)' },
  { scenes: 30, label: '5:00 menit (30 scene)' },
  { scenes: 45, label: '7:30 menit (45 scene)' },
  { scenes: 64, label: '10:40 menit (64 scene)' },
] as const
