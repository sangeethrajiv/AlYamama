import { useCallback, useState } from 'react'
import type { Invoice, Bill } from '../../types/accounting'
import type { Contact } from './types'
import { seedContacts, newContact } from './data'

export function useContacts(invoices: Invoice[], bills: Bill[]) {
  const [contacts, setContacts] = useState<Contact[]>(() => seedContacts(invoices, bills))

  const saveContact = useCallback((c: Contact) => {
    setContacts(prev => (prev.some(p => p.id === c.id) ? prev.map(p => (p.id === c.id ? c : p)) : [c, ...prev]))
  }, [])
  const archiveContact = useCallback((id: string, active: boolean) => {
    setContacts(prev => prev.map(p => (p.id === id ? { ...p, active } : p)))
  }, [])
  /** Used by Accounting: makes sure a partner typed on a document exists in the address book. */
  const ensurePartner = useCallback((name: string, role: 'isCustomer' | 'isVendor', vat?: string, address?: string) => {
    const n = name.trim()
    if (!n) return
    setContacts(prev => {
      const ex = prev.find(c => c.name.trim().toLowerCase() === n.toLowerCase())
      if (ex) return ex[role] ? prev : prev.map(c => (c.id === ex.id ? { ...c, [role]: true } : c))
      return [newContact(n, { [role]: true, vat: vat || '', notes: address ? `Address on first document: ${address}` : '' }), ...prev]
    })
  }, [])

  return { contacts, saveContact, archiveContact, ensurePartner }
}
export type ContactsApi = ReturnType<typeof useContacts>
