import assert from 'node:assert/strict'
import test from 'node:test'

import { ApiError } from '../src/lib/api/errors.ts'
import {
  CAMPAIGN_SCHEDULER_DESCRIPTION,
  canEditSchedulerSettings,
  getMinuteBounds,
  isSettingsUnavailableError,
  mapLiveSchedulerSettings,
  minutesToSeconds,
  secondsToMinutes,
  validateSchedulerMinutes,
} from '../src/features/settings/scheduler-settings.ts'

test('maps GET /social-automation/api/settings envelope and converts seconds to minutes', () => {
  const mapped = mapLiveSchedulerSettings({
    ok: true,
    data: {
      scheduler_interval_seconds: 3600,
      default_interval_seconds: 3600,
      min_interval_seconds: 60,
      max_interval_seconds: 86400,
      updated_at: null,
    },
  })

  assert.equal(mapped.scheduler_interval_seconds, 3600)
  assert.equal(mapped.default_interval_seconds, 3600)
  assert.equal(mapped.min_interval_seconds, 60)
  assert.equal(mapped.max_interval_seconds, 86400)
  assert.equal(mapped.updated_at, null)

  assert.equal(secondsToMinutes(mapped.scheduler_interval_seconds), 60)
  assert.deepEqual(getMinuteBounds(mapped), { minMinutes: 1, maxMinutes: 1440 })
})

test('converts 2 minutes to 120 seconds for TEST operator setting', () => {
  const result = validateSchedulerMinutes('2', { minMinutes: 1, maxMinutes: 1440 })
  assert.deepEqual(result, {
    valid: true,
    minutes: 2,
    seconds: 120,
  })
  assert.equal(minutesToSeconds(2), 120)
  assert.equal(secondsToMinutes(120), 2)
})

test('validates range 1 to 1440 minutes and rejects invalid inputs', () => {
  const bounds = { minMinutes: 1, maxMinutes: 1440 }

  assert.equal(validateSchedulerMinutes('1', bounds).valid, true)
  assert.equal(validateSchedulerMinutes('1440', bounds).valid, true)

  assert.equal(validateSchedulerMinutes('', bounds).valid, false)
  assert.equal(validateSchedulerMinutes('0', bounds).valid, false)
  assert.equal(validateSchedulerMinutes('-5', bounds).valid, false)
  assert.equal(validateSchedulerMinutes('1441', bounds).valid, false)
  assert.equal(validateSchedulerMinutes('2.5', bounds).valid, false)
  assert.equal(validateSchedulerMinutes('abc', bounds).valid, false)
})

test('enforces Admin/Owner permission for editing scheduler settings', () => {
  assert.equal(
    canEditSchedulerSettings({
      roleResolved: true,
      isOwnerOrAdmin: true,
      isStaff: false,
    }),
    true,
  )
  assert.equal(
    canEditSchedulerSettings({
      roleResolved: true,
      isOwnerOrAdmin: false,
      isStaff: true,
    }),
    false,
  )
  assert.equal(
    canEditSchedulerSettings({
      roleResolved: false,
      isOwnerOrAdmin: true,
      isStaff: false,
    }),
    false,
  )
})

test('detects Settings API unavailable on 404 and 503 without treating 500 or 422 as unavailable', () => {
  const err404 = new ApiError('Not found', { kind: 'not_found', status: 404 })
  const err503 = new ApiError('Service unavailable', {
    kind: 'server',
    status: 503,
  })
  const err500 = new ApiError('Internal error', { kind: 'server', status: 500 })
  const err422 = new ApiError('Validation failed', {
    kind: 'validation',
    status: 422,
  })

  assert.equal(isSettingsUnavailableError(err404), true)
  assert.equal(isSettingsUnavailableError(err503), true)
  assert.equal(isSettingsUnavailableError(err500), false)
  assert.equal(isSettingsUnavailableError(err422), false)
})

test('preserves updated_at when returned by backend and includes required explanation copy', () => {
  const mapped = mapLiveSchedulerSettings({
    ok: true,
    data: {
      scheduler_interval_seconds: 120,
      default_interval_seconds: 3600,
      min_interval_seconds: 60,
      max_interval_seconds: 86400,
      updated_at: '2026-11-22T12:40:00Z',
    },
  })

  assert.equal(mapped.scheduler_interval_seconds, 120)
  assert.equal(secondsToMinutes(mapped.scheduler_interval_seconds), 2)
  assert.equal(mapped.updated_at, '2026-11-22T12:40:00Z')
  assert.equal(
    CAMPAIGN_SCHEDULER_DESCRIPTION,
    'Controls how often the server checks running Campaigns and dispatches eligible jobs. Campaigns continue running even when no Clients are online.',
  )
})
