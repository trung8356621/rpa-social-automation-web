import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EMPTY_SCRIPT_REGISTRY, MOCK_SCRIPT_REGISTRY } from './mock-data'
import { applyMockOperationalSettings } from './operational-settings'
import type {
  DemoScenario,
  ScriptOperationalSettingsInput,
  ScriptRegistryData,
  ScriptSharingMode,
} from './types'

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

  const updateScriptSharing = useCallback(
    async (packageKey: string, sharingMode: ScriptSharingMode) => {
      await delay(200)
      const target = data.scripts.find((s) => s.package_key === packageKey)
      if (!target) throw new Error('Script không tồn tại.')
      if (sharingMode === 'cms_global' && target.global_eligible === false) {
        const msg =
          target.global_ineligible_reason ||
          'Script không đủ điều kiện chia sẻ CMS Global.'
        showToast(msg, 'error')
        throw new Error(msg)
      }
      const targetScope =
        target.eligible_global_scope?.scope ?? target.global_scope ?? null
      if (sharingMode === 'cms_global' && targetScope) {
        const conflict = data.scripts.find(
          (s) =>
            s.package_key !== packageKey &&
            s.sharing_mode === 'cms_global' &&
            (s.global_scope === targetScope ||
              s.eligible_global_scope?.scope === targetScope),
        )
        if (conflict) {
          const msg = `Xung đột CMS Global (409): [${conflict.name}] đã chia sẻ scope ${targetScope}.`
          showToast(msg, 'error')
          throw new Error(msg)
        }
      }

      const nextScope = sharingMode === 'cms_global' ? targetScope : null
      setData((prev) => ({
        scripts: prev.scripts.map((s) =>
          s.package_key === packageKey
            ? { ...s, sharing_mode: sharingMode, global_scope: nextScope }
            : s,
        ),
        details: Object.fromEntries(
          Object.entries(prev.details).map(([k, d]) =>
            k === packageKey
              ? [k, { ...d, sharing_mode: sharingMode, global_scope: nextScope }]
              : [k, d],
          ),
        ),
      }))
      showToast(
        sharingMode === 'cms_global'
          ? 'Đã bật chia sẻ CMS Global (MOCK local).'
          : 'Đã chuyển về Site-specific (MOCK local).',
      )
    },
    [data.scripts, showToast],
  )

  const updateOperationalSettings = useCallback(
    async (packageKey: string, input: ScriptOperationalSettingsInput) => {
      await delay(120)
      setData((prev) =>
        applyMockOperationalSettings(
          prev.scripts,
          prev.details,
          packageKey,
          input,
        ),
      )
      showToast('Operational settings updated (MOCK local).')
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
    updateScriptSharing,
    updateOperationalSettings,
  }
}
