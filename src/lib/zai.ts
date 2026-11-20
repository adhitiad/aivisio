import ZAI from 'z-ai-web-dev-sdk'

const globalForZAI = globalThis as unknown as {
  zai: Awaited<ReturnType<typeof ZAI.create>> | undefined
}

/** Singleton klien Z.AI untuk dipakai di server (planner, TTS, gambar, video). */
export async function getZAI() {
  if (!globalForZAI.zai) {
    globalForZAI.zai = await ZAI.create()
  }
  return globalForZAI.zai
}
