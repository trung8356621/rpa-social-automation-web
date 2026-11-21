import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ActionTagItem, Site } from '../src/features/action-tags/types.ts'
import { buildLiveCampaignV2CreateBody } from '../src/features/campaigns/api/build-create-payload.ts'
import { mapLiveCampaign } from '../src/features/campaigns/api/mappers.ts'
import { mockCampaignAdapter, resetMockCampaignStore } from '../src/features/campaigns/api/mock-adapter.ts'
import {
  buildCreateCampaignV2Input,
  buildV2DraftPlanPayload,
  createPlannedContentItem,
  formatCampaignV2ApiError,
  groupTagsByCompatibleSchema,
  inspectBackendPersistenceSupport,
  resolveActionTagScript,
  scriptTargetKey,
  validateStep1Plan,
  validateStep2Plan,
} from '../src/features/campaigns/multi-tag-plan.ts'
import { canStartCampaign, isCampaignV2 } from '../src/features/campaigns/validation.ts'
import { ApiError } from '../src/lib/api/errors.ts'
import { emptyScheduleForm, scheduleFormToApi } from '../src/features/campaigns/schedule.ts'
import { unavailableScriptInputSchema } from '../src/features/campaigns/script-compat.ts'
import { emptyShortcodeMappingEntry } from '../src/features/campaigns/shortcode-mapping.ts'
import type { ScriptInputSchema } from '../src/features/campaigns/types.ts'
import type { ScriptListItem } from '../src/features/script-registry/types.ts'

const SITES: Site[] = [
  {
    id: 1,
    key: 'mayhopphat',
    name: 'MayHopPhat',
    base_url: 'https://mayhopphat.example',
    cms_type: 'wordpress',
  },
  {
    id: 2,
    key: 'blog2',
    name: 'Blog Two',
    base_url: 'https://blog2.example',
    cms_type: 'wordpress',
  },
  {
    id: 3,
    key: 'facebook',
    name: 'Facebook',
    base_url: 'https://facebook.com',
    cms_type: null,
  },
]

const TAGS: ActionTagItem[] = [
  {
    id: 1,
    tag_key: 'mayhopphat.create_post',
    site_key: 'mayhopphat',
    site_name: 'MayHopPhat',
    path_key: 'create_post',
    path_name: 'Create Post',
    name: 'MayHopPhat Create Post',
    scripts_count: 1,
    ready: true,
    enabled: true,
  },
  {
    id: 2,
    tag_key: 'blog2.create_post',
    site_key: 'blog2',
    site_name: 'Blog Two',
    path_key: 'create_post',
    path_name: 'Create Post',
    name: 'Blog Two Create Post',
    scripts_count: 0,
    ready: true,
    enabled: true,
  },
  {
    id: 3,
    tag_key: 'facebook.group.post',
    site_key: 'facebook',
    site_name: 'Facebook',
    path_key: 'group.post',
    path_name: 'Group Post',
    name: 'Facebook Group Post',
    scripts_count: 1,
    ready: true,
    enabled: true,
  },
  {
    id: 4,
    tag_key: 'blog2.disabled_tag',
    site_key: 'blog2',
    site_name: 'Blog Two',
    path_key: 'disabled_tag',
    path_name: 'Disabled Tag',
    name: 'Disabled Tag',
    scripts_count: 1,
    ready: false,
    enabled: false,
  },
  {
    id: 5,
    tag_key: 'facebook.missing_script',
    site_key: 'facebook',
    site_name: 'Facebook',
    path_key: 'missing_script',
    path_name: 'Missing Script',
    name: 'Missing Script Tag',
    scripts_count: 0,
    ready: false,
    enabled: true,
  },
]

