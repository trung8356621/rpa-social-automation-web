import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'

import {
  buildLiveCampaignV2CreateBody,
  buildLiveCampaignV2UpdateBody,
} from '../src/features/campaigns/api/build-create-payload.ts'
import { mapLiveCampaign } from '../src/features/campaigns/api/mappers.ts'
import { createDetailRefreshController } from '../src/features/campaigns/campaign-detail-polling.ts'
import {
  INTERVAL_MAX_ERROR_MESSAGE,
  MAX_INTERVAL_MINUTES,
  decomposeIntervalMinutes,
  maxInputForUnit,
  switchIntervalUnit,
  validateIntervalDraft,
} from '../src/features/campaigns/campaign-interval-edit.ts'
import {
  buildCreateCampaignV2Input,
  buildUpdateCampaignV2Input,
  campaignToV2WizardState,
  type ResolvedActionTagPlan,
  type SchemaMappingGroup,
  type ValidatedContentAssociation,
} from '../src/features/campaigns/multi-tag-plan.ts'

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
  schema_key: 'title',
  tag_keys: ['sitea.create_post', 'siteb.create_post'],
  script_names: ['Create Post'],
  variables: ['title'],
  required_variables: ['title'],
  schema_available: true,
  unavailable_reason: null,
}

const SAMPLE_CONTENTS: ValidatedContentAssociation[] = [
  {
    persisted_id: 'cnt-1',
    external_ref: 'art-1',
    raw_source: '[title]Hello[/title]',
    targets: [
      {
        assignment_id: 'asgn-1',
        action_tag_key: 'sitea.create_post',
        script_package_key: 'sitea.create_post',
        script_version: '1.0.0',
        release_id: 101,
        resolution_source: 'site_specific',
        shortcode_mapping: { entries: [{ shortcode: 'title', variable: 'title' }] },
      },
      {
        assignment_id: 'asgn-2',
        action_tag_key: 'siteb.create_post',
        script_package_key: 'siteb.create_post',
        script_version: '1.0.0',
        release_id: 102,
        resolution_source: 'site_specific',
        shortcode_mapping: { entries: [{ shortcode: 'title', variable: 'title' }] },
      },
    ],
  },
]

