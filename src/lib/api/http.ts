import { getRpaApiBaseUrl, RPA_API_TIMEOUT_MS } from './config'
import { ApiError } from './errors'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type StaffApiRequestOptions = {
  method?: HttpMethod
  /** JSON body — mutations only; CP9A live path must not send production writes */
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
  /** Include credentials for SEO-OPS session cookie (same-origin / authorized CORS) */
  credentials?: RequestCredentials
  headers?: Record<string, string>
}

type JsonObject = Record<string, unknown>

function joinUrl(base: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!base) return normalizedPath
  return `${base}${normalizedPath}`
}

function kindFromStatus(status: number): ApiError['kind'] {
  if (status === 401) return 'auth'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 422) return 'validation'
  if (status >= 500) return 'server'
  return 'unknown'
}

function messageFromStatus(status: number, code: string | null): string {
  if (status === 401) {
    return 'Authentication required. Sign in to SEO-OPS staff session, then retry.'
  }
  if (status === 403) {
    return 'Permission denied for Social Automation staff API.'
  }
  if (status === 404) return 'Resource not found.'
  if (status === 422) {
    return code ? `Validation failed (${code}).` : 'Validation failed.'
  }
  if (status === 503) {
    return code === 'schema_unavailable'
      ? 'Action Registry schema unavailable on server.'
      : 'Service temporarily unavailable.'
  }
  if (status >= 500) return 'Server error. Please try again later.'
  return `Request failed (HTTP ${status}).`
}

async function readJsonSafe(response: Response): Promise<JsonObject | null> {
  const text = await response.text()
  if (!text) return null
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as JsonObject
    }
    return null
  } catch {
    return null
  }
}

function extractErrorCode(payload: JsonObject | null): string | null {
  if (!payload) return null
  const error = payload.error
  if (typeof error === 'string' && error.trim()) return error.trim()
  const message = payload.message
  if (typeof message === 'string' && message.trim()) return message.trim()
  return null
}

/**
 * Chromium rejects fetch with the abort *reason value* when AbortController.abort(reason)
 * is called with a non-undefined reason (e.g. abort('timeout') → rejected string "timeout"),
 * not always with a DOMException AbortError.
 */
function isAbortRejection(error: unknown): boolean {
  if (typeof error === 'string') return true
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (error instanceof Error && error.name === 'AbortError') return true
  return false
}

function networkFailureMessage(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return 'Network/CORS error reaching absolute API host. Prefer empty VITE_RPA_API_BASE so DEV uses the Vite proxy (same-origin).'
  }
  return 'Network error reaching staff API via DEV proxy. Check Vite is running and proxy target is reachable.'
}

/**
 * Minimal staff API transport (native fetch).
 * Does not log cookies, tokens, or response bodies.
 */
export async function staffApiRequest<T>(
  path: string,
  options: StaffApiRequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const timeoutMs = options.timeoutMs ?? RPA_API_TIMEOUT_MS
  const base = getRpaApiBaseUrl()
  const url = joinUrl(base, path)

  const controller = new AbortController()
  let timedOut = false
  const timeoutId = window.setTimeout(() => {
    timedOut = true
    // Abort without a custom reason so fetch rejects with AbortError DOMException.
    controller.abort()
  }, timeoutMs)

  const onOuterAbort = () => {
    if (!controller.signal.aborted) controller.abort()
  }
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', onOuterAbort, { once: true })
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method,
      headers,
      credentials: options.credentials ?? 'include',
      signal: controller.signal,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

    const payload = await readJsonSafe(response)

    if (!response.ok) {
      const code = extractErrorCode(payload)
      throw new ApiError(messageFromStatus(response.status, code), {
        kind: kindFromStatus(response.status),
        status: response.status,
        code,
      })
    }

    if (payload === null) {
      throw new ApiError('Invalid JSON response from staff API.', {
        kind: 'parse',
        status: response.status,
      })
    }

    return payload as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (timedOut) {
      throw new ApiError('Request timed out.', { kind: 'timeout', status: null })
    }
    if (isAbortRejection(error) || controller.signal.aborted) {
      throw new ApiError('Request cancelled.', { kind: 'abort', status: null })
    }
    throw new ApiError(networkFailureMessage(url), {
      kind: 'network',
      status: null,
      cause: error,
    })
  } finally {
    window.clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', onOuterAbort)
  }
}
