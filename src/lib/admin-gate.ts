/**
 * Gate untuk endpoint mutasi. Default (ADMIN_API_GATE kosong/0): izin — aplikasi
 * ini tool single-user dan landing harus tetap berfungsi tanpa login.
 * Jika ADMIN_API_GATE=1: wajib session OAuth Google/Facebook via BetterAuth.
 */
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from './auth'

export async function adminGate(): Promise<Response | null> {
  if (process.env.ADMIN_API_GATE !== '1') return null
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) {
    return Response.json(
      { error: 'Tidak diizinkan. Masuk terlebih dahulu.' },
      { status: 401 },
    )
  }
  return null
}