describe('Posting Interval Unit Selector (Minutes / Hours / Days)', () => {
  it('1, 2, 3 & 4. Minutes, Hours, Days conversions and 7-day maximum (10080 minutes)', () => {
    assert.deepEqual(validateIntervalDraft({ value: '30', unit: 'minutes' }), {
      ok: true,
      value: 30,
    })
    assert.deepEqual(validateIntervalDraft({ value: '4', unit: 'hours' }), {
      ok: true,
      value: 240,
    })
    assert.deepEqual(validateIntervalDraft({ value: '2', unit: 'days' }), {
      ok: true,
      value: 2880,
    })
    assert.deepEqual(validateIntervalDraft({ value: '7', unit: 'days' }), {
      ok: true,
      value: 10080,
    })
    assert.deepEqual(validateIntervalDraft({ value: '168', unit: 'hours' }), {
      ok: true,
      value: 10080,
    })

    assert.equal(maxInputForUnit('minutes'), MAX_INTERVAL_MINUTES)
    assert.equal(maxInputForUnit('hours'), 168)
    assert.equal(maxInputForUnit('days'), 7)
  })

  it('5. Rejects values above 10080 minutes, empty, negative, and decimals', () => {
    const overDays = validateIntervalDraft({ value: '8', unit: 'days' })
    assert.equal(overDays.ok, false)
    if (!overDays.ok) assert.equal(overDays.message, INTERVAL_MAX_ERROR_MESSAGE)

    const overHours = validateIntervalDraft({ value: '169', unit: 'hours' })
    assert.equal(overHours.ok, false)
    if (!overHours.ok) assert.equal(overHours.message, INTERVAL_MAX_ERROR_MESSAGE)

    const overMinutes = validateIntervalDraft({ value: '10081', unit: 'minutes' })
    assert.equal(overMinutes.ok, false)
    if (!overMinutes.ok) assert.equal(overMinutes.message, INTERVAL_MAX_ERROR_MESSAGE)

    assert.equal(validateIntervalDraft({ value: '', unit: 'hours' }).ok, false)
    assert.equal(validateIntervalDraft({ value: '-1', unit: 'days' }).ok, false)
    assert.equal(validateIntervalDraft({ value: '1.5', unit: 'hours' }).ok, false)
  })

  it('6. Exact Edit hydration selects convenient unit without rounding', () => {
    assert.deepEqual(decomposeIntervalMinutes(2880), { value: '2', unit: 'days' })
    assert.deepEqual(decomposeIntervalMinutes(240), { value: '4', unit: 'hours' })
    assert.deepEqual(decomposeIntervalMinutes(90), { value: '90', unit: 'minutes' })
    assert.deepEqual(decomposeIntervalMinutes(0), { value: '0', unit: 'minutes' })

    const campaign = mapLiveCampaign({
      id: 'camp-hydrate',
      plan_version: 2,
      status: 'draft',
      action_tags: [
        {
          action_tag_key: 'sitea.create_post',
          site_key: 'sitea',
          script_package_key: 'sitea.create_post',
          script_version: '1.0.0',
          interval_minutes: 2880,
        },
        {
          action_tag_key: 'siteb.create_post',
          site_key: 'siteb',
          script_package_key: 'siteb.create_post',
          script_version: '1.0.0',
          interval_minutes: 90,
        },
      ],
    })
    const wizardState = campaignToV2WizardState(campaign, [])
    assert.deepEqual(wizardState.initialIntervalDraftsByTagKey['sitea.create_post'], {
      value: '2',
      unit: 'days',
    })
    assert.deepEqual(wizardState.initialIntervalDraftsByTagKey['siteb.create_post'], {
      value: '90',
      unit: 'minutes',
    })
  })

  it('7. No accidental rounding when switching units', () => {
    // 90 minutes cannot be represented as whole hours -> retains 90 minutes + warning
    const lossy = switchIntervalUnit({ value: '90', unit: 'minutes' }, 'hours')
    assert.deepEqual(lossy.draft, { value: '90', unit: 'minutes' })
    assert.ok(lossy.warning)

    // 2 days -> 48 hours converts exactly without warning
    const exact = switchIntervalUnit({ value: '2', unit: 'days' }, 'hours')
    assert.deepEqual(exact.draft, { value: '48', unit: 'hours' })
    assert.equal(exact.warning, null)
  })

  it('8. Inline Save sends exact converted interval_minutes', () => {
    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /validateIntervalDraft\(intervalDraft\)/)
    assert.match(screenSrc, /onUpdateActionTagInterval\(campaign\.id, actionTagKey, check\.value\)/)
    assert.match(screenSrc, /<option value="minutes">/)
    assert.match(screenSrc, /<option value="hours">/)
    assert.match(screenSrc, /<option value="days">/)
  })

  it('9. Wizard Create/Update sends exact interval_minutes with no extra unit field', () => {
    const tagA = makeResolvedTag('sitea.create_post', 'sitea', 1, 'pt-1')
    const tagB = makeResolvedTag('siteb.create_post', 'siteb', 2, 'pt-2')

    const createInput = buildCreateCampaignV2Input({
      name: 'Unit Create',
      run_mode: 'live',
      resolvedTags: [tagA, tagB],
      groups: [SAMPLE_GROUP],
      groupMappings: {
        'grp-1': { entries: [{ shortcode: 'title', variable: 'title' }] },
      },
      validatedContents: SAMPLE_CONTENTS,
      intervalsByTagKey: {
        'sitea.create_post': { value: '4', unit: 'hours' },
        'siteb.create_post': { value: '2', unit: 'days' },
      },
    })
    const createBody = buildLiveCampaignV2CreateBody(createInput)
    assert.equal(createBody.action_tags[0]?.interval_minutes, 240)
    assert.equal(createBody.action_tags[1]?.interval_minutes, 2880)
    assert.equal('unit' in (createBody.action_tags[0] as Record<string, unknown>), false)

    const updateInput = buildUpdateCampaignV2Input({
      id: 'camp-1',
      revision: 2,
      name: 'Unit Update',
      run_mode: 'live',
      resolvedTags: [tagA, tagB],
      groups: [SAMPLE_GROUP],
      groupMappings: {
        'grp-1': { entries: [{ shortcode: 'title', variable: 'title' }] },
      },
      validatedContents: SAMPLE_CONTENTS,
      intervalsByTagKey: {
        'sitea.create_post': { value: '7', unit: 'days' },
        'siteb.create_post': { value: '30', unit: 'minutes' },
      },
    })
    const updateBody = buildLiveCampaignV2UpdateBody(updateInput)
    assert.equal(updateBody.action_tags[0]?.interval_minutes, 10080)
    assert.equal(updateBody.action_tags[1]?.interval_minutes, 30)
  })

  it('10. Existing polling and History remain intact', async () => {
    let calls = 0
    const controller = createDetailRefreshController({
      loadDetail: async () => {
        calls += 1
      },
      loadContents: async () => {
        calls += 1
      },
    })
    await controller.refresh('camp-1')
    assert.equal(calls, 2)

    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /expandedHistoryIds/)
    assert.match(screenSrc, /AttemptScreenshot/)
  })
})
