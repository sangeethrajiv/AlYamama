import type { Invoice, Bill } from '../../types/accounting'
import type { Contact } from './types'
import { USERS } from '../../auth/users'

const known: Record<string, Partial<Contact>> = {
  'Innovex (Dril Quip TIW-SAUDI ARABIA Limited Company)': { vat: '310562291400003', crNumber: '2050087311', email: 'ap@innovex.example', phone: '+966 13 812 0000', paymentTerms: '30 days', creditLimit: 250000, addresses: [{ id: 'a1', type: 'invoice', street: 'Second Industrial City', city: 'Dammam', region: 'Eastern Province', zip: '34334', country: 'Saudi Arabia' }] },
  'Al-Yamama Steel Industries': { vat: '300112233400003', crNumber: '1010221134', email: 'finance@yamama-steel.example', phone: '+966 11 477 1000', paymentTerms: '45 days', creditLimit: 500000, addresses: [{ id: 'a1', type: 'invoice', street: 'Al Kharj Road, Km 12', city: 'Riyadh', region: 'Riyadh', zip: '11564', country: 'Saudi Arabia' }] },
  'Dammam Special Steel & Honed Tubes Co.': { vat: '300481920100003', crNumber: '2050155290', email: 'sales@dammam-steel.example', phone: '+966 13 847 2200', paymentTerms: '30 days', creditLimit: 0, addresses: [{ id: 'a1', type: 'invoice', street: 'First Industrial City', city: 'Dammam', region: 'Eastern Province', zip: '31421', country: 'Saudi Arabia' }] },
}

const blank = (): Omit<Contact, 'id' | 'name'> => ({
  kind: 'company', isCustomer: false, isVendor: false, email: '', phone: '', mobile: '', website: '', vat: '', crNumber: '',
  taxRegime: 'VAT registered', paymentTerms: 'Immediate', creditLimit: 0, currency: 'SAR', addresses: [], tags: [], notes: '', active: true,
  createdAt: '2026-01-01',
})

export const newContact = (name: string, patch: Partial<Contact> = {}): Contact => ({
  ...blank(), id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, createdAt: new Date().toISOString().slice(0, 10), ...patch,
})

/** Seeds the address book from the partners already used in invoices and bills, so nothing in Accounting is orphaned. */
export function seedContacts(invoices: Invoice[], bills: Bill[]): Contact[] {
  const map = new Map<string, Contact>()
  const put = (name: string, role: 'isCustomer' | 'isVendor', vat?: string) => {
    const key = name.trim().toLowerCase()
    if (!key) return
    const ex = map.get(key)
    if (ex) { ex[role] = true; if (!ex.vat && vat) ex.vat = vat; return }
    map.set(key, { ...blank(), id: `ct_${map.size + 1}`, name: name.trim(), vat: vat || '', ...known[name.trim()], [role]: true } as Contact)
  }
  invoices.forEach(i => put(i.partner, 'isCustomer', i.customerVat))
  bills.forEach(b => put(b.vendor, 'isVendor', b.vendorVat))
  const list = [...map.values()]
  // A few people attached to their companies
  const first = list.find(c => c.isCustomer)
  if (first) list.push({ ...blank(), id: 'ct_p1', kind: 'individual', name: 'Khalid Al-Otaibi', parentId: first.id, jobTitle: 'Finance Manager', email: 'khalid@example.com', mobile: '+966 55 123 4567', isCustomer: true })
  // System users: every login account has its own record. The first four are also staff.
  USERS.forEach((u, i) => list.push({ ...blank(), id: `ct_u${i + 1}`, kind: 'individual', name: u.name, jobTitle: u.title, email: u.email, isLogin: true, isEmployee: i < 4 }))
  // The company's own record and a bank
  list.push({ ...blank(), id: 'ct_self', name: 'Al-Yamama Workshop (our company)', otherKind: 'own_company', email: 'info@alyamama.example', phone: '+966 13 000 0000' })
  list.push({ ...blank(), id: 'ct_bank1', name: 'Saudi National Bank', otherKind: 'bank', website: 'www.snb.example', phone: '+966 920 000 000' })
  return list
}
