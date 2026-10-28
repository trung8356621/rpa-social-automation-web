/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPA_API_MODE?: string
  readonly VITE_RPA_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
