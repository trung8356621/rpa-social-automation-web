import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import type {
  ActionTagItem,
  CmsTypeItem,
  PathItem,
  Site,
} from '../src/features/action-tags/types.ts'
import { resolveArticlesListState } from '../src/features/campaigns/articles-list-state.ts'
import {
  buildLiveCampaignV2CreateBody,
  buildLiveCampaignV2UpdateBody,
} from '../src/features/campaigns/api/build-create-payload.ts'
import { mapLiveCampaign } from '../src/features/campaigns/api/mappers.ts'
import { mockCampaignAdapter, resetMockCampaignStore } from '../src/features/campaigns/api/mock-adapter.ts'
import {
  buildCreateCampaignV2Input,
  buildUpdateCampaignV2Input,
  buildV2DraftPlanPayload,
  buildV2PlanUpdateFromCampaign,
  campaignToV2WizardState,
  createPlannedContentItem,
  filterSelectableCampaignTags,
  formatCampaignV2ApiError,
  generateBulkMockContentsForGroup,
  generateMockContentForGroup,
  groupTagsByCompatibleSchema,
  inspectBackendPersistenceSupport,
  inspectV2UpdateSupport,
  isSystemAuthenticationTag,
  resolveActionTagScript,
  resolveActionTagWithPin,
  scriptTargetKey,
  validateStep1Plan,
  validateStep2Plan,
} from '../src/features/campaigns/multi-tag-plan.ts'
import { canStartCampaign, isCampaignV2 } from '../src/features/campaigns/validation.ts'
import { ApiError } from '../src/lib/api/errors.ts'
import { emptyScheduleForm, scheduleFormToApi } from '../src/features/campaigns/schedule.ts'
import { unavailableScriptInputSchema } from '../src/features/campaigns/script-compat.ts'
import {
  buildAutoShortcodeMapping,
  defaultShortcodeMappingForSchema,
  emptyShortcodeMappingEntry,
  findCompatibleBodyVariable,
  preferredDefaultVariable,
  validateBodyShortcodeSupport,
} from '../src/features/campaigns/shortcode-mapping.ts'
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
          raw_source: '[caption]FB Caption[/caption]',
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
          raw_source: '[caption]FB Post[/caption]',
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

  it('excludes system authentication tags using authoritative is_authentication metadata without hiding custom .login tags', () => {
    const authSites: Site[] = [
      {
        id: 10,
        key: 'baloquatang',
        name: 'Balo Qua Tang',
        base_url: 'https://baloquatang.example',
        cms_type: 'wordpress',
      },
      {
        id: 11,
        key: 'customsite',
        name: 'Custom Site',
        base_url: 'https://custom.example',
        cms_type: null,
      },
    ]

    const authPaths: PathItem[] = [
      {
        id: 100,
        site_id: 10,
        site_key: 'baloquatang',
        key: 'login',
        name: 'Login',
        url_pattern: '/wp-login.php',
        path_inputs: [],
        is_authentication: true,
      },
      {
        id: 101,
        site_id: 10,
        site_key: 'baloquatang',
        key: 'create_post',
        name: 'Create Post',
        url_pattern: '/wp-admin/post-new.php',
        path_inputs: [],
        is_authentication: false,
      },
      {
        id: 102,
        site_id: 11,
        site_key: 'customsite',
        key: 'login',
        name: 'Custom Action Named Login',
        url_pattern: '/custom-action',
        path_inputs: [],
        is_authentication: false,
      },
    ]

    const cmsTypes: CmsTypeItem[] = [
      {
        id: 1,
        key: 'wordpress',
        name: 'WordPress',
        is_enabled: true,
        path_templates: [
          {
            cms_type: 'wordpress',
            key: 'login',
            name: 'Login',
            url_pattern: '/wp-login.php',
            path_inputs: [],
            is_authentication: true,
          },
        ],
      },
    ]

    const authTags: ActionTagItem[] = [
      {
        id: 201,
        tag_key: 'baloquatang.login',
        site_key: 'baloquatang',
        site_name: 'Balo Qua Tang',
        path_id: 100,
        path_key: 'login',
        path_name: 'Login',
        name: 'baloquatang.login',
        scripts_count: 1,
        ready: true,
        enabled: true,
      },
      {
        id: 202,
        tag_key: 'baloquatang.create_post',
        site_key: 'baloquatang',
        site_name: 'Balo Qua Tang',
        path_id: 101,
        path_key: 'create_post',
        path_name: 'Create Post',
        name: 'baloquatang.create_post',
        scripts_count: 1,
        ready: true,
        enabled: true,
      },
      {
        id: 203,
        tag_key: 'customsite.login',
        site_key: 'customsite',
        site_name: 'Custom Site',
        path_id: 102,
        path_key: 'login',
        path_name: 'Custom Action Named Login',
        name: 'customsite.login',
        scripts_count: 1,
        ready: true,
        enabled: true,
      },
    ]

    const authScripts: ScriptListItem[] = [
      ...SCRIPTS,
      {
        package_key: 'baloquatang.create_post',
        script_id: 'baloquatang.create_post',
        name: 'Balo Create Post',
        action_tag_key: 'baloquatang.create_post',
        version: '1.0.0',
        release_id: 301,
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
        is_authentication: false,
      },
      {
        package_key: 'customsite.login',
        script_id: 'customsite.login',
        name: 'Custom Non-Auth Script',
        action_tag_key: 'customsite.login',
        version: '1.0.0',
        release_id: 302,
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
        is_authentication: false,
      },
    ]

    // 1. WordPress auth tag is classified as system auth; create_post and custom .login are not
    assert.equal(
      isSystemAuthenticationTag(authTags[0]!, {
        site: authSites[0],
        paths: authPaths,
        cmsTypes,
      }),
      true,
    )
    assert.equal(
      isSystemAuthenticationTag(authTags[1]!, {
        site: authSites[0],
        paths: authPaths,
        cmsTypes,
      }),
      false,
    )
    assert.equal(
      isSystemAuthenticationTag(authTags[2]!, {
        site: authSites[1],
        paths: authPaths,
        cmsTypes,
      }),
      false,
    )

    // 2. Picker, Search, and Site filter exclude WordPress auth tag but preserve create_post and custom .login
    const allSelectable = filterSelectableCampaignTags({
      tags: authTags,
      sites: authSites,
      paths: authPaths,
      cmsTypes,
      scripts: authScripts,
    })
    assert.deepEqual(
      allSelectable.map((r) => r.tag.tag_key),
      ['baloquatang.create_post', 'customsite.login'],
    )

    const searchLogin = filterSelectableCampaignTags({
      tags: authTags,
      sites: authSites,
      paths: authPaths,
      cmsTypes,
      scripts: authScripts,
      search: 'login',
    })
    assert.deepEqual(
      searchLogin.map((r) => r.tag.tag_key),
      ['customsite.login'],
    )

    const siteFiltered = filterSelectableCampaignTags({
      tags: authTags,
      sites: authSites,
      paths: authPaths,
      cmsTypes,
      scripts: authScripts,
      siteFilter: 'baloquatang',
    })
    assert.deepEqual(
      siteFiltered.map((r) => r.tag.tag_key),
      ['baloquatang.create_post'],
    )

    // 3. Selected Tag validation rejects system authentication tag
    const resolvedAuth = resolveActionTagScript(
      authTags[0]!,
      authSites[0],
      authScripts,
      { paths: authPaths, cmsTypes },
    )
    const resolvedPost = resolveActionTagScript(
      authTags[1]!,
      authSites[0],
      authScripts,
      { paths: authPaths, cmsTypes },
    )
    assert.equal(resolvedAuth.is_system_auth, true)
    assert.equal(resolvedAuth.is_runnable, false)
    assert.equal(
      validateStep1Plan({
        name: 'Test Plan',
        resolvedTags: [resolvedAuth, resolvedPost],
      }).ok,
      false,
    )

    // 4. Payload builder never includes system authentication tags
    const v2Input = buildCreateCampaignV2Input({
      name: 'Safe Plan',
      run_mode: 'live',
      resolvedTags: [resolvedAuth, resolvedPost],
      groups: [],
      groupMappings: {},
      validatedContents: [],
    })
    const body = buildLiveCampaignV2CreateBody(v2Input)
    assert.deepEqual(
      body.action_tags.map((t) => t.action_tag_key),
      ['baloquatang.create_post'],
    )

    // 5. Historical Campaign Details referencing an auth tag still map normally
    const historical = mapLiveCampaign({
      id: 'camp_hist_auth',
      name: 'Historical Auth Campaign',
      platform: 'baloquatang',
      script_id: 'baloquatang.login',
      script_version: '1.0.0',
      status: 'completed',
      run_mode: 'live',
    })
    assert.equal(historical.script_package_key, 'baloquatang.login')
    assert.equal(historical.status, 'completed')
  })

  it('prepopulates V2 Edit wizard with unchanged Release pins, blocks unsupported V2 update, decouples Articles from schema 404, and validates [body] shortcode', async () => {
    const v2Campaign = mapLiveCampaign({
      id: 'camp_v2_edit_1',
      plan_version: 2,
      name: 'Editable V2 Draft',
      status: 'draft',
      run_mode: 'live',
      action_tags: [
        {
          action_tag_id: 1,
          action_tag_key: 'mayhopphat.create_post',
          site_key: 'mayhopphat',
          site_name: 'MayHopPhat',
          cms_type: 'wordpress',
          script_package_key: 'mayhopphat.create_post',
          script_name: 'WP Create Post',
          script_version: '1.0.0',
          release_id: 99,
          resolution_source: 'site_specific',
          shortcode_mapping: {
            entries: [{ shortcode: 'body', variable: 'body' }],
          },
        },
      ],
      contents: [
        {
          id: 'cnt_edit_1',
          external_ref: 'post-1',
          status: 'pending',
          source_format: 'shortcode',
          raw_source: '[body]Hello[/body]',
          assignments: [
            {
              id: 'asgn_1',
              action_tag_key: 'mayhopphat.create_post',
              script_package_key: 'mayhopphat.create_post',
              script_version: '1.0.0',
              release_id: 99,
            },
          ],
        },
      ],
    })

    // 1. V2 Edit prepopulation preserves IDs, Release pins, mappings, and assignments
    const hydrated = campaignToV2WizardState(v2Campaign)
    assert.equal(hydrated.name, 'Editable V2 Draft')
    assert.deepEqual(hydrated.selectedTagKeys, ['mayhopphat.create_post'])
    assert.equal(hydrated.contents.length, 1)
    assert.equal(hydrated.contents[0]!.id, 'cnt_edit_1')
    assert.deepEqual(hydrated.contents[0]!.target_tag_keys, [
      'mayhopphat.create_post',
    ])
    assert.equal(
      hydrated.initialMappingsByTagKey['mayhopphat.create_post']?.[0]?.variable,
      'body',
    )

    // 2. Release pin is preserved even when newer version (1.2.0 / #101) exists in SCRIPTS
    const resolvedWithPin = resolveActionTagWithPin(
      TAGS[0],
      hydrated.pinnedTagsByKey['mayhopphat.create_post'],
      SITES[0],
      SCRIPTS,
    )
    assert.equal(resolvedWithPin?.effective_script?.version, '1.0.0')
    assert.equal(resolvedWithPin?.effective_script?.release_id, 99)

    // 3. Incomplete hydration cannot Save; complete hydration enables Save
    assert.equal(
      inspectV2UpdateSupport({
        campaign: v2Campaign,
        detailLoaded: false,
        resolvedTags: resolvedWithPin ? [resolvedWithPin] : [],
      }).supported,
      false,
    )
    assert.equal(
      inspectV2UpdateSupport({
        campaign: v2Campaign,
        detailLoaded: true,
        resolvedTags: resolvedWithPin ? [resolvedWithPin] : [],
      }).supported,
      true,
    )

    // 4. Articles list remains 'ready' when Content GET succeeded even if Script schema returned 404
    const articlesListState = resolveArticlesListState({
      loading: false,
      error: null, // schemaError is kept separate from contentsError
      rowCount: 2,
    })
    assert.equal(articlesListState, 'ready')

    // 5. Default [body] shortcode prefers 'body' when schema supports it, and rejects when unsupported
    assert.equal(findCompatibleBodyVariable(WP_SCHEMA), 'body')
    assert.equal(preferredDefaultVariable(WP_SCHEMA), 'body')
    assert.equal(validateBodyShortcodeSupport(WP_SCHEMA).supported, true)

    assert.equal(findCompatibleBodyVariable(FB_SCHEMA), null)
    assert.equal(preferredDefaultVariable(FB_SCHEMA), 'caption')
    const unsupportedBody = validateBodyShortcodeSupport(FB_SCHEMA)
    assert.equal(unsupportedBody.supported, false)

    // 6. V2 defaultShortcodeMappingForSchema never maps [body] -> title on title-only schema
    const titleOnlySchema: ScriptInputSchema = {
      fields: [],
      test_mode_compatible: null,
      title_required: true,
      body_required: false,
      schema_available: true,
      title_supported: true,
      body_supported: false,
      unavailable_reason: null,
    }
    const wpDefaultMap = defaultShortcodeMappingForSchema(WP_SCHEMA)
    assert.equal(wpDefaultMap[0]?.shortcode, 'body')
    assert.equal(wpDefaultMap[0]?.variable, 'body')

    const titleOnlyDefaultMap = defaultShortcodeMappingForSchema(titleOnlySchema)
    assert.equal(titleOnlyDefaultMap[0]?.shortcode, 'body')
    assert.equal(titleOnlyDefaultMap[0]?.variable, '')
    assert.equal(validateBodyShortcodeSupport(titleOnlySchema).supported, false)

    // 7. V2 Add Content in Edit mode preserves existing Content IDs & assignments
    const addedItem = createPlannedContentItem({
      external_ref: 'post-2',
      target_tag_keys: ['mayhopphat.create_post'],
      raw_source: '[body]Second[/body]',
    })
    const combinedContents = [...hydrated.contents, addedItem]
    assert.equal(combinedContents[0]!.id, 'cnt_edit_1')
    assert.deepEqual(combinedContents[0]!.target_tag_keys, [
      'mayhopphat.create_post',
    ])
    assert.equal(combinedContents[1]!.external_ref, 'post-2')
    assert.equal(combinedContents[1]!.persisted_id, null)

    // 8. Build PUT V2 full-plan payload preserving existing IDs and omitting IDs on new items
    const editGroup = groupTagsByCompatibleSchema(
      [resolvedWithPin!],
      {
        [scriptTargetKey('mayhopphat.create_post', '1.0.0')]: {
          schema: WP_SCHEMA,
          loading: false,
          error: null,
        },
      },
      (reason) => unavailableScriptInputSchema(null, reason),
    )
    const editMappings = {
      [editGroup[0]!.group_key]: [
        emptyShortcodeMappingEntry({ shortcode: 'title', variable: 'title' }),
        emptyShortcodeMappingEntry({ shortcode: 'body', variable: 'body' }),
      ],
    }
    const step2Edit = validateStep2Plan({
      groups: editGroup,
      mappingsByGroupKey: editMappings,
      resolvedTags: [
        { ...resolvedWithPin!, plan_tag_uuid: 'ptag-uuid-1' },
      ],
      contents: [
        {
          ...hydrated.contents[0]!,
          raw_source: '[title]Updated[/title][body]Hello[/body]',
        },
        {
          ...addedItem,
          raw_source: '[title]Second Title[/title][body]Second[/body]',
        },
      ],
    })
    assert.equal(step2Edit.ok, true)
    if (!step2Edit.ok) return

    const updateInput = buildUpdateCampaignV2Input({
      id: 'camp_v2_edit_1',
      revision: 3,
      name: 'Edited V2 Name',
      run_mode: 'live',
      resolvedTags: [
        { ...resolvedWithPin!, plan_tag_uuid: 'ptag-uuid-1' },
      ],
      groups: editGroup,
      groupMappings: step2Edit.groupMappings,
      validatedContents: step2Edit.validatedContents,
    })
    const putBody = buildLiveCampaignV2UpdateBody(updateInput)
    assert.equal(putBody.plan_version, 2)
    assert.equal(putBody.revision, 3)
    assert.equal(putBody.action_tags[0]!.plan_tag_uuid, 'ptag-uuid-1')
    assert.equal(putBody.contents[0]!.id, 'cnt_edit_1')
    assert.equal(putBody.contents[0]!.assignments[0]!.id, 'asgn_1')
    assert.equal('id' in putBody.contents[1]!, false)
    assert.equal('id' in putBody.contents[1]!.assignments[0]!, false)

    // 9. Successful PUT + revision update + 409 revision conflict in mockCampaignAdapter
    resetMockCampaignStore()
    const createdV2 = await mockCampaignAdapter.createCampaignV2(
      buildCreateCampaignV2Input({
        name: 'Initial V2',
        run_mode: 'live',
        resolvedTags: [resolvedWithPin!],
        groups: editGroup,
        groupMappings: step2Edit.groupMappings,
        validatedContents: [step2Edit.validatedContents[0]!],
      }),
    )
    assert.equal(createdV2.revision, 1)

    const updatedV2 = await mockCampaignAdapter.updateCampaignV2({
      ...updateInput,
      id: createdV2.id,
      revision: 1,
    })
    assert.equal(updatedV2.revision, 2)
    assert.equal(updatedV2.name, 'Edited V2 Name')
    assert.equal(updatedV2.contents?.length, 2)
    assert.equal(updatedV2.allowed_actions.includes('start'), false)
    assert.equal(canStartCampaign(updatedV2, updatedV2.contents ?? [], null).ok, false)

    // Stale revision (1 vs 2) triggers 409 campaign_revision_conflict
    let caughtConflict: unknown = null
    try {
      await mockCampaignAdapter.updateCampaignV2({
        ...updateInput,
        id: createdV2.id,
        revision: 1,
      })
    } catch (err) {
      caughtConflict = err
    }
    const formattedConflict = formatCampaignV2ApiError(caughtConflict)
    assert.equal(formattedConflict.isRevisionConflict, true)
    assert.equal(formattedConflict.expectedRevision, 1)
    assert.equal(formattedConflict.currentRevision, 2)
  })

  it('auto-maps all declared Script variables, rejects unrepresentable variable names, removes manual mapping UI in V2, and generates V2 mock articles persisted via PUT', async () => {
    // 1. Single-variable Script: title -> [title]
    const singleTitleSchema: ScriptInputSchema = {
      fields: [],
      test_mode_compatible: null,
      title_required: true,
      body_required: false,
      schema_available: true,
      title_supported: true,
      body_supported: false,
      unavailable_reason: null,
    }
    const singleAuto = buildAutoShortcodeMapping(singleTitleSchema)
    assert.equal(singleAuto.ok, true)
    if (singleAuto.ok) {
      assert.deepEqual(singleAuto.mapping.entries, [
        { shortcode: 'title', variable: 'title' },
      ])
    }

    // 2. Multi-variable Script: all variables mapped (title, body, content, count)
    const multiSchema: ScriptInputSchema = {
      fields: [
        { key: 'content', type: 'text', required: true },
        { key: 'count', type: 'number', required: false },
      ],
      test_mode_compatible: true,
      title_required: true,
      body_required: false,
      schema_available: true,
      title_supported: true,
      body_supported: true,
      unavailable_reason: null,
    }
    const multiAuto = buildAutoShortcodeMapping(multiSchema)
    assert.equal(multiAuto.ok, true)
    if (multiAuto.ok) {
      assert.deepEqual(multiAuto.mapping.entries, [
        { shortcode: 'title', variable: 'title' },
        { shortcode: 'body', variable: 'body' },
        { shortcode: 'content', variable: 'content' },
        { shortcode: 'count', variable: 'count' },
      ])
    }

    // 3. Variable name incompatible with shortcode parser fails closed without silent rename
    const upperSchema: ScriptInputSchema = {
      fields: [{ key: 'PostTitle', type: 'string', required: true }],
      test_mode_compatible: null,
      title_required: false,
      body_required: false,
      schema_available: true,
      title_supported: false,
      body_supported: false,
      unavailable_reason: null,
    }
    const upperAuto = buildAutoShortcodeMapping(upperSchema)
    assert.equal(upperAuto.ok, false)
    if (!upperAuto.ok) {
      assert.match(upperAuto.error, /PostTitle/)
    }

    // 4. CampaignContentStep2.tsx has no manual ShortcodeMappingFields or Mock controls
    const step2Source = fs.readFileSync(
      path.resolve('src/features/campaigns/components/CampaignContentStep2.tsx'),
      'utf8',
    )
    assert.equal(step2Source.includes('ShortcodeMappingFields'), false)
    assert.equal(step2Source.includes('Generate Mock'), false)
    assert.equal(step2Source.includes('V2BulkMockGenerator'), false)

    // 5. Generate 1, 20, and 100 distinct mock Contents on Articles -> ONE V2 PUT -> reload lists persisted Contents
    const siteMap = new Map(SITES.map((s) => [s.key, s]))
    const wpDirect = resolveActionTagScript(TAGS[0]!, siteMap.get('mayhopphat'), SCRIPTS)
    const wpGlobal = resolveActionTagScript(TAGS[1]!, siteMap.get('blog2'), SCRIPTS)
    const schemaLookup = {
      [scriptTargetKey('mayhopphat.create_post', '1.2.0')]: {
        schema: multiSchema,
        loading: false,
        error: null,
      },
    }
    const groups = groupTagsByCompatibleSchema(
      [wpDirect, wpGlobal],
      schemaLookup,
      (reason) => unavailableScriptInputSchema(null, reason),
    )
    assert.equal(groups.length, 1)
    assert.deepEqual(groups[0]!.tag_keys, [
      'mayhopphat.create_post',
      'blog2.create_post',
    ])

    const gen1 = generateBulkMockContentsForGroup({ group: groups[0]!, count: 1 })
    assert.equal(gen1.ok, true)
    if (!gen1.ok) return
    assert.equal(gen1.items.length, 1)

    const gen20 = generateBulkMockContentsForGroup({
      group: groups[0]!,
      count: 20,
      existingRefs: gen1.items.map((x) => x.external_ref),
      startSeq: 2,
    })
    assert.equal(gen20.ok, true)
    if (!gen20.ok) return
    assert.equal(gen20.items.length, 20)

    const gen100 = generateBulkMockContentsForGroup({
      group: groups[0]!,
      count: 100,
      existingRefs: [...gen1.items, ...gen20.items].map((x) => x.external_ref),
      startSeq: 22,
    })
    assert.equal(gen100.ok, true)
    if (!gen100.ok) return
    assert.equal(gen100.items.length, 100)

    const allRefs = new Set([
      ...gen1.items.map((x) => x.external_ref),
      ...gen20.items.map((x) => x.external_ref),
      ...gen100.items.map((x) => x.external_ref),
    ])
    assert.equal(allRefs.size, 121)
    assert.deepEqual(gen100.items[0]!.target_tag_keys, [
      'mayhopphat.create_post',
      'blog2.create_post',
    ])
    assert.match(gen100.items[0]!.raw_source, /\[title\]TEST Mock Title/)
    assert.match(gen100.items[0]!.raw_source, /\[content\]TEST Mock content/)

    const step2 = validateStep2Plan({
      groups,
      contents: [gen1.items[0]!],
      resolvedTags: [wpDirect, wpGlobal],
    })
    assert.equal(step2.ok, true)
    if (!step2.ok) return

    resetMockCampaignStore()
    const created = await mockCampaignAdapter.createCampaignV2(
      buildCreateCampaignV2Input({
        name: 'V2 Bulk Mock Test',
        run_mode: 'live',
        resolvedTags: [wpDirect, wpGlobal],
        groups,
        groupMappings: step2.groupMappings,
        validatedContents: step2.validatedContents,
      }),
    )
    assert.equal(created.contents?.length ?? 0, 0) // createCampaignV2 stores contents in store.contents
    const initialContents = (await mockCampaignAdapter.listContents()).filter(
      (c) => c.campaign_id === created.id,
    )
    assert.equal(initialContents.length, 1)

    const existingPlanned = campaignToV2WizardState(created, initialContents).contents
    const bulkPlan = buildV2PlanUpdateFromCampaign({
      campaign: created,
      contents: [...existingPlanned, ...gen100.items],
      schemaLookup,
    })
    assert.equal(bulkPlan.ok, true)
    if (!bulkPlan.ok) return
    assert.equal(bulkPlan.input.contents.length, 101)
    assert.equal(bulkPlan.input.contents[0]!.id, initialContents[0]!.id)
    assert.equal('id' in bulkPlan.input.contents[1]!, false)

    const updated = await mockCampaignAdapter.updateCampaignV2(bulkPlan.input)
    assert.equal(updated.revision, 2)
    assert.equal(updated.contents?.length, 101)
    assert.equal(updated.contents?.[0]?.id, initialContents[0]!.id)
    assert.equal(updated.contents?.[100]?.assignments?.length, 2)

    const reloaded = await mockCampaignAdapter.getCampaign(created.id)
    assert.equal(reloaded.summary.total, 101)
    assert.equal(reloaded.allowed_actions.includes('start'), false)
  })

  it('generates unambiguous [title]...[/title] for 1-variable title-only Script shared across 4 Tags with no duplicate mappings or assignments', () => {
    const fourSites: Site[] = [1, 2, 3, 4].map((n) => ({
      id: 100 + n,
      key: `wp${n}`,
      name: `WP ${n}`,
      base_url: `https://wp${n}.example`,
      cms_type: 'wordpress',
    }))
    const fourTags: ActionTagItem[] = [1, 2, 3, 4].map((n) => ({
      id: 200 + n,
      tag_key: `wp${n}.create_post`,
      site_key: `wp${n}`,
      site_name: `WP ${n}`,
      path_key: 'create_post',
      path_name: 'Create Post',
      name: `WP ${n} Create Post`,
      scripts_count: 1,
      ready: true,
      enabled: true,
    }))
    const globalWpScript: ScriptListItem = {
      package_key: 'wp1.create_post',
      script_id: 'wp1.create_post',
      name: 'WP Create Post',
      action_tag_key: 'wp1.create_post',
      version: '1.0.0',
      release_id: 501,
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
    }
    const titleOnlySchema: ScriptInputSchema = {
      fields: [],
      test_mode_compatible: null,
      title_required: true,
      body_required: false,
      schema_available: true,
      title_supported: true,
      body_supported: false,
      unavailable_reason: null,
    }

    const resolved4 = fourTags.map((t, idx) =>
      resolveActionTagScript(t, fourSites[idx], [globalWpScript]),
    )
    const schemaLookup = {
      [scriptTargetKey('wp1.create_post', '1.0.0')]: {
        schema: titleOnlySchema,
        loading: false,
        error: null,
      },
    }
    const groups = groupTagsByCompatibleSchema(
      resolved4,
      schemaLookup,
      (reason) => unavailableScriptInputSchema(null, reason),
    )
    assert.equal(groups.length, 1)
    assert.equal(groups[0]!.tag_keys.length, 4)

    const bulk = generateBulkMockContentsForGroup({
      group: groups[0]!,
      count: 20,
    })
    assert.equal(bulk.ok, true)
    if (!bulk.ok) return
    assert.equal(bulk.items.length, 20)

    const firstRaw = bulk.items[0]!.raw_source
    assert.equal((firstRaw.match(/\[title\]/g) ?? []).length, 1)
    assert.equal((firstRaw.match(/\[\/title\]/g) ?? []).length, 1)
    // No inner square brackets inside sample value
    const inner = firstRaw.slice('[title]'.length, -'[/title]'.length)
    assert.equal(inner.includes('[') || inner.includes(']'), false)

    const campaign = mapLiveCampaign({
      id: 'camp_4tags',
      plan_version: 2,
      revision: 1,
      name: '4-Tag Title Only',
      status: 'draft',
      run_mode: 'live',
      action_tags: resolved4.map((r) => ({
        action_tag_id: r.tag_id,
        action_tag_key: r.tag_key,
        site_key: r.site_key,
        site_name: r.site_name,
        cms_type: r.cms_type,
        script_package_key: r.effective_script!.package_key,
        script_version: r.effective_script!.version,
        release_id: r.effective_script!.release_id,
        resolution_source: r.resolution_source,
        shortcode_mapping: {
          entries: [{ shortcode: 'title', variable: 'title' }],
        },
      })),
    })

    const built = buildV2PlanUpdateFromCampaign({
      campaign,
      contents: bulk.items,
      schemaLookup,
    })
    assert.equal(built.ok, true)
    if (!built.ok) return

    const putBody = buildLiveCampaignV2UpdateBody(built.input)
    assert.equal(putBody.action_tags.length, 4)
    assert.equal(putBody.contents.length, 20)
    assert.equal(putBody.contents[0]!.assignments.length, 4)
    assert.deepEqual(putBody.contents[0]!.assignments[0]!.shortcode_mapping, {
      entries: [{ shortcode: 'title', variable: 'title' }],
    })
  })
})
