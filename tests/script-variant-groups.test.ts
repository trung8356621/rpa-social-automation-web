import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { mapLiveCampaign } from '../src/features/campaigns/api/mappers.ts'
import type { ScriptListItem } from '../src/features/script-registry/types.ts'
import {
  partitionScriptsIntoVariantGroups,
  removeVariantFromGroup,
  reorderVariantPriority,
  setVariantLanguageLabel,
  validateVariantLanguageLabels,
} from '../src/features/script-registry/variant-groups.ts'

function makeScript(overrides: Partial<ScriptListItem>): ScriptListItem {
  return {
    package_key: 'script.wp.create_post.vi',
    script_id: 'wp.create_post.vi',
    name: 'WordPress create_post / VI',
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
    sharing_mode: 'site_specific',
    global_scope: null,
    global_eligible: true,
    global_ineligible_reason: null,
    eligible_global_scope: {
      scope: 'wordpress:create_post',
      cms_type: 'wordpress',
      path_template: 'create_post',
    },
    global_conflict: null,
    ...overrides,
  }
}

test('single-language legacy scripts remain ungrouped cards', () => {
  const legacy = makeScript({
    package_key: 'mayhopphat.create_post',
    script_id: 'mayhopphat.create_post',
    name: 'WordPress Create Post',
    eligible_global_scope: null,
  })
  const singleScoped = makeScript({
    package_key: 'facebook.group_post',
    script_id: 'facebook.group_post',
    name: 'Facebook Group Post',
    eligible_global_scope: {
      scope: 'facebook:group_post',
      cms_type: 'facebook',
      path_template: 'group_post',
    },
  })

  const part = partitionScriptsIntoVariantGroups([legacy, singleScoped])
  assert.equal(part.groups.length, 0)
  assert.equal(part.ungrouped.length, 2)
})

test('two-language WordPress group (VI + EN) groups under one logical Action and preserves conflict', () => {
  const vi = makeScript({
    package_key: 'wp.create_post.vi',
    script_id: 'wp.create_post.vi',
    name: 'WordPress create_post / VI',
    version: '1.0.0',
    release_id: 101,
    sharing_mode: 'cms_global',
    global_scope: 'wordpress:create_post',
  })
  const en = makeScript({
    package_key: 'wp.create_post.en',
    script_id: 'wp.create_post.en',
    name: 'WordPress create_post / EN',
    version: '1.1.0',
    release_id: 102,
    sharing_mode: 'site_specific',
    global_conflict: {
      package_key: 'wp.create_post.vi',
      script_id: 'wp.create_post.vi',
      name: 'WordPress create_post / VI',
      global_scope: 'wordpress:create_post',
    },
  })

  const part = partitionScriptsIntoVariantGroups([vi, en])
  assert.equal(part.groups.length, 1)
  assert.equal(part.ungrouped.length, 0)

  const group = part.groups[0]!
  assert.equal(group.scope, 'wordpress:create_post')
  assert.equal(group.sharing_mode, 'cms_global')
  assert.equal(group.has_sharing_conflict, true)
  assert.equal(group.has_duplicate_languages, false)
  assert.equal(group.variants.length, 2)
  assert.equal(group.variants[0]?.language_label, 'VI')
  assert.equal(group.variants[0]?.fallback_priority, 1)
  assert.equal(group.variants[0]?.release_id, 101)
  assert.equal(group.variants[1]?.language_label, 'EN')
  assert.equal(group.variants[1]?.fallback_priority, 2)
  assert.equal(group.variants[1]?.release_id, 102)
  // Real conflict is preserved, never hidden
  assert.ok(group.variants[1]?.global_conflict)
})

test('three-language group, duplicate language labels, fallback ordering, and variant removal', () => {
  const vi = makeScript({ package_key: 'wp.vi', name: 'WP / VI', release_id: 1 })
  const en = makeScript({ package_key: 'wp.en', name: 'WP / EN', release_id: 2 })
  const ja = makeScript({ package_key: 'wp.ja', name: 'WP / JA', release_id: 3 })

  const part = partitionScriptsIntoVariantGroups([vi, en, ja])
  assert.equal(part.groups.length, 1)
  let variants = part.groups[0]!.variants
  assert.deepEqual(
    variants.map((v) => v.language_label),
    ['VI', 'EN', 'JA'],
  )

  // Reorder JA up -> becomes #2
  variants = reorderVariantPriority(variants, 'wp.ja', 'up')
  assert.deepEqual(
    variants.map((v) => [v.language_label, v.fallback_priority]),
    [
      ['VI', 1],
      ['JA', 2],
      ['EN', 3],
    ],
  )

  // Duplicate language label detection
  const dupAttempt = setVariantLanguageLabel(variants, 'wp.ja', 'vi')
  assert.equal(dupAttempt.validation.ok, false)
  if (!dupAttempt.validation.ok) {
    assert.deepEqual(dupAttempt.validation.duplicates, ['VI'])
  }

  // Valid language label update
  const okUpdate = setVariantLanguageLabel(variants, 'wp.ja', 'JP')
  assert.equal(okUpdate.validation.ok, true)
  assert.equal(
    validateVariantLanguageLabels(okUpdate.variants).ok,
    true,
  )

  // Remove variant before Campaign Start -> priorities renumbered
  const afterRemove = removeVariantFromGroup(okUpdate.variants, 'wp.en')
  assert.deepEqual(
    afterRemove.map((v) => [v.package_key, v.fallback_priority]),
    [
      ['wp.vi', 1],
      ['wp.ja', 2],
    ],
  )
})

test('existing Campaign release pinning remains immutable per Script package_key and release_id', () => {
  const pinnedCampaign = mapLiveCampaign({
    id: 'camp_pinned_1',
    plan_version: 2,
    name: 'Pinned Variant Release Campaign',
    status: 'running',
    action_tags: [
      {
        action_tag_id: 1,
        action_tag_key: 'mayhopphat.create_post',
        site_key: 'mayhopphat',
        site_name: 'MayHopPhat',
        cms_type: 'wordpress',
        script_package_key: 'wp.create_post.vi',
        script_name: 'WordPress create_post / VI',
        script_version: '1.0.0',
        release_id: 101,
        resolution_source: 'cms_global',
      },
    ],
  })

  assert.equal(pinnedCampaign.action_tags?.[0]?.script_package_key, 'wp.create_post.vi')
  assert.equal(pinnedCampaign.action_tags?.[0]?.script_version, '1.0.0')
  assert.equal(pinnedCampaign.action_tags?.[0]?.release_id, 101)
})

test('missing Backend API keeps LIVE mode read-only with no invented endpoints', () => {
  const part = partitionScriptsIntoVariantGroups([
    makeScript({ package_key: 'wp.vi', name: 'WP / VI' }),
    makeScript({ package_key: 'wp.en', name: 'WP / EN' }),
  ])
  assert.equal(part.groups[0]?.backend_supported, false)

  const cardSrc = readFileSync(
    resolve(
      process.cwd(),
      'src/features/script-registry/components/ScriptVariantGroupCard.tsx',
    ),
    'utf8',
  )
  assert.equal(cardSrc.includes("mode === 'live'"), true)
  assert.equal(cardSrc.includes('Read-only (LIVE)'), true)

  const screenSrc = readFileSync(
    resolve(
      process.cwd(),
      'src/features/script-registry/components/ScriptsScreen.tsx',
    ),
    'utf8',
  )
  assert.equal(
    screenSrc.includes('Backend variant group & fallback priority persistence API is not available yet.'),
    true,
  )
})
