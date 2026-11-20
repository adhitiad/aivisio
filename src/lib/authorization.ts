import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export const APP_ROLES = ['OWNER', 'ADMIN', 'CREATOR'] as const
export type AppRole = (typeof APP_ROLES)[number]

export type Principal = {
  userId: string
  email: string
  role: AppRole
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export function normalizeRole(value: unknown): AppRole {
  if (typeof value !== 'string') return 'CREATOR'
  const normalized = value.trim().toUpperCase()
  return APP_ROLES.includes(normalized as AppRole)
    ? (normalized as AppRole)
    : 'CREATOR'
}

export function isConfiguredOwnerEmail(email: string, emailVerified: boolean): boolean {
  if (!emailVerified) return false
  const configured = (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return configured.includes(email.trim().toLowerCase())
}

/**
 * Resolve the principal from the current BetterAuth session and the database.
 * OWNER_EMAILS is an explicit, verified-email bootstrap allowlist. Other roles
 * are read from User.role; a browser-provided role is never trusted.
 */
export async function requirePrincipal(allowedRoles?: readonly AppRole[]): Promise<Principal> {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw new AuthorizationError('Authentication required.', 401)

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, emailVerified: true, role: true },
  })
  if (!user) throw new AuthorizationError('Authentication required.', 401)

  const role = isConfiguredOwnerEmail(user.email, user.emailVerified)
    ? 'OWNER'
    : normalizeRole(user.role)

  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new AuthorizationError('Insufficient permissions.', 403)
  }

  return { userId: user.id, email: user.email, role }
}

export function authorizationErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AuthorizationError)) return null
  return Response.json(
    { error: error.message },
    {
      status: error.status,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
