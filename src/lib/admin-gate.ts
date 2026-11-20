import { authorizationErrorResponse, requirePrincipal } from './authorization'

/**
 * Server-side admin authorization.
 * Unlike the old opt-in session gate, this always requires OWNER or ADMIN.
 */
export async function adminGate(): Promise<Response | null> {
  try {
    await requirePrincipal(['OWNER', 'ADMIN'])
    return null
  } catch (error) {
    const response = authorizationErrorResponse(error)
    if (response) return response
    throw error
  }
}
