import { getZAI } from '@/lib/zai'
import { moduleLogger } from '@/lib/logger'

/**
 * Riset web untuk menahan halusinasi (terutama video Short).
 * Tiap engine dicoba dengan parser nyata; engine yang gagal diblokir/tidak
 * tersedia dilaporkan JUJUR di hasil — tidak pernah ada hasil palsu.
 */

const log = moduleLogger('video-research')
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export type SearchHit = { title: string; url: string; snippet: string; engine: string }

export type EngineReport = {
  engine: string
  label: string
  ok: boolean
  count: number
  error?: string
  latencyMs: number
}

export type ResearchResult = {
  engines: EngineReport[]
  hits: SearchHit[]
  digest: string
}

async function fetchHtml(url: string, timeoutMs = 12_000): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.6' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  if (html.length < 2000) throw new Error('Respons terlalu pendek (kemungkinan diblokir)')
  return html
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => {
      try {
        return String.fromCodePoint(parseInt(d, 10))
      } catch {
        return ''
      }
    })
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

async function searchYouTube(query: string): Promise<SearchHit[]> {
  const html = await fetchHtml(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=id`,
  )
  const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});<\/script>/s)
    || html.match(/var ytInitialData\s*=\s*(\{.+?\});/s)
  if (!m) throw new Error('Data halaman YouTube tidak ditemukan')
  const data = JSON.parse(m[1]) as unknown
  const hits: SearchHit[] = []

  const walk = (node: unknown, depth = 0) => {
    if (depth > 30 || hits.length >= 10 || node == null) return
    if (Array.isArray(node)) {
      for (const child of node) walk(child, depth + 1)
      return
    }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>
      const vr = obj.videoRenderer as Record<string, unknown> | undefined
      if (vr && typeof vr.videoId === 'string') {
        try {
          const title =
            ((vr.title as { runs?: Array<{ text?: string }> })?.runs?.[0]?.text as string) || ''
          const channel =
            ((vr.ownerText as { runs?: Array<{ text?: string }> })?.runs?.[0]?.text as string) ||
            ((vr.longBylineText as { runs?: Array<{ text?: string }> })?.runs?.[0]?.text as string) ||
            ''
          const snippet =
            ((vr.detailedMetadataSnippets as Array<{
              snippetText?: { runs?: Array<{ text?: string }> }
            }>)?.[0]?.snippetText?.runs?.[0]?.text as string) || ''
          const views =
            ((vr.viewCountText as { simpleText?: string })?.simpleText as string) || ''
          const published =
            ((vr.publishedTimeText as { simpleText?: string })?.simpleText as string) || ''
          if (title) {
            const parts = [channel, views, published].filter(Boolean).join(' - ')
            hits.push({
              title: title.slice(0, 140),
              url: `https://www.youtube.com/watch?v=${vr.videoId}`,
              snippet: (snippet || parts).slice(0, 220),
              engine: 'youtube',
            })
          }
        } catch {
          // lewati renderer rusak
        }
      }
      for (const key of Object.keys(obj)) walk(obj[key], depth + 1)
    }
  }
  walk(data)
  if (hits.length === 0) throw new Error('Tidak ada video terbaca dari halaman')
  return hits
}

async function searchBing(query: string): Promise<SearchHit[]> {
  const html = await fetchHtml(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=id&count=12`,
  )
  const blocks = html.match(/<li class="b_algo"[\s\S]*?<\/li>/g) || []
  const hits: SearchHit[] = []
  for (const block of blocks) {
    const a = block.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!a) continue
    const url = decodeEntities(a[1])
    if (!/^https?:\/\//.test(url) || url.includes('bing.com')) continue
    const snippet = block.match(/<p[^>]*>([\s\S]*?)<\/p>/)
    hits.push({
      title: stripTags(a[2]).slice(0, 140),
      url,
      snippet: snippet ? stripTags(snippet[1]).slice(0, 220) : '',
      engine: 'bing',
    })
    if (hits.length >= 8) break
  }
  if (hits.length === 0) throw new Error('Halaman tanpa hasil terbaca (butuh JS / format berubah)')
  return hits
}

async function searchGoogle(query: string): Promise<SearchHit[]> {
  const html = await fetchHtml(
    `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=id&num=12`,
  )
  if (/unusual traffic|detected unusual/i.test(html)) throw new Error('Kena proteksi anti-bot')
  const hits: SearchHit[] = []
  // Pola lama /url?q= dan pola baru anchor langsung berikut <h3>
  const re = /<a[^>]+href="\/url\?q=([^&"]+)[^"]*"[^>]*>[\s\S]{0,200}?<h3[^>]*>([\s\S]*?)<\/h3>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && hits.length < 8) {
    const url = decodeEntities(m[1])
    if (!/^https?:\/\//.test(url) || url.includes('google.')) continue
    hits.push({
      title: stripTags(m[2]).slice(0, 140),
      url,
      snippet: '',
      engine: 'google',
    })
  }
  if (hits.length === 0) {
    // Fallback pola baru: anchor http langsung + h3
    const re2 = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/g
    let m2: RegExpExecArray | null
    while ((m2 = re2.exec(html)) && hits.length < 8) {
      const url = decodeEntities(m2[1])
      if (url.includes('google.') || url.includes('youtube.com/about')) continue
      hits.push({ title: stripTags(m2[2]).slice(0, 140), url, snippet: '', engine: 'google' })
    }
  }
  if (hits.length === 0) throw new Error('Halaman tanpa hasil terbaca (butuh JS / format berubah)')
  return hits
}

async function searchDuckDuckGo(query: string): Promise<SearchHit[]> {
  const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`)
  const hits: SearchHit[] = []
  const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && hits.length < 8) {
    let url = decodeEntities(m[1])
    const uddg = url.match(/[?&]uddg=([^&]+)/)
    if (uddg) url = decodeURIComponent(uddg[1])
    if (!/^https?:\/\//.test(url)) continue
    hits.push({ title: stripTags(m[2]).slice(0, 140), url, snippet: '', engine: 'duckduckgo' })
  }
  if (hits.length === 0) throw new Error('Halaman tanpa hasil terbaca')
  return hits
}

