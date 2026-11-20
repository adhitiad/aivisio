/**
 * Preset penyedia API AI. Semua dipanggil lewat antarmuka OpenAI-compatible
 * (POST {baseUrl}/chat/completions). Base URL & model adalah NILAI AWAL yang
 * bisa diedit user — tidak ada endpoint yang dikarang. Untuk penyedia yang
 * endpoint resminya belum bisa dipastikan (beam, inkling), base URL sengaja
 * dikosongkan dan user wajib mengisi sendiri dari dokumentasi resmi.
 */
export type ProviderPreset = {
  key: string
  label: string
  baseUrl: string
  model: string
  note?: string
  /** Kirim juga header tambahan selain Bearer (mis. x-api-key untuk Anthropic). */
  extraHeaderName?: string
  sortOrder: number
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    key: 'zai-bawaan',
    label: 'Z.AI Bawaan (gateway)',
    baseUrl: '',
    model: 'bawaan gateway',
    note: 'Kredensial dikelola gateway otomatis. Tidak perlu API key — selalu siap dipakai.',
    sortOrder: 1,
  },
  {
    key: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    note: 'Endpoint OpenAI-compatible resmi Google AI. API key dari aistudio.google.com.',
    sortOrder: 2,
  },
  {
    key: 'chatgpt',
    label: 'ChatGPT (OpenAI)',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    note: 'API key dari platform.openai.com.',
    sortOrder: 3,
  },
  {
    key: 'grok',
    label: 'Grok (xAI)',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-3-mini',
    note: 'API key dari console.x.ai.',
    sortOrder: 4,
  },
  {
    key: 'claude',
    label: 'Claude (Anthropic)',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-haiku-latest',
    note: 'Pakai layer OpenAI-compatible resmi Anthropic. API key dari console.anthropic.com.',
    extraHeaderName: 'x-api-key',
    sortOrder: 5,
  },
  {
    key: 'mistral',
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    note: 'API key dari console.mistral.ai.',
    sortOrder: 6,
  },
  {
    key: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    note: 'Gerbang ratusan model sekaligus. API key dari openrouter.ai.',
    sortOrder: 7,
  },
  {
    key: 'ollama',
    label: 'Ollama (lokal)',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.1',
    note: 'Berjalan di komputer Anda sendiri. Jalankan `ollama serve`, lalu isi nama model yang sudah Anda pull.',
    sortOrder: 8,
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    note: 'API key dari platform.deepseek.com.',
    sortOrder: 9,
  },
  {
    key: 'glm',
    label: 'GLM (Zhipu)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    note: 'API key dari open.bigmodel.cn.',
    sortOrder: 10,
  },
  {
    key: 'minimax',
    label: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    model: 'MiniMax-Text-01',
    note: 'Periksa base URL region Anda (domestik/internasional) di dokumen resmi MiniMax.',
    sortOrder: 11,
  },
  {
    key: 'kimi',
    label: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    note: 'API key dari platform.moonshot.cn.',
    sortOrder: 12,
  },
  {
    key: 'qwen',
    label: 'Qwen (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    note: 'Mode kompatibel OpenAI resmi DashScope. API key dari bailian.alibaba.com.',
    sortOrder: 13,
  },
  {
    key: 'longcat',
    label: 'LongCat (Meituan)',
    baseUrl: 'https://api.longcat.chat/openai/v1',
    model: 'LongCat-Flash-Chat',
    note: 'Model LongCat-Flash. Verifikasi base URL terbaru di dokumen resmi LongCat.',
    sortOrder: 14,
  },
  {
    key: 'beam',
    label: 'Beam',
    baseUrl: '',
    model: '',
    note: 'Endpoint resmi belum bisa dipastikan — isi base URL, model, dan API key sendiri dari dokumentasi penyedia.',
    sortOrder: 15,
  },
  {
    key: 'inkling',
    label: 'Inkling',
    baseUrl: '',
    model: '',
    note: 'Endpoint resmi belum bisa dipastikan — isi base URL, model, dan API key sendiri dari dokumentasi penyedia.',
    sortOrder: 16,
  },
  {
    key: 'openai-lainnya',
    label: 'OpenAI-Compatible Lainnya',
    baseUrl: '',
    model: '',
    note: 'Untuk penyedia apa pun yang kompatibel OpenAI dan belum tercantum di daftar.',
    sortOrder: 17,
  },
]

export function getPreset(key: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.key === key)
}
