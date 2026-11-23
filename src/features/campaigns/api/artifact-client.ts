import { getRpaApiBaseUrl } from '@/lib/api/config'
import { ApiError } from '@/lib/api/errors'

function joinUrl(base: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!base) return normalizedPath
  return `${base}${normalizedPath}`
}

/**
 * Fetches an authenticated Staff Campaign Artifact binary as a Blob.
 * Uses Staff session cookie (credentials: 'include') and never exposes Client API keys.
 */
export async function fetchArtifactImageBlob(
  pathOrUrl: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const url = joinUrl(getRpaApiBaseUrl(), pathOrUrl)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'image/*,*/*',
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal,
    })
  } catch (err) {
    if (
      signal?.aborted ||
      (err instanceof DOMException && err.name === 'AbortError')
    ) {
      throw new ApiError('Request cancelled.', { kind: 'abort', status: null })
    }
    throw new ApiError('Network error loading screenshot.', {
      kind: 'network',
      status: null,
      cause: err,
    })
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new ApiError('Unauthorized to load screenshot.', {
        kind: 'auth',
        status: 401,
      })
    }
    if (response.status === 403) {
      throw new ApiError('Permission denied to load screenshot.', {
        kind: 'forbidden',
        status: 403,
      })
    }
    if (response.status === 404 || response.status === 410) {
      throw new ApiError('Screenshot binary unavailable.', {
        kind: 'not_found',
        status: response.status,
      })
    }
    throw new ApiError(`Failed to load screenshot (HTTP ${response.status}).`, {
      kind: response.status >= 500 ? 'server' : 'unknown',
      status: response.status,
    })
  }

  const blob = await response.blob()
  if (!blob || blob.size === 0) {
    throw new ApiError('Screenshot binary unavailable.', {
      kind: 'not_found',
      status: response.status,
    })
  }
  return blob
}
