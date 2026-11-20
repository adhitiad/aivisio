import { createHash, randomBytes } from 'node:crypto'
import type { YoutubeOAuthConnection } from '@prisma/client'
import { db } from '@/lib/db'
import { decryptYoutubeToken, encryptYoutubeToken } from './token-crypto'

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'
const YOUTUBE_DATA_ENDPOINT = 'https://www.googleapis.com/youtube/v3'
const YOUTUBE_ANALYTICS_ENDPOINT = 'https://youtubeanalytics.googleapis.com/v2/reports'
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
] as const
const MONETARY_SCOPE = 'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'
const OPENID_SCOPES = ['openid', 'email'] as const
const STATE_TTL_MS = 10 * 60 * 1000
const TOKEN_REFRESH_SKEW_MS = 60 * 1000

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

type GoogleApiErrorPayload = {
  error?: {
    code?: number
    message?: string
    errors?: Array<{ reason?: string; message?: string }>
  }
}

type GoogleChannel = {
  id?: string
  snippet?: {
    title?: string
    description?: string
    customUrl?: string
    country?: string
    thumbnails?: {
      default?: { url?: string }
      medium?: { url?: string }
      high?: { url?: string }
    }
  }
  statistics?: {
    viewCount?: string
    subscriberCount?: string
    hiddenSubscriberCount?: boolean
    videoCount?: string
  }
}

type GoogleChannelListResponse = {
  items?: GoogleChannel[]
  nextPageToken?: string
}

type AnalyticsResponse = {
  columnHeaders?: Array<{ name?: string }>
  rows?: Array<Array<string | number>>
}

export class YoutubeIntegrationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = 'YoutubeIntegrationError'
  }
}

function oauthConfig() {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET
  const siteUrl = process.env.SITE_URL ?? process.env.BETTER_AUTH_URL
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI ||
    (siteUrl ? new URL('/api/youtube/oauth/callback', siteUrl).toString() : '')

  if (!clientId || !clientSecret || !redirectUri) {
    throw new YoutubeIntegrationError(
      'YouTube OAuth belum dikonfigurasi pada server.',
      503,
      'YOUTUBE_OAUTH_NOT_CONFIGURED',
    )
  }

  let parsedRedirect: URL
  try {
    parsedRedirect = new URL(redirectUri)
  } catch {
    throw new YoutubeIntegrationError('YOUTUBE_OAUTH_REDIRECT_URI tidak valid.', 500, 'YOUTUBE_OAUTH_CONFIG_INVALID')
  }

  if (
    process.env.NODE_ENV === 'production' &&
    parsedRedirect.protocol !== 'https:'
  ) {
    throw new YoutubeIntegrationError('Redirect YouTube OAuth produksi wajib menggunakan HTTPS.', 500, 'YOUTUBE_OAUTH_CONFIG_INVALID')
  }

  return { clientId, clientSecret, redirectUri: parsedRedirect.toString() }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url')
}

function grantedScopes(value: string | null | undefined): string[] {
  return (value ?? '').split(/\s+/).map((scope) => scope.trim()).filter(Boolean)
}

export function hasYoutubeMonetaryScope(scopes: string): boolean {
  return grantedScopes(scopes).includes(MONETARY_SCOPE)
}

export async function createYoutubeAuthorizationUrl(userId: string): Promise<string> {
  const config = oauthConfig()
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')

  await db.youtubeOAuthState.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  await db.youtubeOAuthState.create({
    data: {
      stateHash: sha256(state),
      userId,
      codeVerifierEncrypted: encryptYoutubeToken(verifier),
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    },
  })

  const url = new URL(AUTHORIZATION_ENDPOINT)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', [...OPENID_SCOPES, ...REQUIRED_SCOPES, 'https://www.googleapis.com/auth/youtube.upload', MONETARY_SCOPE].join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', sha256(verifier))
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export async function consumeYoutubeOAuthState(
  state: string,
  userId: string,
): Promise<string> {
  if (!state || state.length > 256) {
    throw new YoutubeIntegrationError('State OAuth tidak valid.', 400, 'YOUTUBE_OAUTH_STATE_INVALID')
  }

  const row = await db.youtubeOAuthState.findUnique({
    where: { stateHash: sha256(state) },
  })

  if (!row || row.userId !== userId || row.expiresAt.getTime() <= Date.now()) {
    if (row?.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      await db.youtubeOAuthState.deleteMany({ where: { id: row.id } })
    }
    throw new YoutubeIntegrationError('Sesi OAuth kedaluwarsa atau tidak cocok. Ulangi koneksi YouTube.', 400, 'YOUTUBE_OAUTH_STATE_INVALID')
  }

  const deleted = await db.youtubeOAuthState.deleteMany({
    where: { id: row.id, stateHash: sha256(state), userId },
  })
  if (deleted.count !== 1) {
    throw new YoutubeIntegrationError('State OAuth sudah digunakan.', 400, 'YOUTUBE_OAUTH_STATE_REPLAYED')
  }

  return decryptYoutubeToken(row.codeVerifierEncrypted)
}

async function parseGoogleError(response: Response): Promise<GoogleApiErrorPayload | null> {
  return await response.json().catch(() => null) as GoogleApiErrorPayload | null
}

async function exchangeAuthorizationCode(code: string, verifier: string): Promise<GoogleTokenResponse> {
  const config = oauthConfig()
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  })

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const payload = await response.json().catch(() => null) as GoogleTokenResponse | null
  if (!response.ok || !payload?.access_token) {
    throw new YoutubeIntegrationError(
      'Google tidak dapat menyelesaikan otorisasi YouTube. Coba hubungkan ulang akun.',
      response.status === 400 ? 400 : 502,
      payload?.error === 'invalid_grant' ? 'YOUTUBE_OAUTH_CODE_INVALID' : 'YOUTUBE_OAUTH_TOKEN_EXCHANGE_FAILED',
    )
  }

  return payload
}

