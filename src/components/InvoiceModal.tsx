import { useState } from 'react'
import {
  X,
  Plus,
  Trash2,
  FileCheck2,
  CheckCircle2,
  Paperclip,
  History,
  Coins,
  Layers,
  Calculator,
} from 'lucide-react'
import type { Invoice, InvoiceLine, CompanyId, InvoiceCategory } from '../types/accounting'
import { mockAnalyticAccounts, mockCurrencies, moneyFormat } from '../data/mockAccountingData'

interface InvoiceModalProps {
  invoice?: Invoice
  companyId: CompanyId
  existingInvoices: Invoice[]
  defaultCategory?: InvoiceCategory
  onClose: () => void
  onSave: (invoice: Invoice, postImmediately?: boolean) => void
}

export default function InvoiceModal({
  invoice,
  companyId,
  existingInvoices: _existingInvoices,
  defaultCategory = 'credit',
  onClose,
  onSave,
}: InvoiceModalProps) {
  const isDraft = !invoice || invoice.state === 'draft'

  // Invoice Category
  const [category, setCategory] = useState<InvoiceCategory>(
    invoice?.category || defaultCategory
  )

  // Header Left Fields
  const [isSubscriptionInvoice, setIsSubscriptionInvoice] = useState<boolean>(
    invoice?.isSubscriptionInvoice ?? false
  )
  const [partner, setPartner] = useState(
    invoice?.partner || 'Al-Yamama Steel Industries'
  )
  const [customerVat, setCustomerVat] = useState(invoice?.customerVat || '300184920100003')
  const [customerAddress, setCustomerAddress] = useState(
    invoice?.customerAddress ||
      'الحارث بن مرة, الأمير محمد بن سعود DMM 32241, 7507 5440, Saudi Arabia'
  )
  const [project, setProject] = useState(invoice?.project || '')
  const [contactPerson, setContactPerson] = useState(
    invoice?.contactPerson || 'Al Yamama Company, Abdul Khadir'
  )
  const [paymentTerms, setPaymentTerms] = useState(invoice?.paymentTerms || '15 Days Net')
  const [showDiscount, setShowDiscount] = useState<boolean>(invoice?.showDiscount ?? false)
  const [vendorProjectName, setVendorProjectName] = useState(invoice?.vendorProjectName || '')
  const [prNumber, setPrNumber] = useState(invoice?.prNumber || '')
  const [poNumber, setPoNumber] = useState(
    invoice?.poNumber || invoice?.reference || 'PO-YAMAMA-9921'
  )

  // Header Right Fields
  const [invoiceDateWithTime, setInvoiceDateWithTime] = useState(
    invoice?.invoiceDateWithTime || '11/01/2026 10:30:00'
  )
  const [dateInvoice, setDateInvoice] = useState(invoice?.dateInvoice || '2026-11-01')
  const [dateDue, setDateDue] = useState(invoice?.dateDue || '2026-11-15')
  const [salesperson, setSalesperson] = useState(invoice?.salesperson || 'Administrator')
  const [equipmentGroupTask, setEquipmentGroupTask] = useState(
    invoice?.equipmentGroupTask || 'No Grouping'
  )
  const [sourceDocument, setSourceDocument] = useState(
    invoice?.sourceDocument || invoice?.reference || 'SO13060'
  )
  const [companySeal, setCompanySeal] = useState<boolean>(invoice?.companySeal ?? true)
  const [showOutFromStock, setShowOutFromStock] = useState<boolean>(
    invoice?.showOutFromStock ?? false
  )
  const [isProgressive, setIsProgressive] = useState<boolean>(
    invoice?.isProgressive ?? (category === 'progressive')
  )
  const [salesTeam, setSalesTeam] = useState(invoice?.salesTeam || '')
  const [currency, setCurrency] = useState(invoice?.currency || 'SAR')
  const [currencyRate, setCurrencyRate] = useState(invoice?.currencyRate || 1.0)
  const [journalName, setJournalName] = useState(
    category === 'cash' ? 'Cash Invoices (Cash)' : 'Customer Invoices (Sale)'
  )

  // Progressive Milestone setup
  const [contractAmount, setContractAmount] = useState<number>(invoice?.contractAmount || 500000)
  const [previouslyBilled, setPreviouslyBilled] = useState<number>(invoice?.previouslyBilled || 150000)
  const [progressPercentage, setProgressPercentage] = useState<number>(invoice?.progressPercentage || 30)
  const [retainageAmount, setRetainageAmount] = useState<number>(invoice?.retainageAmount || 15000)

  // Lines
  const [lines, setLines] = useState<InvoiceLine[]>(
    invoice?.lines || [
      {
        id: 'ln_init_1',
        mainTask: 'Overhaul Service',
        category: 'Service',
        showSeparately: false,
        showLine: false,
        showMainQuantity: false,
        partnerNumberType: 'FAY',
        productSubType: 'Hydraulic Overhaul',
        product: 'HYD-CYL-450',
        description: 'Overhaul of 450mm Bore Rolling Mill Hydraulic Cylinder (Honing & Seals)',
        accountCode: '479100',
        accountName: 'Revenue (Product Sales & Service)',
        analyticAccountId: 'ana_1',
        analyticAccountName: 'CC-101 - Workshop Main Base',
        mainQuantity: 1.0,
        quantity: 2.0,
        unitOfMeasure: 'EA',
        unitPrice: 36956.52,
        taxRate: 0.15,
        taxesApplied: '15% VAT',
        discount: 0.0,
        subtotal: 73913.04,
        taxAmount: 11086.96,
        total: 85000.0,
      },
    ]
  )

  const [attachmentsCount, setAttachmentsCount] = useState(invoice?.attachmentsCount || 3)

  const handleCurrencyChange = (newCurr: string) => {
    setCurrency(newCurr)
    const match = mockCurrencies.find(c => c.currency === newCurr)
    if (match) {
      setCurrencyRate(match.rateToBase)
    }
  }

  const updateLine = (id: string, field: keyof InvoiceLine, value: any) => {
    if (!isDraft) return
    setLines(prev =>
      prev.map(l => {
        if (l.id !== id) return l
        const updated = { ...l, [field]: value }

        if (field === 'analyticAccountId') {
          const matched = mockAnalyticAccounts.find(a => a.id === value)
          updated.analyticAccountName = matched ? `${matched.code} - ${matched.name}` : ''
        }

        const qty = Number(updated.quantity) || 0
        const price = Number(updated.unitPrice) || 0
        const disc = Number(updated.discount) || 0
        const taxR = Number(updated.taxRate) || 0

        const gross = qty * price
        const net = Math.max(0, gross - disc)
        const tax = net * taxR

        return {
          ...updated,
          subtotal: net,
          taxAmount: tax,
          total: net + tax,
        }
      })
    )
  }

  const addLine = () => {
    if (!isDraft) return
    const newLine: InvoiceLine = {
      id: `ln_${Date.now()}`,
      mainTask: isSubscriptionInvoice ? 'Annual Service Subscription' : 'Supply of',
      category: isSubscriptionInvoice ? 'Subscription' : 'Supply',
      showSeparately: false,
      showLine: false,
      showMainQuantity: false,
      partnerNumberType: 'FAY',
      productSubType: isSubscriptionInvoice ? 'Service - New Subscription' : 'Parts Supply',
      product: isSubscriptionInvoice ? 'Annual Service Subscription - 1 Year' : 'PARTS-SEAL-KIT',
      description: isSubscriptionInvoice ? 'Annual Service Subscription - 1 Year' : 'High pressure hydraulic seal replacement kit',
      accountCode: isSubscriptionInvoice ? '479104' : '479100',
      accountName: isSubscriptionInvoice ? 'Revenue (Renewal)' : 'Revenue (Product Sales & Service)',
      analyticAccountId: 'ana_1',
      analyticAccountName: 'CC-101 - Workshop Main Base',
      mainQuantity: 1.0,
      quantity: 1.0,
      unitOfMeasure: 'EA',
      unitPrice: isSubscriptionInvoice ? 325.0 : 3200.0,
      taxRate: 0.15,
      taxesApplied: '15% VAT',
      discount: 0.0,
      subtotal: isSubscriptionInvoice ? 325.0 : 3200.0,
      taxAmount: isSubscriptionInvoice ? 48.75 : 480.0,
      total: isSubscriptionInvoice ? 373.75 : 3680.0,
    }
    setLines(prev => [...prev, newLine])
  }

  const removeLine = (id: string) => {
    if (!isDraft || lines.length <= 1) return
    setLines(prev => prev.filter(l => l.id !== id))
  }

  // Totals
  const untaxedTotal = lines.reduce((acc, l) => acc + l.subtotal, 0)
  const taxTotal = lines.reduce((acc, l) => acc + l.taxAmount, 0)
  const grandTotal = untaxedTotal + taxTotal

  // Save handler
  const handleSave = (postImmediately = false) => {
    if (!partner.trim() || grandTotal <= 0) {
      alert('Please enter a customer and at least one valid invoice line.')
      return
    }

    let nextNum = invoice?.number
    if (!nextNum) {
      const stamp = Math.floor(1000 + Math.random() * 9000)
      if (category === 'cash') nextNum = `CSH/2026/${stamp}`
      else if (category === 'proforma') nextNum = `PRO/2026/${stamp}`
      else if (category === 'progressive') nextNum = `PRG/2026/${stamp}`
      else nextNum = `INV/2026/${stamp}`
    }

    const updatedInvoice: Invoice = {
      id: invoice?.id || `inv_${Date.now()}`,
      number: nextNum,
      companyId: invoice?.companyId || companyId,
      partner,
      customerAddress,
      customerVat,
      isSubscriptionInvoice,
      project,
      contactPerson,
      paymentTerms,
      showDiscount,
      vendorProjectName,
      prNumber,
      poNumber,
      invoiceDateWithTime,
      dateInvoice,
      dateDue,
      salesperson,
      equipmentGroupTask,
      sourceDocument,
      companySeal,
      showOutFromStock,
      isProgressive,
      salesTeam,
      currency,
      currencyRate,
      journalId: category === 'cash' ? 'jour_cash' : 'jour_sale',
      reference: poNumber || sourceDocument,
      lines,
      amountUntaxed: untaxedTotal,
      amountTax: taxTotal,
      amountTotal: grandTotal,
      residual: postImmediately ? (category === 'cash' ? 0 : grandTotal) : (invoice?.residual ?? grandTotal),
      state: postImmediately ? (category === 'cash' ? 'paid' : 'open') : (invoice?.state || 'draft'),
      category,
      contractAmount: isProgressive ? contractAmount : undefined,
      previouslyBilled: isProgressive ? previouslyBilled : undefined,
      progressPercentage: isProgressive ? progressPercentage : undefined,
      retainageAmount: isProgressive ? retainageAmount : undefined,
      approvalStatus: 'approved',
      validatedBy: postImmediately ? 'Administrator' : invoice?.validatedBy,
      validatedAt: postImmediately ? new Date().toISOString().slice(0, 16).replace('T', ' ') : invoice?.validatedAt,
      type: 'out_invoice',
      attachmentsCount,
    }

    onSave(updatedInvoice, postImmediately)
  }

  const invoiceNumberDisplay = invoice?.number || 'New'
  const stateDisplay = invoice?.state ? invoice.state.toUpperCase() : 'DRAFT'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-[#f8fafc] rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Top Header (Matches Exact Screenshot Format) */}
        <div className="bg-white px-6 py-4 border-b border-slate-200/90 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <FileCheck2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">
                  Customer Invoice: {invoiceNumberDisplay}
                </h2>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    stateDisplay === 'OPEN'
                      ? 'bg-emerald-100 text-emerald-800'
                      : stateDisplay === 'PAID'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {stateDisplay}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Customer Billing Document</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: Cards in Exact Format */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* CARD 1: INVOICE HEADER & PARTNER INFORMATION */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              INVOICE HEADER & PARTNER INFORMATION
            </div>

            {/* Grid 1: Customer, VAT, PO Reference */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Customer / Partner *</label>
                <input
                  type="text"
                  disabled={!isDraft}
                  value={partner}
                  onChange={e => setPartner(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Customer VAT Number</label>
                <input
                  type="text"
                  disabled={!isDraft}
                  value={customerVat}
                  onChange={e => setCustomerVat(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Customer PO Reference</label>
                <input
                  type="text"
                  disabled={!isDraft}
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
                />
              </div>
            </div>

            {/* Grid 2: Invoice Date, Payment Terms, Due Date */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Invoice Date *</label>
                <input
                  type="date"
                  disabled={!isDraft}
                  value={dateInvoice}
                  onChange={e => setDateInvoice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Payment Terms</label>
                <select
                  disabled={!isDraft}
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
                >
                  <option value="Immediate Payment">Immediate Payment</option>
                  <option value="15 Days Net">15 Days Net</option>
                  <option value="30 Days Net">30 Days Net</option>
                  <option value="60 Days">60 Days</option>
                  <option value="Advance / Proforma">Advance / Proforma</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Due Date</label>
                <input
                  type="date"
                  disabled={!isDraft}
                  value={dateDue}
                  onChange={e => setDateDue(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
                />
              </div>
            </div>

            {/* Grid 3: Currency, Exchange Rate to SAR, Journal */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
                  <span>Currency</span>
                  <Coins size={13} className="text-emerald-600" />
                </label>
                <select
                  disabled={!isDraft}
                  value={currency}
                  onChange={e => handleCurrencyChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
                >
                  {mockCurrencies.map(c => (
                    <option key={c.currency} value={c.currency}>
                      {c.currency} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Exchange Rate to SAR</label>
                <input
                  type="number"
                  step="0.0001"
                  disabled={!isDraft || currency === 'SAR'}
                  value={currencyRate}
                  onChange={e => setCurrencyRate(parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Journal</label>
                <input
                  type="text"
                  disabled
                  value={journalName}
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-medium cursor-not-allowed"
                />
              </div>
            </div>

            {/* Additional Fields Section in Same Card Style */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Subscription Invoice Switch */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-700">Subscription Invoice</span>
                <button
                  type="button"
                  disabled={!isDraft}
                  onClick={() => setIsSubscriptionInvoice(!isSubscriptionInvoice)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    isSubscriptionInvoice ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isSubscriptionInvoice ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Salesperson</label>
                <input
                  type="text"
                  disabled={!isDraft}
                  value={salesperson}
                  onChange={e => setSalesperson(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Source Document</label>
                <input
                  type="text"
                  disabled={!isDraft}
                  value={sourceDocument}
                  onChange={e => setSourceDocument(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Contact Person</label>
                <input
                  type="text"
                  disabled={!isDraft}
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Project</label>
                <input
                  type="text"
                  disabled={!isDraft}
                  value={project}
                  onChange={e => setProject(e.target.value)}
                  placeholder="Optional project name/code"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Equipment Details Group Task</label>
                <select
                  disabled={!isDraft}
                  value={equipmentGroupTask}
                  onChange={e => setEquipmentGroupTask(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                >
                  <option value="No Grouping">No Grouping</option>
                  <option value="By Task">By Task</option>
                  <option value="By Equipment">By Equipment</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Vendor Project Name</label>
                <input
                  type="text"
                  disabled={!isDraft}
                  value={vendorProjectName}
                  onChange={e => setVendorProjectName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">PR Number</label>
                <input
                  type="text"
                  disabled={!isDraft}
                  value={prNumber}
                  onChange={e => setPrNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Sales Team</label>
                <input
                  type="text"
                  disabled={!isDraft}
                  value={salesTeam}
                  onChange={e => setSalesTeam(e.target.value)}
                  placeholder="e.g. Sales Dammam"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                />
              </div>

              <div className="flex items-center gap-4 pt-1 col-span-full">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isDraft}
                    checked={companySeal}
                    onChange={e => setCompanySeal(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-700">Company Seal on Invoice</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isDraft}
                    checked={showOutFromStock}
                    onChange={e => setShowOutFromStock(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-700">Show Out from Stock Button</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isDraft}
                    checked={isProgressive}
                    onChange={e => {
                      setIsProgressive(e.target.checked)
                      if (e.target.checked) setCategory('progressive')
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-700">Is Progressive Inv. ?</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isDraft}
                    checked={showDiscount}
                    onChange={e => setShowDiscount(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-700">Show Discount</span>
                </label>
              </div>

              {/* Customer Address */}
              <div className="col-span-full">
                <label className="block text-slate-700 font-bold mb-1">Customer Address (Saudi & Arabic Format)</label>
                <textarea
                  rows={2}
                  disabled={!isDraft}
                  value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 leading-relaxed font-sans"
                />
              </div>
            </div>
          </div>

          {/* CARD 2: INVOICE LINE ITEMS (PRODUCTS & SERVICES) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  INVOICE LINE ITEMS (PRODUCTS & SERVICES)
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Cost Centre is required for operational revenue tracking.
                </p>
              </div>

              {isDraft && (
                <button
                  type="button"
                  onClick={addLine}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus size={14} /> Add Line Item
                </button>
              )}
            </div>

            {/* Line Items Table (Matches Screenshot Layout & Fields) */}
            <div className="overflow-x-auto border border-slate-200/90 rounded-xl">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80 text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Product / Service</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-2 text-right w-16">Qty</th>
                    <th className="py-2.5 px-3 text-right w-24">Unit Price</th>
                    <th className="py-2.5 px-2 text-center w-20">Tax</th>
                    <th className="py-2.5 px-3 w-44">Cost Centre</th>
                    <th className="py-2.5 px-2">Main Task</th>
                    <th className="py-2.5 px-2">Category</th>
                    <th className="py-2.5 px-2">Partner Type</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                    {isDraft && <th className="py-2.5 px-2 w-7"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map(line => (
                    <tr key={line.id} className="hover:bg-slate-50/70 transition">
                      {/* Product */}
                      <td className="py-2.5 px-3">
                        {isDraft ? (
                          <input
                            type="text"
                            value={line.product}
                            onChange={e => updateLine(line.id, 'product', e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 w-36"
                          />
                        ) : (
                          <span className="font-bold text-slate-800">{line.product}</span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-2.5 px-3 max-w-xs whitespace-normal">
                        {isDraft ? (
                          <input
                            type="text"
                            value={line.description}
                            onChange={e => updateLine(line.id, 'description', e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 w-52"
                          />
                        ) : (
                          <span className="text-slate-600 truncate block max-w-xs">{line.description}</span>
                        )}
                      </td>

                      {/* Qty */}
                      <td className="py-2.5 px-2 text-right">
                        {isDraft ? (
                          <input
                            type="number"
                            step="1"
                            value={line.quantity}
                            onChange={e => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-xs text-right font-mono w-16"
                          />
                        ) : (
                          <span className="font-mono text-slate-800">{line.quantity}</span>
                        )}
                      </td>

                      {/* Unit Price */}
                      <td className="py-2.5 px-3 text-right">
                        {isDraft ? (
                          <input
                            type="number"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={e => updateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold w-24"
                          />
                        ) : (
                          <span className="font-mono font-semibold text-slate-800">{line.unitPrice.toFixed(2)}</span>
                        )}
                      </td>

                      {/* Tax */}
                      <td className="py-2.5 px-2 text-center">
                        {isDraft ? (
                          <select
                            value={line.taxRate}
                            onChange={e => updateLine(line.id, 'taxRate', parseFloat(e.target.value))}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-semibold"
                          >
                            <option value={0.15}>15% VAT</option>
                            <option value={0.0}>0% Zero</option>
                          </select>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {line.taxesApplied || '15% VAT'}
                          </span>
                        )}
                      </td>

                      {/* Cost Centre / Analytic Account */}
                      <td className="py-2.5 px-3">
                        {isDraft ? (
                          <select
                            value={line.analyticAccountId || 'ana_1'}
                            onChange={e => updateLine(line.id, 'analyticAccountId', e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 w-44"
                          >
                            {mockAnalyticAccounts.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-700">{line.analyticAccountName || 'CC-101 - Workshop Main Base'}</span>
                        )}
                      </td>

                      {/* Main Task */}
                      <td className="py-2.5 px-2 text-slate-700">{line.mainTask || '-'}</td>

                      {/* Category */}
                      <td className="py-2.5 px-2 text-slate-700">{line.category || '-'}</td>

                      {/* Partner Number Type */}
                      <td className="py-2.5 px-2 font-mono text-slate-600">{line.partnerNumberType || 'FAY'}</td>

                      {/* Subtotal */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {line.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SR
                      </td>

                      {/* Remove Line */}
                      {isDraft && (
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Attachments & Summary Box (Matches Exact Screenshot Layout) */}
            <div className="pt-2 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
              {/* Left Attachments note */}
              <div className="space-y-1 text-xs text-slate-500">
                <div className="flex items-center gap-1.5 font-medium text-slate-600">
                  <Paperclip size={14} className="text-slate-400" />
                  <span>Attachments ({attachmentsCount} files attached)</span>
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => setAttachmentsCount(c => c + 1)}
                      className="text-emerald-700 hover:underline font-bold ml-1"
                    >
                      + Add
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  Includes Workshop Job Card, Inspection Sheet & Material Certifications.
                </div>
              </div>

              {/* Right Summary Box */}
              <div className="w-full sm:w-80 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span className="font-medium">Untaxed Amount:</span>
                  <span className="font-mono font-semibold">
                    {untaxedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SR
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-medium">Standard VAT (15%):</span>
                  <span className="font-mono font-semibold">
                    {taxTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SR
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                  <span>Total ({currency}):</span>
                  <span className="font-mono text-base font-bold text-emerald-800">
                    {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SR
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: DOCUMENT ACTIVITY & AUDIT HISTORY */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <History size={14} className="text-emerald-600" />
              <span>DOCUMENT ACTIVITY & AUDIT HISTORY</span>
            </div>
            <p className="text-[11px] text-slate-400">
              All field updates, approvals, and status transitions are recorded immutably.
            </p>
            <div className="space-y-2 text-xs border-l-2 border-emerald-500 pl-3">
              <div className="text-slate-600">
                <span className="font-bold text-slate-800">Administrator</span> generated customer invoice and verified tax accounts
                <span className="text-slate-400 text-[10px] ml-2">{invoiceDateWithTime}</span>
              </div>
              {invoice?.validatedBy && (
                <div className="text-slate-600">
                  <span className="font-bold text-emerald-700">{invoice.validatedBy}</span> confirmed and posted invoice
                  <span className="text-slate-400 text-[10px] ml-2">{invoice.validatedAt}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer (Matches Exact Screenshot Close Button) */}
        <div className="bg-white px-6 py-4 border-t border-slate-200/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition shadow-xs"
          >
            Close
          </button>

          {isDraft && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSave(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <CheckCircle2 size={15} />
                <span>Validate & Post</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
