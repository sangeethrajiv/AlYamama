import type { Contact } from '@erp/shared/contracts';
import { MockDb } from './mock-db';

/**
 * Accounting calls the Contacts domain through its public contract: a partner typed on a document is added to the
 * address book (or gets the missing role) so nothing on a document is orphaned.
 */
export function ensurePartner(db: MockDb, name: string, role: 'isCustomer' | 'isVendor', vat?: string, address?: string): void {
  const n = name.trim();
  if (!n) return;
  const ex = db.contacts.find(c => c.name.trim().toLowerCase() === n.toLowerCase());
  if (ex) {
    if (!ex[role]) db.contacts = db.contacts.map(c => (c.id === ex.id ? { ...c, [role]: true } : c));
    return;
  }
  const c: Contact = {
    id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind: 'company', name: n, isCustomer: false, isVendor: false, email: '', phone: '', mobile: '',
    website: '', vat: vat || '', crNumber: '', taxRegime: 'VAT registered', paymentTerms: 'Immediate', creditLimit: '0.00', currency: 'SAR', addresses: [],
    tags: [], notes: address ? `Address on first document: ${address}` : '', active: true, createdAt: new Date().toISOString().slice(0, 10), [role]: true,
  };
  db.contacts = [c, ...db.contacts];
}