const SCRIPTS: ScriptListItem[] = [
  {
    package_key: 'mayhopphat.create_post',
    script_id: 'mayhopphat.create_post',
    name: 'WP Create Post',
    action_tag_key: 'mayhopphat.create_post',
    version: '1.2.0',
    release_id: 101,
    status: 'published',
    assets_complete: true,
    video_demo_status: 'ready',
    has_playable_video: true,
    has_thumbnail: true,
    video_media_id: 1,
    thumbnail_media_id: 2,
    thumbnail_url: null,
    video_url: null,
    last_sync_label: 'now',
    updated_by_label: 'staff',
    sharing_mode: 'cms_global',
    global_scope: 'wordpress:create_post',
  },
  {
    package_key: 'facebook.group.post',
    script_id: 'facebook.group.post',
    name: 'FB Group Post',
    action_tag_key: 'facebook.group.post',
    version: '2.0.0',
    release_id: 202,
    status: 'published',
    assets_complete: true,
    video_demo_status: 'ready',
    has_playable_video: true,
    has_thumbnail: true,
    video_media_id: 3,
    thumbnail_media_id: 4,
    thumbnail_url: null,
    video_url: null,
    last_sync_label: 'now',
    updated_by_label: 'staff',
    sharing_mode: 'site_specific',
    global_scope: null,
  },
]

const WP_SCHEMA: ScriptInputSchema = {
  fields: [],
  test_mode_compatible: false,
  title_required: true,
  body_required: true,
  schema_available: true,
  title_supported: true,
  body_supported: true,
  unavailable_reason: null,
}

const FB_SCHEMA: ScriptInputSchema = {
  fields: [{ key: 'caption', type: 'text', required: true, label: 'Caption' }],
  test_mode_compatible: true,
  title_required: false,
  body_required: false,
  schema_available: true,
  title_supported: false,
  body_supported: false,
  unavailable_reason: null,
}

