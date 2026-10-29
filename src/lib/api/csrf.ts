/**
 * Laravel XSRF-TOKEN cookie → X-XSRF-TOKEN header (staff session mutations).
 * Never log cookie values. DEV proxy (CP10) strips Secure so localhost can store the cookie.
 */

const XSRF_COOKIE = 'XSRF-TOKEN'

export function readXsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie ? document.cookie.split('; ') : []
  for (const part of cookies) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const name = part.slice(0, eq)
    if (name !== XSRF_COOKIE) continue
    const raw = part.slice(eq + 1)
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return null
}

/** Warm CSRF cookie when missing (same-origin / Vite DEV proxy). */
export async function ensureCsrfCookie(
  credentials: RequestCredentials = 'include',
): Promise<string | null> {
  const existing = readXsrfToken()
  if (existing) return existing

  await fetch('/sanctum/csrf-cookie', {
    method: 'GET',
    credentials,
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  return readXsrfToken()
}
