import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  mapLiveScriptDetail,
  mapLiveScriptListItem,
} from '../src/features/script-registry/api/map-script-registry.ts'
import {
  formatLanguageBadge,
  formatLanguageDisplay,
  getLanguageCatalog,
  isSupportedLanguageCode,
  normalizeLanguageCode,
  searchLanguages,
} from '../src/features/script-registry/languages.ts'
import {
  applyMockOperationalSettings,
  buildScriptConfigRequestBody,
  findCompatibleScriptsForAction,
  formatScriptConfigErrorMessage,
  isScriptConfigUnavailableError,
} from '../src/features/script-registry/operational-settings.ts'
import { ApiError } from '../src/lib/api/errors.ts'
import type {
  ScriptDetail,
  ScriptListItem,
} from '../src/features/script-registry/types.ts'

function makeScript(overrides: Partial<ScriptListItem>): ScriptListItem {
  return {
    package_key: 'wp.create_post.vi',
    script_id: 'wp.create_post.vi',
    name: 'WordPress Create Post (VI)',
    action_tag_key: 'mayhopphat.create_post',
    version: '1.0.0',
    release_id: 101,
    status: 'published',
    assets_complete: true,
    video_demo_status: 'ready',
    has_playable_video: true,
    has_thumbnail: false,
    video_media_id: null,
    thumbnail_media_id: null,
    thumbnail_url: null,
    video_url: null,
    last_sync_label: '23/11/2026',
    updated_by_label: 'rpa.creator',
    sharing_mode: 'cms_global',
    global_scope: 'wordpress:create_post',
    is_enabled: true,
    language_code: 'vi',
    is_primary: true,
    ...overrides,
  }
}

test('bundled ISO 639 / BCP 47 language dataset supports search by English name, native name, and code', () => {
  const catalog = getLanguageCatalog()
  assert.ok(catalog.length >= 180)

  // Search by English name
  const byEnglish = searchLanguages('Japanese')
  assert.equal(byEnglish.some((l) => l.code === 'ja'), true)

  // Search by native name
  const byNative = searchLanguages('Tiếng Việt')
  assert.equal(byNative.some((l) => l.code === 'vi'), true)

  const byNativeKo = searchLanguages('한국어')
  assert.equal(byNativeKo.some((l) => l.code === 'ko'), true)

  // Search by code
  const byCode = searchLanguages('zh-Hans')
  assert.equal(byCode.some((l) => l.code === 'zh-Hans'), true)
})

test('language code normalization handles legacy DEFAULT/VI/EN and BCP 47 codes', () => {
  assert.equal(normalizeLanguageCode(null), null)
  assert.equal(normalizeLanguageCode(''), null)
  assert.equal(normalizeLanguageCode('DEFAULT'), null)
  assert.equal(normalizeLanguageCode('default'), null)
  assert.equal(normalizeLanguageCode('VI'), 'vi')
  assert.equal(normalizeLanguageCode('EN'), 'en')
  assert.equal(normalizeLanguageCode('fr'), 'fr')
  assert.equal(normalizeLanguageCode('ja'), 'ja')
  assert.equal(normalizeLanguageCode('ko'), 'ko')
  assert.equal(normalizeLanguageCode('es'), 'es')
  assert.equal(normalizeLanguageCode('zh-hans'), 'zh-Hans')
  assert.equal(normalizeLanguageCode('ZH-HANT'), 'zh-Hant')

  assert.equal(isSupportedLanguageCode('ja'), true)
  assert.equal(isSupportedLanguageCode('zh-Hans'), true)
  assert.equal(isSupportedLanguageCode('DEFAULT'), true)

  assert.equal(formatLanguageDisplay(null), 'Default / Unassigned')
  assert.match(formatLanguageDisplay('ja'), /Japanese.*ja/)
  assert.equal(formatLanguageBadge('zh-Hans'), 'ZH-HANS')
  assert.equal(formatLanguageBadge('DEFAULT'), null)
})

