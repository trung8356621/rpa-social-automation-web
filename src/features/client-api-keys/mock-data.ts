import type { ClientApiKeyItem, ClientApiKeysData } from './types'

export const MOCK_CLIENT_API_KEYS: ClientApiKeyItem[] = [
  {
    id: 1,
    name: 'Office Desktop Client',
    key_prefix: 'rpa_sk_ab12',
    installation_id: 'inst_demo',
    created_by: 1,
    created_by_name: 'rpa.creator',
    last_used_at: '2026-10-28T09:50:00Z',
    revoked_at: null,
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    mock_lease: {
      status: 'valid',
      connection: 'online',
      heartbeat_at: '2026-10-28T09:50:00Z',
      heartbeat_stale: false,
      device_hostname: 'DESKTOP-HJ2LKRD',
    },
  },
  {
    id: 2,
    name: 'Staging Laptop — long label for overflow check and wrap',
    key_prefix: 'rpa_sk_cd34',
    installation_id: 'inst_demo',
    created_by: 2,
    created_by_name: 'tech.lead',
    last_used_at: '2026-10-28T07:00:00Z',
    revoked_at: null,
    is_active: true,
    created_at: '2026-10-01T00:00:00Z',
    mock_lease: {
      status: 'valid',
      connection: 'online',
      heartbeat_at: '2026-10-28T07:00:00Z',
      heartbeat_stale: true,
      device_hostname: 'LAPTOP-STAGE-01',
    },
  },
  {
    id: 3,
    name: 'Idle Key',
    key_prefix: 'rpa_sk_ef56',
    installation_id: 'inst_demo',
    created_by: 1,
    created_by_name: 'rpa.creator',
    last_used_at: null,
    revoked_at: null,
    is_active: true,
    created_at: '2026-10-15T00:00:00Z',
    mock_lease: {
      status: 'none',
      connection: 'offline',
      heartbeat_at: null,
      heartbeat_stale: false,
      device_hostname: null,
    },
  },
  {
    id: 4,
    name: 'Revoked Field Unit',
    key_prefix: 'rpa_sk_gh78',
    installation_id: 'inst_demo',
    created_by: 1,
    created_by_name: 'rpa.creator',
    last_used_at: '2026-10-10T00:00:00Z',
    revoked_at: '2026-10-12T00:00:00Z',
    is_active: false,
    created_at: '2026-08-01T00:00:00Z',
    mock_lease: {
      status: 'expired',
      connection: 'offline',
      heartbeat_at: '2026-10-12T00:00:00Z',
      heartbeat_stale: true,
      device_hostname: 'FIELD-PC-09',
    },
  },
]

export const MOCK_CLIENT_API_KEYS_DATA: ClientApiKeysData = {
  keys: MOCK_CLIENT_API_KEYS,
}

export const EMPTY_CLIENT_API_KEYS_DATA: ClientApiKeysData = { keys: [] }
