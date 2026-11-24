import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, it } from 'node:test'

import { buildLivePausedCampaignV2UpdateBody } from '../src/features/campaigns/api/build-create-payload.ts'
import { mapLiveCampaign, mapLiveContent } from '../src/features/campaigns/api/mappers.ts'
import {
  getMockCampaignStore,
  mockCampaignAdapter,
  resetMockCampaignStore,
} from '../src/features/campaigns/api/mock-adapter.ts'
import { resolveArtifactFetchUrl } from '../src/features/campaigns/campaign-artifacts.ts'
import { createDetailRefreshController } from '../src/features/campaigns/campaign-detail-polling.ts'
import { decomposeIntervalMinutes } from '../src/features/campaigns/campaign-interval-edit.ts'
import {
  buildUpdatePausedCampaignV2Input,
  campaignToV2WizardState,
  formatCampaignV2ApiError,
  validatePausedStep2Plan,
  validateStep2Plan,
  type ResolvedActionTagPlan,
  type SchemaMappingGroup,
} from '../src/features/campaigns/multi-tag-plan.ts'
import { ApiError } from '../src/lib/api/errors.ts'

function makeCampaign9Fixture() {
  const campaign = mapLiveCampaign({
    id: '7f6324cc-d8d9-41de-b4d3-65d23092d0f2',
    plan_version: 2,
    revision: 7,
    name: 'test3',
    status: 'paused',
    execution_mode: 'one_account_one_job',
    run_mode: 'live',
    action_tags: [
      {
        plan_tag_uuid: 'pt-uuid-c9',
        action_tag_id: 12,
        action_tag_key: 'mayhopphat.create_post',
        site_key: 'mayhopphat',
        script_package_key: 'mayhopphat.create_post',
        script_version: '1.0.0',
        release_id: 101,
        resolution_source: 'site_specific',
        interval_minutes: 60,
      },
    ],
  })

  const contents = [
    mapLiveContent(
      {
        id: '82',
        campaign_id: campaign.id,
        external_ref: 'mock-5-nrf8',
        status: 'success',
        raw_source: null, // historical content without raw_source
        assignments: [
          {
            id: 'asgn-82',
            action_tag_key: 'mayhopphat.create_post',
            script_package_key: 'mayhopphat.create_post',
            script_version: '1.0.0',
            release_id: 101,
            raw_source: null,
          },
        ],
      },
      campaign.id,
    ),
    mapLiveContent(
      {
        id: '83',
        campaign_id: campaign.id,
        external_ref: 'mock-6-fail',
        status: 'failed_locked',
        raw_source: null,
        last_error_code: 'SELECTOR_TIMEOUT',
        last_error_message: 'Timed out',
      },
      campaign.id,
    ),
  ]

  return { campaign, contents }
}

const SAMPLE_TAG: ResolvedActionTagPlan = {
  plan_tag_uuid: 'pt-uuid-c9',
  tag_id: 12,
  tag_key: 'mayhopphat.create_post',
  site_key: 'mayhopphat',
  site_name: 'MayHopPhat',
  cms_type: 'wordpress',
  tag_enabled: true,
  is_system_auth: false,
  resolution_source: 'site_specific',
  effective_script: {
    package_key: 'mayhopphat.create_post',
    name: 'WP Create Post',
    version: '1.0.0',
    release_id: 101,
  },
  is_runnable: true,
  status_reason: null,
}

const SAMPLE_GROUP: SchemaMappingGroup = {
  group_key: 'grp-1',
  schema_key: 'title',
  tag_keys: ['mayhopphat.create_post'],
  script_names: ['WP Create Post'],
  variables: ['title'],
  required_variables: ['title'],
  schema_available: true,
  unavailable_reason: null,
  schema: {
    fields: [{ key: 'title', type: 'string', required: true }],
    test_mode_compatible: true,
    title_required: true,
    body_required: false,
    schema_available: true,
    title_supported: true,
    body_supported: false,
    unavailable_reason: null,
  },
}

afterEach(() => {
  resetMockCampaignStore()
})

