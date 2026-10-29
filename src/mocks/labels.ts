/** Explicit mock marker — not live API data. */
export const MOCK_BANNER =
  'MOCK DATA — local only. No live API. Demos: ?demo=empty|error|missing-video · Scripts ?play=…&detail=… · Accounts/Keys ?demo=empty|error'

/** Shown when VITE_RPA_API_MODE=live — staff session menus (Clients stay MOCK). */
export const LIVE_BANNER =
  'LIVE MODE — Action Tags + Script Registry + Accounts + Client API Keys staff API (session + CSRF). Clients remain MOCK. No Electron Client API Key in browser.'
