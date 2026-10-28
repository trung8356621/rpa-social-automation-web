/** Explicit mock marker — not live API data. */
export const MOCK_BANNER =
  'MOCK DATA — local only. No live API. Demos: ?demo=empty|error|missing-video · Scripts ?play=…&detail=… · Accounts/Keys ?demo=empty|error'

/** Shown when VITE_RPA_API_MODE=live — Action Tags uses staff API; other routes stay mock. */
export const LIVE_BANNER =
  'LIVE MODE — Action Tags read-only staff API. Other routes remain MOCK. No production writes from this UI (CP9A).'