async function googleJson<T>(url: URL, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const payload = await response.json().catch(() => null) as (T & GoogleApiErrorPayload) | null
  if (!response.ok) {
    const reason = payload && 'error' in payload ? payload.error?.errors?.[0]?.reason : undefined
    if (response.status === 401 || reason === 'authError') {
      throw new YoutubeIntegrationError('Akses YouTube kedaluwarsa. Hubungkan ulang akun Google.', 401, 'YOUTUBE_RECONNECT_REQUIRED')
    }
    if (response.status === 403) {
      throw new YoutubeIntegrationError('Google menolak akses. Periksa izin YouTube dan status channel pada akun Google.', 403, 'YOUTUBE_PERMISSION_DENIED')
    }
    throw new YoutubeIntegrationError('Permintaan ke Google YouTube API gagal (' + response.status + ').', 502, 'YOUTUBE_GOOGLE_API_ERROR')
  }
  return (payload ?? {}) as T
}

async function fetchGoogleIdentity(accessToken: string): Promise<{ subject: string | null; email: string | null }> {
  try {
    const payload = await googleJson<{ sub?: string; email?: string; email_verified?: boolean }>(
      new URL('https://openidconnect.googleapis.com/v1/userinfo'),
      accessToken,
    )
    return {
      subject: payload.sub?.slice(0, 255) ?? null,
      email: payload.email_verified ? payload.email?.slice(0, 320) ?? null : null,
    }
  } catch {
    return { subject: null, email: null }
  }
}

async function fetchOwnedChannels(accessToken: string): Promise<GoogleChannel[]> {
  const channels: GoogleChannel[] = []
  let pageToken: string | undefined

  for (let page = 0; page < 5; page++) {
    const url = new URL(YOUTUBE_DATA_ENDPOINT + '/channels')
    url.searchParams.set('part', 'snippet,statistics')
    url.searchParams.set('mine', 'true')
    url.searchParams.set('maxResults', '50')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await googleJson<GoogleChannelListResponse>(url, accessToken)
    channels.push(...(response.items ?? []))
    pageToken = response.nextPageToken
    if (!pageToken) break
  }

  return channels.filter((channel) => Boolean(channel.id && channel.snippet?.title))
}

async function syncChannels(
  userId: string,
  connectionId: string,
  channels: GoogleChannel[],
): Promise<number> {
  let synced = 0

  for (const channel of channels) {
    const youtubeChannelId = channel.id
    const snippet = channel.snippet
    if (!youtubeChannelId || !snippet?.title) continue

    const existing = await db.youtubeChannel.findUnique({
      where: { youtubeChannelId },
      select: { id: true, userId: true },
    })
    if (existing && existing.userId !== userId) {
      throw new YoutubeIntegrationError(
        'Salah satu channel YouTube sudah terhubung ke pengguna AIVISO lain.',
        409,
        'YOUTUBE_CHANNEL_ALREADY_LINKED',
      )
    }

    const thumbnailUrl =
      snippet.thumbnails?.high?.url ??
      snippet.thumbnails?.medium?.url ??
      snippet.thumbnails?.default?.url ??
      null

    await db.youtubeChannel.upsert({
      where: { youtubeChannelId },
      create: {
        userId,
        oauthConnectionId: connectionId,
        youtubeChannelId,
        title: snippet.title.slice(0, 200),
        handle: snippet.customUrl?.slice(0, 200) ?? null,
        thumbnailUrl,
        description: snippet.description?.slice(0, 5000) ?? null,
        country: snippet.country?.slice(0, 2) ?? null,
        connectionStatus: 'connected',
        lastSyncedAt: new Date(),
      },
      update: {
        oauthConnectionId: connectionId,
        title: snippet.title.slice(0, 200),
        handle: snippet.customUrl?.slice(0, 200) ?? null,
        thumbnailUrl,
        description: snippet.description?.slice(0, 5000) ?? null,
        country: snippet.country?.slice(0, 2) ?? null,
        connectionStatus: 'connected',
        lastSyncedAt: new Date(),
      },
    })
    synced++
  }

  return synced
}

