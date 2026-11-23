import { useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { Dashboard } from './Dashboard'
import { EntityDetail } from './EntityDetail'
import { EntityForm } from './EntityForm'
import { EntityList } from './EntityList'
import { ENTITY_BY_ROUTE, NAV_GROUPS } from './entities'
import { HOME, navigate, useRoute } from './router'
import { useProduct } from './store'
import { Toaster } from './toast'
import { Button, cx, EmptyState } from './ui'
import type { Rec } from './types'

function Breadcrumb() {
  const route = useRoute()
  const s = useProduct()
  const crumbs: { label: string; to?: string }[] = [{ label: 'Product', to: HOME }]
  if (route.page === 'dashboard') crumbs.push({ label: 'Dashboard' })
  else if (route.page !== 'notfound') {
    const cfg = ENTITY_BY_ROUTE[route.section]
    if (cfg) {
      const group = NAV_GROUPS.find((g) => g.items.includes(cfg.key))
      if (group) crumbs.push({ label: group.label })
      crumbs.push({ label: cfg.title, to: route.page === 'list' ? undefined : `/${cfg.route}` })
      if (route.page === 'new') crumbs.push({ label: 'New' })
      if (route.page === 'detail' || route.page === 'edit') {
        const rec = (s[cfg.key] as Rec[]).find((r) => r.id === route.id)
        crumbs.push({ label: rec ? cfg.nameOf(rec, s) : `#${route.id}`, to: route.page === 'edit' ? `/${cfg.route}/${route.id}` : undefined })
        if (route.page === 'edit') crumbs.push({ label: 'Edit' })
      }
    }
  }
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 overflow-hidden whitespace-nowrap text-sm text-slate-500">
        {crumbs.map((c, i) => (
          <li key={i} className={cx('flex min-w-0 items-center gap-1', i > 0 && i < crumbs.length - 1 && 'hidden sm:flex')}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
            {c.to ? <a href={`#${c.to}`} className="truncate hover:text-slate-900">{c.label}</a> : <span className={cx('truncate', i === crumbs.length - 1 && 'font-medium text-slate-900')}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Page() {
  const route = useRoute()
  if (route.page === 'dashboard') return <Dashboard />
  if (route.page === 'notfound') return <NotFound />
  const cfg = ENTITY_BY_ROUTE[route.section]
  if (!cfg) return <NotFound />
  switch (route.page) {
    case 'list': return <EntityList cfg={cfg} />
    case 'new': return <EntityForm key={`${cfg.key}-new`} cfg={cfg} />
    case 'detail': return <EntityDetail key={`${cfg.key}-${route.id}`} cfg={cfg} id={route.id} />
    case 'edit': return <EntityForm key={`${cfg.key}-${route.id}-edit`} cfg={cfg} id={route.id} />
  }
}

function NotFound() {
  return <EmptyState title="Page not found" message="This section does not exist." action={<Button variant="primary" onClick={() => navigate(HOME)}>Go to dashboard</Button>} />
}

/** Product module screens. Navigation (sidebar), header and sign-in belong to the ERP shell; this renders the page content only. */
export default function ProductModule() {
  const route = useRoute()
  const section = route.page === 'dashboard' ? '' : route.page === 'notfound' ? '-' : route.section

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [section, route.page, route.page === 'detail' || route.page === 'edit' ? route.id : 0])

  return (
    <div className="prd-module text-slate-900">
      <div className="mb-4"><Breadcrumb /></div>
      <Page />
      <Toaster />
    </div>
  )
}
