import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

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
  findCompatibleScriptsForAction,
} from '../src/features/script-registry/operational-settings.ts'
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
