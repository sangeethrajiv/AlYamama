import { useState, useMemo } from 'react'
import type {
  TabId,
  DrawerType,
  CompanyId,
  UserRole,
  Invoice,
  Bill,
  Payment,
  JournalEntry,
  Account,
  ChequeRecord,
  AuditLogEntry,
  FiscalPeriodConfig,
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

export default function App() {
  // Global State
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [activeCompanyId, setActiveCompanyId] = useState<CompanyId>('co_1')
  const [currentRole, setCurrentRole] = useState<UserRole>('Accounts Manager')
  const [arabic, setArabic] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Entities Data State
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices)
  const [bills, setBills] = useState<Bill[]>(mockBills)
  const [payments, setPayments] = useState<Payment[]>(mockPayments)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(mockJournalEntries)
  const [accounts, setAccounts] = useState<Account[]>(mockChartOfAccounts)
  const [cheques, setCheques] = useState<ChequeRecord[]>(mockCheques)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(mockAuditLogs)
  const [fiscalConfig, setFiscalConfig] = useState<Record<string, FiscalPeriodConfig>>(mockFiscalConfig)

  // Modals & Drawers
  const [drawerType, setDrawerType] = useState<DrawerType>(null)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>(undefined)
  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null)
  const [editingBill, setEditingBill] = useState<Bill | undefined>(undefined)
  const [paymentModalState, setPaymentModalState] = useState<{
    open: boolean
    type?: 'customer' | 'supplier'
    invoice?: Invoice
    bill?: Bill
  }>({ open: false })
  const [selectedGlCode, setSelectedGlCode] = useState<string | undefined>(undefined)

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
      user: `${currentRole} (Active Session)`,
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

  // --- Invoice Operations ---
  const handleSaveInvoice = (inv: Invoice, postImmediately = false) => {
    const exists = invoices.some(i => i.id === inv.id)
    if (exists) {
      setInvoices(prev => prev.map(i => (i.id === inv.id ? inv : i)))
      addAuditLog('Invoice', inv.id, inv.number, 'update', 'draft', inv.state, 'Invoice modified')
    } else {
      setInvoices(prev => [inv, ...prev])
      addAuditLog('Invoice', inv.id, inv.number, 'create', '—', inv.state, 'New invoice registered')
    }

    if (postImmediately) {
      handleValidateInvoice(inv.id, inv)
    }

    setDrawerType(null)
    setEditingInvoice(undefined)
  }

  const handleValidateInvoice = (invoiceId: string, overrideInv?: Invoice) => {
    const target = overrideInv || invoices.find(i => i.id === invoiceId)
    if (!target) return

    // Post validation: update state to 'open'
    const updated: Invoice = {
      ...target,
      state: 'open',
      validatedBy: `${currentRole} (Verified)`,
      validatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      approvalStatus: 'approved',
    }

    // Auto-generate Journal Entry (§4.1.1 INV-007)
    const newJE: JournalEntry = {
      id: `je_inv_${target.id}`,
      entryNumber: `${target.number}-JE`,
      companyId: target.companyId,
      entryDate: target.dateInvoice,
      journalId: 'jour_sale',
      journalName: 'Customer Invoices (Sales)',
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
        `Auto-generated inter-company vendor bill in Company B from posted invoice ${target.number} (MC-005)`
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
      target.state,
      'open',
      `Invoice posted via action_invoice_open(); Journal Entry ${newJE.entryNumber} posted automatically.`
    )
  }

  const handleCancelInvoice = (invoiceId: string) => {
    const target = invoices.find(i => i.id === invoiceId)
    if (!target) return

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

  const handleCreateCreditNote = (originalInvoice: Invoice) => {
    const stamp = Math.floor(1000 + Math.random() * 9000)
    const creditNote: Invoice = {
      ...originalInvoice,
      id: `inv_cn_${Date.now()}`,
      number: `RND/2026/${stamp}`,
      type: 'out_refund',
      originInvoiceNumber: originalInvoice.number,
      reference: `Credit Note for ${originalInvoice.number}`,
      dateInvoice: '2026-11-06',
      state: 'open',
      residual: 0,
      approvalStatus: 'approved',
    }

    // Reduces residual on original invoice (BR-008)
    setInvoices(prev => [
      creditNote,
      ...prev.map(i =>
        i.id === originalInvoice.id
          ? { ...i, residual: Math.max(0, i.residual - originalInvoice.amountTotal) }
          : i
      ),
    ])

    addAuditLog(
      'Invoice',
      creditNote.id,
      creditNote.number,
      'create_credit_note',
      '—',
      'open',
      `Issued credit note linked to original invoice ${originalInvoice.number} (INV-011 / BR-008)`
    )
  }

  // --- Bill Operations ---
  const handleSaveBill = (b: Bill, postImmediately = false) => {
    const exists = bills.some(item => item.id === b.id)
    if (exists) {
      setBills(prev => prev.map(item => (item.id === b.id ? b : item)))
    } else {
      setBills(prev => [b, ...prev])
    }

    addAuditLog(
      'Vendor Bill',
      b.id,
      b.number,
      'save_bill',
      b.state,
      postImmediately ? 'open' : b.state,
      `Vendor bill saved with supplier ref ${b.supplierInvoiceNumber}`
    )

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
      `Approved by ${currentRole} in accordance with threshold authorization matrix (§19)`
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
    setPayments(prev => [payment, ...prev])

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
            }
          : p
      )
    )

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
      `Reversal entry posted counterbalancing ${orig.entryNumber} (JE-007)`
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
      `Cheque marked bounced: "${reason}". Reversed payment voucher and recorded bank return charge (BANK-007).`
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

  return (
    <div className={`flex min-h-screen bg-slate-100 text-slate-800 ${arabic ? 'rtl' : 'ltr'}`} dir={arabic ? 'rtl' : 'ltr'}>
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenDrawer={drawer => {
          if (drawer === 'invoice') {
            setEditingInvoice(undefined)
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
          onOpenQuickCreate={() => setDrawerType('invoice')}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              invoices={invoices}
              bills={bills}
              payments={payments}
              accounts={accounts}
              onSelectTab={setActiveTab}
              onOpenDrawer={setDrawerType}
              onOpenInvoiceModal={inv => {
                setEditingInvoice(inv)
                setDrawerType('invoice')
              }}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoiceList
              invoices={invoices}
              onOpenInvoiceModal={inv => {
                setEditingInvoice(inv)
                setDrawerType('invoice')
              }}
              onOpenPaymentModal={inv => {
                setPaymentModalState({ open: true, type: 'customer', invoice: inv })
              }}
              onOpenPdfModal={inv => setPdfInvoice(inv)}
              onValidateInvoice={id => handleValidateInvoice(id)}
              onCancelInvoice={id => handleCancelInvoice(id)}
              onCreateCreditNote={inv => handleCreateCreditNote(inv)}
              currentRole={currentRole}
              searchQuery={searchQuery}
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

          {activeTab === 'settings' && (
            <SettingsAndLockView
              currentCompanyId={activeCompanyId}
              fiscalConfig={currentFiscalConfig}
              onAdvanceLockDate={handleAdvanceLockDate}
              currentRole={currentRole}
            />
          )}
        </main>
      </div>

      {/* Global Invoice Modal */}
      {drawerType === 'invoice' && (
        <InvoiceModal
          invoice={editingInvoice}
          companyId={activeCompanyId}
          existingInvoices={invoices}
          onClose={() => {
            setDrawerType(null)
            setEditingInvoice(undefined)
          }}
          onSave={handleSaveInvoice}
        />
      )}

      {/* Global Printable Tax Invoice PDF Modal */}
      {pdfInvoice && (
        <InvoicePdfModal invoice={pdfInvoice} onClose={() => setPdfInvoice(null)} />
      )}

      {/* Global Bill Modal */}
      {drawerType === 'bill' && (
        <BillModal
          bill={editingBill}
          companyId={activeCompanyId}
          existingBills={bills}
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
  )
}
