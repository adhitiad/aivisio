import { getToolById } from './tools'

const FORMAT_RULES = `
ATURAN OUTPUT (WAJIB):
1. Jawab sepenuhnya dalam Bahasa Indonesia yang natural dan mudah dibaca kreator Indonesia.
2. Gunakan format Markdown: heading (##, ###), poin bernomor, teks tebal untuk istilah kunci, dan tabel Markdown jika sedang membandingkan atau mengurutkan sesuatu.
3. Mulai dengan paragraf pembuka 2-3 kalimat yang merangkum kesimpulan atau rekomendasi utama JANGAN mulai dengan heading.
4. Berikan angka konkret (durasi, jumlah, persentase, contoh judul, contoh kalimat), bukan saran generik. Jangan memberi saran kosong seperti "konsisten upload" tanpa penjelasan cara.
5. Seluruh rekomendasi WAJIB disesuaikan dengan konteks pengguna di bawah ini, bukan jawaban template.
6. Hindari basa-basi dan pengulangan. Setiap bagian harus berisi informasi baru yang bisa langsung dieksekusi.
7. Akhiri jawaban dengan bagian "## Langkah Pertama Minggu Ini" berupa checklist Markdown (- [ ]) berisi 5-7 aksi konkret yang bisa dikerjakan minggu ini.
8. Jangan menyebutkan bahwa Anda adalah model AI, dan jangan menanyakan balik kepada pengguna; buat asumsi wajar bila data kurang dan sebutkan asumsi tersebut secara singkat.
`

export function buildMessages(toolId: string, inputs: Record<string, string>) {
  const tool = getToolById(toolId)
  if (!tool) throw new Error(`Tool tidak dikenali: ${toolId}`)

  const system = `${tool.originalPrompt}\n${FORMAT_RULES}`

  const contextLines = tool.fields
    .map((f) => {
      const value = (inputs[f.id] ?? '').trim()
      if (!value) return null
      return `- ${f.label}: ${value}`
    })
    .filter(Boolean)
    .join('\n')

  const user = `== KONTEKS SAYA ==\n${contextLines || '(pengguna tidak mengisi detail tambahan, gunakan asumsi wajar untuk kreator YouTube pemula di Indonesia)'}\n\nBerdasarkan konteks di atas, kerjakan tugas Anda sekarang dan hasilkan output lengkap sesuai aturan.`

  return [
    { role: 'assistant' as const, content: system },
    { role: 'user' as const, content: user },
  ]
}

export function buildTitle(toolId: string, inputs: Record<string, string>): string {
  const tool = getToolById(toolId)
  if (!tool) return 'Hasil AI'
  const primaryField = tool.fields.find((f) => f.required) ?? tool.fields[0]
  const raw = (inputs[primaryField.id] ?? '').trim()
  const fallback = `${tool.name} - ${new Date().toLocaleDateString('id-ID')}`
  if (!raw) return fallback
  const short = raw.length > 72 ? `${raw.slice(0, 72)}...` : raw
  return short
}
