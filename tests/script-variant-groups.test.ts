import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  formatVariantGroupApiError,
  isVariantGroupsApiUnavailableError,
  mapVariantGroupDto,
  VARIANT_GROUP_PATHS,
} from '../src/features/script-registry/api/variant-groups-contract.ts'
import {
  mockVariantGroupApi,
  resetMockVariantGroups,
} from '../src/features/script-registry/api/mock-variant-groups-api.ts'
import { mapLiveCampaign } from '../src/features/campaigns/api/mappers.ts'
import { ApiError } from '../src/lib/api/errors.ts'
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
  assert.equal(screenSrc.includes('Create Variant Group'), false)
})

test('LIVE Variant Group routes, DTO mapping, CRUD lifecycle, conflict, unauthorized, and unavailable state', async () => {
  // Exact routes from seo-ops-addons-rpa@bccb621
  assert.equal(
    VARIANT_GROUP_PATHS.list,
    '/social-automation/api/script-registry/variant-groups',
  )
  assert.equal(
    VARIANT_GROUP_PATHS.detail('grp-1'),
    '/social-automation/api/script-registry/variant-groups/grp-1',
  )
  assert.equal(
    VARIANT_GROUP_PATHS.addVariant('grp-1'),
    '/social-automation/api/script-registry/variant-groups/grp-1/variants',
  )
  assert.equal(
    VARIANT_GROUP_PATHS.updateVariant('grp-1', 'var-1'),
    '/social-automation/api/script-registry/variant-groups/grp-1/variants/var-1',
  )
  assert.equal(
    VARIANT_GROUP_PATHS.removeVariant('grp-1', 'var-1'),
    '/social-automation/api/script-registry/variant-groups/grp-1/variants/var-1',
  )
  assert.equal(
    VARIANT_GROUP_PATHS.reorder('grp-1'),
    '/social-automation/api/script-registry/variant-groups/grp-1/reorder',
  )

  // Map persisted GroupDTO
  const mapped = mapVariantGroupDto({
    id: 'grp-uuid-1',
    name: 'WordPress Create Post',
    scope_type: 'cms_global',
    cms_type: 'wordpress',
    cms_path_key: 'create_post',
    global_scope_key: 'wordpress:create_post',
    is_enabled: true,
    variants: [
      {
        id: 'var-en',
        priority: 2,
        language_label: 'EN',
        package_id: 2,
        package_key: 'wp.create_post.en',
        script_id: 'wp.create_post.en',
        script_name: 'WP Create Post EN',
        release_id: 202,
        script_version: '1.1.0',
        release_status: 'published',
        is_enabled: true,
      },
      {
        id: 'var-vi',
        priority: 1,
        language_label: 'VI',
        package_id: 1,
        package_key: 'wp.create_post.vi',
        script_id: 'wp.create_post.vi',
        script_name: 'WP Create Post VI',
        release_id: 101,
        script_version: '1.0.0',
        release_status: 'published',
        is_enabled: true,
      },
    ],
  })
  assert.equal(mapped.id, 'grp-uuid-1')
  assert.equal(mapped.variants[0]?.language_label, 'VI')
  assert.equal(mapped.variants[1]?.language_label, 'EN')

  // Full CRUD lifecycle (Create -> Add -> Edit Label -> Reorder -> Remove)
  resetMockVariantGroups()
  const created = await mockVariantGroupApi.createGroup({
    name: 'WP Create Post Group',
    scope_type: 'cms_global',
    global_scope_key: 'wordpress:create_post',
    cms_type: 'wordpress',
    cms_path_key: 'create_post',
    variants: [
      {
        package_key: 'wp.create_post.vi',
        release_id: 101,
        script_version: '1.0.0',
        language_label: 'VI',
      },
    ],
  })
  assert.equal(created.variants.length, 1)

  const afterAdd = await mockVariantGroupApi.addVariant(created.id, {
    package_key: 'wp.create_post.en',
    release_id: 102,
    script_version: '1.1.0',
    language_label: 'EN',
  })
  assert.equal(afterAdd.variants.length, 2)

  // Duplicate language label rejected
  await assert.rejects(
    () =>
      mockVariantGroupApi.addVariant(created.id, {
        package_key: 'wp.create_post.other',
        language_label: 'vi',
      }),
    /duplicate language label/i,
  )

  // Edit language label
  const enVariantId = afterAdd.variants[1]!.id
  const afterEdit = await mockVariantGroupApi.updateVariant(
    created.id,
    enVariantId,
    { language_label: 'EN-US' },
  )
  assert.equal(afterEdit.variants[1]?.language_label, 'EN-US')

  // Reorder priority (EN-US first, VI second)
  const viVariantId = afterEdit.variants[0]!.id
  const afterReorder = await mockVariantGroupApi.reorderVariants(created.id, [
    enVariantId,
    viVariantId,
  ])
  assert.deepEqual(
    afterReorder.variants.map((v) => [v.language_label, v.priority]),
    [
      ['EN-US', 1],
      ['VI', 2],
    ],
  )

  // Remove variant
  const afterRemove = await mockVariantGroupApi.removeVariant(
    created.id,
    enVariantId,
  )
  assert.equal(afterRemove.variants.length, 1)
  assert.equal(afterRemove.variants[0]?.priority, 1)

  // CMS Global conflict (409)
  await assert.rejects(
    () =>
      mockVariantGroupApi.createGroup({
        name: 'Duplicate Scope Group',
        scope_type: 'cms_global',
        global_scope_key: 'wordpress:create_post',
        variants: [
          { package_key: 'wp.other', language_label: 'JA' },
        ],
      }),
    /conflict/i,
  )

  // Error formatting: 409, 401/403, 404/503 unavailable
  const conflictMsg = formatVariantGroupApiError(
    new ApiError('Conflict', {
      kind: 'conflict',
      status: 409,
      code: 'global_scope_conflict',
      details: { conflict: { name: 'WP Create Post Group' } },
    }),
  )
  assert.match(conflictMsg, /WP Create Post Group/)

  const unauthMsg = formatVariantGroupApiError(
    new ApiError('Authentication required.', {
      kind: 'auth',
      status: 401,
    }),
  )
  assert.match(unauthMsg, /Authentication required/)

  const err404 = new ApiError('Not found', { kind: 'not_found', status: 404 })
  const err503 = new ApiError('Schema unavailable', {
    kind: 'server',
    status: 503,
    code: 'schema_unavailable',
  })
  assert.equal(isVariantGroupsApiUnavailableError(err404), true)
  assert.equal(isVariantGroupsApiUnavailableError(err503), true)
  assert.match(
    formatVariantGroupApiError(err404),
    /Variant Groups API unavailable/i,
  )
})
