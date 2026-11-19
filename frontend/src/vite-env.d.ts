/// <reference types="vite/client" />

/** Build-time settings read from .env.local (see frontend/.env.example). */
interface ImportMetaEnv {
  /** Base URL of the Contacts API, e.g. http://localhost:3000/v2. Empty = run on sample data. */
  readonly VITE_API_URL?: string
  /** Identity headers for the backend's auth stub, until JWT exists. */
  readonly VITE_API_USER_ID?: string
  readonly VITE_API_COMPANY_ID?: string
  readonly VITE_API_ALLOWED_COMPANY_IDS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
