import { STAFF_CLIENT_BOOTSTRAP_LOCALSTORAGE_KEY } from '@/lib/api/config'

import type {
  LiveOwnerClientConnectionsResponse,
  LiveStaffClientConnectionResponse,
} from './api/live-types'

const MOCK_EXPIRES = Math.floor(Date.now() / 1000) + 3600

export const MOCK_STAFF_NOT_CONNECTED: LiveStaffClientConnectionResponse = {
  ok: true,
  endpoint: 'http://localhost',
  connected: false,
  status: 'not_connected',
  bootstrap: {
    raw_key: 'rpa_client_mock0001_staff_enroll_DEMO_ONLY_not_live',
    key_prefix: 'rpa_client_mock0001',
    expires_at: MOCK_EXPIRES,
    expires_at_iso: new Date(MOCK_EXPIRES * 1000).toISOString(),
    installation_id: 'ins_mock',
    purpose: 'staff_client_enroll',
    tutorial_video: {
      available: false,
      placeholder: true,
      message: 'Video tutorial placeholder',
    },
  },
  connection: null,
  localstorage_key: STAFF_CLIENT_BOOTSTRAP_LOCALSTORAGE_KEY,
}

export const MOCK_STAFF_CONNECTED: LiveStaffClientConnectionResponse = {
  ok: true,
  endpoint: 'http://localhost',
  connected: true,
  status: 'connected',
  bootstrap: null,
  connection: {
    client_api_key_id: 101,
    key_prefix: 'rpa_client_abcd1234',
    key_name: 'Staff Client 1',
    staff_user_id: 1,
    staff_name: 'Mock Staff',
    machine_name: 'DESKTOP-MOCK01',
    agent_uuid: 'agt_mock_001',
    connection_status: 'connected',
    is_active: true,
    connected_at: '2026-10-29T08:00:00+00:00',
    disconnected_at: null,
    last_heartbeat_at: '2026-10-29T08:15:00+00:00',
    installation_id: 'ins_mock',
  },
  localstorage_key: STAFF_CLIENT_BOOTSTRAP_LOCALSTORAGE_KEY,
}

export const MOCK_OWNER_CONNECTIONS: LiveOwnerClientConnectionsResponse = {
  ok: true,
  connections: [
    {
      client_api_key_id: 101,
      key_prefix: 'rpa_client_abcd1234',
      key_name: 'Staff Client 1',
      staff_user_id: 1,
      staff_name: 'Mock Staff',
      machine_name: 'DESKTOP-MOCK01',
      agent_uuid: 'agt_mock_001',
      connection_status: 'connected',
      is_active: true,
      connected_at: '2026-10-29T08:00:00+00:00',
      disconnected_at: null,
      last_heartbeat_at: '2026-10-29T08:15:00+00:00',
      installation_id: 'ins_mock',
      connected: true,
    },
    {
      client_api_key_id: 88,
      key_prefix: 'rpa_client_deadbeef',
      key_name: 'Staff Client 7',
      staff_user_id: 7,
      staff_name: 'Former Staff',
      machine_name: 'LAPTOP-OLD',
      agent_uuid: 'agt_mock_088',
      connection_status: 'disconnected',
      is_active: false,
      connected_at: '2026-10-20T10:00:00+00:00',
      disconnected_at: '2026-10-28T18:00:00+00:00',
      last_heartbeat_at: '2026-10-28T17:55:00+00:00',
      installation_id: 'ins_mock',
      connected: false,
    },
  ],
  summary: { total: 2, active: 1, disconnected: 1 },
  notes:
    'Successful registrations only. Unused temporary Keys are never stored and never listed.',
}
