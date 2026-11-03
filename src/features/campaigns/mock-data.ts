import {
  DEFAULT_RESOURCE_RECHECK_SECONDS,
  DEFAULT_TIMEZONE,
} from './schedule.ts'
import { emptySummary, summarizeContents } from './status-labels.ts'
import type {
  Campaign,
  CampaignAction,
  CampaignContent,
  CampaignJobAttempt,
  CampaignSchedule,
  CampaignStoreSnapshot,
} from './types.ts'

function schedule(
  partial: Partial<CampaignSchedule> & Pick<CampaignSchedule, 'type'>,
): CampaignSchedule {
  return {
    timezone: DEFAULT_TIMEZONE,
    start_at: null,
    daily_window: null,
    min_interval_seconds: null,
    resource_recheck_seconds: DEFAULT_RESOURCE_RECHECK_SECONDS,
    ...partial,
  }
}

function actionsFor(status: Campaign['status']): CampaignAction[] {
  switch (status) {
    case 'draft':
      return ['edit', 'start', 'cancel']
    case 'scheduled':
      return ['edit', 'start', 'cancel']
    case 'running':
      return ['pause', 'cancel']
    case 'paused':
      return ['resume', 'cancel', 'start']
    case 'completed':
      return []
    case 'cancelled':
      return []
    default:
      return []
  }
}

const now = '2026-11-02T09:00:00+07:00'

const campaignsSeed: Campaign[] = [
  {
    id: 'camp_draft_empty',
    name: 'Draft — Zero Content',
    site_key: 'facebook',
    site_name: 'Facebook',
    script_package_key: 'script.facebook.group_composer.post',
    script_name: 'Facebook Group Composer',
    execution_mode: 'one_account_one_job',
    run_mode: 'live',
    status: 'draft',
    schedule: schedule({ type: 'immediate' }),
    summary: emptySummary(),
    created_at: now,
    updated_at: now,
    allowed_actions: actionsFor('draft'),
  },
  {
    id: 'camp_scheduled',
    name: 'Scheduled Morning Posts',
    site_key: 'wordpress',
    site_name: 'WordPress',
    script_package_key: 'script.wordpress.new_post.post',
    script_name: 'WordPress New Post',
    execution_mode: 'one_account_many_jobs',
    run_mode: 'live',
    status: 'scheduled',
    schedule: schedule({
      type: 'scheduled',
      start_at: '2026-11-05T08:00:00+07:00',
    }),
    summary: emptySummary(),
    created_at: now,
    updated_at: now,
    allowed_actions: actionsFor('scheduled'),
  },
  {
    id: 'camp_running',
    name: 'Running Live Campaign',
    site_key: 'facebook',
    site_name: 'Facebook',
    script_package_key: 'script.facebook.group_composer.post',
    script_name: 'Facebook Group Composer',
    execution_mode: 'one_account_one_job',
    run_mode: 'live',
    status: 'running',
    schedule: schedule({ type: 'immediate' }),
    summary: emptySummary(),
    created_at: now,
    updated_at: now,
    allowed_actions: actionsFor('running'),
  },
  {
    id: 'camp_waiting',
    name: 'Waiting for Online Accounts',
    site_key: 'wordpress',
    site_name: 'WordPress',
    script_package_key: 'script.wordpress.new_post.post',
    script_name: 'WordPress New Post',
    execution_mode: 'one_account_one_job',
    run_mode: 'live',
    status: 'running',
    schedule: schedule({
      type: 'time_window',
      start_at: '2026-11-05T08:00:00+07:00',
      daily_window: { from: '08:00', to: '22:00' },
      min_interval_seconds: 1800,
    }),
    summary: emptySummary(),
    created_at: now,
    updated_at: now,
    allowed_actions: actionsFor('running'),
  },
  {
    id: 'camp_test',
    name: 'Test Mode Smoke',
    site_key: 'wordpress',
    site_name: 'WordPress',
    script_package_key: 'script.wordpress.new_post.post',
    script_name: 'WordPress New Post',
    execution_mode: 'one_account_one_job',
    run_mode: 'test',
    status: 'draft',
    schedule: schedule({ type: 'immediate' }),
    summary: emptySummary(),
    created_at: now,
    updated_at: now,
    allowed_actions: actionsFor('draft'),
  },
  {
    id: 'camp_live',
    name: 'Live Production Window',
    site_key: 'facebook',
    site_name: 'Facebook',
    script_package_key: 'script.facebook.group_composer.post',
    script_name: 'Facebook Group Composer',
    execution_mode: 'one_account_many_jobs',
    run_mode: 'live',
    status: 'paused',
    schedule: schedule({
      type: 'time_window',
      start_at: '2026-11-02T08:00:00+07:00',
      daily_window: { from: '08:00', to: '22:00' },
      min_interval_seconds: 1800,
    }),
    summary: emptySummary(),
    created_at: now,
    updated_at: now,
    allowed_actions: actionsFor('paused'),
  },
  {
    id: 'camp_failed_unknown',
    name: 'Failed Locked + Unknown',
    site_key: 'facebook',
    site_name: 'Facebook',
    script_package_key: 'script.facebook.group_composer.post',
    script_name: 'Facebook Group Composer',
    execution_mode: 'one_account_one_job',
    run_mode: 'live',
    status: 'paused',
    schedule: schedule({ type: 'immediate' }),
    summary: emptySummary(),
    created_at: now,
    updated_at: now,
    allowed_actions: actionsFor('paused'),
  },
  {
    id: 'camp_completed',
    name: 'Completed Batch',
    site_key: 'wordpress',
    site_name: 'WordPress',
    script_package_key: 'script.wordpress.new_post.post',
    script_name: 'WordPress New Post',
    execution_mode: 'one_account_many_jobs',
    run_mode: 'live',
    status: 'completed',
    schedule: schedule({ type: 'immediate' }),
    summary: emptySummary(),
    created_at: now,
    updated_at: now,
    allowed_actions: actionsFor('completed'),
  },
  {
    id: 'camp_multi_account',
    name: 'Multi-Account Allocation',
    site_key: 'facebook',
    site_name: 'Facebook',
    script_package_key: 'script.facebook.comment',
    script_name: 'Facebook Comment',
    execution_mode: 'one_account_one_job',
    run_mode: 'live',
    status: 'running',
    schedule: schedule({ type: 'immediate' }),
    summary: emptySummary(),
    created_at: now,
    updated_at: now,
    allowed_actions: actionsFor('running'),
  },
]

