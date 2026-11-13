import { useState, useMemo, useEffect } from 'react'
import type {
  TabId,
  DrawerType,
  CompanyId,
  UserRole,
  Invoice,
  InvoiceCategory,
  Bill,
  Payment,
  JournalEntry,
  Account,
  ChequeRecord,
  AuditLogEntry,
  FiscalPeriodConfig,
  CreditNoteOptions,
} from './types/accounting'
import {
  mockCompanies,
  mockChartOfAccounts,
  mockInvoices,
  mockBills,
  mockPayments,
  mockJournalEntries,
  mockCheques,
  mockAuditLogs,
  mockFiscalConfig,
} from './data/mockAccountingData'

// Components
import Header from './components/Header'
import LoginPage from './components/LoginPage'
import { loadSession, saveSession, clearSession } from './auth/session'
import type { AuthUser } from './auth/users'
import Sidebar from './components/Sidebar'
import DashboardView from './components/DashboardView'
import InvoiceList from './components/InvoiceList'
import InvoiceModal from './components/InvoiceModal'
import InvoicePdfModal from './components/InvoicePdfModal'
import BillList from './components/BillList'
import BillModal from './components/BillModal'
import PaymentList from './components/PaymentList'
import PaymentModal from './components/PaymentModal'
import ReconciliationView from './components/ReconciliationView'
import JournalEntryView from './components/JournalEntryView'
import ChartOfAccountsView from './components/ChartOfAccountsView'
import BankingView from './components/BankingView'
import ReportsView from './components/ReportsView'
import AuditLogView from './components/AuditLogView'
import SettingsAndLockView from './components/SettingsAndLockView'
import ContactsModule from './modules/contacts/ContactsModule'
import { useContacts } from './modules/contacts/useContacts'
import InventoryModule from './modules/inventory/InventoryModule'
import { useInventory } from './modules/inventory/useInventory'
import { DirectoryProvider } from './modules/shared/directory'

