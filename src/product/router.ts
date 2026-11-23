import { useEffect, useState } from 'react'

/**
 * Hash router for the Product module. The ERP shell owns the first hash segment (the tab id), so every route here starts with a
 * `prd_*` tab: #/prd_overview , #/prd_products , #/prd_products/new , #/prd_products/12 , #/prd_products/12/edit
 */
export const HOME = '/prd_overview'
export type Route =
  | { page: 'dashboard' }
  | { page: 'list'; section: string }
  | { page: 'new'; section: string }
  | { page: 'detail'; section: string; id: number }
  | { page: 'edit'; section: string; id: number }
  | { page: 'notfound' }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean)
  if (parts.length === 0 || parts[0] === 'prd_overview') return { page: 'dashboard' }
  const [section, a, b] = parts
  if (!a) return { page: 'list', section }
  if (a === 'new') return { page: 'new', section }
  const id = Number(a)
  if (!Number.isInteger(id)) return { page: 'notfound' }
  if (b === 'edit') return { page: 'edit', section, id }
  return b ? { page: 'notfound' } : { page: 'detail', section, id }
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return parseHash(hash)
}

export const navigate = (path: string) => {
  window.location.hash = path.startsWith('#') ? path : `#${path}`
}
export const hrefOf = (path: string) => `#${path}`
