import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from './auth'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  return auth.api.getSession({ headers: getRequestHeaders() })
})

export const requireSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw new Error('Unauthorized')
  return session
})

export const signOutFn = createServerFn({ method: 'POST' }).handler(async () => {
  await auth.api.signOut({ headers: getRequestHeaders() })
  return { ok: true }
})
