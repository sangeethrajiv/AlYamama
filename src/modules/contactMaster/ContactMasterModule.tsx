import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from '../shared/ui'
import ContactListPage, { initialListState, type ListState } from './ContactListPage'
import ContactDetailPage, { ContactNotFound } from './ContactDetailPage'
import ContactFormPage from './ContactFormPage'
import { Toast } from './parts'
import { createPartner, setPartnerActive, updatePartner, usePartners } from './store'
import type { PartnerDraft, ResPartner } from './types'

/**
 * Contact module (frontend-only). The page lives in the URL so refresh and back/forward stay put:
 *   #/cm_contacts            list
 *   #/cm_contacts/new        add form
 *   #/cm_contacts/<id>       view
 *   #/cm_contacts/<id>/edit  edit form
 */
type Route = { view: 'list' } | { view: 'new' } | { view: 'detail'; id: number } | { view: 'edit'; id: number }

function parseRoute(): Route {
  const [, a, b] = window.location.hash.replace(/^#\/?/, '').split('/')
  if (a === 'new') return { view: 'new' }
  const id = Number(a)
  if (a && Number.isInteger(id)) return b === 'edit' ? { view: 'edit', id } : { view: 'detail', id }
  return { view: 'list' }
}
const go = (path = '') => { window.location.hash = `#/cm_contacts${path ? `/${path}` : ''}` }

let loadedOnce = false // the list shows its loading state the first time it is opened in a session

export default function ContactMasterModule({ searchQuery, readOnly }: { searchQuery: string; readOnly: boolean }) {
  const partners = usePartners()
  const [route, setRoute] = useState<Route>(parseRoute)
  const [ls, setLs] = useState<ListState>(initialListState)
  const [loading, setLoading] = useState(!loadedOnce)
  const [toast, setToast] = useState('')
  const [confirm, setConfirm] = useState<{ kind: 'archive' | 'delete'; c: ResPartner } | null>(null)
  const closeToast = useCallback(() => setToast(''), [])
  const patch = useCallback((p: Partial<ListState>) => setLs(s => ({ ...s, ...p })), [])

  useEffect(() => {
    const on = () => { setRoute(parseRoute()); window.scrollTo({ top: 0 }) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => { loadedOnce = true; setLoading(false) }, 500)
    return () => clearTimeout(t)
  }, [loading])

  const restore = (c: ResPartner) => { setPartnerActive(c.id, true); setToast(`${c.name} restored.`) }
  const doConfirm = () => {
    if (!confirm) return
    if (confirm.kind === 'archive') { setPartnerActive(confirm.c.id, false); setToast(`${confirm.c.name} archived.`) }
    else setToast(`Deleting is not enabled in this frontend-only build — ${confirm.c.name} was kept. Use Archive to hide it.`)
    setConfirm(null)
  }
  const ask = (kind: 'archive' | 'delete') => (c: ResPartner) => setConfirm({ kind, c })

  const byId = (id: number) => partners.find(c => c.id === id)
  let page
  // Auditors can view contacts but not create or change them
  const view = readOnly && (route.view === 'new' || route.view === 'edit') ? ({ view: 'list' } as Route) : route
  if (view.view === 'new') {
    page = <ContactFormPage key="new" mode="add" partners={partners} onCancel={() => go()}
      onSave={(d: PartnerDraft) => { const c = createPartner(d); setToast(`${c.name} created.`); go(String(c.id)) }} />
  } else if (view.view === 'edit') {
    const c = byId(view.id)
    page = c
      ? <ContactFormPage key={`edit${c.id}`} mode="edit" partner={c} partners={partners} onCancel={() => go(String(c.id))}
        onSave={(d: PartnerDraft) => { updatePartner(c.id, d); setToast(`${d.name} updated.`); go(String(c.id)) }} />
      : <ContactNotFound onBack={() => go()} />
  } else if (view.view === 'detail') {
    const c = byId(view.id)
    page = c
      ? <ContactDetailPage key={c.id} partner={c} partners={partners} readOnly={readOnly} onBack={() => go()} onOpen={id => go(String(id))}
        onEdit={() => go(`${c.id}/edit`)} onArchive={() => ask('archive')(c)} onRestore={() => restore(c)} onDelete={() => ask('delete')(c)} />
      : <ContactNotFound onBack={() => go()} />
  } else {
    page = <ContactListPage partners={partners} searchQuery={searchQuery.trim().toLowerCase()} readOnly={readOnly} loading={loading} ls={ls} patch={patch}
      onOpen={id => go(String(id))} onAdd={() => go('new')} onEdit={c => go(`${c.id}/edit`)} onArchive={ask('archive')} onRestore={restore} onDelete={ask('delete')} />
  }

  return (
    <>
      {page}
      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'archive' ? `Archive ${confirm.c.name}?` : `Delete ${confirm.c.name}?`}
          text={confirm.kind === 'archive'
            ? 'The contact will be hidden from the default list. You can restore it at any time.'
            : 'Permanent deletion is not enabled in this version, so the contact will not be removed. Use Archive to hide it instead.'}
          confirmLabel={confirm.kind === 'archive' ? 'Archive' : 'Delete'} danger={confirm.kind === 'delete'}
          onConfirm={doConfirm} onCancel={() => setConfirm(null)} />
      )}
      {toast && <Toast text={toast} onClose={closeToast} />}
    </>
  )
}