const contentsSeed: CampaignContent[] = [
  {
    id: 'cnt_sched_1',
    campaign_id: 'camp_scheduled',
    external_ref: 'manual-sched-001',
    source: 'manual',
    status: 'pending',
    input: {
      title: 'Scheduled draft title',
      body: 'Body for scheduled campaign.',
      variables: {},
    },
    editor_doc: null,
    assigned_account_id: null,
    assigned_account_label: null,
    current_job_id: null,
    last_result: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cnt_run_1',
    campaign_id: 'camp_running',
    external_ref: 'manual-run-001',
    source: 'manual',
    status: 'running',
    input: {
      title: null,
      body: 'Live running content A',
      variables: { group_id: 'g_100' },
    },
    editor_doc: null,
    assigned_account_id: 'acc_mock_01',
    assigned_account_label: 'FB Ops A',
    current_job_id: 'job_9001',
    last_result: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cnt_run_2',
    campaign_id: 'camp_running',
    external_ref: 'manual-run-002',
    source: 'manual',
    status: 'pending',
    input: {
      title: null,
      body: 'Live running content B',
      variables: { group_id: 'g_101' },
    },
    editor_doc: null,
    assigned_account_id: null,
    assigned_account_label: null,
    current_job_id: null,
    last_result: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cnt_wait_1',
    campaign_id: 'camp_waiting',
    external_ref: 'manual-wait-001',
    source: 'manual',
    status: 'waiting_resources',
    input: {
      title: 'Waiting post',
      body: 'Waiting for online account lease.',
      variables: {},
    },
    editor_doc: null,
    assigned_account_id: null,
    assigned_account_label: null,
    current_job_id: null,
    last_result: 'waiting_resources — recheck in 60m',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cnt_test_1',
    campaign_id: 'camp_test',
    external_ref: 'manual-test-001',
    source: 'manual',
    status: 'draft',
    input: {
      title: 'Test title',
      body: 'Test mode body — stop before publish.',
      variables: {},
    },
    editor_doc: null,
    assigned_account_id: null,
    assigned_account_label: null,
    current_job_id: null,
    last_result: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cnt_live_1',
    campaign_id: 'camp_live',
    external_ref: 'manual-live-001',
    source: 'manual',
    status: 'pending',
    input: {
      title: null,
      body: 'Paused live window content',
      variables: { group_id: 'g_200' },
    },
    editor_doc: null,
    assigned_account_id: 'acc_mock_02',
    assigned_account_label: 'FB Ops B',
    current_job_id: null,
    last_result: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cnt_fail_1',
    campaign_id: 'camp_failed_unknown',
    external_ref: 'manual-fail-001',
    source: 'manual',
    status: 'failed_locked',
    input: {
      title: null,
      body: 'Failed locked content — admin action required.',
      variables: { group_id: 'g_300' },
    },
    editor_doc: null,
    assigned_account_id: 'acc_mock_03',
    assigned_account_label: 'FB Ops C',
    current_job_id: 'job_9100',
    last_result: 'failed_locked: selector timeout',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cnt_unk_1',
    campaign_id: 'camp_failed_unknown',
    external_ref: 'manual-unk-001',
    source: 'manual',
    status: 'unknown',
    input: {
      title: null,
      body: 'Unknown result — do not auto retry.',
      variables: { group_id: 'g_301' },
    },
    editor_doc: null,
    assigned_account_id: 'acc_mock_04',
    assigned_account_label: 'FB Ops D',
    current_job_id: 'job_9101',
    last_result: 'unknown: agent disconnect mid-run',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cnt_done_1',
    campaign_id: 'camp_completed',
    external_ref: 'manual-done-001',
    source: 'manual',
    status: 'success',
    input: {
      title: 'Done title',
      body: 'Completed successfully.',
      variables: {},
    },
    editor_doc: null,
    assigned_account_id: 'acc_mock_05',
    assigned_account_label: 'WP Ops A',
    current_job_id: 'job_9200',
    last_result: 'success',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cnt_done_2',
    campaign_id: 'camp_completed',
    external_ref: 'manual-done-002',
    source: 'manual',
    status: 'success',
    input: {
      title: 'Done title 2',
      body: 'Also completed.',
      variables: {},
    },
    editor_doc: null,
    assigned_account_id: 'acc_mock_05',
    assigned_account_label: 'WP Ops A',
    current_job_id: 'job_9201',
    last_result: 'success',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cnt_multi_1',
    campaign_id: 'camp_multi_account',
    external_ref: 'manual-multi-001',
    source: 'manual',
    status: 'success',
    input: {
      title: null,
      body: 'Comment from account 1',
      variables: {},
    },
    editor_doc: null,
    assigned_account_id: 'acc_mock_10',
    assigned_account_label: 'FB Commenter 1',
    current_job_id: 'job_9300',
    last_result: 'success',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cnt_multi_2',
    campaign_id: 'camp_multi_account',
    external_ref: 'manual-multi-002',
    source: 'manual',
    status: 'running',
    input: {
      title: null,
      body: 'Comment from account 2',
      variables: {},
    },
    editor_doc: null,
    assigned_account_id: 'acc_mock_11',
    assigned_account_label: 'FB Commenter 2',
    current_job_id: 'job_9301',
    last_result: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cnt_multi_3',
    campaign_id: 'camp_multi_account',
    external_ref: 'manual-multi-003',
    source: 'manual',
    status: 'pending',
    input: {
      title: null,
      body: 'Comment from account 3',
      variables: {},
    },
    editor_doc: null,
    assigned_account_id: 'acc_mock_12',
    assigned_account_label: 'FB Commenter 3',
    current_job_id: null,
    last_result: null,
    created_at: now,
    updated_at: now,
  },
]