async function searchYandex(query: string): Promise<SearchHit[]> {
  const html = await fetchHtml(`https://yandex.com/search/?text=${encodeURIComponent(query)}`)
  if (/captcha|SmartCaptcha/i.test(html)) throw new Error('Kena captcha Yandex')
  const hits: SearchHit[] = []
  const re = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="[^"]*organic__url[^"]*"[^>]*>([\s\S]*?)<\/a>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && hits.length < 8) {
    hits.push({ title: stripTags(m[2]).slice(0, 140), url: decodeEntities(m[1]), snippet: '', engine: 'yandex' })
  }
  if (hits.length === 0) throw new Error('Halaman tanpa hasil terbaca / captcha')
  return hits
}

async function searchGatewayIndex(query: string): Promise<SearchHit[]> {
  const zai = await getZAI()
  const res = (await zai.functions.invoke('web_search', {
    query,
    num: 8,
    recency_days: 730,
  })) as Array<{ url: string; name?: string; snippet?: string }>
  const hits = (res || [])
    .filter((r) => r.url)
    .map((r) => ({
      title: (r.name || r.url).slice(0, 140),
      url: r.url,
      snippet: (r.snippet || '').slice(0, 220),
      engine: 'index-web',
    }))
  if (hits.length === 0) throw new Error('Index gateway tidak mengembalikan hasil')
  return hits
}

const ENGINE_TASKS: Array<{ engine: string; label: string; run: (q: string) => Promise<SearchHit[]> }> = [
  { engine: 'youtube', label: 'YouTube', run: searchYouTube },
  { engine: 'google', label: 'Google', run: searchGoogle },
  { engine: 'bing', label: 'Bing', run: searchBing },
  { engine: 'duckduckgo', label: 'DuckDuckGo', run: searchDuckDuckGo },
  { engine: 'yandex', label: 'Yandex', run: searchYandex },
  { engine: 'index-web', label: 'Index Web (gateway)', run: searchGatewayIndex },
]

function dedupe(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>()
  const out: SearchHit[] = []
  for (const h of hits) {
    let norm = h.url
    try {
      const u = new URL(h.url)
      // simpan query (mis. ?v=videoId di YouTube) agar tidak tertukar
      norm = u.host.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + u.search
    } catch {
      // pakai mentah
    }
    if (seen.has(norm)) continue
    seen.add(norm)
    out.push(h)
  }
  return out
}

/** Riset penuh: semua engine paralel, gabungkan hasil nyata, buat digest. */
export async function researchTopic(topic: string): Promise<ResearchResult> {
  const t0 = Date.now()
  const settled = await Promise.all(
    ENGINE_TASKS.map(async (t): Promise<{ report: EngineReport; hits: SearchHit[] }> => {
      const s0 = Date.now()
      try {
        const hits = await t.run(topic)
        return {
          report: { engine: t.engine, label: t.label, ok: true, count: hits.length, latencyMs: Date.now() - s0 },
          hits,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'gagal'
        return {
          report: {
            engine: t.engine,
            label: t.label,
            ok: false,
            count: 0,
            error: msg.slice(0, 120),
            latencyMs: Date.now() - s0,
          },
          hits: [],
        }
      }
    }),
  )

  const reports = settled.map((s) => s.report)
  const unique = dedupe(settled.flatMap((s) => s.hits)).slice(0, 14)

  const digestLines: string[] = []
  const byEngine = new Map<string, SearchHit[]>()
  for (const h of unique) {
    const arr = byEngine.get(h.engine) || []
    arr.push(h)
    byEngine.set(h.engine, arr)
  }
  for (const [engine, arr] of byEngine) {
    digestLines.push(`Sumber ${engine}:`)
    for (const h of arr.slice(0, 4)) {
      digestLines.push(`- ${h.title}${h.snippet ? ` | ${h.snippet}` : ''} (${h.url})`)
    }
  }

  log.info(
    {
      okEngines: reports.filter((r) => r.ok).length,
      totalEngines: reports.length,
      hits: unique.length,
      latencyMs: Date.now() - t0,
    },
    'riset web selesai',
  )

  return { engines: reports, hits: unique, digest: digestLines.join('\n').slice(0, 6000) }
}