describe('Campaign Create V2 — Multi-Tag Planning', () => {
  it('resolves site_specific > cms_global > missing without fabricating disabled/missing Scripts', () => {
    const siteMap = new Map(SITES.map((s) => [s.key, s]))

    const wpDirect = resolveActionTagScript(TAGS[0]!, siteMap.get('mayhopphat'), SCRIPTS)
    assert.equal(wpDirect.resolution_source, 'site_specific')
    assert.equal(wpDirect.effective_script?.package_key, 'mayhopphat.create_post')
    assert.equal(wpDirect.effective_script?.version, '1.2.0')
    assert.equal(wpDirect.effective_script?.release_id, 101)
    assert.equal(wpDirect.is_runnable, true)

    const wpGlobal = resolveActionTagScript(TAGS[1]!, siteMap.get('blog2'), SCRIPTS)
    assert.equal(wpGlobal.resolution_source, 'cms_global')
    assert.equal(wpGlobal.effective_script?.package_key, 'mayhopphat.create_post')
    assert.equal(wpGlobal.is_runnable, true)

    const disabled = resolveActionTagScript(TAGS[3]!, siteMap.get('blog2'), SCRIPTS)
    assert.equal(disabled.tag_enabled, false)
    assert.equal(disabled.is_runnable, false)
    assert.match(disabled.status_reason ?? '', /disabled/i)

    const missing = resolveActionTagScript(TAGS[4]!, siteMap.get('facebook'), SCRIPTS)
    assert.equal(missing.resolution_source, 'missing')
    assert.equal(missing.effective_script, null)
    assert.equal(missing.is_runnable, false)
  })

  it('Step 1 validation rejects empty name, zero tags, and disabled/missing-script tags', () => {
    const siteMap = new Map(SITES.map((s) => [s.key, s]))
    const wpDirect = resolveActionTagScript(TAGS[0]!, siteMap.get('mayhopphat'), SCRIPTS)
    const missing = resolveActionTagScript(TAGS[4]!, siteMap.get('facebook'), SCRIPTS)

    assert.equal(validateStep1Plan({ name: '', resolvedTags: [wpDirect] }).ok, false)
    assert.equal(validateStep1Plan({ name: 'Test', resolvedTags: [] }).ok, false)
    assert.equal(validateStep1Plan({ name: 'Test', resolvedTags: [wpDirect, missing] }).ok, false)
    assert.equal(validateStep1Plan({ name: 'Test', resolvedTags: [wpDirect] }).ok, true)
  })

  it('groups compatible schemas together and separates incompatible Script schemas', () => {
    const siteMap = new Map(SITES.map((s) => [s.key, s]))
    const resolved = [
      resolveActionTagScript(TAGS[0]!, siteMap.get('mayhopphat'), SCRIPTS),
      resolveActionTagScript(TAGS[1]!, siteMap.get('blog2'), SCRIPTS),
      resolveActionTagScript(TAGS[2]!, siteMap.get('facebook'), SCRIPTS),
    ]

    const schemaLookup = {
      [scriptTargetKey('mayhopphat.create_post', '1.2.0')]: {
        schema: WP_SCHEMA,
        loading: false,
        error: null,
      },
      [scriptTargetKey('facebook.group.post', '2.0.0')]: {
        schema: FB_SCHEMA,
        loading: false,
        error: null,
      },
    }

    const groups = groupTagsByCompatibleSchema(
      resolved,
      schemaLookup,
      (reason) => unavailableScriptInputSchema(null, reason),
    )
    assert.equal(groups.length, 2)
    assert.deepEqual(groups[0]!.tag_keys, ['mayhopphat.create_post', 'blog2.create_post'])
    assert.deepEqual(groups[1]!.tag_keys, ['facebook.group.post'])
  })

  it('validates multi-content targeting different Tags, required variables, and builds explicit associations', () => {
    const siteMap = new Map(SITES.map((s) => [s.key, s]))
    const resolved = [
      resolveActionTagScript(TAGS[0]!, siteMap.get('mayhopphat'), SCRIPTS),
      resolveActionTagScript(TAGS[1]!, siteMap.get('blog2'), SCRIPTS),
      resolveActionTagScript(TAGS[2]!, siteMap.get('facebook'), SCRIPTS),
    ]
    const schemaLookup = {
      [scriptTargetKey('mayhopphat.create_post', '1.2.0')]: {
        schema: WP_SCHEMA,
        loading: false,
        error: null,
      },
      [scriptTargetKey('facebook.group.post', '2.0.0')]: {
        schema: FB_SCHEMA,
        loading: false,
        error: null,
      },
    }
    const groups = groupTagsByCompatibleSchema(
      resolved,
      schemaLookup,
      (reason) => unavailableScriptInputSchema(null, reason),
    )
    const mappingsByGroupKey = {
      [groups[0]!.group_key]: [
        emptyShortcodeMappingEntry({ shortcode: 'title', variable: 'title' }),
        emptyShortcodeMappingEntry({ shortcode: 'body', variable: 'body' }),
      ],
      [groups[1]!.group_key]: [
        emptyShortcodeMappingEntry({ shortcode: 'body', variable: 'caption' }),
      ],
    }

    // Rejects mixing incompatible schema tags on one content item
    const mixed = validateStep2Plan({
      groups,
      mappingsByGroupKey,
      resolvedTags: resolved,
      contents: [
        createPlannedContentItem({
          external_ref: 'mixed-1',
          target_tag_keys: ['mayhopphat.create_post', 'facebook.group.post'],
          raw_source: '[title]Hi[/title][body]World[/body]',
        }),
      ],
    })
    assert.equal(mixed.ok, false)

    // Rejects missing required shortcode in content
    const missingReq = validateStep2Plan({
      groups,
      mappingsByGroupKey,
      resolvedTags: resolved,
      contents: [
        createPlannedContentItem({
          external_ref: 'wp-1',
          target_tag_keys: ['mayhopphat.create_post'],
          raw_source: '[body]Only body[/body]',
        }),
      ],
    })
    assert.equal(missingReq.ok, false)

    // Accepts valid multi-content targeting different tags + builds V2 payload
    const valid = validateStep2Plan({
      groups,
      mappingsByGroupKey,
      resolvedTags: resolved,
      contents: [
        createPlannedContentItem({
          external_ref: 'wp-1',
          target_tag_keys: ['mayhopphat.create_post', 'blog2.create_post'],
          raw_source: '[title]Hello[/title][body]WP Post[/body]',
        }),
        createPlannedContentItem({
          external_ref: 'fb-1',
          target_tag_keys: ['facebook.group.post'],
          raw_source: '[body]FB Caption[/body]',
        }),
      ],
    })
    assert.equal(valid.ok, true)
    if (!valid.ok) return

    const payload = buildV2DraftPlanPayload({
      name: 'Launch Plan',
      run_mode: 'live',
      resolvedTags: resolved,
      groups,
      groupMappings: valid.groupMappings,
      validatedContents: valid.validatedContents,
    })
    assert.equal(payload.status, 'draft')
    assert.equal(payload.action_tags.length, 3)
    assert.equal(payload.action_tags[1]!.resolution_source, 'cms_global')
    assert.equal(payload.action_tags[1]!.release_id, 101)
    assert.equal(payload.contents.length, 2)
    assert.deepEqual(payload.contents[0]!.action_tag_keys, [
      'mayhopphat.create_post',
      'blog2.create_post',
    ])
  })

  it('supports LIVE and MOCK V2 Draft creation without account_id and no execution/claim calls', async () => {
    const siteMap = new Map(SITES.map((s) => [s.key, s]))
    const wpDirect = resolveActionTagScript(TAGS[0]!, siteMap.get('mayhopphat'), SCRIPTS)
    const fbDirect = resolveActionTagScript(TAGS[2]!, siteMap.get('facebook'), SCRIPTS)

    const liveSupport = inspectBackendPersistenceSupport({
      mode: 'live',
      resolvedTags: [wpDirect, fbDirect],
      contents: [],
    })
    assert.equal(liveSupport.supported, true)

    const mockMulti = inspectBackendPersistenceSupport({
      mode: 'mock',
      resolvedTags: [wpDirect, fbDirect],
      contents: [],
    })
    assert.equal(mockMulti.supported, true)

    const schemaLookup = {
      [scriptTargetKey('mayhopphat.create_post', '1.2.0')]: {
        schema: WP_SCHEMA,
        loading: false,
        error: null,
      },
      [scriptTargetKey('facebook.group.post', '2.0.0')]: {
        schema: FB_SCHEMA,
        loading: false,
        error: null,
      },
    }
    const groups = groupTagsByCompatibleSchema(
      [wpDirect, fbDirect],
      schemaLookup,
      (reason) => unavailableScriptInputSchema(null, reason),
    )
    const mappingsByGroupKey = {
      [groups[0]!.group_key]: [
        emptyShortcodeMappingEntry({ shortcode: 'title', variable: 'title' }),
        emptyShortcodeMappingEntry({ shortcode: 'body', variable: 'body' }),
      ],
      [groups[1]!.group_key]: [
        emptyShortcodeMappingEntry({ shortcode: 'body', variable: 'caption' }),
      ],
    }
    const step2 = validateStep2Plan({
      groups,
      mappingsByGroupKey,
      resolvedTags: [wpDirect, fbDirect],
      contents: [
        createPlannedContentItem({
          external_ref: 'wp-1',
          target_tag_keys: ['mayhopphat.create_post'],
          raw_source: '[title]Hello[/title][body]World[/body]',
        }),
        createPlannedContentItem({
          external_ref: 'fb-1',
          target_tag_keys: ['facebook.group.post'],
          raw_source: '[body]FB Post[/body]',
        }),
      ],
    })
    assert.equal(step2.ok, true)
    if (!step2.ok) return

    const v2Input = buildCreateCampaignV2Input({
      name: 'V2 Multi-Tag Draft',
      run_mode: 'live',
      resolvedTags: [wpDirect, fbDirect],
      groups,
      groupMappings: step2.groupMappings,
      validatedContents: step2.validatedContents,
    })
    const liveBody = buildLiveCampaignV2CreateBody(v2Input)
    assert.equal(liveBody.plan_version, 2)
    assert.equal('account_id' in liveBody, false)
    assert.equal(liveBody.action_tags.length, 2)
    assert.equal(liveBody.action_tags[0]!.release_id, 101)
    assert.equal(liveBody.contents.length, 2)
    assert.equal(liveBody.contents[0]!.assignments.length, 1)
    assert.equal(
      liveBody.contents[0]!.assignments[0]!.action_tag_key,
      'mayhopphat.create_post',
    )

    resetMockCampaignStore()
    const created = await mockCampaignAdapter.createCampaignV2(v2Input)
    assert.equal(created.plan_version, 2)
    assert.equal(created.status, 'draft')
    assert.equal(created.account_id, null)
    assert.equal(created.action_tags?.length, 2)
    assert.equal(created.allowed_actions.includes('start'), false)
    assert.equal(isCampaignV2(created), true)
    const startCheck = canStartCampaign(created, [], null)
    assert.equal(startCheck.ok, false)
    assert.match(startCheck.reasons[0] ?? '', /not implemented yet/i)
  })

  it('parses Backend V2 GET/POST response, preserves V1 backward compatibility, and formats 409/422 errors', () => {
    const v2Mapped = mapLiveCampaign({
      id: 'camp_v2_99',
      plan_version: 2,
      name: 'Server V2 Draft',
      status: 'draft',
      run_mode: 'live',
      account_id: null,
      action_tags: [
        {
          action_tag_id: 1,
          action_tag_key: 'mayhopphat.create_post',
          site_key: 'mayhopphat',
          site_name: 'MayHopPhat',
          cms_type: 'wordpress',
          script_package_key: 'mayhopphat.create_post',
          script_name: 'WP Create Post',
          script_version: '1.2.0',
          release_id: 101,
          resolution_source: 'site_specific',
          shortcode_mapping: {
            entries: [{ shortcode: 'body', variable: 'body' }],
          },
        },
      ],
      contents: [
        {
          id: 'cnt_1',
          external_ref: 'wp-1',
          status: 'pending',
          source_format: 'shortcode',
          raw_source: '[body]Hello[/body]',
          assignments: [
            {
              id: 'asgn_1',
              action_tag_key: 'mayhopphat.create_post',
              script_package_key: 'mayhopphat.create_post',
              script_version: '1.2.0',
              release_id: 101,
              status: 'pending',
            },
          ],
        },
      ],
    })
    assert.equal(v2Mapped.plan_version, 2)
    assert.equal(isCampaignV2(v2Mapped), true)
    assert.equal(v2Mapped.action_tags?.length, 1)
    assert.equal(v2Mapped.contents?.[0]?.assignments?.length, 1)
    assert.equal(canStartCampaign(v2Mapped, v2Mapped.contents ?? [], null).ok, false)

    // Legacy V1 row still maps cleanly without plan_version: 2
    const v1Mapped = mapLiveCampaign({
      id: 'camp_v1_1',
      name: 'Legacy V1',
      platform: 'mayhopphat',
      script_id: 'mayhopphat.create_post',
      script_version: '1.0.0',
      account_id: 'acc-1',
      status: 'draft',
      run_mode: 'live',
      total_contents: 1,
    })
    assert.equal(isCampaignV2(v1Mapped), false)
    assert.equal(v1Mapped.account_id, 'acc-1')

    // 409 Stale Release conflict formatting
    const err409 = new ApiError('Pinned script release is stale.', {
      kind: 'conflict',
      status: 409,
      details: {
        action_tag_key: 'mayhopphat.create_post',
        expected_release_id: 101,
        actual_release_id: 105,
      },
    })
    const formatted409 = formatCampaignV2ApiError(err409)
    assert.equal(formatted409.isStaleReleaseConflict, true)
    assert.deepEqual(formatted409.conflictTags, ['mayhopphat.create_post'])
    assert.match(formatted409.message, /#101 vs current #105/)

    // 422 Validation error formatting
    const err422 = new ApiError('The given data was invalid.', {
      kind: 'validation',
      status: 422,
      details: {
        errors: {
          name: ['The name field is required.'],
        },
      },
    })
    const formatted422 = formatCampaignV2ApiError(err422)
    assert.equal(formatted422.isStaleReleaseConflict, false)
    assert.deepEqual(formatted422.validationErrors, [
      'name: The name field is required.',
    ])
  })
})
