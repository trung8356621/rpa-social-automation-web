import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'

import {
  buildLiveCampaignV2CreateBody,
  buildLiveCampaignV2UpdateBody,
} from '../src/features/campaigns/api/build-create-payload.ts'
import { mapLiveCampaign, mapLiveContent } from '../src/features/campaigns/api/mappers.ts'
import { resolveArtifactFetchUrl } from '../src/features/campaigns/campaign-artifacts.ts'
import { createDetailRefreshController } from '../src/features/campaigns/campaign-detail-polling.ts'
import { groupAttemptsByContent } from '../src/features/campaigns/campaign-detail-view.ts'
import {
  resolveContentQueueFeedback,
  resolveEffectiveContentStatus,
} from '../src/features/campaigns/campaign-queue-status.ts'
import {
  buildCreateCampaignV2Input,
  buildUpdateCampaignV2Input,
  campaignToV2WizardState,
  formatCampaignV2ApiError,
  parseIntervalMinutesInput,
  validateStep1Plan,
  type ResolvedActionTagPlan,
  type SchemaMappingGroup,
  type ValidatedContentAssociation,
} from '../src/features/campaigns/multi-tag-plan.ts'
import { contentStatusBadge } from '../src/features/campaigns/status-labels.ts'
import { ApiError } from '../src/lib/api/errors.ts'

function makeResolvedTag(
  tagKey: string,
  siteKey: string,
  tagId: number,
  planTagUuid?: string | null,
): ResolvedActionTagPlan {
  return {
    plan_tag_uuid: planTagUuid ?? null,
    tag_id: tagId,
    tag_key: tagKey,
    site_key: siteKey,
    site_name: siteKey,
    cms_type: 'wordpress',
    tag_enabled: true,
    is_system_auth: false,
    resolution_source: 'site_specific',
    effective_script: {
      package_key: `${siteKey}.create_post`,
      name: 'Create Post',
      version: '1.0.0',
      release_id: 100 + tagId,
    },
    is_runnable: true,
    status_reason: null,
  }
}

const SAMPLE_GROUP: SchemaMappingGroup = {
  group_key: 'grp-1',
  schema_key: 'title|body',
  tag_keys: ['sitea.create_post', 'siteb.create_post'],
  script_names: ['Create Post'],
  variables: ['title', 'body'],
  required_variables: ['title'],
  schema_available: true,
  unavailable_reason: null,
}

const SAMPLE_VALIDATED_CONTENTS: ValidatedContentAssociation[] = [
  {
    persisted_id: 'cnt-existing-1',
    external_ref: 'art-1',
    raw_source: '[title]Hello[/title]',
    targets: [
      {
        assignment_id: 'asgn-existing-1',
        action_tag_key: 'sitea.create_post',
        script_package_key: 'sitea.create_post',
        script_version: '1.0.0',
        release_id: 101,
        resolution_source: 'site_specific',
        shortcode_mapping: {
          entries: [{ shortcode: 'title', variable: 'title' }],
        },
      },
      {
        assignment_id: 'asgn-existing-2',
        action_tag_key: 'siteb.create_post',
        script_package_key: 'siteb.create_post',
        script_version: '1.0.0',
        release_id: 102,
        resolution_source: 'site_specific',
        shortcode_mapping: {
          entries: [{ shortcode: 'title', variable: 'title' }],
        },
      },
    ],
  },
]