export async function completeYoutubeOAuth(
  userId: string,
  code: string,
  verifier: string,
): Promise<{ channelCount: number; googleEmail: string | null }> {
  if (!code || code.length > 4096) {
    throw new YoutubeIntegrationError('Kode OAuth tidak valid.', 400, 'YOUTUBE_OAUTH_CODE_INVALID')
  }

  const token = await exchangeAuthorizationCode(code, verifier)
  if (!token.scope) {
    throw new YoutubeIntegrationError('Google tidak mengembalikan daftar izin aktual. Ulangi proses persetujuan YouTube.', 502, 'YOUTUBE_OAUTH_SCOPE_RESPONSE_MISSING')
  }
  const scopes = grantedScopes(token.scope)
  if (REQUIRED_SCOPES.some((scope) => !scopes.includes(scope))) {
    throw new YoutubeIntegrationError('Izin baca channel dan YouTube Analytics belum diberikan.', 403, 'YOUTUBE_REQUIRED_SCOPES_MISSING')
  }

  const channels = await fetchOwnedChannels(token.access_token!)
  const channelIds = channels.map((channel) => channel.id).filter((id): id is string => Boolean(id))
  const linkedChannels = channelIds.length > 0
    ? await db.youtubeChannel.findMany({
        where: { youtubeChannelId: { in: channelIds } },
        select: { youtubeChannelId: true, userId: true },
      })
    : []
  if (linkedChannels.some((channel) => channel.userId !== userId)) {
    throw new YoutubeIntegrationError(
      'Salah satu channel YouTube sudah terhubung ke pengguna AIVISIO lain.',
      409,
      'YOUTUBE_CHANNEL_ALREADY_LINKED',
    )
  }

  const existing = await db.youtubeOAuthConnection.findUnique({ where: { userId } })
  const identity = await fetchGoogleIdentity(token.access_token!)
  const isSameGoogleAccount = Boolean(
    existing?.googleSubject &&
    identity.subject &&
    existing.googleSubject === identity.subject,
  )
  const refreshToken = token.refresh_token ??
    (isSameGoogleAccount && existing?.refreshTokenEncrypted
      ? decryptYoutubeToken(existing.refreshTokenEncrypted)
      : null)

  if (!refreshToken) {
    throw new YoutubeIntegrationError('Google tidak mengembalikan refresh token baru untuk akun yang terhubung. Cabut izin AIVISO pada akun Google yang dipilih lalu ulangi koneksi.', 502, 'YOUTUBE_REFRESH_TOKEN_MISSING')
  }

  const expiresIn = Number(token.expires_in ?? 3600)
  if (!Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > 86_400) {
    throw new YoutubeIntegrationError('Masa berlaku token Google tidak valid.', 502, 'YOUTUBE_TOKEN_RESPONSE_INVALID')
  }

  const connection = await db.youtubeOAuthConnection.upsert({
    where: { userId },
    create: {
      userId,
      googleSubject: identity.subject,
      googleEmail: identity.email,
      accessTokenEncrypted: encryptYoutubeToken(token.access_token!),
      refreshTokenEncrypted: encryptYoutubeToken(refreshToken),
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      scopes: scopes.join(' '),
      connectionStatus: 'connected',
      lastVerifiedAt: new Date(),
    },
    update: {
      googleSubject: identity.subject ?? existing?.googleSubject,
      googleEmail: identity.email ?? existing?.googleEmail,
      accessTokenEncrypted: encryptYoutubeToken(token.access_token!),
      refreshTokenEncrypted: encryptYoutubeToken(refreshToken),
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      scopes: scopes.join(' '),
      connectionStatus: 'connected',
      lastVerifiedAt: new Date(),
    },
  })

  if (
    existing?.googleSubject &&
    identity.subject &&
    existing.googleSubject !== identity.subject
  ) {
    // A user may switch Google accounts. Detach the previous account's
    // channels before linking the newly authorized account to this connection.
    await db.youtubeChannel.updateMany({
      where: { userId, oauthConnectionId: connection.id },
      data: { connectionStatus: 'disconnected', oauthConnectionId: null },
    })
  }

  const channelCount = await syncChannels(userId, connection.id, channels)
  await db.youtubeOAuthConnection.update({
    where: { id: connection.id },
    data: { lastVerifiedAt: new Date(), connectionStatus: 'connected' },
  })

  return { channelCount, googleEmail: identity.email }
}

export async function markYoutubeConnectionNeedsReconnect(userId: string): Promise<void> {
  await db.$transaction([
    db.youtubeOAuthConnection.updateMany({
      where: { userId },
      data: { connectionStatus: 'needs_reconnect' },
    }),
    db.youtubeChannel.updateMany({
      where: { userId, oauthConnectionId: { not: null } },
      data: { connectionStatus: 'needs_reconnect' },
    }),
  ])
}