const jobsSeed: CampaignJobAttempt[] = [
  {
    id: 'att_9001',
    content_id: 'cnt_run_1',
    campaign_id: 'camp_running',
    attempt: 1,
    status: 'running',
    agent_label: 'agent-mock-1',
    browser_label: 'Chrome · profile-a',
    started_at: now,
    ended_at: null,
    error: null,
    artifacts: [],
  },
  {
    id: 'att_9100',
    content_id: 'cnt_fail_1',
    campaign_id: 'camp_failed_unknown',
    attempt: 1,
    status: 'failed_locked',
    agent_label: 'agent-mock-2',
    browser_label: 'Chrome · profile-b',
    started_at: '2026-11-02T08:10:00+07:00',
    ended_at: '2026-11-02T08:12:00+07:00',
    error: 'selector timeout at step publish',
    artifacts: [
      {
        id: 'art_1',
        kind: 'screenshot',
        label: 'failure.png',
        url: null,
      },
    ],
  },
  {
    id: 'att_9101',
    content_id: 'cnt_unk_1',
    campaign_id: 'camp_failed_unknown',
    attempt: 1,
    status: 'unknown',
    agent_label: 'agent-mock-3',
    browser_label: 'Chrome · profile-c',
    started_at: '2026-11-02T08:20:00+07:00',
    ended_at: null,
    error: 'agent disconnect — result uncertain',
    artifacts: [],
  },
  {
    id: 'att_9200',
    content_id: 'cnt_done_1',
    campaign_id: 'camp_completed',
    attempt: 1,
    status: 'success',
    agent_label: 'agent-mock-4',
    browser_label: 'Chrome · profile-d',
    started_at: '2026-11-01T10:00:00+07:00',
    ended_at: '2026-11-01T10:05:00+07:00',
    error: null,
    artifacts: [
      {
        id: 'art_2',
        kind: 'screenshot',
        label: 'success.png',
        url: null,
      },
    ],
  },
]