describe('P0 — Paused Campaign V2 Minimal Update (No Shortcode Source Error)', () => {
  it('1, 2 & 3. Paused Campaign with empty historical raw_source opens Step 2 and passes paused validation without shortcode source error', () => {
    const { campaign, contents } = makeCampaign9Fixture()
    const state = campaignToV2WizardState(campaign, contents)

    // Historical content has empty raw_source in wizard state
    assert.equal(state.contents[0]?.external_ref, 'mock-5-nrf8')
    assert.equal(state.contents[0]?.raw_source, '')
    assert.equal(state.executionMode, 'one_account_one_job')

    // Old validateStep2Plan WOULD fail on this historical content (confirming root cause)
    const legacyCheck = validateStep2Plan({
      groups: [SAMPLE_GROUP],
      contents: state.contents,
      resolvedTags: [SAMPLE_TAG],
    })
    assert.equal(legacyCheck.ok, false)
    if (!legacyCheck.ok) {
      assert.equal(legacyCheck.message, 'mock-5-nrf8: Shortcode source cannot be empty.')
    }

    // Paused Edit validation validates only execution_mode and succeeds
    const pausedCheck = validatePausedStep2Plan({
      executionMode: 'one_account_many_jobs',
    })
    assert.deepEqual(pausedCheck, {
      ok: true,
      execution_mode: 'one_account_many_jobs',
    })
  })

  it('4, 5, 6 & 7. Minimal PUT payload contains only plan_version and execution_mode, omitting contents, action_tags, and raw_source', () => {
    const input = buildUpdatePausedCampaignV2Input({
      id: '7f6324cc-d8d9-41de-b4d3-65d23092d0f2',
      execution_mode: 'one_account_many_jobs',
    })
    const body = buildLivePausedCampaignV2UpdateBody(input)

    assert.deepEqual(body, {
      plan_version: 2,
      execution_mode: 'one_account_many_jobs',
    })
    assert.equal('contents' in body, false)
    assert.equal('action_tags' in body, false)
    assert.equal('name' in body, false)
    assert.equal('run_mode' in body, false)
  })

  it('8, 9, 10 & 11. Paused update preserves Step 1, historical Contents, Attempts, status=paused, and never triggers Start/Resume/Retry', async () => {
    const created = await mockCampaignAdapter.createCampaignV2({
      plan_version: 2,
      name: 'test3',
      run_mode: 'live',
      execution_mode: 'one_account_one_job',
      action_tags: [
        {
          action_tag_id: 12,
          action_tag_key: 'mayhopphat.create_post',
          site_key: 'mayhopphat',
          script_package_key: 'mayhopphat.create_post',
          script_version: '1.0.0',
          release_id: 101,
          resolution_source: 'site_specific',
          shortcode_mapping: { entries: [{ shortcode: 'title', variable: 'title' }] },
          interval_minutes: 60,
        },
      ],
      contents: [
        {
          external_ref: 'mock-5-nrf8',
          raw_source: '[title]Success Article[/title]',
          assignments: [
            {
              action_tag_id: 12,
              action_tag_key: 'mayhopphat.create_post',
              script_package_key: 'mayhopphat.create_post',
              script_version: '1.0.0',
              release_id: 101,
              raw_source: '[title]Success Article[/title]',
              shortcode_mapping: { entries: [{ shortcode: 'title', variable: 'title' }] },
            },
          ],
        },
      ],
    })

    const store = getMockCampaignStore()
    const inStore = store.campaigns.find((c) => c.id === created.id)!
    inStore.status = 'paused'
    const cRow = store.contents.find((c) => c.campaign_id === created.id)!
    cRow.status = 'success'
    const attemptsBefore = store.job_attempts.length

    const updated = await mockCampaignAdapter.updatePausedCampaignV2({
      id: created.id,
      plan_version: 2,
      execution_mode: 'one_account_many_jobs',
    })

    assert.equal(updated.status, 'paused')
    assert.equal(updated.execution_mode, 'one_account_many_jobs')
    assert.equal(updated.name, 'test3')
    assert.equal(updated.run_mode, 'live')
    assert.equal(updated.action_tags?.[0]?.interval_minutes, 60)
    assert.equal(store.contents.find((c) => c.id === cRow.id)?.status, 'success')
    assert.equal(store.job_attempts.length, attemptsBefore)

    const hookSrc = readFileSync(
      resolve('src/features/campaigns/use-campaigns.ts'),
      'utf8',
    )
    const pausedBlock = hookSrc.slice(
      hookSrc.indexOf('const updatePausedCampaignV2'),
      hookSrc.indexOf('const applyAndReloadCampaign'),
    )
    assert.doesNotMatch(pausedBlock, /startCampaign|resumeCampaign|retryContent/)
  })

  it('12, 13 & 14. Create, Draft Edit, and genuine pending Content edit still validate required shortcode sources', () => {
    const emptyPendingCheck = validateStep2Plan({
      groups: [SAMPLE_GROUP],
      contents: [
        {
          id: 'new-1',
          persisted_id: null,
          persisted_assignments_by_tag: {},
          external_ref: 'pending-art-1',
          target_tag_keys: ['mayhopphat.create_post'],
          raw_source: '',
        },
      ],
      resolvedTags: [SAMPLE_TAG],
    })
    assert.equal(emptyPendingCheck.ok, false)
    if (!emptyPendingCheck.ok) {
      assert.equal(
        emptyPendingCheck.message,
        'pending-art-1: Shortcode source cannot be empty.',
      )
    }

    const validPendingCheck = validateStep2Plan({
      groups: [SAMPLE_GROUP],
      contents: [
        {
          id: 'new-1',
          persisted_id: null,
          persisted_assignments_by_tag: {},
          external_ref: 'pending-art-1',
          target_tag_keys: ['mayhopphat.create_post'],
          raw_source: '[title]Valid Title[/title]',
        },
      ],
      resolvedTags: [SAMPLE_TAG],
    })
    assert.equal(validPendingCheck.ok, true)
  })

  it('15, 16, 17 & 18. Backend validation errors visible, interval unit selector, screenshots, and polling intact', async () => {
    const err = formatCampaignV2ApiError(
      new ApiError('Invalid execution_mode.', {
        kind: 'validation',
        status: 422,
        details: { errors: ['execution_mode is invalid'] },
      }),
    )
    assert.deepEqual(err.validationErrors, ['execution_mode is invalid'])

    assert.deepEqual(decomposeIntervalMinutes(240), { value: '4', unit: 'hours' })
    assert.equal(
      resolveArtifactFetchUrl({
        artifact_uuid: 'art-1',
        has_binary: true,
        download_url: null,
        url: null,
      }),
      '/social-automation/api/campaigns/artifacts/art-1',
    )

    let calls = 0
    const controller = createDetailRefreshController({
      loadDetail: async () => {
        calls += 1
      },
      loadContents: async () => {
        calls += 1
      },
    })
    await controller.refresh('7f6324cc-d8d9-41de-b4d3-65d23092d0f2')
    assert.equal(calls, 2)
  })
})