test('operational settings enforce one primary Script per Action scope and compute compatible fallback priority', () => {
  const vi = makeScript({
    package_key: 'wp.vi',
    name: 'WP VI',
    language_code: 'vi',
    is_primary: true,
    is_enabled: true,
  })
  const ja = makeScript({
    package_key: 'wp.ja',
    name: 'WP JA',
    language_code: 'ja',
    is_primary: false,
    is_enabled: true,
  })
  const fr = makeScript({
    package_key: 'wp.fr',
    name: 'WP FR',
    language_code: 'fr',
    is_primary: false,
    is_enabled: false,
  })

  const details: Record<string, ScriptDetail> = {
    'wp.vi': {
      package_key: 'wp.vi',
      name: 'WP VI',
      action_tag_key: 'mayhopphat.create_post',
      description: null,
      updated_by_label: 'rpa.creator',
      global_scope: 'wordpress:create_post',
      is_enabled: true,
      language_code: 'vi',
      is_primary: true,
      releases: [],
    },
    'wp.ja': {
      package_key: 'wp.ja',
      name: 'WP JA',
      action_tag_key: 'mayhopphat.create_post',
      description: null,
      updated_by_label: 'rpa.creator',
      global_scope: 'wordpress:create_post',
      is_enabled: true,
      language_code: 'ja',
      is_primary: false,
      releases: [],
    },
  }

  // Promote wp.ja to Primary with language zh-Hans
  const updated = applyMockOperationalSettings(
    [vi, ja, fr],
    details,
    'wp.ja',
    {
      is_enabled: true,
      language_code: 'zh-hans',
      is_primary: true,
    },
  )

  const newVi = updated.scripts.find((s) => s.package_key === 'wp.vi')!
  const newJa = updated.scripts.find((s) => s.package_key === 'wp.ja')!
  assert.equal(newJa.is_primary, true)
  assert.equal(newJa.language_code, 'zh-Hans')
  assert.equal(newVi.is_primary, false)

  const compatible = findCompatibleScriptsForAction(
    updated.details['wp.ja']!,
    updated.scripts,
  )
  assert.deepEqual(
    compatible.map((c) => [c.package_key, c.priority_label, c.language_code]),
    [
      ['wp.ja', 'Primary', 'zh-Hans'],
      ['wp.vi', 'Fallback #1', 'vi'],
      ['wp.fr', 'Disabled', 'fr'],
    ],
  )
})

test('ScriptsScreen removes Create Variant Group / preview and ScriptDetailsDrawer gates LIVE operational settings read-only', () => {
  const screenSrc = readFileSync(
    resolve(
      process.cwd(),
      'src/features/script-registry/components/ScriptsScreen.tsx',
    ),
    'utf8',
  )
  assert.equal(screenSrc.includes('Create Variant Group'), false)
  assert.equal(screenSrc.includes('CreateVariantGroupModal'), false)
  assert.equal(screenSrc.includes('Action Variant Groups'), false)

  const cardSrc = readFileSync(
    resolve(
      process.cwd(),
      'src/features/script-registry/components/ScriptCard.tsx',
    ),
    'utf8',
  )
  assert.equal(cardSrc.includes('Primary'), true)
  assert.equal(cardSrc.includes('Disabled'), true)
  assert.equal(cardSrc.includes('formatLanguageBadge'), true)

  const drawerSrc = readFileSync(
    resolve(
      process.cwd(),
      'src/features/script-registry/components/ScriptDetailsDrawer.tsx',
    ),
    'utf8',
  )
  assert.equal(drawerSrc.includes('Operational Settings'), true)
  assert.equal(drawerSrc.includes('LanguageSelector'), true)
  assert.equal(drawerSrc.includes('Set as Primary Script for its Action'), true)
  assert.equal(drawerSrc.includes('Compatible Scripts Sharing Action'), true)
  assert.equal(drawerSrc.includes('Settings are read-only in LIVE mode.'), true)
})

