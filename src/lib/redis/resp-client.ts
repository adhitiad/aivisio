import net, { type Socket } from 'node:net'
import tls, { type TLSSocket } from 'node:tls'

export type RespValue = string | number | null | RespValue[]
type ParsedFrame = { value: RespValue | Error; next: number }

export function parseRespFrame(buffer: Buffer, offset = 0): ParsedFrame | null {
  if (offset >= buffer.length) return null
  const marker = String.fromCharCode(buffer[offset])
  const lineEnd = buffer.indexOf('\r\n', offset)
  if (lineEnd < 0) return null
  const line = buffer.toString('utf8', offset + 1, lineEnd)
  if (marker === '+') return { value: line, next: lineEnd + 2 }
  if (marker === '-') return { value: new Error(line), next: lineEnd + 2 }
  if (marker === ':') {
    const value = Number(line)
    if (!Number.isFinite(value)) throw new Error('RESP integer tidak valid.')
    return { value, next: lineEnd + 2 }
  }
  if (marker === '$') {
    const length = Number(line)
    if (!Number.isInteger(length) || length < -1) throw new Error('RESP bulk length tidak valid.')
    if (length === -1) return { value: null, next: lineEnd + 2 }
    const end = lineEnd + 2 + length
    if (buffer.length < end + 2) return null
    if (buffer[end] !== 13 || buffer[end + 1] !== 10) throw new Error('RESP bulk terminator tidak valid.')
    return { value: buffer.toString('utf8', lineEnd + 2, end), next: end + 2 }
  }
  if (marker === '*') {
    const count = Number(line)
    if (!Number.isInteger(count) || count < -1) throw new Error('RESP array length tidak valid.')
    if (count === -1) return { value: null, next: lineEnd + 2 }
    const values: RespValue[] = []
    let cursor = lineEnd + 2
    for (let index = 0; index < count; index++) {
      const child = parseRespFrame(buffer, cursor)
      if (!child) return null
      if (child.value instanceof Error) throw child.value
      values.push(child.value)
      cursor = child.next
    }
    return { value: values, next: cursor }
  }
  throw new Error('RESP marker tidak didukung: ' + marker)
}

function encodeCommand(args: string[]): Buffer {
  const chunks = ['*' + args.length + '\r\n']
  for (const arg of args) chunks.push('$' + Buffer.byteLength(arg) + '\r\n' + arg + '\r\n')
  return Buffer.from(chunks.join(''), 'utf8')
}

type Pending = { resolve: (value: RespValue) => void; reject: (error: Error) => void }

export class RedisRespClient {
  private socket: Socket | TLSSocket | null = null
  private pending: Pending[] = []
  private buffer = Buffer.alloc(0)
  private connecting: Promise<void> | null = null
  private closed = false

  constructor(private readonly url: URL) {}

  private async ensureConnected(): Promise<void> {
    if (this.closed) throw new Error('Redis client sudah ditutup.')
    if (this.socket && !this.socket.destroyed && !this.socket.connecting) return
    if (this.connecting) return this.connecting
    this.connecting = new Promise<void>((resolve, reject) => {
      const host = this.url.hostname
      const port = Number(this.url.port || (this.url.protocol === 'rediss:' ? 6380 : 6379))
      const secure = this.url.protocol === 'rediss:'
      const socket = secure
        ? tls.connect({ host, port, servername: host })
        : net.createConnection({ host, port })
      this.socket = socket
      this.buffer = Buffer.alloc(0)
      let settled = false
      const failConnect = (error: Error) => {
        if (settled) return
        settled = true
        socket.destroy()
        this.socket = null
        reject(error)
      }
      socket.on('data', (chunk: Buffer) => this.consume(chunk))
      socket.on('error', (error) => {
        this.rejectPending(error)
        if (this.socket === socket) this.socket = null
      })
      socket.on('close', () => {
        if (this.socket === socket) this.socket = null
        this.rejectPending(new Error('Koneksi Redis terputus.'))
      })
      socket.setTimeout(45_000, () => socket.destroy(new Error('Redis socket timeout.')))
      const onReady = () => {
        if (settled) return
        settled = true
        void (async () => {
          const username = decodeURIComponent(this.url.username || '')
          const password = decodeURIComponent(this.url.password || '')
          if (password) {
            if (username) await this.sendRaw(['AUTH', username, password])
            else await this.sendRaw(['AUTH', password])
          }
          const dbIndex = this.url.pathname.replace(/^\//, '')
          if (dbIndex && dbIndex !== '0') {
            if (!/^\d+$/.test(dbIndex)) throw new Error('Redis database index tidak valid.')
            await this.sendRaw(['SELECT', dbIndex])
          }
        })().then(resolve).catch((error: unknown) => {
          socket.destroy()
          reject(error instanceof Error ? error : new Error('Redis authentication failed.'))
        })
      }
      if (secure) socket.once('secureConnect', onReady)
      else socket.once('connect', onReady)
      socket.once('error', failConnect)
    })
    try {
      await this.connecting
    } finally {
      this.connecting = null
    }
  }

  private consume(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    for (;;) {
      let frame: ParsedFrame | null
      try {
        frame = parseRespFrame(this.buffer)
      } catch (error) {
        this.rejectPending(error instanceof Error ? error : new Error('RESP decode failed.'))
        this.socket?.destroy()
        return
      }
      if (!frame) return
      this.buffer = this.buffer.subarray(frame.next)
      const pending = this.pending.shift()
      if (!pending) continue
      if (frame.value instanceof Error) pending.reject(frame.value)
      else pending.resolve(frame.value)
    }
  }

  private rejectPending(error: Error): void {
    const pending = this.pending.splice(0)
    for (const item of pending) item.reject(error)
  }

  private sendRaw(args: string[]): Promise<RespValue> {
    const socket = this.socket
    if (!socket || socket.destroyed) return Promise.reject(new Error('Redis socket belum terhubung.'))
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject })
      socket.write(encodeCommand(args), (error) => {
        if (!error) return
        const index = this.pending.findIndex((item) => item.resolve === resolve)
        if (index >= 0) this.pending.splice(index, 1)
        reject(error)
      })
    })
  }

  async command(...args: string[]): Promise<RespValue> {
    await this.ensureConnected()
    return this.sendRaw(args)
  }

  async close(): Promise<void> {
    this.closed = true
    this.rejectPending(new Error('Redis client ditutup.'))
    this.socket?.end()
    this.socket = null
  }
}

export function redisConnectionUrl(): URL {
  const provider = (process.env.REDIS_PROVIDER || 'local').toLowerCase()
  if (!['local', 'upstash', 'redis-cloud'].includes(provider)) {
    throw new Error('REDIS_PROVIDER harus local, upstash, atau redis-cloud.')
  }
  const value = provider === 'upstash'
    ? process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL
    : provider === 'redis-cloud'
      ? process.env.REDIS_CLOUD_URL || process.env.REDIS_URL
      : process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  if (!value) throw new Error('Redis URL belum dikonfigurasi untuk provider ' + provider + '.')
  const url = new URL(value)
  if (!['redis:', 'rediss:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Redis URL harus menggunakan redis:// atau rediss://.')
  }
  if (url.search || url.hash) throw new Error('Redis URL tidak boleh memiliki query atau fragment.')
  return url
}
