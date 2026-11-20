/** Distinguish Loading / Error / Empty / Ready for Articles table. */
export function resolveArticlesListState(options: {
  loading: boolean
  error: string | null | undefined
  rowCount: number
}): 'loading' | 'error' | 'empty' | 'ready' {
  if (options.loading) return 'loading'
  if (options.error) return 'error'
  if (options.rowCount <= 0) return 'empty'
  return 'ready'
}