const VALID_TABS: TabId[] = ['dashboard', 'invoices', 'bills', 'payments', 'reconcile', 'journals', 'coa', 'banking', 'reports', 'audit', 'settings', 'inventory', 'contacts', 'usr_customers', 'usr_vendors', 'usr_employees', 'usr_logins', 'usr_other', 'usr_archived', 'inv_overview', 'inv_products', 'inv_categories', 'inv_warehouses', 'inv_stock', 'inv_moves', 'inv_receipts', 'inv_deliveries', 'inv_internal', 'inv_transfers', 'inv_move_lines', 'inv_locations', 'inv_picking_types', 'inv_uom_categories', 'inv_uom']
function tabFromHash(): TabId {
  const h = window.location.hash.replace(/^#\/?/, '') as TabId
  return VALID_TABS.includes(h) ? h : 'dashboard'
}

export default function App() {
  // Global State
  // Session: restored after a refresh. The current page lives in the URL hash so a refresh stays on it.
  const [restored] = useState(() => loadSession())
  const [user, setUser] = useState<AuthUser | null>(restored?.user ?? null)
  const [signedOutNotice, setSignedOutNotice] = useState('')
  const [remember, setRemember] = useState(restored?.session.remember ?? true)
  const [activeTab, setActiveTab] = useState<TabId>(tabFromHash)
  const [activeCompanyId, setActiveCompanyId] = useState<CompanyId>(restored?.session.companyId ?? 'co_1')
  const [currentRole, setCurrentRole] = useState<UserRole>(restored?.session.role ?? 'Accounts Manager')
  const [arabic, setArabic] = useState<boolean>(restored?.session.arabic ?? false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Keep the URL in step with the page, and follow back/forward
  useEffect(() => {
    if (!user) return
    if (tabFromHash() !== activeTab) window.location.hash = `#/${activeTab}`
  }, [activeTab, user])
  useEffect(() => {
    const onHash = () => setActiveTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    if (user) saveSession({ userId: user.id, role: currentRole, companyId: activeCompanyId, arabic, remember })
  }, [user, currentRole, activeCompanyId, arabic, remember])
  const handleLogin = (u: AuthUser, rem: boolean) => {
    setRemember(rem); setCurrentRole(u.role); setSignedOutNotice(''); setUser(u)
  }
  const handleSignOut = () => {
    clearSession()
    setDrawerType(null); setEditingInvoice(undefined); setEditingBill(undefined); setPdfInvoice(null); setPaymentModalState({ open: false })
    setSignedOutNotice('You have been signed out.')
    window.location.hash = ''
    setActiveTab('dashboard')
    setUser(null)
  }

  // Entities Data State
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices)
  const [bills, setBills] = useState<Bill[]>(mockBills)
  const [payments, setPayments] = useState<Payment[]>(mockPayments)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(mockJournalEntries)
  const [accounts, setAccounts] = useState<Account[]>(mockChartOfAccounts)
  const [cheques, setCheques] = useState<ChequeRecord[]>(mockCheques)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(mockAuditLogs)
  const [fiscalConfig, setFiscalConfig] = useState<Record<string, FiscalPeriodConfig>>(mockFiscalConfig)

  // Independent modules: Contacts and Inventory own their data; Accounting reads them through the directory
  const contactsApi = useContacts(mockInvoices, mockBills)
  const inventory = useInventory(contactsApi.contacts)
  const [invoiceDefaultPartner, setInvoiceDefaultPartner] = useState<string | undefined>(undefined)

  // Modals & Drawers
  const [drawerType, setDrawerType] = useState<DrawerType>(null)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>(undefined)
  const [activeInvoiceCategory, setActiveInvoiceCategory] = useState<InvoiceCategory | 'all'>('all')
  const [defaultInvoiceCategory, setDefaultInvoiceCategory] = useState<InvoiceCategory>('credit')
  // Set when the form is opened from a specific type; undefined means the user picks the type
  const [lockedCategory, setLockedCategory] = useState<InvoiceCategory | undefined>(undefined)
  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null)
  const [pdfAutoPrint, setPdfAutoPrint] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | undefined>(undefined)
  const [paymentModalState, setPaymentModalState] = useState<{
    open: boolean
    type?: 'customer' | 'supplier'
    invoice?: Invoice
    bill?: Bill
  }>({ open: false })
  const [selectedGlCode, setSelectedGlCode] = useState<string | undefined>(undefined)

  // Esc closes any open modal/drawer; page scrolls to top on tab change
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (pdfInvoice) setPdfInvoice(null)
      else if (paymentModalState.open) setPaymentModalState({ open: false })
      else if (drawerType) {
        setDrawerType(null)
        setEditingInvoice(undefined)
        setEditingBill(undefined)
      } else setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pdfInvoice, paymentModalState.open, drawerType])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [activeTab])

  // Current company fiscal config
  const currentFiscalConfig = fiscalConfig[activeCompanyId] || fiscalConfig['co_1']

  // Helper to add audit log entries (§12)
  const addAuditLog = (
    recordType: AuditLogEntry['recordType'],
    recordId: string,
    recordName: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
    notes?: string
  ) => {
    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      user: currentRole,
      recordType,
      recordId,
      recordName,
      fieldName,
      oldValue,
      newValue,
      notes,
    }
    setAuditLogs(prev => [newLog, ...prev])
  }

  const handlePostNote = (recordType: AuditLogEntry['recordType'], recordId: string, recordName: string, text: string) =>
    addAuditLog(recordType, recordId, recordName, 'note', '', '', text)

  // Field-level tracking: one log row per changed field (old -> new)
  const fmtVal = (v: unknown) => (v === undefined || v === null || v === '' ? 'empty' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v))
  const trackChanges = <T extends object>(
    recordType: AuditLogEntry['recordType'],
    id: string,
    name: string,
    before: T,
    after: T,
    fields: Record<string, string>
  ) => {
    const b = before as Record<string, unknown>
    const a = after as Record<string, unknown>
    const rows: [string, string, string][] = []
    for (const [key, label] of Object.entries(fields)) {
      if (fmtVal(b[key]) !== fmtVal(a[key])) rows.push([label, fmtVal(b[key]), fmtVal(a[key])])
    }
    const bl = (b.lines as unknown[] | undefined)?.length ?? 0
    const al = (a.lines as unknown[] | undefined)?.length ?? 0
    if (JSON.stringify(b.lines) !== JSON.stringify(a.lines)) {
      rows.push(['Lines', `${bl} line(s), ${fmtVal(b.amountUntaxed)} untaxed`, `${al} line(s), ${fmtVal(a.amountUntaxed)} untaxed`])
    }
    // Same-second entries are grouped as one edit in Chatter
    rows.reverse().forEach(([label, from, to]) => addAuditLog(recordType, id, name, `edit:${label}`, from, to))
    return rows.length
  }
  const INVOICE_FIELDS: Record<string, string> = {
    partner: 'Customer', customerVat: 'Customer VAT', category: 'Invoice type', dateInvoice: 'Invoice date', dateDue: 'Due date',
    paymentTerms: 'Payment terms', currency: 'Currency', project: 'Project', contactPerson: 'Contact person',
    salesperson: 'Salesperson', sourceDocument: 'Source document', reference: 'Reference', prNumber: 'PR number', poNumber: 'PO number',
    vendorProjectName: 'Vendor project', isSubscriptionInvoice: 'Subscription invoice', subscriptionFrequency: 'Frequency',
    subscriptionType: 'Subscription type', subscriptionStartDate: 'Start date', subscriptionEndDate: 'End date',
    amountTotal: 'Total', billingEmail: 'Billing email', advPercentage: 'Adv. percentage', poName: 'PO name', poDescription: 'PO description',
    contractAmount: 'PO total amount', progressiveStatus: 'PO status',
  }
  const BILL_FIELDS: Record<string, string> = {
    vendor: 'Vendor', supplierInvoiceNumber: 'Vendor reference', dateBill: 'Bill date', dateDue: 'Due date',
    paymentTerms: 'Payment terms', currency: 'Currency', amountTotal: 'Total',
  }

  // --- Invoice Operations ---
  const handleSaveInvoice = (inv: Invoice, postImmediately = false, keepOpen = false) => {
    contactsApi.ensurePartner(inv.partner, 'isCustomer', inv.customerVat, inv.customerAddress)
    const exists = invoices.some(i => i.id === inv.id)
    if (exists) {
      setInvoices(prev => prev.map(i => (i.id === inv.id ? inv : i)))
      const prev = invoices.find(i => i.id === inv.id)
      if (prev) trackChanges('Invoice', inv.id, inv.number, prev, inv, INVOICE_FIELDS)
    } else {
      setInvoices(prev => [inv, ...prev])
      addAuditLog('Invoice', inv.id, inv.number, 'create', '—', postImmediately ? 'draft' : inv.state, 'Invoice created')
    }

    if (postImmediately) {
      handleValidateInvoice(inv.id, inv)
      // Stay on the invoice: the drawer now shows it as Open with its next steps
      setEditingInvoice(inv)
      return
    }

    if (keepOpen) {
      // e.g. approving a progressive PO: stay on the record
      setEditingInvoice(inv)
      return
    }

    setDrawerType(null)
    setEditingInvoice(undefined)
  }

  const handleValidateInvoice = (invoiceId: string, overrideInv?: Invoice) => {
    const target = overrideInv || invoices.find(i => i.id === invoiceId)
    if (!target) return

    // Post validation: every invoice (cash included) goes to 'open'; it becomes paid only when a payment is registered
    const updated: Invoice = {
      ...target,
      state: 'open',
      residual: target.amountTotal,
      validatedBy: currentRole,
      validatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      approvalStatus: 'approved',
    }

    // Auto-generate Journal Entry
    const newJE: JournalEntry = {
      id: `je_inv_${target.id}`,
      entryNumber: `${target.number}-JE`,
      companyId: target.companyId,
      entryDate: target.dateInvoice,
      journalId: 'jour_sale',
      journalName: 'Customer Invoices',
      reference: target.number,
      state: 'posted',
      narration: `Automated journal entry for customer invoice ${target.number} - ${target.partner}`,
      sourceDocument: target.number,
      lines: [
        {
          id: `jel_rec_${Date.now()}`,
          accountId: 'acc_105',
          accountCode: '110000',
          accountName: 'Trade Debtors / Accounts Receivable',
          partner: target.partner,
          label: `${target.number} Receivable`,
          debit: target.amountTotal,
          credit: 0,
        },
        {
          id: `jel_rev_${Date.now()}`,
          accountId: 'acc_401',
          accountCode: '400000',
          accountName: 'Hydraulic Cylinder Overhaul Revenue',
          label: 'Revenue recognition',
          debit: 0,
          credit: target.amountUntaxed,
          analyticAccountId: target.lines[0]?.analyticAccountId || 'ana_1',
        },
        {
          id: `jel_tax_${Date.now()}`,
          accountId: 'acc_203',
          accountCode: '220000',
          accountName: 'Output VAT 15%',
          label: '15% VAT on Sale',
          debit: 0,
          credit: target.amountTax,
        },
      ],
    }

    // Check Multi-Company Auto Inter-Company Rule (MC-005 & §23):
    // Posting invoice in Company A auto-creates draft vendor bill in Company B!
    if (target.partner.includes('Al-Yamama')) {
      const icBill: Bill = {
        id: `bill_ic_${Date.now()}`,
        number: `BILL/2026/IC-${target.number.slice(-4)}`,
        supplierInvoiceNumber: target.number,
        companyId: 'co_2', // Partner company
        vendor: mockCompanies.find(c => c.id === target.companyId)?.name || 'Al-Yamama HQ',
        dateBill: target.dateInvoice,
        dateDue: target.dateDue,
        paymentTerms: target.paymentTerms,
        journalId: 'jour_purchase',
        currency: target.currency,
        currencyRate: target.currencyRate,
        lines: target.lines,
        amountUntaxed: target.amountUntaxed,
        amountTax: target.amountTax,
        amountTotal: target.amountTotal,
        residual: target.amountTotal,
        state: 'open',
        approvalStatus: 'approved',
        type: 'in_invoice',
        interCompanyOrigin: `${target.number} (${mockCompanies.find(c => c.id === target.companyId)?.code})`,
        attachmentsCount: 1,
      }
      setBills(prev => [icBill, ...prev])
      addAuditLog(
        'Vendor Bill',
        icBill.id,
        icBill.number,
        'auto_intercompany',
        '—',
        'open',
        `Auto-generated inter-company vendor bill in Company B from posted invoice ${target.number}`
      )
    }

    setInvoices(prev => prev.map(i => (i.id === target.id ? updated : i)))
    setJournalEntries(prev => [newJE, ...prev])

    // Update AR balance
    setAccounts(prev =>
      prev.map(a =>
        a.code === '110000'
          ? { ...a, balance: a.balance + target.amountTotal }
          : a.code === '220000'
          ? { ...a, balance: a.balance + target.amountTax }
          : a
      )
    )

    addAuditLog(
      'Invoice',
      target.id,
      target.number,
      'state',
      'draft',
      updated.state,
      `Invoice confirmed and posted. Journal entry ${newJE.entryNumber} was created automatically.`
    )
  }

  const handleCancelInvoice = (invoiceId: string) => {
    const target = invoices.find(i => i.id === invoiceId)
    if (!target) return
    if (target.zatca) {
      alert('This invoice was submitted to ZATCA and cannot be cancelled. Create a credit note instead.')
      return
    }

    setInvoices(prev =>
      prev.map(i => (i.id === invoiceId ? { ...i, state: 'cancel', residual: 0 } : i))
    )
    addAuditLog(
      'Invoice',
      target.id,
      target.number,
      'state',
      target.state,
      'cancel',
      'Invoice cancelled and receivables cleared.'
    )
  }

  const handleConvertToTaxInvoice = (invoiceId: string) => {
    const target = invoices.find(i => i.id === invoiceId)
    if (!target) return
    const stamp = Math.floor(1000 + Math.random() * 9000)
    const newSeq = `INV/2026/${stamp}`

    setInvoices(prev =>
      prev.map(i =>
        i.id === invoiceId
          ? {
              ...i,
              number: newSeq,
              category: 'credit',
              state: 'open',
              paymentTerms: '15 Days Net',
              dateDue: '2026-11-20',
            }
          : i
      )
    )

    addAuditLog(
      'Invoice',
      target.id,
      newSeq,
      'convert_proforma',
      target.number,
      'open',
      `Proforma invoice ${target.number} converted to official Tax Invoice ${newSeq}`
    )
  }

  const handleCreateCreditNote = (originalInvoice: Invoice, opts: CreditNoteOptions = { reason: 'Credit note', date: '2026-11-10', method: 'cancel' }) => {
    const stamp = Math.floor(1000 + Math.random() * 9000)
    const reconcile = opts.method !== 'draft'
    const creditNote: Invoice = {
      ...originalInvoice,
      id: `inv_cn_${Date.now()}`,
      number: `RND/2026/${stamp}`,
      type: 'out_refund',
      originInvoiceNumber: originalInvoice.number,
      creditNoteReason: opts.reason,
      reference: `Credit Note for ${originalInvoice.number}`,
      dateInvoice: opts.date,
      state: reconcile ? 'paid' : 'draft',
      residual: 0,
      approvalStatus: reconcile ? 'approved' : 'not_required',
      zatca: undefined,
    }

    // Reconciling clears the credit against the original invoice's open balance (BR-008)
    setInvoices(prev => [
      creditNote,
      ...prev.map(i => {
        if (i.id !== originalInvoice.id || !reconcile) return i
        const residual = Math.max(0, Math.round((i.residual - originalInvoice.amountTotal) * 100) / 100)
        return { ...i, residual, state: (residual <= 0 ? 'paid' : 'in_payment') as Invoice['state'] }
      }),
    ])

    addAuditLog(
      'Invoice',
      creditNote.id,
      creditNote.number,
      'create_credit_note',
      '—',
      creditNote.state,
      `Credit note for ${originalInvoice.number} (${opts.reason}). ${reconcile ? 'Posted and reconciled against the invoice.' : 'Saved as draft.'}`
    )
    addAuditLog('Invoice', originalInvoice.id, originalInvoice.number, 'create_credit_note', '—', creditNote.state, `Credit note ${creditNote.number} issued: ${opts.reason}.`)
    if (reconcile) {
      const left = Math.max(0, Math.round((originalInvoice.residual - originalInvoice.amountTotal) * 100) / 100)
      addAuditLog('Invoice', originalInvoice.id, originalInvoice.number, 'state', originalInvoice.state, left <= 0 ? 'paid' : 'in_payment', `Credit note ${creditNote.number} reconciled against this invoice.`)
    }

    // "Modify": also open a fresh draft copy so the invoice can be corrected and re-issued
    if (opts.method === 'modify') {
      const copy: Invoice = {
        ...originalInvoice,
        id: `inv_mod_${Date.now()}`,
        number: `DRAFT/${stamp}`,
        state: 'draft',
        residual: originalInvoice.amountTotal,
        dateInvoice: opts.date,
        validatedBy: undefined,
        validatedAt: undefined,
        approvalStatus: 'not_required',
        zatca: undefined,
        reference: `Re-issued from ${originalInvoice.number}`,
      }
      setInvoices(prev => [copy, ...prev])
      addAuditLog('Invoice', copy.id, copy.number, 'create', '—', 'draft', `Draft re-issued from ${originalInvoice.number} after credit note ${creditNote.number}.`)
    }
  }

  // Renew a proforma: turns it into a real customer invoice (draft) and marks the proforma as invoiced
  const handleRenewProforma = (orig: Invoice) => {
    if (orig.linkedInvoice) return
    const stamp = Math.floor(1000 + Math.random() * 9000)
    const copy: Invoice = {
      ...orig,
      id: `inv_from_pro_${Date.now()}`,
      number: `INV/2026/${stamp}`,
      category: 'credit',
      state: 'draft',
      residual: orig.amountTotal,
      dateInvoice: '2026-11-10',
      dateDue: '2026-11-10',
      sourceDocument: orig.number,
      sourceProformaId: orig.id,
      reference: `From proforma ${orig.number}`,
      linkedInvoice: undefined,
      billingEmail: undefined,
      advPercentage: undefined,
      validatedBy: undefined,
      validatedAt: undefined,
      approvalStatus: 'not_required',
      zatca: undefined,
      lines: orig.lines.map((l, i) => ({ ...l, id: `ln_inv_${Date.now()}_${i}` })),
    }
    setInvoices(prev => [copy, ...prev.map(i => (i.id === orig.id ? { ...i, linkedInvoice: copy.number } : i))])
    addAuditLog('Invoice', orig.id, orig.number, 'renew', 'pending payment', 'invoiced', `Invoice ${copy.number} created from this proforma.`)
    addAuditLog('Invoice', copy.id, copy.number, 'create', '—', 'draft', `Created from proforma ${orig.number}.`)
    setDefaultInvoiceCategory('credit')
    setLockedCategory('credit')
    setEditingInvoice(copy)
  }

  // Simulated ZATCA submission: validates, signs a local hash, chains the document
  const handleSubmitZatca = async (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId)
    if (!inv || inv.zatca) return
    const bytes = new TextEncoder().encode(JSON.stringify({ n: inv.number, t: inv.amountTotal, d: inv.dateInvoice, p: inv.partner }))
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const invoiceHash = btoa(String.fromCharCode(...new Uint8Array(digest)))
    const chainIndex = Math.max(0, ...invoices.map(i => i.zatca?.chainIndex ?? 0)) + 1
    const zatca = {
      status: 'cleared' as const,
      uuid: crypto.randomUUID(),
      invoiceHash,
      chainIndex,
      submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      submittedBy: currentRole,
      message: 'Invoice cleared (simulated)',
    }
    setInvoices(prev => prev.map(i => (i.id === invoiceId ? { ...i, zatca } : i)))
    addAuditLog('Invoice', inv.id, inv.number, 'zatca_submit', 'not submitted', 'cleared', `Submitted to ZATCA. Chain index ${chainIndex}, UUID ${zatca.uuid}.`)
  }

  // --- Bill Operations ---
  const handleSaveBill = (b: Bill, postImmediately = false) => {
    contactsApi.ensurePartner(b.vendor, 'isVendor', b.vendorVat)
    const exists = bills.some(item => item.id === b.id)
    if (exists) {
      setBills(prev => prev.map(item => (item.id === b.id ? b : item)))
    } else {
      setBills(prev => [b, ...prev])
    }

    const prevBill = bills.find(item => item.id === b.id)
    if (prevBill) {
      trackChanges('Vendor Bill', b.id, b.number, prevBill, b, BILL_FIELDS)
    } else {
      addAuditLog('Vendor Bill', b.id, b.number, 'save_bill', '—', postImmediately ? 'open' : b.state, `Vendor bill created with supplier ref ${b.supplierInvoiceNumber}`)
    }

    setDrawerType(null)
    setEditingBill(undefined)
  }

  const handleApproveBill = (billId: string) => {
    const target = bills.find(b => b.id === billId)
    if (!target) return

    setBills(prev =>
      prev.map(b =>
        b.id === billId ? { ...b, approvalStatus: 'approved', state: 'open' } : b
      )
    )

    addAuditLog(
      'Vendor Bill',
      target.id,
      target.number,
      'approvalStatus',
      target.approvalStatus,
      'approved',
      `Approved by ${currentRole}`
    )
  }

  const handleRejectBill = (billId: string, reason: string) => {
    const target = bills.find(b => b.id === billId)
    if (!target) return

    setBills(prev =>
      prev.map(b =>
        b.id === billId
          ? { ...b, approvalStatus: 'rejected', state: 'draft', approvalRejectReason: reason }
          : b
      )
    )

    addAuditLog(
      'Vendor Bill',
      target.id,
      target.number,
      'approvalStatus',
      target.approvalStatus,
      'rejected',
      `Rejected with reason: "${reason}" (Returned to Draft state per §19.1 APR-006)`
    )
  }

  // --- Payment Operations ---
  const handleSavePayment = (
    payment: Payment,
    allocatedInvoiceId?: string,
    allocatedBillId?: string
  ) => {
    const allocInv = allocatedInvoiceId ? invoices.find(i => i.id === allocatedInvoiceId) : undefined
    setPayments(prev => [
      allocInv && allocatedInvoiceId
        ? { ...payment, allocations: [{ invoiceId: allocatedInvoiceId, amount: Math.min(payment.amount, allocInv.residual) }] }
        : payment,
      ...prev,
    ])

    // Generate Journal Entry for Payment
    const je: JournalEntry = {
      id: `je_pay_${payment.id}`,
      entryNumber: `${payment.paymentNumber}-JE`,
      companyId: payment.companyId,
      entryDate: payment.paymentDate,
      journalId: payment.journalId,
      journalName: payment.journalName,
      reference: payment.paymentNumber,
      state: 'posted',
      narration: payment.memo,
      sourceDocument: payment.paymentNumber,
      lines:
        payment.partnerType === 'customer'
          ? [
              {
                id: `jel_${Date.now()}_1`,
                accountId: payment.journalId,
                accountCode: '101000',
                accountName: payment.journalName,
                label: 'Receipt in Bank',
                debit: payment.amountBaseCurrency,
                credit: 0,
              },
              {
                id: `jel_${Date.now()}_2`,
                accountId: 'acc_105',
                accountCode: '110000',
                accountName: 'Trade Debtors',
                partner: payment.partner,
                label: `Settlement for ${payment.memo}`,
                debit: 0,
                credit: payment.amountBaseCurrency,
              },
            ]
          : [
              {
                id: `jel_${Date.now()}_3`,
                accountId: 'acc_201',
                accountCode: '210000',
                accountName: 'Trade Creditors / Accounts Payable',
                partner: payment.partner,
                label: `Disbursement for ${payment.memo}`,
                debit: payment.amountBaseCurrency,
                credit: 0,
              },
              {
                id: `jel_${Date.now()}_4`,
                accountId: payment.journalId,
                accountCode: '101000',
                accountName: payment.journalName,
                label: 'Bank disbursement',
                debit: 0,
                credit: payment.amountBaseCurrency,
              },
            ],
    }

    setJournalEntries(prev => [je, ...prev])

    // Mirror the payment on the invoice / bill so its Chatter shows the status change
    const payInv = allocatedInvoiceId ? invoices.find(i => i.id === allocatedInvoiceId) : undefined
    if (payInv) {
      const left = Math.max(0, payInv.residual - payment.amount)
      addAuditLog('Invoice', payInv.id, payInv.number, 'payment', payInv.state, left <= 0 ? 'paid' : 'in_payment', `Payment ${payment.paymentNumber} of ${payment.amount.toFixed(2)} ${payInv.currency} registered via ${payment.journalName}. Balance due ${left.toFixed(2)}.`)
    }
    const payBill = allocatedBillId ? bills.find(b => b.id === allocatedBillId) : undefined
    if (payBill) {
      const left = Math.max(0, payBill.residual - payment.amount)
      addAuditLog('Vendor Bill', payBill.id, payBill.number, 'payment', payBill.state, left <= 0 ? 'paid' : 'in_payment', `Payment ${payment.paymentNumber} of ${payment.amount.toFixed(2)} ${payBill.currency} registered via ${payment.journalName}. Balance due ${left.toFixed(2)}.`)
    }

    // If allocated to invoice, update invoice state & residual
    if (allocatedInvoiceId) {
      setInvoices(prev =>
        prev.map(inv => {
          if (inv.id !== allocatedInvoiceId) return inv
          const newResidual = Math.max(0, inv.residual - payment.amount)
          const newState = newResidual <= 0 ? 'paid' : 'in_payment'
          return {
            ...inv,
            residual: newResidual,
            state: newState,
          }
        })
      )
    }

    // If allocated to bill, update bill state & residual
    if (allocatedBillId) {
      setBills(prev =>
        prev.map(b => {
          if (b.id !== allocatedBillId) return b
          const newResidual = Math.max(0, b.residual - payment.amount)
          const newState = newResidual <= 0 ? 'paid' : 'in_payment'
          return {
            ...b,
            residual: newResidual,
            state: newState,
          }
        })
      )
    }

    // If corporate cheque used, add to Cheque register
    if (payment.paymentMethod === 'Corporate Cheque') {
      const newCheque: ChequeRecord = {
        id: `chq_${Date.now()}`,
        chequeNumber: payment.chequeNumber || `CHQ-${Math.floor(100000 + Math.random() * 900000)}`,
        chequeDate: payment.paymentDate,
        payeeName: payment.partner,
        bankName: 'Riyad Bank',
        amount: payment.amount,
        currency: payment.currency,
        status: 'issued',
        relatedPaymentId: payment.id,
        companyId: payment.companyId,
      }
      setCheques(prev => [newCheque, ...prev])
    }

    // Update Bank balance
    setAccounts(prev =>
      prev.map(a => {
        if (a.id === payment.journalId) {
          const delta = payment.partnerType === 'customer' ? payment.amountBaseCurrency : -payment.amountBaseCurrency
          return { ...a, balance: a.balance + delta }
        }
        return a
      })
    )

    addAuditLog(
      'Payment',
      payment.id,
      payment.paymentNumber,
      'state',
      'draft',
      'posted',
      `Payment voucher confirmed for SAR ${payment.amount.toLocaleString()}. Linked JE ${je.entryNumber} posted.`
    )

    setPaymentModalState({ open: false })
  }

  // --- Reconciliation Execution (§7) ---
  const handleReconcile = (invoiceId: string, paymentId: string, writeOffAmount = 0) => {
    const inv = invoices.find(i => i.id === invoiceId)
    const pay = payments.find(p => p.id === paymentId)
    if (!inv || !pay) return

    const newResidual = Math.max(0, inv.residual - pay.amount - writeOffAmount)
    const newInvoiceState = newResidual <= 0 ? 'paid' : 'in_payment'

    setInvoices(prev =>
      prev.map(i =>
        i.id === invoiceId
          ? {
              ...i,
              residual: newResidual,
              state: newInvoiceState,
            }
          : i
      )
    )

    setPayments(prev =>
      prev.map(p =>
        p.id === paymentId
          ? {
              ...p,
              state: 'reconciled',
              matchedInvoiceIds: [...(p.matchedInvoiceIds || []), invoiceId],
              allocations: [...(p.allocations || []), { invoiceId, amount: Math.min(pay.amount, inv.residual) }],
            }
          : p
      )
    )

    addAuditLog('Invoice', inv.id, inv.number, 'reconciliation', inv.state, newInvoiceState, `Payment ${pay.paymentNumber} reconciled against this invoice. Balance due ${newResidual.toFixed(2)}.`)
    addAuditLog(
      'Payment',
      pay.id,
      pay.paymentNumber,
      'reconciliation',
      'posted',
      'reconciled',
      `Matched and reconciled against invoice ${inv.number}. Write-off applied: SAR ${writeOffAmount}. Residual updated to ${newResidual}.`
    )
  }

  const handleUnreconcile = (invoiceId: string, paymentId: string) => {
    const inv = invoices.find(i => i.id === invoiceId)
    const pay = payments.find(p => p.id === paymentId)
    if (!inv || !pay) return
    const amt = pay.allocations?.find(a => a.invoiceId === invoiceId)?.amount ?? Math.min(pay.amount, inv.amountTotal)
    const residual = Math.min(inv.amountTotal, Math.round((inv.residual + amt) * 100) / 100)
    setInvoices(prev =>
      prev.map(i => (i.id === invoiceId ? { ...i, residual, state: residual >= i.amountTotal ? 'open' : 'in_payment' } : i))
    )
    setPayments(prev =>
      prev.map(p => {
        if (p.id !== paymentId) return p
        const matched = (p.matchedInvoiceIds || []).filter(id => id !== invoiceId)
        return {
          ...p,
          matchedInvoiceIds: matched,
          allocations: (p.allocations || []).filter(a => a.invoiceId !== invoiceId),
          state: matched.length ? p.state : 'posted',
        }
      })
    )
    addAuditLog('Invoice', inv.id, inv.number, 'unreconcile', inv.state, residual >= inv.amountTotal ? 'open' : 'in_payment', `Payment ${pay.paymentNumber} unreconciled; ${amt.toFixed(2)} returned to the open balance.`)
  }

  const handleBulkReconcile = (paymentId: string, allocations: { invoiceId: string; amount: number }[]) => {
    const pay = payments.find(p => p.id === paymentId)
    if (!pay || allocations.length === 0) return
    const byId = new Map(allocations.map(a => [a.invoiceId, a.amount]))
    const refs: string[] = []
    setInvoices(prev =>
      prev.map(i => {
        const amt = byId.get(i.id)
        if (!amt) return i
        refs.push(i.number)
        const residual = Math.max(0, Math.round((i.residual - amt) * 100) / 100)
        return { ...i, residual, state: residual <= 0 ? 'paid' : 'in_payment' }
      })
    )
    const total = allocations.reduce((s, a) => s + a.amount, 0)
    const fully = total >= pay.amount - 0.005
    setPayments(prev =>
      prev.map(p =>
        p.id === paymentId
          ? { ...p, state: fully ? 'reconciled' : 'posted', matchedInvoiceIds: [...(p.matchedInvoiceIds || []), ...allocations.map(a => a.invoiceId)], allocations: [...(p.allocations || []), ...allocations] }
          : p
      )
    )
    allocations.forEach(a => {
      const inv = invoices.find(x => x.id === a.invoiceId)
      if (!inv) return
      const left = Math.max(0, Math.round((inv.residual - a.amount) * 100) / 100)
      addAuditLog('Invoice', inv.id, inv.number, 'reconciliation', inv.state, left <= 0 ? 'paid' : 'in_payment', `Bulk payment ${pay.paymentNumber} applied ${a.amount.toFixed(2)}. Balance due ${left.toFixed(2)}.`)
    })
    addAuditLog(
      'Payment', pay.id, pay.paymentNumber, 'bulk_reconciliation', 'posted', fully ? 'reconciled' : 'posted',
      `Bulk payment matched against ${allocations.length} invoice(s): ${allocations.map(a => invoices.find(i => i.id === a.invoiceId)?.number).join(', ')}. Total allocated ${total.toFixed(2)}.`
    )
  }

  // --- Journal Entry Operations (§6) ---
  const handleSaveJE = (entry: JournalEntry) => {
    setJournalEntries(prev => [entry, ...prev])
    addAuditLog(
      'Journal Entry',
      entry.id,
      entry.entryNumber,
      'state',
      'draft',
      'posted',
      `Manual double-entry JE posted. Lines: ${entry.lines.length}. Balanced debits/credits verified.`
    )
  }

  const handleReverseJE = (entryId: string) => {
    const orig = journalEntries.find(e => e.id === entryId)
    if (!orig) return

    const revStamp = Math.floor(1000 + Math.random() * 9000)
    const counterEntry: JournalEntry = {
      id: `je_rev_${Date.now()}`,
      entryNumber: `REV/${orig.entryNumber.replace(/[^0-9]/g, '') || revStamp}`,
      companyId: orig.companyId,
      entryDate: '2026-11-06',
      journalId: orig.journalId,
      journalName: orig.journalName,
      reference: `Reversal of ${orig.entryNumber}`,
      state: 'posted',
      narration: `Reversal entry counterbalancing ${orig.entryNumber}`,
      lines: orig.lines.map(l => ({
        ...l,
        id: `rev_jel_${Date.now()}_${Math.random()}`,
        debit: l.credit,
        credit: l.debit,
        label: `Reversal: ${l.label}`,
      })),
    }

    setJournalEntries(prev => [
      counterEntry,
      ...prev.map(e => (e.id === entryId ? { ...e, isReversed: true, reversedByEntryId: counterEntry.id } : e)),
    ])

    addAuditLog(
      'Journal Entry',
      counterEntry.id,
      counterEntry.entryNumber,
      'reverse_entry',
      orig.entryNumber,
      'posted',
      `Reversal entry posted counterbalancing ${orig.entryNumber}`
    )
  }

  // --- Cheque Lifecycle Operations (§18) ---
  const handleClearCheque = (chequeId: string) => {
    setCheques(prev =>
      prev.map(c =>
        c.id === chequeId
          ? {
              ...c,
              status: 'cleared',
              clearanceDate: new Date().toISOString().slice(0, 10),
            }
          : c
      )
    )
  }

  const handleBounceCheque = (chequeId: string, reason: string) => {
    const target = cheques.find(c => c.id === chequeId)
    if (!target) return

    setCheques(prev =>
      prev.map(c =>
        c.id === chequeId
          ? {
              ...c,
              status: 'bounced',
              bounceReason: reason,
            }
          : c
      )
    )

    // Reopen related invoice or payment if linked (§18.1 BANK-007)
    if (target.relatedPaymentId) {
      setPayments(prev =>
        prev.map(p =>
          p.id === target.relatedPaymentId ? { ...p, state: 'cancelled' } : p
        )
      )
    }

    addAuditLog(
      'Payment',
      chequeId,
      target.chequeNumber,
      'cheque_bounced',
      target.status,
      'bounced',
      `Cheque marked bounced: "${reason}". Reversed payment voucher and recorded bank return charge.`
    )
  }

  const handleRecordDirectBankTx = (
    journalId: string,
    amount: number,
    isCharge: boolean,
    memo: string
  ) => {
    setAccounts(prev =>
      prev.map(a =>
        a.id === journalId
          ? { ...a, balance: a.balance + (isCharge ? -amount : amount) }
          : a
      )
    )

    const stamp = Math.floor(1000 + Math.random() * 9000)
    const directJe: JournalEntry = {
      id: `je_bank_${Date.now()}`,
      entryNumber: `BNK/2026/${stamp}`,
      companyId: activeCompanyId,
      entryDate: '2026-11-06',
      journalId,
      journalName: 'Bank Journal',
      reference: memo,
      state: 'posted',
      narration: memo,
      lines: isCharge
        ? [
            {
              id: `jel_fee_${Date.now()}`,
              accountId: 'acc_505',
              accountCode: '504000',
              accountName: 'Bank Charges & Gateway Fees',
              label: memo,
              debit: amount,
              credit: 0,
              analyticAccountId: 'ana_1',
            },
            {
              id: `jel_bnk_${Date.now()}`,
              accountId: journalId,
              accountCode: '101000',
              accountName: 'Bank Account',
              label: memo,
              debit: 0,
              credit: amount,
            },
          ]
        : [
            {
              id: `jel_bnk2_${Date.now()}`,
              accountId: journalId,
              accountCode: '101000',
              accountName: 'Bank Account',
              label: memo,
              debit: amount,
              credit: 0,
            },
            {
              id: `jel_inc_${Date.now()}`,
              accountId: 'acc_404',
              accountCode: '490000',
              accountName: 'Interest & Miscellaneous Income',
              label: memo,
              debit: 0,
              credit: amount,
              analyticAccountId: 'ana_1',
            },
          ],
    }

    setJournalEntries(prev => [directJe, ...prev])
    addAuditLog(
      'Journal Entry',
      directJe.id,
      directJe.entryNumber,
      'direct_bank_tx',
      '—',
      'posted',
      `Direct bank transaction: ${memo} (SAR ${amount}) recorded.`
    )
  }

  // --- Fiscal Lock Advance (§15) ---
  const handleAdvanceLockDate = (newHardLock: string, newSoftLock: string) => {
    setFiscalConfig(prev => ({
      ...prev,
      [activeCompanyId]: {
        ...prev[activeCompanyId],
        periodLockDate: newHardLock,
        fiscalYearLockDate: newSoftLock,
      },
    }))

    addAuditLog(
      'Lock Date',
      activeCompanyId,
      `${mockCompanies.find(c => c.id === activeCompanyId)?.name} Lock Dates`,
      'period_lock_date',
      currentFiscalConfig.periodLockDate,
      newHardLock,
      `Hard lock date advanced post closing checklist verification. Soft lock updated to ${newSoftLock} (FY-006 / FY-011).`
    )
  }

  // Drilldown to GL from CoA
  const handleDrilldownGl = (accountCode: string) => {
    setSelectedGlCode(accountCode)
    setActiveTab('reports')
  }

  // Unreconciled count
  const unreconciledCount = payments.filter(p => p.state === 'posted' && p.partnerType === 'customer').length

  // Invoice Category Counts
  const cashInvoicesCount = invoices.filter(i => (i.category || 'credit') === 'cash').length
  const creditInvoicesCount = invoices.filter(i => (i.category || 'credit') === 'credit').length
  const proformaInvoicesCount = invoices.filter(i => i.category === 'proforma').length
  const progressiveInvoicesCount = invoices.filter(i => i.category === 'progressive').length

  if (!user) return <LoginPage notice={signedOutNotice} onLogin={handleLogin} />

  return (
    <DirectoryProvider contacts={contactsApi.contacts} products={inventory.dirProducts} stockOf={inventory.onHand}>
    <div className={`flex min-h-screen bg-slate-100 text-slate-800 ${arabic ? 'rtl' : 'ltr'}`} dir={arabic ? 'rtl' : 'ltr'}>
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenDrawer={(drawer, category) => {
          if (drawer === 'invoice') {
            setEditingInvoice(undefined)
            if (category) setDefaultInvoiceCategory(category)
            setLockedCategory(category)
            setDrawerType('invoice')
          } else if (drawer === 'bill') {
            setEditingBill(undefined)
            setDrawerType('bill')
          } else if (drawer === 'payment') {
            setPaymentModalState({ open: true, type: 'customer' })
          } else if (drawer === 'journal') {
            setActiveTab('journals')
          } else if (drawer === 'reconcile') {
            setActiveTab('reconcile')
          } else if (drawer === 'bank_tx') {
            setActiveTab('banking')
          } else if (drawer === 'lock_wizard') {
            setActiveTab('settings')
          }
        }}
        invoicesCount={invoices.filter(i => i.state === 'open' || i.state === 'in_payment').length}
        billsCount={bills.filter(b => b.state === 'open' || b.state === 'in_payment').length}
        unreconciledCount={unreconciledCount}
        activeInvoiceCategory={activeInvoiceCategory}
        onSelectInvoiceCategory={setActiveInvoiceCategory}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        cashCount={cashInvoicesCount}
        creditCount={creditInvoicesCount}
        proformaCount={proformaInvoicesCount}
        progressiveCount={progressiveInvoicesCount}
      />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentCompanyId={activeCompanyId}
          onSelectCompany={setActiveCompanyId}
          currentRole={currentRole}
          onSelectRole={setCurrentRole}
          arabic={arabic}
          onToggleLanguage={() => setArabic(!arabic)}
          onOpenQuickCreate={() => { setLockedCategory(undefined); setDrawerType('invoice') }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleSidebar={() => setMobileNavOpen(true)}
          user={user}
          onSignOut={handleSignOut}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <div key={activeTab} className="page-fade">
          {activeTab === 'dashboard' && (
            <DashboardView
              invoices={invoices}
              bills={bills}
              payments={payments}
              accounts={accounts}
              currentRole={currentRole}
              onSelectTab={setActiveTab}
              onOpenDrawer={d => { if (d === 'invoice') setLockedCategory(undefined); setDrawerType(d) }}
              onOpenInvoiceModal={inv => {
                setEditingInvoice(inv)
                setDrawerType('invoice')
              }}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoiceList
              invoices={invoices}
              onOpenInvoiceModal={(inv, cat) => {
                setEditingInvoice(inv)
                if (cat) setDefaultInvoiceCategory(cat)
                setLockedCategory(cat)
                setDrawerType('invoice')
              }}
              onOpenPaymentModal={inv => {
                setPaymentModalState({ open: true, type: 'customer', invoice: inv })
              }}
              onOpenPdfModal={inv => setPdfInvoice(inv)}
              onValidateInvoice={id => handleValidateInvoice(id)}
              onCancelInvoice={id => handleCancelInvoice(id)}
              onCreateCreditNote={inv => handleCreateCreditNote(inv)}
              onConvertToTaxInvoice={handleConvertToTaxInvoice}
              currentRole={currentRole}
              searchQuery={searchQuery}
              activeCategoryFilter={activeInvoiceCategory}
              onCategoryFilterChange={setActiveInvoiceCategory}
            />
          )}

          {activeTab === 'bills' && (
            <BillList
              bills={bills}
              onOpenBillModal={b => {
                setEditingBill(b)
                setDrawerType('bill')
              }}
              onPayBill={b => {
                setPaymentModalState({ open: true, type: 'supplier', bill: b })
              }}
              onApproveBill={id => handleApproveBill(id)}
              onRejectBill={(id, reason) => handleRejectBill(id, reason)}
              currentRole={currentRole}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentList
              payments={payments}
              onOpenPaymentModal={type => {
                setPaymentModalState({ open: true, type: type || 'customer' })
              }}
              currentRole={currentRole}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'reconcile' && (
            <ReconciliationView
              invoices={invoices}
              payments={payments}
              onReconcile={handleReconcile}
              onBulkReconcile={handleBulkReconcile}
              currentRole={currentRole}
            />
          )}

          {activeTab === 'journals' && (
            <JournalEntryView
              entries={journalEntries}
              companyId={activeCompanyId}
              onSaveEntry={handleSaveJE}
              onReverseEntry={handleReverseJE}
              currentRole={currentRole}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'coa' && (
            <ChartOfAccountsView
              accounts={accounts}
              onSelectAccountForGl={handleDrilldownGl}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'banking' && (
            <BankingView
              cheques={cheques}
              accounts={accounts}
              companyId={activeCompanyId}
              onBounceCheque={handleBounceCheque}
              onClearCheque={handleClearCheque}
              onRecordDirectBankTx={handleRecordDirectBankTx}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              accounts={accounts}
              invoices={invoices}
              entries={journalEntries}
              selectedGlAccountCode={selectedGlCode}
            />
          )}

          {activeTab === 'audit' && (
            <AuditLogView logs={auditLogs} searchQuery={searchQuery} />
          )}

          {(activeTab === 'inventory' || activeTab.startsWith('inv_')) && (
            <InventoryModule
              tab={activeTab}
              inv={inventory}
              contacts={contactsApi.contacts}
              currentRole={currentRole}
              searchQuery={searchQuery}
              onSelectTab={setActiveTab}
            />
          )}

          {(activeTab === 'contacts' || activeTab.startsWith('usr_')) && (
            <ContactsModule
              key={activeTab}
              tab={activeTab}
              api={contactsApi}
              invoices={invoices}
              bills={bills}
              currentRole={currentRole}
              searchQuery={searchQuery}
              onCreateInvoice={partner => {
                setEditingInvoice(undefined)
                setInvoiceDefaultPartner(partner)
                setLockedCategory(undefined)
                setDrawerType('invoice')
              }}
              onOpenInvoice={inv => { setEditingInvoice(inv); setDrawerType('invoice') }}
              onCreateBill={() => { setEditingBill(undefined); setDrawerType('bill') }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsAndLockView
              currentCompanyId={activeCompanyId}
              fiscalConfig={currentFiscalConfig}
              onAdvanceLockDate={handleAdvanceLockDate}
              currentRole={currentRole}
            />
          )}
          </div>
        </main>
      </div>

      {/* Global Invoice Modal */}
      {drawerType === 'invoice' && (
        <InvoiceModal
          key={editingInvoice?.id ?? 'new'}
          invoice={editingInvoice}
          defaultPartner={invoiceDefaultPartner}
          companyId={activeCompanyId}
          existingInvoices={invoices}
          payments={payments}
          onUnreconcile={handleUnreconcile}
          onRegisterPayment={inv => setPaymentModalState({ open: true, type: 'customer', invoice: inv })}
          onCreateCreditNote={handleCreateCreditNote}
          onSubmitZatca={handleSubmitZatca}
          onRenewProforma={handleRenewProforma}
          onPrintInvoice={(inv, autoPrint) => { setPdfAutoPrint(!!autoPrint); setPdfInvoice(inv) }}
          onCancelInvoice={handleCancelInvoice}
          auditLogs={auditLogs}
          onPostNote={handlePostNote}
          defaultCategory={defaultInvoiceCategory}
          lockedCategory={lockedCategory}
          onClose={() => {
            setDrawerType(null)
            setEditingInvoice(undefined)
            setInvoiceDefaultPartner(undefined)
          }}
          onSave={handleSaveInvoice}
        />
      )}

      {/* Global Printable Tax Invoice PDF Modal */}
      {pdfInvoice && (
        <InvoicePdfModal invoice={pdfInvoice} autoPrint={pdfAutoPrint} onClose={() => setPdfInvoice(null)} />
      )}

      {/* Global Bill Modal */}
      {drawerType === 'bill' && (
        <BillModal
          bill={editingBill}
          companyId={activeCompanyId}
          existingBills={bills}
          auditLogs={auditLogs}
          onPostNote={handlePostNote}
          onClose={() => {
            setDrawerType(null)
            setEditingBill(undefined)
          }}
          onSave={handleSaveBill}
        />
      )}

      {/* Global Payment Register Modal */}
      {paymentModalState.open && (
        <PaymentModal
          initialType={paymentModalState.type}
          initialInvoice={paymentModalState.invoice}
          initialBill={paymentModalState.bill}
          companyId={activeCompanyId}
          openInvoices={invoices.filter(i => i.state === 'open' || i.state === 'in_payment')}
          openBills={bills.filter(b => b.state === 'open' || b.state === 'in_payment')}
          onClose={() => setPaymentModalState({ open: false })}
          onSavePayment={handleSavePayment}
        />
      )}
    </div>
    </DirectoryProvider>
  )
}