function withSummaries(
  campaigns: Campaign[],
  contents: CampaignContent[],
): Campaign[] {
  return campaigns.map((c) => {
    const statuses = contents
      .filter((x) => x.campaign_id === c.id)
      .map((x) => x.status)
    return {
      ...c,
      summary: summarizeContents(statuses),
      allowed_actions: actionsFor(c.status),
    }
  })
}

/** Deep-clone labeled MOCK seed — never production data. */
export function createMockCampaignStore(): CampaignStoreSnapshot {
  const contents = structuredClone(contentsSeed)
  const campaigns = withSummaries(structuredClone(campaignsSeed), contents)
  return {
    campaigns,
    contents,
    job_attempts: structuredClone(jobsSeed),
  }
}

/** Mock-only: Script package keys known Test Mode compatible */
export const MOCK_TEST_MODE_COMPATIBLE_SCRIPTS = new Set<string>([
  'script.wordpress.new_post.post',
])

/** Mock Script input schemas for Campaign Content forms */
export const MOCK_SCRIPT_INPUT_SCHEMAS: Record<
  string,
  {
    variables: Array<{
      key: string
      type: string
      required?: boolean
      label?: string
    }>
    test_mode_compatible: boolean | null
  }
> = {
  'script.wordpress.new_post.post': {
    variables: [
      { key: 'title', type: 'string', required: true, label: 'Title' },
      { key: 'body', type: 'text', required: true, label: 'Body' },
    ],
    test_mode_compatible: true,
  },
  'script.facebook.group_composer.post': {
    variables: [
      { key: 'body', type: 'text', required: true, label: 'Body' },
      { key: 'group_id', type: 'string', required: true, label: 'Group ID' },
    ],
    test_mode_compatible: false,
  },
  'script.facebook.comment': {
    variables: [
      { key: 'body', type: 'text', required: true, label: 'Comment' },
    ],
    test_mode_compatible: null,
  },
}
