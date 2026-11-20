import { RedisRespClient, redisConnectionUrl, type RespValue } from './resp-client'

const queueKey = process.env.VIDEO_QUEUE_KEY || 'aiviso:video-jobs'
let client: RedisRespClient | null = null

function getClient(): RedisRespClient {
  if (!client) client = new RedisRespClient(redisConnectionUrl())
  return client
}

export async function enqueueVideoJob(projectId: string): Promise<void> {
  if (!/^[0-9a-f-]{20,80}$/i.test(projectId)) throw new Error('Video project id tidak valid untuk queue.')
  await getClient().command('LPUSH', queueKey, projectId)
}

export async function dequeueVideoJob(timeoutSeconds = 2): Promise<string | null> {
  const timeout = Math.max(1, Math.min(10, Math.floor(timeoutSeconds)))
  const response = await getClient().command('BRPOP', queueKey, String(timeout))
  if (!Array.isArray(response)) return null
  const result = response as RespValue[]
  return typeof result[1] === 'string' ? result[1] : null
}

export async function pingRedis(): Promise<boolean> {
  const response = await getClient().command('PING')
  return response === 'PONG'
}

export async function closeRedisClient(): Promise<void> {
  if (!client) return
  const current = client
  client = null
  await current.close()
}
