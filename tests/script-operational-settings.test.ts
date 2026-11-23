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
  resolveEffectiveSharingForScript,
} from '../src/features/script-registry/operational-settings.ts'
import type { PersistedVariantGroup } from '../src/features/script-registry/api/variant-groups-contract.ts'
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

  const persistedGroup: PersistedVariantGroup = {
    id: 'grp_wp_1',
    name: 'wordpress:create_post',
    scope_type: 'cms_global',
    cms_type: 'wordpress',
    cms_template_id: 1,
    cms_path_key: 'create_post',
    global_scope_key: 'wordpress:create_post',
    action_tag_key: null,
    is_enabled: true,
    variants: [
      {
        id: 'var_ja',
        priority: 1,
        language_label: 'ZH-HANS',
        package_id: 2,
        package_key: 'wp.ja',
        script_id: 'wp.ja',
        script_name: 'WP JA',
        release_id: 102,
        script_version: '1.0.0',
        release_status: 'published',
        content_digest: null,
        execution_digest: null,
        published_at: null,
        is_enabled: true,
      },
      {
        id: 'var_vi',
        priority: 2,
        language_label: 'VI',
        package_id: 1,
        package_key: 'wp.vi',
        script_id: 'wp.vi',
        script_name: 'WP VI',
        release_id: 101,
        script_version: '1.0.0',
        release_status: 'published',
        content_digest: null,
        execution_digest: null,
        published_at: null,
        is_enabled: true,
      },
    ],
    created_at: null,
    updated_at: null,
  }

  const compatible = findCompatibleScriptsForAction(
    updated.details['wp.ja']!,
    updated.scripts,
    [persistedGroup],
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

test('Script role clarity: ungrouped enabled same-Action scripts show Enabled (not selected), replacement workflow & effective CMS Global sharing', () => {
  const oldVi = makeScript({
    package_key: 'wp.vi.old',
    name: 'WP VI Old',
    language_code: 'vi',
    is_primary: false,
    is_enabled: false,
    sharing_mode: 'site_specific',
  })
  const newVi = makeScript({
    package_key: 'wp.vi.new',
    name: 'WP VI New',
    language_code: 'vi',
    is_primary: true,
    is_enabled: true,
    sharing_mode: 'cms_global',
  })
  const fallbackEn = makeScript({
    package_key: 'wp.en',
    name: 'WP EN',
    language_code: 'en',
    is_primary: false,
    is_enabled: true,
    // Backend stores site_specific on fallback package row while it belongs to cms_global group
    sharing_mode: 'site_specific',
  })
  const unselectedJa = makeScript({
    package_key: 'wp.ja.unselected',
    name: 'WP JA Unselected',
    language_code: 'ja',
    is_primary: false,
    is_enabled: true,
    sharing_mode: 'site_specific',
  })

  const group: PersistedVariantGroup = {
    id: 'grp_1',
    name: 'wordpress:create_post',
    scope_type: 'cms_global',
    cms_type: 'wordpress',
    cms_template_id: 1,
    cms_path_key: 'create_post',
    global_scope_key: 'wordpress:create_post',
    action_tag_key: null,
    is_enabled: true,
    variants: [
      {
        id: 'v_new',
        priority: 1,
        language_label: 'VI',
        package_id: 2,
        package_key: 'wp.vi.new',
        script_id: 'wp.vi.new',
        script_name: 'WP VI New',
        release_id: 201,
        script_version: '2.0.0',
        release_status: 'published',
        content_digest: null,
        execution_digest: null,
        published_at: null,
        is_enabled: true,
      },
      {
        id: 'v_en',
        priority: 2,
        language_label: 'EN',
        package_id: 3,
        package_key: 'wp.en',
        script_id: 'wp.en',
        script_name: 'WP EN',
        release_id: 202,
        script_version: '1.0.0',
        release_status: 'published',
        content_digest: null,
        execution_digest: null,
        published_at: null,
        is_enabled: true,
      },
    ],
    created_at: null,
    updated_at: null,
  }

  const rows = findCompatibleScriptsForAction(
    {
      package_key: 'wp.vi.new',
      global_scope: 'wordpress:create_post',
      eligible_global_scope: null,
      action_tag_key: 'mayhopphat.create_post',
    },
    [oldVi, newVi, fallbackEn, unselectedJa],
    [group],
  )

  assert.deepEqual(
    rows.map((r) => [r.package_key, r.role, r.priority_label, r.effective_sharing_mode, r.sharing_managed_automatically]),
    [
      ['wp.vi.new', 'primary', 'Primary', 'cms_global', true],
      ['wp.en', 'fallback', 'Fallback #1', 'cms_global', true],
      ['wp.ja.unselected', 'enabled_unselected', 'Enabled (not selected)', 'site_specific', false],
      ['wp.vi.old', 'disabled', 'Disabled', 'site_specific', false],
    ],
  )

  // Fallback variant inheriting cms_global group must show checked + read-only ("Managed automatically by SEO-OPS.")
  const enSharing = resolveEffectiveSharingForScript(fallbackEn, [group])
  assert.equal(enSharing.effectiveSharingMode, 'cms_global')
  assert.equal(enSharing.sharingManagedAutomatically, true)

  // Unselected script must NOT be marked cms_global merely for sharing the Action Tag
  const jaSharing = resolveEffectiveSharingForScript(unselectedJa, [group])
  assert.equal(jaSharing.effectiveSharingMode, 'site_specific')
  assert.equal(jaSharing.sharingManagedAutomatically, false)

  const sharingPanelSrc = readFileSync(
    resolve(
      process.cwd(),
      'src/features/script-registry/components/ScriptSharingPanel.tsx',
    ),
    'utf8',
  )
  assert.equal(
    sharingPanelSrc.includes('Managed automatically by SEO-OPS.'),
    true,
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
  assert.equal(hookSrc.includes('descriptionEditSupported: false'), true)

  // Verify ScriptDetailsDrawer has inline Description editor + explicit Enable/Disable button
  const drawerSrc = readFileSync(
    resolve(
      process.cwd(),
      'src/features/script-registry/components/ScriptDetailsDrawer.tsx',
    ),
    'utf8',
  )
  assert.equal(drawerSrc.includes('editingDescription'), true)
  assert.equal(drawerSrc.includes('onSaveDescription'), true)
  assert.equal(drawerSrc.includes('Script description'), true)
  assert.equal(drawerSrc.includes("'Disable'"), true)
  assert.equal(drawerSrc.includes("'Enable'"), true)
  assert.equal(drawerSrc.includes("'Enabled' : 'Disabled'"), true)
})