describe('Action Tag Posting Interval & Sequential Queue Status', () => {
  it('1. Input defaults to 0', () => {
    assert.deepEqual(parseIntervalMinutesInput(undefined), { ok: true, value: 0 })
    assert.equal(parseIntervalMinutesInput('').ok, false)

    const step1Src = readFileSync(
      resolve('src/features/campaigns/components/CampaignPlanStep1.tsx'),
      'utf8',
    )
    assert.match(step1Src, /Khoảng cách giữa 2 bài \(phút\)/)
    assert.match(step1Src, /max=\{maxInputForUnit\(draft\.unit\)\}/)
    assert.match(step1Src, /intervalsByTagKey\[row\.tag_key\] \?\?/)
  })

  it('2 & 3. Editing/saving interval_minutes = 240 and reloading retains 240', () => {
    const tagA = makeResolvedTag('sitea.create_post', 'sitea', 1, 'pt-uuid-1')
    const input = buildCreateCampaignV2Input({
      name: 'Interval Test',
      run_mode: 'live',
      resolvedTags: [tagA],
      groups: [SAMPLE_GROUP],
      groupMappings: {
        'grp-1': { entries: [{ shortcode: 'title', variable: 'title' }] },
      },
      validatedContents: [SAMPLE_VALIDATED_CONTENTS[0]!],
      intervalsByTagKey: { 'sitea.create_post': '240' },
    })

    assert.equal(input.action_tags[0]?.interval_minutes, 240)
    const createBody = buildLiveCampaignV2CreateBody(input)
    assert.equal(createBody.action_tags[0]?.interval_minutes, 240)

    // Reload from Backend GET response
    const reloaded = mapLiveCampaign({
      id: 'camp-v2-240',
      plan_version: 2,
      revision: 2,
      name: 'Interval Test',
      status: 'draft',
      run_mode: 'live',
      action_tags: [
        {
          plan_tag_uuid: 'pt-uuid-1',
          action_tag_id: 1,
          action_tag_key: 'sitea.create_post',
          site_key: 'sitea',
          script_package_key: 'sitea.create_post',
          script_version: '1.0.0',
          release_id: 101,
          resolution_source: 'site_specific',
          interval_minutes: 240,
          last_success_at: '2026-11-23T10:00:00Z',
          next_run_at: '2026-11-23T14:00:00Z',
        },
      ],
    })

    assert.equal(reloaded.action_tags?.[0]?.interval_minutes, 240)
    assert.equal(reloaded.action_tags?.[0]?.last_success_at, '2026-11-23T10:00:00Z')
    assert.equal(reloaded.action_tags?.[0]?.next_run_at, '2026-11-23T14:00:00Z')

    const hydrated = campaignToV2WizardState(reloaded, [])
    assert.equal(hydrated.initialIntervalsByTagKey['sitea.create_post'], '240')
  })

  it('4. Invalid, negative, >10080 intervals rejected and payload builder never clamps or zeroes invalid values', () => {
    assert.deepEqual(parseIntervalMinutesInput('0'), { ok: true, value: 0 })
    assert.deepEqual(parseIntervalMinutesInput('240'), { ok: true, value: 240 })
    assert.deepEqual(parseIntervalMinutesInput('1440'), { ok: true, value: 1440 })
    assert.deepEqual(parseIntervalMinutesInput('10080'), { ok: true, value: 10080 })

    assert.equal(parseIntervalMinutesInput('-1').ok, false)
    assert.equal(parseIntervalMinutesInput('1.5').ok, false)
    assert.equal(parseIntervalMinutesInput('').ok, false)
    assert.equal(parseIntervalMinutesInput('abc').ok, false)

    const overMax = parseIntervalMinutesInput('10081')
    assert.equal(overMax.ok, false)
    if (!overMax.ok) {
      assert.equal(overMax.message, 'Khoảng cách tối đa là 7 ngày.')
    }
    assert.equal(parseIntervalMinutesInput('525600').ok, false)

    const tagA = makeResolvedTag('sitea.create_post', 'sitea', 1)
    const invalidStep1 = validateStep1Plan({
      name: 'Test',
      resolvedTags: [tagA],
      intervalsByTagKey: { 'sitea.create_post': '10081' },
    })
    assert.equal(invalidStep1.ok, false)

    // Payload builder throws instead of silently clamping 10081 -> 10080 or converting -5 -> 0
    assert.throws(() =>
      buildLiveCampaignV2CreateBody({
        plan_version: 2,
        name: 'Bad',
        run_mode: 'live',
        action_tags: [
          {
            action_tag_key: 'sitea.create_post',
            site_key: 'sitea',
            script_package_key: 'sitea.create_post',
            script_version: '1.0.0',
            resolution_source: 'site_specific',
            shortcode_mapping: { entries: [] },
            interval_minutes: 10081,
          },
        ],
        contents: [],
      }),
    )
    assert.throws(() =>
      buildLiveCampaignV2CreateBody({
        plan_version: 2,
        name: 'Bad Neg',
        run_mode: 'live',
        action_tags: [
          {
            action_tag_key: 'sitea.create_post',
            site_key: 'sitea',
            script_package_key: 'sitea.create_post',
            script_version: '1.0.0',
            resolution_source: 'site_specific',
            shortcode_mapping: { entries: [] },
            interval_minutes: -5,
          },
        ],
        contents: [],
      }),
    )

    const formatted = formatCampaignV2ApiError(
      new ApiError('Validation failed (invalid_interval_minutes).', {
        kind: 'validation',
        status: 422,
        code: 'invalid_interval_minutes',
        details: {
          errors: ['action_tags.0.interval_minutes must be at least 0.'],
        },
      }),
    )
    assert.equal(
      formatted.message,
      'HTTP 422 [invalid_interval_minutes]: Validation failed (invalid_interval_minutes).',
    )
    assert.deepEqual(formatted.validationErrors, [
      'action_tags.0.interval_minutes must be at least 0.',
    ])
  })

  it('5 & 6. Multiple Action Tags keep independent intervals and preserve IDs and assignments', () => {
    const tagA = makeResolvedTag('sitea.create_post', 'sitea', 1, 'pt-uuid-a')
    const tagB = makeResolvedTag('siteb.create_post', 'siteb', 2, 'pt-uuid-b')

    const updateInput = buildUpdateCampaignV2Input({
      id: 'camp-v2-multi',
      revision: 3,
      updated_at: '2026-11-23T12:00:00Z',
      name: 'Multi Tag Interval',
      run_mode: 'live',
      resolvedTags: [tagA, tagB],
      groups: [SAMPLE_GROUP],
      groupMappings: {
        'grp-1': { entries: [{ shortcode: 'title', variable: 'title' }] },
      },
      validatedContents: SAMPLE_VALIDATED_CONTENTS,
      intervalsByTagKey: {
        'sitea.create_post': '240',
        'siteb.create_post': '1440',
      },
    })

    const updateBody = buildLiveCampaignV2UpdateBody(updateInput)
    assert.equal(updateBody.action_tags[0]?.plan_tag_uuid, 'pt-uuid-a')
    assert.equal(updateBody.action_tags[0]?.action_tag_id, 1)
    assert.equal(updateBody.action_tags[0]?.interval_minutes, 240)
    assert.equal(updateBody.action_tags[1]?.plan_tag_uuid, 'pt-uuid-b')
    assert.equal(updateBody.action_tags[1]?.action_tag_id, 2)
    assert.equal(updateBody.action_tags[1]?.interval_minutes, 1440)
    assert.equal(updateBody.contents[0]?.id, 'cnt-existing-1')
    assert.equal(updateBody.contents[0]?.assignments[0]?.id, 'asgn-existing-1')
    assert.equal(updateBody.contents[0]?.assignments[1]?.id, 'asgn-existing-2')
  })

  it('7, 8, 9 & 10. waiting_interval, waiting_resources, blocked_by_failure, and next_run_at display clearly', () => {
    assert.deepEqual(contentStatusBadge('waiting_interval'), {
      label: 'Waiting Interval',
      variant: 'primary',
    })
    assert.deepEqual(contentStatusBadge('waiting_resources'), {
      label: 'Waiting Resources',
      variant: 'primary',
    })
    assert.deepEqual(contentStatusBadge('blocked_by_failure'), {
      label: 'Blocked by Failure',
      variant: 'warning',
    })

    const waitingIntervalRow = mapLiveContent({
      id: 'cnt-wi',
      campaign_id: 'camp-1',
      status: 'pending',
      queue_state: 'waiting_interval',
      next_run_at: '2026-11-23T16:30:00Z',
    })
    assert.equal(resolveEffectiveContentStatus(waitingIntervalRow), 'waiting_interval')
    const fb = resolveContentQueueFeedback(waitingIntervalRow)
    assert.equal(fb.kind, 'info')
    if (fb.kind === 'info') {
      assert.match(fb.message, /Next eligible:/)
      assert.match(fb.message, /subject to Client\/Account\/Browser availability/)
    }

    const detailSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(detailSrc, /Action Tags &amp; Posting Interval/)
    assert.match(detailSrc, /tag\.interval_minutes \?\? 0\} phút/)
  })

  it('11. Missing optional Backend fields handled safely', () => {
    const campaign = mapLiveCampaign({
      id: 'camp-minimal',
      plan_version: 2,
      name: 'Minimal',
      status: 'running',
      action_tags: [
        {
          action_tag_key: 'sitea.create_post',
          site_key: 'sitea',
          script_package_key: 'sitea.create_post',
          script_version: '1.0.0',
        },
      ],
    })
    assert.equal(campaign.action_tags?.[0]?.interval_minutes, 0)
    assert.equal(campaign.action_tags?.[0]?.last_success_at, null)
    assert.equal(campaign.action_tags?.[0]?.next_run_at, null)

    const content = mapLiveContent({
      id: 'cnt-min',
      campaign_id: 'camp-minimal',
      status: 'waiting_interval',
    })
    assert.equal(content.next_run_at, null)
    const fb = resolveContentQueueFeedback(content)
    assert.equal(fb.kind, 'info')
  })

  it('12, 13, 14 & 15. Polling does not create/retry Jobs, screenshots work, Pause/Resume/Cancel intact, History preserved', async () => {
    let detailCalls = 0
    let contentCalls = 0
    const controller = createDetailRefreshController({
      loadDetail: async () => {
        detailCalls += 1
      },
      loadContents: async () => {
        contentCalls += 1
      },
    })
    await controller.refresh('camp-1')
    assert.equal(detailCalls, 1)
    assert.equal(contentCalls, 1)

    assert.equal(
      resolveArtifactFetchUrl({
        artifact_uuid: 'art-123',
        has_binary: true,
        download_url: null,
        url: null,
      }),
      '/social-automation/api/campaigns/artifacts/art-123',
    )

    const pendingContent = mapLiveContent({
      id: 'cnt-p',
      campaign_id: 'camp-1',
      status: 'waiting_interval',
    })
    assert.deepEqual(groupAttemptsByContent([pendingContent], []).get('cnt-p'), [])

    const detailSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(detailSrc, /AttemptScreenshot/)
    assert.match(detailSrc, /ScreenshotPreviewModal/)
    assert.match(detailSrc, /onPause\(campaign\.id\)/)
    assert.match(detailSrc, /onResume\(campaign\.id\)/)
    assert.match(detailSrc, /onCancel\(campaign\.id\)/)
    assert.match(detailSrc, /expandedHistoryIds/)
  })
})
