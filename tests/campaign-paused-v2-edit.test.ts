import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, it } from 'node:test'

import { buildLiveCampaignV2UpdateBody } from '../src/features/campaigns/api/build-create-payload.ts'
import { mapLiveCampaign } from '../src/features/campaigns/api/mappers.ts'
import {
  getMockCampaignStore,
  mockCampaignAdapter,
  resetMockCampaignStore,
} from '../src/features/campaigns/api/mock-adapter.ts'
import { createDetailRefreshController } from '../src/features/campaigns/campaign-detail-polling.ts'
import { canEditActionTagInterval } from '../src/features/campaigns/campaign-interval-edit.ts'
import {
  buildUpdateCampaignV2Input,
  campaignToV2WizardState,
  canEditCampaignV2,
  formatCampaignV2ApiError,
  inspectV2UpdateSupport,
  type ResolvedActionTagPlan,
  type SchemaMappingGroup,
  type ValidatedContentAssociation,
} from '../src/features/campaigns/multi-tag-plan.ts'
import { executionModeLabel } from '../src/features/campaigns/status-labels.ts'
import { ApiError } from '../src/lib/api/errors.ts'

function makeResolvedTag(): ResolvedActionTagPlan {
  return {
    plan_tag_uuid: 'pt-uuid-1',
    tag_id: 10,
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
}

const SAMPLE_CONTENTS: ValidatedContentAssociation[] = [
  {
    persisted_id: 'cnt-1',
    external_ref: 'art-1',
    raw_source: '[title]Hello[/title]',
    targets: [
      {
        assignment_id: 'asgn-1',
        action_tag_key: 'mayhopphat.create_post',
        script_package_key: 'mayhopphat.create_post',
        script_version: '1.0.0',
        release_id: 101,
        resolution_source: 'site_specific',
        shortcode_mapping: {
          entries: [{ shortcode: 'title', variable: 'title' }],
        },
      },
    ],
  },
]

afterEach(() => {
  resetMockCampaignStore()
})

describe('Paused Campaign V2 Edit via Existing Wizard', () => {
  it('1, 2 & 11. Paused V2 Campaign exposes Edit, opens V2 Wizard, and Running/Cancelled/Completed cannot enter Edit', () => {
    const base = { plan_version: 2 as const, action_tags: [] }
    assert.equal(canEditCampaignV2({ ...base, status: 'paused' }), true)
    assert.equal(canEditCampaignV2({ ...base, status: 'draft' }), true)
    assert.equal(canEditCampaignV2({ ...base, status: 'running' }), false)
    assert.equal(canEditCampaignV2({ ...base, status: 'cancelled' }), false)
    assert.equal(canEditCampaignV2({ ...base, status: 'completed' }), false)

    const listSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignsScreen.tsx'),
      'utf8',
    )
    assert.match(listSrc, /c\.status === 'paused' && isCampaignV2\(c\)/)

    const detailSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(detailSrc, /campaign\.status === 'paused' && isV2/)

    const editPageSrc = readFileSync(
      resolve('src/pages/CampaignEditPage.tsx'),
      'utf8',
    )
    assert.match(editPageSrc, /<CampaignV2Wizard/)
    assert.match(editPageSrc, /campaign\.status === 'paused'/)
  })

  it('3, 4, 5 & 6. Step 1 is locked, Step 2 has ExecutionModeCards, and new Campaign defaults to one_account_many_jobs', () => {
    const wizardSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignV2Wizard.tsx'),
      'utf8',
    )
    assert.match(
      wizardSrc,
      /const isPausedEdit =\s*wizardMode === 'edit' && initialCampaign\?\.status === 'paused'/,
    )
    assert.match(wizardSrc, /const step1Locked = isPausedEdit/)
    assert.match(wizardSrc, /if \(step1Locked\) return/)
    assert.match(wizardSrc, /disabled=\{busy \|\| step1Locked\}/)
    assert.match(
      wizardSrc,
      /hydrated\?\.executionMode \?\? 'one_account_many_jobs'/,
    )
    assert.match(wizardSrc, /<ExecutionModeCards/)
  })

  it('7. Existing Campaign hydrates persisted Execution Mode', () => {
    const campaign = mapLiveCampaign({
      id: 'camp-9',
      plan_version: 2,
      revision: 4,
      name: 'Campaign 9',
      status: 'paused',
      execution_mode: 'one_account_one_job',
      run_mode: 'live',
      action_tags: [
        {
          plan_tag_uuid: 'pt-uuid-1',
          action_tag_id: 10,
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

    const state = campaignToV2WizardState(campaign, [])
    assert.equal(state.executionMode, 'one_account_one_job')

    const support = inspectV2UpdateSupport({
      campaign,
      detailLoaded: true,
      resolvedTags: [makeResolvedTag()],
    })
    assert.equal(support.supported, true)
  })

  it('8, 9, 10 & 12. Save updates Execution Mode, preserves Step 1/progress/attempts, does not Resume, and Draft Edit stays functional', async () => {
    const created = await mockCampaignAdapter.createCampaignV2({
      plan_version: 2,
      name: 'Paused Edit Mock',
      run_mode: 'live',
      execution_mode: 'one_account_one_job',
      action_tags: [
        {
          action_tag_id: 10,
          action_tag_key: 'mayhopphat.create_post',
          site_key: 'mayhopphat',
          script_package_key: 'mayhopphat.create_post',
          script_version: '1.0.0',
          release_id: 101,
          resolution_source: 'site_specific',
          shortcode_mapping: {
            entries: [{ shortcode: 'title', variable: 'title' }],
          },
          interval_minutes: 120,
        },
      ],
      contents: [
        {
          external_ref: 'art-1',
          raw_source: '[title]Hello[/title]',
          assignments: [
            {
              action_tag_id: 10,
              action_tag_key: 'mayhopphat.create_post',
              script_package_key: 'mayhopphat.create_post',
              script_version: '1.0.0',
              release_id: 101,
              raw_source: '[title]Hello[/title]',
              shortcode_mapping: {
                entries: [{ shortcode: 'title', variable: 'title' }],
              },
            },
          ],
        },
      ],
    })

    // Draft Edit remains functional
    const draftEdited = await mockCampaignAdapter.updateCampaignV2(
      buildUpdateCampaignV2Input({
        id: created.id,
        revision: created.revision,
        name: 'Draft Edited',
        run_mode: 'live',
        execution_mode: 'one_account_one_job',
        resolvedTags: [makeResolvedTag()],
        groups: [SAMPLE_GROUP],
        groupMappings: {
          'grp-1': { entries: [{ shortcode: 'title', variable: 'title' }] },
        },
        validatedContents: SAMPLE_CONTENTS,
      }),
    )
    assert.equal(draftEdited.status, 'draft')

    // Transition to paused in mock store
    const store = getMockCampaignStore()
    const target = store.campaigns.find((c) => c.id === created.id)!
    target.status = 'paused'
    const attemptsBefore = store.job_attempts.length

    const updateInput = buildUpdateCampaignV2Input({
      id: created.id,
      revision: draftEdited.revision,
      name: 'Draft Edited',
      run_mode: 'live',
      execution_mode: 'one_account_many_jobs',
      resolvedTags: [makeResolvedTag()],
      groups: [SAMPLE_GROUP],
      groupMappings: {
        'grp-1': { entries: [{ shortcode: 'title', variable: 'title' }] },
      },
      validatedContents: SAMPLE_CONTENTS,
      intervalsByTagKey: { 'mayhopphat.create_post': { value: '120', unit: 'minutes' } },
    })
    const liveBody = buildLiveCampaignV2UpdateBody(updateInput)
    assert.equal(liveBody.execution_mode, 'one_account_many_jobs')
    assert.equal(liveBody.action_tags[0]?.plan_tag_uuid, 'pt-uuid-1')
    assert.equal(liveBody.action_tags[0]?.interval_minutes, 120)

    const pausedUpdated = await mockCampaignAdapter.updateCampaignV2(updateInput)
    assert.equal(pausedUpdated.status, 'paused')
    assert.equal(pausedUpdated.execution_mode, 'one_account_many_jobs')
    assert.equal(store.job_attempts.length, attemptsBefore)

    // Running campaign update rejected
    const currentInStore = store.campaigns.find((c) => c.id === created.id)!
    currentInStore.status = 'running'
    await assert.rejects(
      () =>
        mockCampaignAdapter.updateCampaignV2({
          ...updateInput,
          revision: pausedUpdated.revision,
        }),
      (err: unknown) => err instanceof ApiError,
    )
  })

  it('13, 14, 15 & 16. Errors surfaced, Campaign List displays updated Execution Mode, inline interval & polling/screenshots intact', async () => {
    const formatted = formatCampaignV2ApiError(
      new ApiError('Validation failed.', {
        kind: 'validation',
        status: 422,
        details: { errors: ['execution_mode is invalid'] },
      }),
    )
    assert.deepEqual(formatted.validationErrors, ['execution_mode is invalid'])

    assert.equal(executionModeLabel('one_account_one_job'), '1 Account : 1 Job')
    assert.equal(executionModeLabel('one_account_many_jobs'), '1 Account : N Job')
    assert.equal(canEditActionTagInterval({ status: 'paused' }, true), true)

    let refreshCount = 0
    const controller = createDetailRefreshController({
      loadDetail: async () => {
        refreshCount += 1
      },
      loadContents: async () => {
        refreshCount += 1
      },
    })
    await controller.refresh('camp-9')
    assert.equal(refreshCount, 2)
  })
})