export async function getYoutubeAccessToken(
  connection: YoutubeOAuthConnection,
): Promise<string> {
  if (
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() > Date.now() + TOKEN_REFRESH_SKEW_MS
  ) {
    try {
      return decryptYoutubeToken(connection.accessTokenEncrypted)
    } catch {
      await markYoutubeConnectionNeedsReconnect(connection.userId)
      throw new YoutubeIntegrationError('Kunci enkripsi YouTube berubah atau tidak tersedia. Hubungkan ulang akun Google.', 401, 'YOUTUBE_RECONNECT_REQUIRED')
    }
  }

  if (!connection.refreshTokenEncrypted) {
    await markYoutubeConnectionNeedsReconnect(connection.userId)
    throw new YoutubeIntegrationError('Token YouTube tidak dapat diperbarui. Hubungkan ulang akun.', 401, 'YOUTUBE_RECONNECT_REQUIRED')
  }

  const config = oauthConfig()
  let refreshToken: string
  try {
    refreshToken = decryptYoutubeToken(connection.refreshTokenEncrypted)
  } catch {
    await markYoutubeConnectionNeedsReconnect(connection.userId)
    throw new YoutubeIntegrationError('Kunci enkripsi YouTube berubah atau tidak tersedia. Hubungkan ulang akun Google.', 401, 'YOUTUBE_RECONNECT_REQUIRED')
  }
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  let response: Response
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new YoutubeIntegrationError('Tidak dapat memperbarui token YouTube. Coba lagi.', 502, 'YOUTUBE_TOKEN_REFRESH_NETWORK_ERROR')
  }

  const token = await response.json().catch(() => null) as GoogleTokenResponse | null
  if (!response.ok || !token?.access_token) {
    if (token?.error === 'invalid_grant' || response.status === 400) {
      await markYoutubeConnectionNeedsReconnect(connection.userId)
      throw new YoutubeIntegrationError('Izin YouTube telah dicabut atau kedaluwarsa. Hubungkan ulang akun.', 401, 'YOUTUBE_RECONNECT_REQUIRED')
    }
    throw new YoutubeIntegrationError('Google gagal memperbarui token YouTube.', 502, 'YOUTUBE_TOKEN_REFRESH_FAILED')
  }

  const expiresIn = Number(token.expires_in ?? 3600)
  if (!Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > 86_400) {
    throw new YoutubeIntegrationError('Respons refresh token Google tidak valid.', 502, 'YOUTUBE_TOKEN_RESPONSE_INVALID')
  }

  await db.youtubeOAuthConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encryptYoutubeToken(token.access_token),
      refreshTokenEncrypted: token.refresh_token
        ? encryptYoutubeToken(token.refresh_token)
        : connection.refreshTokenEncrypted,
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      connectionStatus: 'connected',
      lastVerifiedAt: new Date(),
    },
  })

  return token.access_token
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new YoutubeIntegrationError('Tanggal harus berformat YYYY-MM-DD.', 400, 'YOUTUBE_ANALYTICS_DATE_INVALID')
  }
  const date = new Date(value + 'T00:00:00.000Z')
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new YoutubeIntegrationError('Tanggal Analytics tidak valid.', 400, 'YOUTUBE_ANALYTICS_DATE_INVALID')
  }
  return date
}

export type YoutubeAnalyticsInput = {
  userId: string
  channelId: string
  startDate: string
  endDate: string
  includeRevenue: boolean
}

function toMetricNumber(value: string | number | undefined, allowNegative = false): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) && (allowNegative || parsed >= 0) ? parsed : 0
}

