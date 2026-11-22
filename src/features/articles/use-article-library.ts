import { useCallback, useEffect, useMemo, useState } from 'react'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import { getArticleAdapter } from './api/article-adapter'
import type {
  ArticleLibraryFilters,
  LibraryArticle,
  SaveLibraryArticleInput,
} from './types'

type ToastState = { message: string; type: 'success' | 'error' } | null

export function useArticleLibrary(initialFilters?: ArticleLibraryFilters) {
  const mode: RpaApiMode = getRpaApiMode()
  const adapter = useMemo(() => getArticleAdapter(), [mode])

  const [articles, setArticles] = useState<LibraryArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type })
      window.setTimeout(() => setToast(null), 3500)
    },
    [],
  )

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)

    void adapter
      .listArticles(initialFilters, controller.signal)
      .then((rows) => {
        if (cancelled) return
        setArticles(rows)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        setError(toSafeApiMessage(err))
        setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, mode, reloadToken])

  const createArticle = useCallback(
    async (input: SaveLibraryArticleInput) => {
      const created = await adapter.createArticle(input)
      setArticles((prev) => [created, ...prev.filter((a) => a.id !== created.id)])
      showToast('Article created')
      return created
    },
    [adapter, showToast],
  )

  const updateArticle = useCallback(
    async (id: string, input: SaveLibraryArticleInput) => {
      const updated = await adapter.updateArticle(id, input)
      setArticles((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      )
      showToast('Article updated')
      return updated
    },
    [adapter, showToast],
  )

  const deleteArticle = useCallback(
    async (id: string) => {
      await adapter.deleteArticle(id)
      setArticles((prev) => prev.filter((a) => a.id !== id))
      showToast('Article deleted')
    },
    [adapter, showToast],
  )

  return {
    mode,
    adapter,
    articles,
    loading,
    error,
    toast,
    reload,
    createArticle,
    updateArticle,
    deleteArticle,
  }
}
