/** Permission strings (section 10.2): `<module>.<resource>.<action>`. Guards and directives are convenience only; the API enforces. */
export const PERM = {
  dashboard: { read: 'dashboard.read' },
  invoice: {
    read: 'accounting.invoice.read',
    write: 'accounting.invoice.write',
    validate: 'accounting.invoice.validate',
    cancel: 'accounting.invoice.cancel',
    creditNote: 'accounting.invoice.credit_note',
    zatca: 'accounting.invoice.zatca_submit',
  },
  bill: {
    read: 'accounting.bill.read',
    write: 'accounting.bill.write',
    approveL1: 'accounting.bill.approve_level1',
    approveL2: 'accounting.bill.approve_level2',
  },
  payment: { read: 'accounting.payment.read', write: 'accounting.payment.write' },
  reconciliation: { read: 'accounting.reconciliation.read', run: 'accounting.reconciliation.run' },
  journalEntry: { read: 'accounting.journal_entry.read', post: 'accounting.journal_entry.post', reverse: 'accounting.journal_entry.reverse' },
  account: { read: 'accounting.account.read', write: 'accounting.account.write' },
  bank: { read: 'accounting.bank.read', write: 'accounting.bank.write' },
  report: { read: 'reports.financial.read' },
  audit: { read: 'administration.audit.read', note: 'administration.audit.note' },
  settings: { read: 'administration.settings.read', lockDate: 'administration.lock_date.advance' },
  user: { read: 'contacts.user.read', write: 'contacts.user.write' },
  contact: { read: 'contacts.contact.read', write: 'contacts.contact.write', delete: 'contacts.contact.delete' },
  inventory: { read: 'inventory.read', write: 'inventory.write' },
} as const;

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T];
export type KnownPermission = Leaves<typeof PERM>;
export const ALL_PERMISSIONS: readonly KnownPermission[] = Object.values(PERM).flatMap(g => Object.values(g)) as KnownPermission[];