export async function queryYoutubeAnalytics(input: YoutubeAnalyticsInput) {
  const channel = await db.youtubeChannel.findFirst({
    where: { id: input.channelId, userId: input.userId },
    select: {
      id: true,
      title: true,
      youtubeChannelId: true,
      oauthConnectionId: true,
    },
  })
  if (!channel || !channel.oauthConnectionId) {
    throw new YoutubeIntegrationError('Channel tidak ditemukan atau belum terhubung melalui OAuth.', 404, 'YOUTUBE_CHANNEL_NOT_FOUND')
  }

  const start = parseDate(input.startDate)
  const end = parseDate(input.endDate)
  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86_400_000)

  if (end < start || end >= todayUtc || dayCount > 364) {
    throw new YoutubeIntegrationError('Rentang tanggal harus berakhir sebelum hari ini dan maksimal 365 hari.', 400, 'YOUTUBE_ANALYTICS_RANGE_INVALID')
  }

  const connection = await db.youtubeOAuthConnection.findFirst({
    where: { id: channel.oauthConnectionId, userId: input.userId, connectionStatus: 'connected' },
  })
  if (!connection) {
    throw new YoutubeIntegrationError('Koneksi Google YouTube tidak aktif. Hubungkan ulang akun.', 401, 'YOUTUBE_RECONNECT_REQUIRED')
  }

  const scopes = grantedScopes(connection.scopes)
  if (REQUIRED_SCOPES.some((scope) => !scopes.includes(scope))) {
    throw new YoutubeIntegrationError('Akses YouTube Analytics belum diberikan. Hubungkan ulang akun.', 403, 'YOUTUBE_ANALYTICS_SCOPE_REQUIRED')
  }
  const canViewRevenue = scopes.includes(MONETARY_SCOPE)
  if (input.includeRevenue && !canViewRevenue) {
    throw new YoutubeIntegrationError('Akses data pendapatan belum diberikan oleh akun Google.', 403, 'YOUTUBE_MONETARY_SCOPE_REQUIRED')
  }

  const accessToken = await getYoutubeAccessToken(connection)
  const metrics = [
    'views',
    'estimatedMinutesWatched',
    'averageViewDuration',
    'averageViewPercentage',
    'likes',
    'comments',
    'shares',
    'subscribersGained',
    'subscribersLost',
  ]
  if (input.includeRevenue) metrics.push('estimatedRevenue', 'estimatedAdRevenue')

  const baseUrl = new URL(YOUTUBE_ANALYTICS_ENDPOINT)
  baseUrl.searchParams.set('ids', 'channel==' + channel.youtubeChannelId)
  baseUrl.searchParams.set('startDate', input.startDate)
  baseUrl.searchParams.set('endDate', input.endDate)
  baseUrl.searchParams.set('metrics', metrics.join(','))
  baseUrl.searchParams.set('dimensions', 'day')
  baseUrl.searchParams.set('sort', 'day')
  baseUrl.searchParams.set('currency', 'IDR')
  baseUrl.searchParams.set('maxResults', '200')

  // reports.query uses startIndex/maxResults pagination. Fetch no more than
  // 366 daily rows, in pages of 200, so a full 365-day request is not truncated.
  let responseHeaders: Array<{ name?: string }> = []
  const responseRows: Array<Array<string | number>> = []

  for (let startIndex = 1; startIndex <= 366; startIndex += 200) {
    const pageUrl = new URL(baseUrl)
    pageUrl.searchParams.set('startIndex', String(startIndex))

    let response: Response
    try {
      response = await fetch(pageUrl, {
        headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      })
    } catch {
      throw new YoutubeIntegrationError('Tidak dapat menghubungi YouTube Analytics API.', 502, 'YOUTUBE_ANALYTICS_NETWORK_ERROR')
    }

    const payload = await response.json().catch(() => null) as AnalyticsResponse & GoogleApiErrorPayload | null
    if (!response.ok) {
      const reason = payload?.error?.errors?.[0]?.reason ?? ''
      if (response.status === 401 || reason === 'authError') {
        await markYoutubeConnectionNeedsReconnect(input.userId)
        throw new YoutubeIntegrationError('Akses YouTube kedaluwarsa. Hubungkan ulang akun Google.', 401, 'YOUTUBE_RECONNECT_REQUIRED')
      }
      if (response.status === 403 || /insufficientPermissions|forbidden/i.test(reason)) {
        throw new YoutubeIntegrationError('Google tidak mengizinkan laporan Analytics ini. Pastikan akun memiliki akses ke channel dan data yang diminta.', 403, 'YOUTUBE_ANALYTICS_FORBIDDEN')
      }
      throw new YoutubeIntegrationError('YouTube Analytics API gagal (' + response.status + ').', 502, 'YOUTUBE_ANALYTICS_API_ERROR')
    }

    const pageHeaders = payload?.columnHeaders ?? []
    if (responseHeaders.length === 0) {
      responseHeaders = pageHeaders
    } else if (pageHeaders.map((column) => column.name).join('|') !== responseHeaders.map((column) => column.name).join('|')) {
      throw new YoutubeIntegrationError('Struktur halaman YouTube Analytics berubah saat pagination.', 502, 'YOUTUBE_ANALYTICS_RESPONSE_INVALID')
    }

    const pageRows = payload?.rows ?? []
    responseRows.push(...pageRows)
    if (pageRows.length < 200) break
  }

  const headers = responseHeaders.map((column) => column.name ?? '')
  const index = (name: string) => headers.indexOf(name)
  const dateIndex = index('day')
  if (dateIndex < 0) {
    throw new YoutubeIntegrationError('Format laporan YouTube Analytics tidak dikenali.', 502, 'YOUTUBE_ANALYTICS_RESPONSE_INVALID')
  }

  const rows = responseRows.flatMap((values) => {
    const dateValue = String(values[dateIndex] ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return []
    const metric = (name: string) => toMetricNumber(index(name) >= 0 ? values[index(name)] : 0)
    return [{
      date: dateValue,
      views: BigInt(Math.trunc(metric('views'))),
      estimatedMinutesWatched: metric('estimatedMinutesWatched'),
      averageViewDuration: metric('averageViewDuration'),
      averageViewPercentage: metric('averageViewPercentage'),
      likes: BigInt(Math.trunc(metric('likes'))),
      comments: BigInt(Math.trunc(metric('comments'))),
      shares: BigInt(Math.trunc(metric('shares'))),
      subscribersGained: Math.trunc(metric('subscribersGained')),
      subscribersLost: Math.trunc(metric('subscribersLost')),
      estimatedRevenue: input.includeRevenue ? toMetricNumber(index('estimatedRevenue') >= 0 ? values[index('estimatedRevenue')] : 0, true) : null,
      estimatedAdRevenue: input.includeRevenue ? toMetricNumber(index('estimatedAdRevenue') >= 0 ? values[index('estimatedAdRevenue')] : 0, true) : null,
    }]
  })

  if (rows.length > 0) {
    await db.$transaction(rows.map((row) => {
      const metricDate = new Date(row.date + 'T00:00:00.000Z')
      return db.youtubeAnalyticsDailyMetric.upsert({
        where: { channelId_metricDate: { channelId: channel.id, metricDate } },
        create: {
          channelId: channel.id,
          metricDate,
          views: row.views,
          estimatedMinutesWatched: row.estimatedMinutesWatched,
          averageViewDuration: row.averageViewDuration,
          averageViewPercentage: row.averageViewPercentage,
          likes: row.likes,
          comments: row.comments,
          shares: row.shares,
          subscribersGained: row.subscribersGained,
          subscribersLost: row.subscribersLost,
          estimatedRevenue: row.estimatedRevenue,
          estimatedAdRevenue: row.estimatedAdRevenue,
          currencyCode: 'IDR',
        },
        update: {
          views: row.views,
          estimatedMinutesWatched: row.estimatedMinutesWatched,
          averageViewDuration: row.averageViewDuration,
          averageViewPercentage: row.averageViewPercentage,
          likes: row.likes,
          comments: row.comments,
          shares: row.shares,
          subscribersGained: row.subscribersGained,
          subscribersLost: row.subscribersLost,
          ...(input.includeRevenue ? {
            estimatedRevenue: row.estimatedRevenue,
            estimatedAdRevenue: row.estimatedAdRevenue,
          } : {}),
          currencyCode: 'IDR',
        },
      })
    }))
  }

  const serializedRows = rows.map((row) => ({
    date: row.date,
    views: row.views.toString(),
    estimatedMinutesWatched: row.estimatedMinutesWatched,
    averageViewDuration: row.averageViewDuration,
    averageViewPercentage: row.averageViewPercentage,
    likes: row.likes.toString(),
    comments: row.comments.toString(),
    shares: row.shares.toString(),
    subscribersGained: row.subscribersGained,
    subscribersLost: row.subscribersLost,
    estimatedRevenue: row.estimatedRevenue,
    estimatedAdRevenue: row.estimatedAdRevenue,
  }))

  return {
    channel: { id: channel.id, title: channel.title },
    startDate: input.startDate,
    endDate: input.endDate,
    currency: input.includeRevenue ? 'IDR' : null,
    hasMonetaryAccess: canViewRevenue,
    includesRevenue: input.includeRevenue,
    observedAt: new Date().toISOString(),
    rowCount: serializedRows.length,
    rows: serializedRows,
    limitations: [
      'YouTube Analytics hanya mengembalikan tanggal yang metriknya sudah tersedia penuh; data paling baru dapat tertinggal.',
      'Pendapatan adalah estimasi dalam IDR dan dapat disesuaikan pada akhir bulan.',
      'Akses revenue bergantung pada izin monetisasi akun/channel Google yang terhubung.',
    ],
  }
}


