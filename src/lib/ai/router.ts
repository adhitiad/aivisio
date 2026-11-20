import { db } from '@/lib/db'
import { getZAI } from '@/lib/zai'
import { getPreset } from './providers'
import { moduleLogger } from '@/lib/logger'

const log = moduleLogger('ai-router')

export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string }

type ProviderRow = {
  key: string
  label: string
  baseUrl: string
  apiKey: string
  model: string
  extraHeaderName?: string
}

async function getActiveProvider(): Promise<ProviderRow> {
  const row = await db.aiProvider.findFirst({ where: { active: true, enabled: true } })
  if (!row) return { key: 'zai-bawaan', label: 'Z.AI Bawaan', baseUrl: '', apiKey: '', model: '' }
  const preset = getPreset(row.key)
  return {
    key: row.key,
    label: row.label,
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    model: row.model,
    extraHeaderName: preset?.extraHeaderName,
  }
}

/** Chat lewat endpoint OpenAI-compatible apa pun. */
async function chatViaProvider(provider: ProviderRow, messages: ChatMsg[], timeoutMs: number): Promise<string> {
  if (!provider.baseUrl) {
    throw new Error(`Base URL penyedia "${provider.label}" belum diisi. Buka Pengaturan API AI.`)
  }
  if (!provider.model) {
    throw new Error(`Nama model untuk "${provider.label}" belum diisi. Buka Pengaturan API AI.`)
  }
  const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
    if (provider.extraHeaderName) {
      headers[provider.extraHeaderName] = provider.apiKey
    }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: provider.model, messages, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 300)
    throw new Error(`HTTP ${res.status} dari ${provider.label}: ${body}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }
  const content = data.choices?.[0]?.message?.content
  if (!content || !content.trim()) {
    throw new Error(`Respons kosong dari ${provider.label}${data.error?.message ? `: ${data.error.message}` : ''}`)
  }
  return content
}

/**
 * Pintu masuk tunggal untuk generasi TEKS di seluruh aplikasi
 * (tool AI, storyboard video, ringkasan riset).
 * Teks mengikuti provider aktif pilihan user; visual/video/suara tetap
 * memakai engine bawaan gateway.
 */
export async function chatComplete(messages: ChatMsg[], opts?: { timeoutMs?: number }): Promise<string> {
  const provider = await getActiveProvider()
  const timeoutMs = opts?.timeoutMs ?? 180_000
  const t0 = Date.now()
  try {
    let content: string
    if (provider.key === 'zai-bawaan' || !provider.baseUrl) {
      const zai = await getZAI()
      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      })
      content = completion.choices[0]?.message?.content ?? ''
      if (!content.trim()) throw new Error('Respons AI kosong')
    } else {
      content = await chatViaProvider(provider, messages, timeoutMs)
    }
    log.info(
      { provider: provider.key, latencyMs: Date.now() - t0, chars: content.length },
      'chat selesai',
    )
    return content
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error({ provider: provider.key, latencyMs: Date.now() - t0, err: msg.slice(0, 200) }, 'chat gagal')
    throw err instanceof Error ? err : new Error(msg)
  }
}

/** Uji koneksi sebuah provider: chat ping kecil, ukur latensi. */
export async function testProvider(row: {
  key: string
  baseUrl: string
  apiKey: string
  model: string
}): Promise<{ ok: boolean; latencyMs: number; sample?: string; error?: string }> {
  const t0 = Date.now()
  const preset = getPreset(row.key)
  const provider: ProviderRow = {
    key: row.key,
    label: preset?.label ?? row.key,
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    model: row.model,
    extraHeaderName: preset?.extraHeaderName,
  }
  try {
    let sample: string
    if (provider.key === 'zai-bawaan' || !provider.baseUrl) {
      const zai = await getZAI()
      const completion = await zai.chat.completions.create({
        messages: [{ role: 'user', content: 'Balas HANYA satu kata: OK' }],
        thinking: { type: 'disabled' },
      })
      sample = (completion.choices[0]?.message?.content ?? '').trim().slice(0, 40)
      if (!sample) throw new Error('Respons kosong dari gateway')
    } else {
      sample = await chatViaProvider(
        provider,
        [{ role: 'user', content: 'Balas HANYA satu kata: OK' }],
        20_000,
      )
      sample = sample.trim().slice(0, 40)
    }
    return { ok: true, latencyMs: Date.now() - t0, sample }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, latencyMs: Date.now() - t0, error: msg.slice(0, 300) }
  }
}
