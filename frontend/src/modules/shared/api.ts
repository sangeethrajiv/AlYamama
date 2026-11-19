/**
 * HTTP client for the Contacts API (backend/src/contacts).
 *
 * The module is only used when `VITE_API_URL` is set, for example in
 * frontend/.env.local:
 *
 *     VITE_API_URL=http://localhost:3000/v2
 *
 * Without it the Contact module keeps running on the sample data in data.ts, so
 * the prototype still works with no backend.
 */

export const API_URL: string = (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || ''
export const apiEnabled = () => API_URL.length > 0

/**
 * Identity headers. The backend's auth is still a stub (no JWT yet), so the
 * caller states who it is and which companies it may see. Leaving the company
 * headers unset means "all companies", which suits this prototype.
 */
function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const uid = import.meta.env?.VITE_API_USER_ID as string | undefined
  const cid = import.meta.env?.VITE_API_COMPANY_ID as string | undefined
  const allowed = import.meta.env?.VITE_API_ALLOWED_COMPANY_IDS as string | undefined
  if (uid) h['X-User-Id'] = uid
  if (cid) h['X-Company-Id'] = cid
  if (allowed) h['X-Allowed-Company-Ids'] = allowed
  return h
}

export interface ApiError extends Error {
  status: number
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers(), ...(init?.headers || {}) } })
  let body: { success?: boolean; data?: T; message?: string } = {}
  try {
    body = await res.json()
  } catch {
    /* an empty or non-JSON body is handled below */
  }
  if (!res.ok || body.success === false) {
    const err = new Error(body.message || `${res.status} ${res.statusText}`) as ApiError
    err.status = res.status
    throw err
  }
  return body.data as T
}

export const get = <T>(path: string) => request<T>(path)
export const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })
export const put = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
export const del = <T>(path: string) => request<T>(path, { method: 'DELETE' })

export interface ListResult<T> {
  records: T[]
  total: number
  page: number
  limit: number
  counts?: Record<string, number>
  groups?: Array<{ value: unknown; label: string; count: number }>
}

/** Server-side limit per request in the backend. */
const PAGE = 500

/**
 * Reads every page of a list endpoint.
 *
 * The Contact list filters and sorts in the browser, so it needs the whole set.
 * That is fine for this prototype (about 6,000 contacts) but is not how the
 * Angular UI should work: the API already supports `page`, `limit`, `q`,
 * `filters` and `order`, so the real client should page on the server.
 */
export async function getAll<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; ; page++) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v))
    params.set('page', String(page))
    params.set('limit', String(PAGE))
    const res = await get<ListResult<T>>(`${path}?${params.toString()}`)
    out.push(...res.records)
    if (out.length >= res.total || res.records.length < PAGE) break
  }
  return out
}