test('LIVE /config contract: payload normalization, response mapping, validation errors, and unavailable handling', () => {
  // Payload building: vi, en, legacy DEFAULT, non-English zh-Hans, optional action_scope
  assert.deepEqual(
    buildScriptConfigRequestBody({
      is_enabled: true,
      language_code: 'vi',
      is_primary: true,
    }),
    {
      language_label: 'vi',
      is_enabled: true,
      is_primary: true,
    },
  )
  assert.deepEqual(
    buildScriptConfigRequestBody({
      is_enabled: false,
      language_code: null,
      is_primary: false,
    }),
    {
      language_label: 'DEFAULT',
      is_enabled: false,
      is_primary: false,
    },
  )
  assert.deepEqual(
    buildScriptConfigRequestBody(
      {
        is_enabled: true,
        language_code: 'zh-hans',
        is_primary: false,
      },
      'cms_global',
    ),
    {
      language_label: 'zh-Hans',
      is_enabled: true,
      is_primary: false,
      action_scope: 'cms_global',
    },
  )

  // Map LIVE list & detail responses from seo-ops-addons-rpa@a552b5e
  const listMapped = mapLiveScriptListItem({
    package_key: 'wp.create_post.ja',
    script_id: 'wp.create_post.ja',
    name: 'WP Create Post JA',
    version: '1.0.0',
    status: 'published',
    is_authentication: false,
    assets_complete: true,
    video_demo_status: 'ready',
    language_label: 'JA',
    is_enabled: true,
    is_primary: true,
  })
  assert.equal(listMapped.language_code, 'ja')
  assert.equal(listMapped.is_enabled, true)
  assert.equal(listMapped.is_primary, true)

  const detailMapped = mapLiveScriptDetail({
    package_key: 'wp.create_post.default',
    name: 'WP Default',
    language_label: 'DEFAULT',
    is_enabled: false,
    is_primary: false,
    releases: [],
  })
  assert.equal(detailMapped.language_code, null)
  assert.equal(detailMapped.is_enabled, false)
  assert.equal(detailMapped.is_primary, false)

  // Exact validation errors
  assert.match(
    formatScriptConfigErrorMessage(
      new ApiError('Duplicate', {
        kind: 'validation',
        status: 422,
        code: 'duplicate_language_label',
      }),
    ),
    /already uses this language label/i,
  )
  assert.match(
    formatScriptConfigErrorMessage(
      new ApiError('Disabled primary', {
        kind: 'validation',
        status: 422,
        code: 'disabled_script_cannot_be_primary',
      }),
    ),
    /disabled Script cannot be set as Primary/i,
  )
  assert.match(
    formatScriptConfigErrorMessage(
      new ApiError('Scope conflict', {
        kind: 'validation',
        status: 422,
        code: 'incompatible_variant_scope',
      }),
    ),
    /Action scope conflict/i,
  )
  assert.match(
    formatScriptConfigErrorMessage(
      new ApiError('Global conflict', {
        kind: 'conflict',
        status: 409,
        code: 'global_scope_conflict',
        details: { conflict: { name: 'WP Primary' } },
      }),
    ),
    /WP Primary/,
  )

  const err404 = new ApiError('Not found', { kind: 'not_found', status: 404 })
  const err503 = new ApiError('Unavailable', {
    kind: 'server',
    status: 503,
    code: 'schema_unavailable',
  })
  assert.equal(isScriptConfigUnavailableError(err404), true)
  assert.equal(isScriptConfigUnavailableError(err503), true)
  assert.match(
    formatScriptConfigErrorMessage(err404),
    /Operational Settings API unavailable/i,
  )

  // Verify hook wires real PATCH /config + list & detail reload
  const hookSrc = readFileSync(
    resolve(
      process.cwd(),
      'src/features/script-registry/use-script-registry.ts',
    ),
    'utf8',
  )
  assert.equal(hookSrc.includes('updateLiveScriptConfig('), true)
  assert.equal(hookSrc.includes('fetchLiveScriptRegistryList()'), true)
  assert.equal(hookSrc.includes('fetchLiveScriptRegistryDetail(packageKey)'), true)
  assert.equal(hookSrc.includes('setConfigApiUnavailable(true)'), true)
})