export type YoutubeOptimizationBreakdownInput = {
  userId: string
  channelId: string
  startDate: string
  endDate: string
  includeRevenue: boolean
}

/**
 * Fetches private per-video and country reports. Monetary metrics are retried
 * without revenue after a 403 (for example, a channel that has not joined YPP).
 * Public Data API counts are intentionally not substituted for private analytics.
 */
export async function queryYoutubeOptimizationBreakdowns(input: YoutubeOptimizationBreakdownInput) {
  const channel = await db.youtubeChannel.findFirst({
    where: { id: input.channelId, userId: input.userId },
    select: { id: true, youtubeChannelId: true, oauthConnectionId: true },
  })
  if (!channel || !channel.oauthConnectionId) {
    throw new YoutubeIntegrationError('Channel tidak ditemukan atau belum terhubung melalui OAuth.', 404, 'YOUTUBE_CHANNEL_NOT_FOUND')
  }

  const start = parseDate(input.startDate)
  const end = parseDate(input.endDate)
  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86_400_000)
  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  if (end < start || end >= todayUtc || dayCount > 364) {
    throw new YoutubeIntegrationError('Rentang tanggal harus berakhir sebelum hari ini dan maksimal 365 hari.', 400, 'YOUTUBE_ANALYTICS_RANGE_INVALID')
  }

  const connection = await db.youtubeOAuthConnection.findFirst({
    where: { id: channel.oauthConnectionId, userId: input.userId, connectionStatus: 'connected' },
  })
  if (!connection) {
    throw new YoutubeIntegrationError('Koneksi Google YouTube tidak aktif. Hubungkan ulang akun.', 401, 'YOUTUBE_RECONNECT_REQUIRED')
  }
  const scopes = grantedScopes(connection.scopes)
  if (REQUIRED_SCOPES.some((scope) => !scopes.includes(scope))) {
    throw new YoutubeIntegrationError('Akses YouTube Analytics belum diberikan. Hubungkan ulang akun.', 403, 'YOUTUBE_ANALYTICS_SCOPE_REQUIRED')
  }

  const accessToken = await getYoutubeAccessToken(connection)
  const fetchReports = async (includeRevenue: boolean) => {
    const currencyMetrics = includeRevenue ? ['estimatedRevenue', 'estimatedAdRevenue'] : []
    const fetchReport = async (dimension: 'video' | 'country', metrics: string[], maxResults: number) => {
      const url = new URL(YOUTUBE_ANALYTICS_ENDPOINT)
      url.searchParams.set('ids', 'channel==' + channel.youtubeChannelId)
      url.searchParams.set('startDate', input.startDate)
      url.searchParams.set('endDate', input.endDate)
      url.searchParams.set('dimensions', dimension)
      url.searchParams.set('metrics', [...metrics, ...currencyMetrics].join(','))
      url.searchParams.set('sort', '-views')
      url.searchParams.set('maxResults', String(maxResults))
      url.searchParams.set('currency', 'IDR')
      return googleJson<AnalyticsResponse>(url, accessToken)
    }
    const [videos, countries] = await Promise.all([
      fetchReport('video', ['views', 'estimatedMinutesWatched', 'averageViewDuration', 'averageViewPercentage'], 200),
      fetchReport('country', ['views', 'estimatedMinutesWatched'], 200),
    ])
    return { videos, countries, includeRevenue }
  }

  let reports: Awaited<ReturnType<typeof fetchReports>>
  let revenueAvailable = input.includeRevenue && scopes.includes(MONETARY_SCOPE)
  if (revenueAvailable) {
    try {
      reports = await fetchReports(true)
    } catch (error) {
      if (!(error instanceof YoutubeIntegrationError) || error.status !== 403) throw error
      revenueAvailable = false
      reports = await fetchReports(false)
    }
  } else {
    reports = await fetchReports(false)
  }

  const capturedOn = new Date()
  const mapReport = (
    response: AnalyticsResponse,
    dimension: 'video' | 'country',
  ) => {
    const headers = (response.columnHeaders ?? []).map((item) => item.name ?? '')
    const position = (name: string) => headers.indexOf(name)
    const dimensionIndex = position(dimension)
    if (dimensionIndex < 0) return []
    return (response.rows ?? []).flatMap((values) => {
      const key = String(values[dimensionIndex] ?? '').trim()
      if (!key || key.length > 128) return []
      const metric = (name: string) => toMetricNumber(position(name) >= 0 ? values[position(name)] : 0, true)
      return [{
        key,
        views: BigInt(Math.trunc(Math.max(0, metric('views')))),
        estimatedMinutesWatched: Math.max(0, metric('estimatedMinutesWatched')),
        averageViewDuration: Math.max(0, metric('averageViewDuration')),
        averageViewPercentage: Math.max(0, metric('averageViewPercentage')),
        estimatedRevenue: revenueAvailable ? metric('estimatedRevenue') : null,
        estimatedAdRevenue: revenueAvailable ? metric('estimatedAdRevenue') : null,
      }]
    })
  }

  const videos = mapReport(reports.videos, 'video')
  const countries = mapReport(reports.countries, 'country')

  if (videos.length || countries.length) {
    await db.$transaction([
      ...videos.map((row) => db.youtubeVideoPerformanceSnapshot.upsert({
        where: {
          channelId_videoId_capturedOn: {
            channelId: channel.id,
            videoId: row.key,
            capturedOn,
          },
        },
        create: {
          channelId: channel.id,
          videoId: row.key,
          videoTitle: row.key,
          capturedOn,
          views: row.views,
          estimatedMinutesWatched: row.estimatedMinutesWatched,
          averageViewDuration: row.averageViewDuration,
          averageViewPercentage: row.averageViewPercentage,
          estimatedRevenue: row.estimatedRevenue,
          estimatedAdRevenue: row.estimatedAdRevenue,
          currencyCode: 'IDR',
        },
        update: {
          views: row.views,
          estimatedMinutesWatched: row.estimatedMinutesWatched,
          averageViewDuration: row.averageViewDuration,
          averageViewPercentage: row.averageViewPercentage,
          estimatedRevenue: row.estimatedRevenue,
          estimatedAdRevenue: row.estimatedAdRevenue,
        },
      })),
      ...countries.map((row) => db.youtubeCountryPerformanceSnapshot.upsert({
        where: {
          channelId_countryCode_capturedOn: {
            channelId: channel.id,
            countryCode: row.key,
            capturedOn,
          },
        },
        create: {
          channelId: channel.id,
          countryCode: row.key,
          capturedOn,
          views: row.views,
          estimatedMinutesWatched: row.estimatedMinutesWatched,
          estimatedRevenue: row.estimatedRevenue,
          estimatedAdRevenue: row.estimatedAdRevenue,
          currencyCode: 'IDR',
        },
        update: {
          views: row.views,
          estimatedMinutesWatched: row.estimatedMinutesWatched,
          estimatedRevenue: row.estimatedRevenue,
          estimatedAdRevenue: row.estimatedAdRevenue,
        },
      })),
    ])
  }

  return {
    capturedOn: capturedOn.toISOString(),
    revenueAvailable,
    videos: videos.map((row) => ({
      videoId: row.key,
      views: row.views.toString(),
      estimatedMinutesWatched: row.estimatedMinutesWatched,
      averageViewDuration: row.averageViewDuration,
      averageViewPercentage: row.averageViewPercentage,
      estimatedRevenue: row.estimatedRevenue,
      estimatedAdRevenue: row.estimatedAdRevenue,
    })),
    countries: countries.map((row) => ({
      countryCode: row.key,
      views: row.views.toString(),
      estimatedMinutesWatched: row.estimatedMinutesWatched,
      estimatedRevenue: row.estimatedRevenue,
      estimatedAdRevenue: row.estimatedAdRevenue,
    })),
  }
}

function formatPacificDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function shiftDate(dateValue: string, days: number): string {
  const [year, month, day] = dateValue.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

/**
 * Scheduled private Analytics sync. First connection gets a 365-day backfill;
 * subsequent daily runs re-fetch a 14-day overlap to capture YouTube revisions.
 * Google reports are delayed, so the sync ends two Pacific days behind today.
 */
export async function syncYoutubeAnalyticsBatch(limit = 20) {
  const today = formatPacificDate()
  const endDate = shiftDate(today, -2)
  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000)
  const channels = await db.youtubeChannel.findMany({
    where: {
      connectionStatus: 'connected',
      oauthConnectionId: { not: null },
      oauthConnection: { is: { connectionStatus: 'connected' } },
      OR: [
        { lastAnalyticsSyncedAt: null },
        { lastAnalyticsSyncedAt: { lt: cutoff } },
      ],
    },
    orderBy: [{ lastAnalyticsSyncedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    take: Math.max(1, Math.min(40, limit)),
    select: {
      id: true,
      userId: true,
      title: true,
      lastAnalyticsSyncedAt: true,
      oauthConnection: {
        select: { scopes: true, connectionStatus: true },
      },
    },
  })

  let succeeded = 0
  let failed = 0
  let rowsSynced = 0
  const skipped = 0

  for (const channel of channels) {
    try {
      const includeRevenue = grantedScopes(channel.oauthConnection?.scopes)
        .includes(MONETARY_SCOPE)
      const startDate = channel.lastAnalyticsSyncedAt
        ? shiftDate(endDate, -13)
        : shiftDate(endDate, -364)

      const report = await queryYoutubeAnalytics({
        userId: channel.userId,
        channelId: channel.id,
        startDate,
        endDate,
        includeRevenue,
      })

      await db.youtubeChannel.update({
        where: { id: channel.id },
        data: {
          lastAnalyticsSyncedAt: new Date(),
          analyticsSyncError: null,
        },
      })
      rowsSynced += report.rowCount
      succeeded++
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 400) : 'Analytics sync failed.'
      await db.youtubeChannel.update({
        where: { id: channel.id },
        data: { analyticsSyncError: message },
      }).catch(() => undefined)
      failed++
    }
  }

  return {
    eligibleChannels: channels.length,
    succeeded,
    failed,
    skipped,
    rowsSynced,
    reportEndDate: endDate,
  }
}

export async function disconnectYoutubeAccount(userId: string): Promise<void> {
  const connection = await db.youtubeOAuthConnection.findUnique({ where: { userId } })
  if (!connection) return

  let token: string | null = null
  try {
    token = connection.refreshTokenEncrypted
      ? decryptYoutubeToken(connection.refreshTokenEncrypted)
      : decryptYoutubeToken(connection.accessTokenEncrypted)
  } catch {
    // Local disconnect must still work if the encryption key has rotated or is missing.
  }

  if (token) {
    try {
      await fetch(REVOKE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      // Local credentials are removed even if Google's revocation endpoint is unavailable.
    }
  }

  await db.$transaction([
    db.youtubeChannel.updateMany({
      where: { userId, oauthConnectionId: connection.id },
      data: { connectionStatus: 'disconnected', oauthConnectionId: null },
    }),
    db.youtubeOAuthState.deleteMany({ where: { userId } }),
    db.youtubeOAuthConnection.delete({ where: { id: connection.id } }),
  ])
}
