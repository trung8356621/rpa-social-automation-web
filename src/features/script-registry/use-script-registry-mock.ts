import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EMPTY_SCRIPT_REGISTRY, MOCK_SCRIPT_REGISTRY } from './mock-data'
import type { DemoScenario, ScriptRegistryData } from './types'

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function cloneSeed(scenario: DemoScenario): ScriptRegistryData {
  if (scenario === 'empty') return structuredClone(EMPTY_SCRIPT_REGISTRY)
  if (scenario === 'missing-video') {
    const data = structuredClone(MOCK_SCRIPT_REGISTRY)
    data.scripts = data.scripts.map((s) => ({
      ...s,
      video_demo_status: 'missing' as const,
      has_playable_video: false,
      has_thumbnail: false,
      video_media_id: null,
      thumbnail_media_id: null,
      thumbnail_url: null,
      video_url: null,
    }))
    return data
  }
  return structuredClone(MOCK_SCRIPT_REGISTRY)
}

export function useScriptRegistryMock(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'

  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ScriptRegistryData>(() => cloneSeed(demo))
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type })
      window.setTimeout(() => setToast(null), 3500)
    },
    [],
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    setData(cloneSeed(demo))
    await delay(demo === 'loading' ? 1200 : 180)
    if (demo === 'error') {
      setError('MOCK ERROR — không tải được Script Registry (local demo).')
      setLoading(false)
      return
    }
    setLoading(false)
  }, [demo])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(cloneSeed(demo))
    void delay(demo === 'loading' ? 1200 : 180).then(() => {
      if (cancelled) return
      if (demo === 'error') {
        setError('MOCK ERROR — không tải được Script Registry (local demo).')
        setLoading(false)
        return
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [demo, enabled])

  const getDetail = useCallback(
    (packageKey: string) => data.details[packageKey] ?? null,
    [data.details],
  )

  const removeScript = useCallback(
    async (packageKey: string) => {
      await delay(200)
      setData((prev) => ({
        scripts: prev.scripts.filter((s) => s.package_key !== packageKey),
        details: Object.fromEntries(
          Object.entries(prev.details).filter(([k]) => k !== packageKey),
        ),
      }))
      showToast(`Đã gỡ Script [${packageKey}] trên mock local.`)
    },
    [showToast],
  )

  return {
    loading,
    error,
    data,
    toast,
    reload,
    getDetail,
    removeScript,
  }
}
