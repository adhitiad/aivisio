/**
 * Same-origin guard for cookie-authenticated mutation endpoints.
 * Requests without Origin remain supported for trusted server-to-server clients;
 * browser requests carrying a cross-site Fetch Metadata header are rejected.
 */
export function sameOriginGuard(request: Request): Response | null {
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null

  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase()
  if (fetchSite === 'cross-site') {
    return Response.json({ error: 'Cross-site request rejected.' }, { status: 403 })
  }

  const origin = request.headers.get('origin')
  if (!origin) return null

  try {
    if (origin === 'null') throw new Error('Opaque origin')
    const expectedOrigin = new URL(
      process.env.SITE_URL || new URL(request.url).origin,
    ).origin
    if (new URL(origin).origin !== expectedOrigin) {
      return Response.json({ error: 'Invalid request origin.' }, { status: 403 })
    }
  } catch {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  return null
}
