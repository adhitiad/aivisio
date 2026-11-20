import { createHash, createHmac } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'

type StorageConfig = {
  endpoint: URL
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

export type StoredObject = { size: number; sha256: string }
export type ObjectHead = { size: number; sha256: string | null }

const EMPTY_SHA256 = createHash('sha256').update('').digest('hex')

export function isNeonStorageConfigured(): boolean {
  return Boolean(
    (process.env.AWS_ENDPOINT_URL_S3 || process.env.NEON_STORAGE_ENDPOINT) &&
    process.env.NEON_STORAGE_BUCKET &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY,
  )
}

function getConfig(): StorageConfig {
  const endpointValue = process.env.AWS_ENDPOINT_URL_S3 || process.env.NEON_STORAGE_ENDPOINT
  const bucket = process.env.NEON_STORAGE_BUCKET?.trim()
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  if (!endpointValue || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Neon Object Storage belum dikonfigurasi. Isi AWS_ENDPOINT_URL_S3, NEON_STORAGE_BUCKET, AWS_ACCESS_KEY_ID, dan AWS_SECRET_ACCESS_KEY.')
  }
  const endpoint = new URL(endpointValue)
  if (endpoint.protocol !== 'https:') throw new Error('Endpoint Neon Object Storage harus menggunakan HTTPS.')
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('Endpoint Object Storage tidak boleh mengandung kredensial, query, atau fragment.')
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error('Nama bucket Object Storage tidak valid.')
  }
  return {
    endpoint,
    bucket,
    region: process.env.AWS_REGION || process.env.NEON_STORAGE_REGION || 'us-east-1',
    accessKeyId,
    secretAccessKey,
  }
}

function validateObjectKey(key: string): string {
  const value = key.trim()
  if (
    !value ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.split('/').some((part) => !part || part === '.' || part === '..') ||
    value.length > 900
  ) {
    throw new Error('Object key tidak valid.')
  }
  return value
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    '%' + char.charCodeAt(0).toString(16).toUpperCase(),
  )
}

function createObjectUrl(config: StorageConfig, key: string): URL {
  const prefix = config.endpoint.pathname.replace(/\/+$/, '')
  const encodedKey = validateObjectKey(key).split('/').map(awsEncode).join('/')
  const pathname = prefix + '/' + awsEncode(config.bucket) + '/' + encodedKey
  const url = new URL(config.endpoint.origin)
  url.pathname = pathname
  return url
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest()
}

function signRequest(
  config: StorageConfig,
  method: string,
  key: string,
  payloadHash: string,
  metadataSha256?: string,
): { url: URL; headers: Record<string, string> } {
  const url = createObjectUrl(config, key)
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const shortDate = amzDate.slice(0, 8)
  const canonicalHeaders: Record<string, string> = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  if (metadataSha256) canonicalHeaders['x-amz-meta-sha256'] = metadataSha256
  const headerNames = Object.keys(canonicalHeaders).sort()
  const canonicalHeaderText = headerNames
    .map((name) => name + ':' + canonicalHeaders[name].trim() + '\n')
    .join('')
  const signedHeaders = headerNames.join(';')
  const canonicalRequest = [
    method,
    url.pathname,
    '',
    canonicalHeaderText,
    signedHeaders,
    payloadHash,
  ].join('\n')
  const scope = shortDate + '/' + config.region + '/s3/aws4_request'
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n')
  const dateKey = hmac('AWS4' + config.secretAccessKey, shortDate)
  const regionKey = hmac(dateKey, config.region)
  const serviceKey = hmac(regionKey, 's3')
  const signingKey = hmac(serviceKey, 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')
  const headers: Record<string, string> = {
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    Authorization:
      'AWS4-HMAC-SHA256 Credential=' + config.accessKeyId + '/' + scope +
      ', SignedHeaders=' + signedHeaders + ', Signature=' + signature,
  }
  if (metadataSha256) headers['x-amz-meta-sha256'] = metadataSha256
  return { url, headers }
}

async function assertOk(response: Response, operation: string): Promise<void> {
  if (response.ok) return
  const detail = (await response.text().catch(() => '')).slice(0, 300)
  throw new Error('Neon Object Storage ' + operation + ' gagal (HTTP ' + response.status + ')' + (detail ? ': ' + detail : ''))
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

function timeoutSignal(): AbortSignal {
  const timeout = Number.parseInt(process.env.STORAGE_REQUEST_TIMEOUT_MS || '1800000', 10)
  return AbortSignal.timeout(Number.isSafeInteger(timeout) && timeout > 0 ? timeout : 1800000)
}

export async function putBuffer(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
  const config = getConfig()
  const sha256 = createHash('sha256').update(body).digest('hex')
  const signed = signRequest(config, 'PUT', key, sha256, sha256)
  const payload = new Uint8Array(body.byteLength)
  payload.set(body)
  const response = await fetch(signed.url, {
    method: 'PUT',
    headers: {
      ...signed.headers,
      'Content-Type': contentType,
      'Content-Length': String(body.byteLength),
    },
    body: payload,
    signal: timeoutSignal(),
  })
  await assertOk(response, 'PUT')
  return { size: body.byteLength, sha256 }
}

export async function putFile(key: string, filePath: string, contentType: string): Promise<StoredObject> {
  const config = getConfig()
  const fileStat = await stat(filePath)
  if (!fileStat.isFile() || fileStat.size <= 0) throw new Error('File upload tidak valid atau kosong.')
  const sha256 = await hashFile(filePath)
  const signed = signRequest(config, 'PUT', key, sha256, sha256)
  const webStream = Readable.toWeb(createReadStream(filePath))
  const init = {
    method: 'PUT',
    headers: {
      ...signed.headers,
      'Content-Type': contentType,
      'Content-Length': String(fileStat.size),
    },
    body: webStream,
    duplex: 'half',
    signal: timeoutSignal(),
  } as RequestInit & { duplex: 'half' }
  const response = await fetch(signed.url, init)
  await assertOk(response, 'PUT')
  return { size: fileStat.size, sha256 }
}

export async function headObject(key: string, timeoutMs?: number): Promise<ObjectHead | null> {
  const config = getConfig()
  const signed = signRequest(config, 'HEAD', key, EMPTY_SHA256)
  const response = await fetch(signed.url, {
    method: 'HEAD',
    headers: signed.headers,
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : timeoutSignal(),
  })
  if (response.status === 404) return null
  await assertOk(response, 'HEAD')
  const size = Number(response.headers.get('content-length') || '0')
  return {
    size,
    sha256: response.headers.get('x-amz-meta-sha256'),
  }
}

export async function getObject(key: string, range?: string, timeoutMs?: number): Promise<Response | null> {
  const config = getConfig()
  const signed = signRequest(config, 'GET', key, EMPTY_SHA256)
  const headers: Record<string, string> = { ...signed.headers }
  if (range) headers.Range = range
  const response = await fetch(signed.url, {
    method: 'GET',
    headers,
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : timeoutSignal(),
  })
  if (response.status === 404) return null
  await assertOk(response, 'GET')
  return response
}

export async function deleteObject(key: string): Promise<void> {
  const config = getConfig()
  const signed = signRequest(config, 'DELETE', key, EMPTY_SHA256)
  const response = await fetch(signed.url, {
    method: 'DELETE',
    headers: signed.headers,
    signal: timeoutSignal(),
  })
  if (response.status === 404) return
  await assertOk(response, 'DELETE')
}
