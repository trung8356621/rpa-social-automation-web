export type ApiErrorKind =
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'server'
  | 'network'
  | 'timeout'
  | 'abort'
  | 'parse'
  | 'unknown'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly code: string | null

  constructor(
    message: string,
    options: {
      kind: ApiErrorKind
      status?: number | null
      code?: string | null
      cause?: unknown
    },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'ApiError'
    this.kind = options.kind
    this.status = options.status ?? null
    this.code = options.code ?? null
  }

  get isAuthRequired(): boolean {
    return this.kind === 'auth'
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

/** Safe user-facing message — never include cookies, tokens, or raw bodies. */
export function toSafeApiMessage(error: unknown): string {
  if (isApiError(error)) return error.message
  if (error instanceof Error && error.message) {
    return 'Request failed. Please try again.'
  }
  return 'Unexpected error. Please try again.'
}
