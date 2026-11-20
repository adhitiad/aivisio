import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from './auth'

/** Session BetterAuth dari request saat ini (server route / server function). */
export async function getApiSession() {
  return auth.api.getSession({ headers: getRequestHeaders() })
}
