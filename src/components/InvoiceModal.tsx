import { useState } from 'react'
import { X, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import Chatter from './Chatter'
import type { AuditLogEntry, Invoice, InvoiceLine, CompanyId, InvoiceCategory, Payment } from '../types/accounting'
import { mockAnalyticAccounts, mockCurrencies, moneyFormat } from '../data/mockAccountingData'

interface InvoiceModalProps {
  invoice?: Invoice
  companyId: CompanyId
  existingInvoices: Invoice[]
  payments?: Payment[]
  onUnreconcile?: (invoiceId: string, paymentId: string) => void
  auditLogs?: AuditLogEntry[]
  onPostNote?: (recordType: AuditLogEntry['recordType'], recordId: string, recordName: string, text: string) => void
  defaultCategory?: InvoiceCategory
  lockedCategory?: InvoiceCategory
  onClose: () => void
  onSave: (invoice: Invoice, postImmediately?: boolean) => void
}

export default function InvoiceModal({
  invoice: invoiceProp,
  companyId,
  existingInvoices,
  payments = [],
  onUnreconcile,
  auditLogs = [],
  onPostNote,
  defaultCategory = 'credit',
  lockedCategory,
  onClose,
  onSave,
}: InvoiceModalProps) {
  // Live copy so status and balances refresh after unreconciling
  const invoice = invoiceProp ? existingInvoices.find(i => i.id === invoiceProp.id) ?? invoiceProp : undefined
  const isDraft = !invoice || invoice.state === 'draft'
  // The type picker only appears when creating from "All Invoices"
  const showTypePicker = !invoice && !lockedCategory
  const [confirmUnrec, setConfirmUnrec] = useState<string | null>(null)
  const invPayments = invoice ? payments.filter(p => p.matchedInvoiceIds?.includes(invoice.id)) : []
  const appliedTo = (p: Payment) =>
    p.allocations?.find(a => a.invoiceId === invoice?.id)?.amount ?? Math.min(p.amount, invoice?.amountTotal ?? p.amount)
  const settled = invoice ? Math.max(0, invoice.amountTotal - invoice.residual) : 0
  const settledPct = invoice && invoice.amountTotal ? Math.min(100, (settled / invoice.amountTotal) * 100) : 0

  // Invoice Category
  const [category, setCategory] = useState<InvoiceCategory>(
    invoice?.category || defaultCategory
  )

  const typeLabel = ({ cash: 'Cash Invoice', credit: 'Credit Invoice', proforma: 'Proforma Invoice', progressive: 'Progressive Invoice' } as Record<string, string>)[category] || 'Customer Invoice'

  // Top Left Header Fields
  const [noOfSubscriptionItems, setNoOfSubscriptionItems] = useState<number>(
    invoice?.noOfSubscriptionItems ?? 0
  )
  const [isSubscriptionInvoice, setIsSubscriptionInvoice] = useState<boolean>(
    invoice?.isSubscriptionInvoice ?? false
  )
  const [subscriptionFrequency, setSubscriptionFrequency] = useState<string>(
    invoice?.subscriptionFrequency || 'One Year'
  )
  const [subscriptionType, setSubscriptionType] = useState<string>(
    invoice?.subscriptionType || 'Vehicle Subscription'
  )
  const [subscriptionStartDate, setSubscriptionStartDate] = useState<string>(
    invoice?.subscriptionStartDate || '02/01/2026'
  )
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string>(
    invoice?.subscriptionEndDate || '01/31/2027'
  )
  const [subscriptionAlertDate, setSubscriptionAlertDate] = useState<string>(
    invoice?.subscriptionAlertDate || '12/31/2026'
  )
  const [partner, setPartner] = useState(
    invoice?.partner || 'Innovex (Dril Quip TIW-SAUDI ARABIA Limited Company)'
  )
  const [customerAddress, setCustomerAddress] = useState(
    invoice?.customerAddress ||
      'King Abdul Aziz Rd\nKing Abdul Aziz Rd\nKing Abdul Aziz Seaport Dist. DMM 32212\n7289 2490\nSaudi Arabia - 310562291400003'
  )
  const [customerVat, setCustomerVat] = useState(invoice?.customerVat || '310562291400003')
  const [project, setProject] = useState(invoice?.project || '')
  const [contactPerson, setContactPerson] = useState(invoice?.contactPerson || '')
  const [paymentTerms, setPaymentTerms] = useState(invoice?.paymentTerms || 'On Completion')
  const [showDiscount, setShowDiscount] = useState<boolean>(invoice?.showDiscount ?? false)
  const [vendorProjectName, setVendorProjectName] = useState(invoice?.vendorProjectName || '')
  const [prNumber, setPrNumber] = useState(invoice?.prNumber || '')
  const [poNumber, setPoNumber] = useState(invoice?.poNumber || '-')

  // Top Right Header Fields
  const [invoiceDateWithTime, setInvoiceDateWithTime] = useState(
    invoice?.invoiceDateWithTime || '03/14/2026 17:25:29'
  )
  const [dateInvoice, setDateInvoice] = useState(invoice?.dateInvoice || '2026-03-14')
  const [dateDue, setDateDue] = useState(invoice?.dateDue || '03/14/2026')
  const [salesperson, setSalesperson] = useState(invoice?.salesperson || 'Faraz Yousuff')
  const [equipmentGroupTask, setEquipmentGroupTask] = useState(
    invoice?.equipmentGroupTask || 'Based On Main Task'
  )
  const [sourceDocument, setSourceDocument] = useState(invoice?.sourceDocument || 'SO0753')
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
  const [journalName] = useState(
    category === 'cash' ? 'Cash Invoices (Cash)' : 'Customer Invoices (Sale)'
  )

  // Tabs
  const [activeTab, setActiveTab] = useState<'lines' | 'other' | 'vehicles'>('lines')

  // Lines
  const [lines, setLines] = useState<InvoiceLine[]>(
    invoice?.lines || [
      {
        id: 'ln_init_1',
        mainTask: 'European',
        category: 'Supply',
        showSeparately: false,
        showLine: false,
        showMainQuantity: true,
        partnerNumberType: 'FAY',
        productSubType: '',
        product: '[FMC130]',
        description: 'Teltonika',
        accountCode: '479100',
        accountName: 'Revenue (Product Sales & Service)',
        analyticAccountId: '',
        analyticAccountName: '',
        mainQuantity: 1.0,
        quantity: 1.0,
        unitOfMeasure: 'pcs',
        unitPrice: 200.0,
        taxRate: 0.15,
        taxesApplied: 'VAT 15%',
        discount: 0.0,
        subtotal: 200.0,
        taxAmount: 30.0,
        total: 230.0,
      },
    ]
  )

  // Vehicles list
  const [vehiclesList, setVehiclesList] = useState(
    invoice?.vehicles || [
      {
        id: 'veh_1',
        plateNumber: '7289-KSA',
        chassisNumber: 'WDB2110261A129842',
        model: 'Toyota Hilux 4x4',
        gpsDeviceId: '[FMC130] Teltonika',
        simNumber: '0559182741',
      },
    ]
  )

  const [attachmentsCount, setAttachmentsCount] = useState(invoice?.attachmentsCount || 1)

  const handleCategoryChange = (newCat: InvoiceCategory) => {
    if (!isDraft) return
    setCategory(newCat)
    if (newCat === 'cash') {
      setPaymentTerms('Immediate Payment')
      setDateDue(dateInvoice)
      setIsProgressive(false)
    } else if (newCat === 'credit') {
      setPaymentTerms('15 Days Net')
      setIsProgressive(false)
    } else if (newCat === 'proforma') {
      setPaymentTerms('Advance / Proforma')
      setIsProgressive(false)
    } else if (newCat === 'progressive') {
      setPaymentTerms('30 Days Net')
      setIsProgressive(true)
    }
  }

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
      mainTask: 'European',
      category: 'Supply',
      showSeparately: false,
      showLine: false,
      showMainQuantity: true,
      partnerNumberType: 'FAY',
      productSubType: '',
      product: '[FMC130]',
      description: 'Teltonika',
      accountCode: '479100',
      accountName: 'Revenue (Product Sales & Service)',
      analyticAccountId: '',
      analyticAccountName: '',
      mainQuantity: 1.0,
      quantity: 1.0,
      unitOfMeasure: 'pcs',
      unitPrice: 200.0,
      taxRate: 0.15,
      taxesApplied: 'VAT 15%',
      discount: 0.0,
      subtotal: 200.0,
      taxAmount: 30.0,
      total: 230.0,
    }
    setLines(prev => [...prev, newLine])
  }

  const removeLine = (id: string) => {
    if (!isDraft || lines.length <= 1) return
    setLines(prev => prev.filter(l => l.id !== id))
  }

  // Totals
  const amountWithoutDiscount = lines.reduce(
    (acc, l) => acc + (Number(l.quantity) * Number(l.unitPrice) || 0),
    0
  )
  const discountTotal = lines.reduce((acc, l) => acc + (Number(l.discount) || 0), 0)
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
      noOfSubscriptionItems,
      isSubscriptionInvoice,
      subscriptionFrequency,
      subscriptionType,
      subscriptionStartDate,
      subscriptionEndDate,
      subscriptionAlertDate,
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
      reference: sourceDocument || poNumber,
      lines,
      amountWithoutDiscount,
      discountTotal,
      amountUntaxed: untaxedTotal,
      amountTax: taxTotal,
      amountTotal: grandTotal,
      residual: postImmediately ? (category === 'cash' ? 0 : grandTotal) : (invoice?.residual ?? grandTotal),
      state: postImmediately ? (category === 'cash' ? 'paid' : 'open') : (invoice?.state || 'draft'),
      category,
      approvalStatus: 'approved',
      validatedBy: postImmediately ? 'Administrator' : invoice?.validatedBy,
      validatedAt: postImmediately ? new Date().toISOString().slice(0, 16).replace('T', ' ') : invoice?.validatedAt,
      type: 'out_invoice',
      attachmentsCount,
      vehicles: vehiclesList,
    }

    onSave(updatedInvoice, postImmediately)
  }

  const invoiceNumberDisplay = invoice?.number || 'New'
  const stateDisplay = invoice?.state ? invoice.state.toUpperCase() : 'DRAFT'

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-50 animate-in fade-in">
      <div className="bg-slate-50 w-full max-w-5xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden">
        {/* Right Sidebar Drawer Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">
                  {invoice ? `${typeLabel}: ${invoiceNumberDisplay}` : showTypePicker ? 'New Customer Invoice' : `New ${typeLabel}`}
                </h2>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${
                    stateDisplay === 'OPEN'
                      ? 'bg-emerald-100 text-emerald-800'
                      : stateDisplay === 'PAID'
                      ? 'bg-slate-100 text-slate-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {stateDisplay}
                </span>
              </div>
              <p className="text-xs text-slate-500">Customer Billing Document</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 4 Invoice Types Switcher */}
          {showTypePicker && (
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Select Invoice Type
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                disabled={!isDraft}
                onClick={() => handleCategoryChange('cash')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 border ${
                  category === 'cash'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 disabled:opacity-60'
                }`}
              >
                
                <span>Cash Invoice</span>
              </button>

              <button
                type="button"
                disabled={!isDraft}
                onClick={() => handleCategoryChange('credit')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 border ${
                  category === 'credit'
                    ? 'bg-slate-600 text-white border-slate-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 disabled:opacity-60'
                }`}
              >
                
                <span>Credit Invoice</span>
              </button>

              <button
                type="button"
                disabled={!isDraft}
                onClick={() => handleCategoryChange('proforma')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 border ${
                  category === 'proforma'
                    ? 'bg-slate-600 text-white border-slate-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 disabled:opacity-60'
                }`}
              >
                
                <span>Proforma Invoice</span>
              </button>

              <button
                type="button"
                disabled={!isDraft}
                onClick={() => handleCategoryChange('progressive')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 border ${
                  category === 'progressive'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 disabled:opacity-60'
                }`}
              >
                
                <span>Progressive Invoice</span>
              </button>
            </div>
          </div>
          )}

          {/* CARD 1: INVOICE HEADER & PARTNER INFORMATION */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              INVOICE HEADER & PARTNER INFORMATION
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3.5 text-xs">
              {/* LEFT COLUMN */}
              <div className="space-y-3">
                {/* No of Subscription Items */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">No of Subscription Items</label>
                  <div className="col-span-3">
                    <input
                      type="number"
                      disabled={!isDraft}
                      value={noOfSubscriptionItems}
                      onChange={e => setNoOfSubscriptionItems(parseInt(e.target.value) || 0)}
                      className="w-24 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Subscription Invoice Switch */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Subscription Invoice</label>
                  <div className="col-span-3">
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
                </div>

                {/* Frequency */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Frequency</label>
                  <div className="col-span-3">
                    <select
                      disabled={!isDraft}
                      value={subscriptionFrequency}
                      onChange={e => setSubscriptionFrequency(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    >
                      <option value="One Year">One Year</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Semi-Annual">Semi-Annual</option>
                      <option value="Two Years">Two Years</option>
                    </select>
                  </div>
                </div>

                {/* Type */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Type</label>
                  <div className="col-span-3">
                    <select
                      disabled={!isDraft}
                      value={subscriptionType}
                      onChange={e => setSubscriptionType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    >
                      <option value="Vehicle Subscription">Vehicle Subscription</option>
                      <option value="Equipment Subscription">Equipment Subscription</option>
                      <option value="Software Subscription">Software Subscription</option>
                      <option value="Maintenance Retainer">Maintenance Retainer</option>
                    </select>
                  </div>
                </div>

                {/* Start Date */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Start Date</label>
                  <div className="col-span-3">
                    <input
                      type="text"
                      disabled={!isDraft}
                      value={subscriptionStartDate}
                      onChange={e => setSubscriptionStartDate(e.target.value)}
                      placeholder="02/01/2026"
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* End Date */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">End Date</label>
                  <div className="col-span-3">
                    <input
                      type="text"
                      disabled={!isDraft}
                      value={subscriptionEndDate}
                      onChange={e => setSubscriptionEndDate(e.target.value)}
                      placeholder="01/31/2027"
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Alert Date */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Alert Date</label>
                  <div className="col-span-3">
                    <input
                      type="text"
                      disabled={!isDraft}
                      value={subscriptionAlertDate}
                      onChange={e => setSubscriptionAlertDate(e.target.value)}
                      placeholder="12/31/2026"
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Customer */}
                <div className="grid grid-cols-5 items-start pt-1">
                  <label className="col-span-2 font-bold text-slate-700 pt-1">Customer</label>
                  <div className="col-span-3 space-y-1">
                    <input
                      type="text"
                      disabled={!isDraft}
                      value={partner}
                      onChange={e => setPartner(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                    <textarea
                      rows={3}
                      disabled={!isDraft}
                      value={customerAddress}
                      onChange={e => setCustomerAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-600 text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Project */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Project</label>
                  <div className="col-span-3">
                    <input
                      type="text"
                      disabled={!isDraft}
                      value={project}
                      onChange={e => setProject(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Contact Person */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Contact Person</label>
                  <div className="col-span-3">
                    <input
                      type="text"
                      disabled={!isDraft}
                      value={contactPerson}
                      onChange={e => setContactPerson(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Payment Terms */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Payment Terms</label>
                  <div className="col-span-3">
                    <select
                      disabled={!isDraft}
                      value={paymentTerms}
                      onChange={e => setPaymentTerms(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    >
                      <option value="On Completion">On Completion</option>
                      <option value="Immediate Payment">Immediate Payment</option>
                      <option value="15 Days Net">15 Days Net</option>
                      <option value="30 Days Net">30 Days Net</option>
                      <option value="60 Days">60 Days</option>
                    </select>
                  </div>
                </div>

                {/* Show Discount */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Show Discount</label>
                  <div className="col-span-3">
                    <input
                      type="checkbox"
                      disabled={!isDraft}
                      checked={showDiscount}
                      onChange={e => setShowDiscount(e.target.checked)}
                      className="rounded border-slate-300 text-slate-700 h-4 w-4"
                    />
                  </div>
                </div>

                {/* Vendor Project Name */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Vendor Project Name</label>
                  <div className="col-span-3">
                    <input
                      type="text"
                      disabled={!isDraft}
                      value={vendorProjectName}
                      onChange={e => setVendorProjectName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* PR Number */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">PR Number</label>
                  <div className="col-span-3">
                    <input
                      type="text"
                      disabled={!isDraft}
                      value={prNumber}
                      onChange={e => setPrNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* PO Number */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">PO Number</label>
                  <div className="col-span-3">
                    <input
                      type="text"
                      disabled={!isDraft}
                      value={poNumber}
                      onChange={e => setPoNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-3">
                {/* Invoice Date with Time */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Invoice Date with Time</label>
                  <div className="col-span-3 font-mono text-slate-700">{invoiceDateWithTime}</div>
                </div>

                {/* Invoice Date */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Invoice Date</label>
                  <div className="col-span-3">
                    <input
                      type="date"
                      disabled={!isDraft}
                      value={dateInvoice}
                      onChange={e => setDateInvoice(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Due Date */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Due Date</label>
                  <div className="col-span-3">
                    <input
                      type="text"
                      disabled={!isDraft}
                      value={dateDue}
                      onChange={e => setDateDue(e.target.value)}
                      placeholder="03/14/2026"
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Salesperson */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Salesperson</label>
                  <div className="col-span-3 text-slate-800 font-semibold">{salesperson}</div>
                </div>

                {/* Equipment Details Group Task */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Equipment Group Task</label>
                  <div className="col-span-3">
                    <select
                      disabled={!isDraft}
                      value={equipmentGroupTask}
                      onChange={e => setEquipmentGroupTask(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    >
                      <option value="Based On Main Task">Based On Main Task</option>
                      <option value="No Grouping">No Grouping</option>
                      <option value="By Task">By Task</option>
                      <option value="By Equipment">By Equipment</option>
                    </select>
                  </div>
                </div>

                {/* Source Document */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Source Document</label>
                  <div className="col-span-3">
                    <input
                      type="text"
                      disabled={!isDraft}
                      value={sourceDocument}
                      onChange={e => setSourceDocument(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Company Seal on Invoice */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Company Seal on Invoice</label>
                  <div className="col-span-3">
                    <input
                      type="checkbox"
                      disabled={!isDraft}
                      checked={companySeal}
                      onChange={e => setCompanySeal(e.target.checked)}
                      className="rounded border-slate-300 text-slate-700 h-4 w-4"
                    />
                  </div>
                </div>

                {/* Show Out from Stock Button */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Show Out from Stock</label>
                  <div className="col-span-3">
                    <input
                      type="checkbox"
                      disabled={!isDraft}
                      checked={showOutFromStock}
                      onChange={e => setShowOutFromStock(e.target.checked)}
                      className="rounded border-slate-300 text-slate-700 h-4 w-4"
                    />
                  </div>
                </div>

                {/* Is Progressive Inv. ? */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Is Progressive Inv. ?</label>
                  <div className="col-span-3">
                    <input
                      type="checkbox"
                      disabled={!isDraft}
                      checked={isProgressive}
                      onChange={e => {
                        setIsProgressive(e.target.checked)
                        if (e.target.checked) setCategory('progressive')
                      }}
                      className="rounded border-slate-300 text-slate-700 h-4 w-4"
                    />
                  </div>
                </div>

                {/* Sales Team */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Sales Team</label>
                  <div className="col-span-3">
                    <input
                      type="text"
                      disabled={!isDraft}
                      value={salesTeam}
                      onChange={e => setSalesTeam(e.target.value)}
                      placeholder="-"
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Currency */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Currency</label>
                  <div className="col-span-3">
                    <select
                      disabled={!isDraft}
                      value={currency}
                      onChange={e => handleCurrencyChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    >
                      {mockCurrencies.map(c => (
                        <option key={c.currency} value={c.currency}>
                          {c.currency} - {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Journal */}
                <div className="grid grid-cols-5 items-center">
                  <label className="col-span-2 font-bold text-slate-700">Journal</label>
                  <div className="col-span-3">
                    <input
                      type="text"
                      disabled
                      value={journalName}
                      className="w-full bg-slate-100 border border-slate-200 rounded px-2.5 py-1 text-slate-600 font-medium cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: INVOICE LINE ITEMS (PRODUCTS & SERVICES) */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
            {/* Tabs */}
            <div className="border-b border-slate-200 flex items-center justify-between">
              <div className="flex gap-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('lines')}
                  className={`pb-2 border-b-2 transition ${
                    activeTab === 'lines'
                      ? 'border-emerald-600 text-emerald-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Invoice Lines
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('other')}
                  className={`pb-2 border-b-2 transition ${
                    activeTab === 'other'
                      ? 'border-emerald-600 text-emerald-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Other Info
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('vehicles')}
                  className={`pb-2 border-b-2 transition flex items-center gap-1.5 ${
                    activeTab === 'vehicles'
                      ? 'border-emerald-600 text-emerald-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  
                  <span>Vehicles</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-normal">
                    {vehiclesList.length}
                  </span>
                </button>
              </div>

              {activeTab === 'lines' && isDraft && (
                <button
                  type="button"
                  onClick={addLine}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus size={13} /> Add Line Item
                </button>
              )}
            </div>

            {/* TAB 1: INVOICE LINES TABLE */}
            {activeTab === 'lines' && (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Main Task</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-2 text-center">Show Separately</th>
                        <th className="py-2.5 px-2 text-center">Show Line</th>
                        <th className="py-2.5 px-2 text-center">Main Quantity</th>
                        <th className="py-2.5 px-2">Partner Type</th>
                        <th className="py-2.5 px-3">Product SubType</th>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3 min-w-[150px]">Description</th>
                        <th className="py-2.5 px-3">Account</th>
                        <th className="py-2.5 px-3">Cost Centre / Analytic</th>
                        <th className="py-2.5 px-2 text-right">Main Qty</th>
                        <th className="py-2.5 px-2 text-right">Qty</th>
                        <th className="py-2.5 px-2">Unit</th>
                        <th className="py-2.5 px-3 text-right">Price</th>
                        <th className="py-2.5 px-2 text-center">Tax</th>
                        <th className="py-2.5 px-2 text-right">Discount</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                        {isDraft && <th className="py-2.5 px-1 w-7"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map(line => (
                        <tr key={line.id} className="hover:bg-slate-50/70 transition">
                          {/* Main Task */}
                          <td className="py-2 px-3">
                            {isDraft ? (
                              <input
                                type="text"
                                value={line.mainTask || ''}
                                onChange={e => updateLine(line.id, 'mainTask', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-24"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">{line.mainTask || '-'}</span>
                            )}
                          </td>

                          {/* Category */}
                          <td className="py-2 px-3">
                            {isDraft ? (
                              <input
                                type="text"
                                value={line.category || ''}
                                onChange={e => updateLine(line.id, 'category', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-20"
                              />
                            ) : (
                              <span className="text-slate-700">{line.category || '-'}</span>
                            )}
                          </td>

                          {/* Show Separately */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              disabled={!isDraft}
                              checked={line.showSeparately || false}
                              onChange={e => updateLine(line.id, 'showSeparately', e.target.checked)}
                              className="rounded border-slate-300 text-slate-700"
                            />
                          </td>

                          {/* Show Line */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              disabled={!isDraft}
                              checked={line.showLine || false}
                              onChange={e => updateLine(line.id, 'showLine', e.target.checked)}
                              className="rounded border-slate-300 text-slate-700"
                            />
                          </td>

                          {/* Show Main Quantity Checkbox */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              disabled={!isDraft}
                              checked={line.showMainQuantity || false}
                              onChange={e => updateLine(line.id, 'showMainQuantity', e.target.checked)}
                              className="rounded border-slate-300 text-slate-700"
                            />
                          </td>

                          {/* Partner Number Type */}
                          <td className="py-2 px-2">
                            {isDraft ? (
                              <input
                                type="text"
                                value={line.partnerNumberType || 'FAY'}
                                onChange={e => updateLine(line.id, 'partnerNumberType', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-16"
                              />
                            ) : (
                              <span className="font-semibold text-slate-700">{line.partnerNumberType || 'FAY'}</span>
                            )}
                          </td>

                          {/* Product SubType */}
                          <td className="py-2 px-3">
                            {isDraft ? (
                              <input
                                type="text"
                                value={line.productSubType || ''}
                                onChange={e => updateLine(line.id, 'productSubType', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-28"
                              />
                            ) : (
                              <span className="text-slate-700">{line.productSubType || '-'}</span>
                            )}
                          </td>

                          {/* Product */}
                          <td className="py-2 px-3">
                            {isDraft ? (
                              <input
                                type="text"
                                value={line.product}
                                onChange={e => updateLine(line.id, 'product', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold text-slate-900 w-28"
                              />
                            ) : (
                              <span className="font-bold text-slate-900">{line.product}</span>
                            )}
                          </td>

                          {/* Description */}
                          <td className="py-2 px-3">
                            {isDraft ? (
                              <input
                                type="text"
                                value={line.description}
                                onChange={e => updateLine(line.id, 'description', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-36"
                              />
                            ) : (
                              <span className="text-slate-700">{line.description}</span>
                            )}
                          </td>

                          {/* Account */}
                          <td className="py-2 px-3 font-mono text-slate-800 font-semibold">
                            {line.accountCode || '479100'}
                          </td>

                          {/* Cost Centre / Analytic Account */}
                          <td className="py-2 px-3">
                            {isDraft ? (
                              <select
                                value={line.analyticAccountId || ''}
                                onChange={e => updateLine(line.id, 'analyticAccountId', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-36"
                              >
                                <option value="">(None)</option>
                                {mockAnalyticAccounts.map(a => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} - {a.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-slate-700">{line.analyticAccountName || '-'}</span>
                            )}
                          </td>

                          {/* Main Qty */}
                          <td className="py-2 px-2 text-right font-mono">
                            {(line.mainQuantity || 1).toFixed(2)}
                          </td>

                          {/* Quantity */}
                          <td className="py-2 px-2 text-right">
                            {isDraft ? (
                              <input
                                type="number"
                                step="1"
                                value={line.quantity}
                                onChange={e => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-16 text-right font-mono"
                              />
                            ) : (
                              <span className="font-mono font-semibold">{line.quantity.toFixed(3)}</span>
                            )}
                          </td>

                          {/* Unit of Measure */}
                          <td className="py-2 px-2 font-mono text-slate-700">
                            {line.unitOfMeasure || 'pcs'}
                          </td>

                          {/* Price */}
                          <td className="py-2 px-3 text-right">
                            {isDraft ? (
                              <input
                                type="number"
                                step="0.001"
                                value={line.unitPrice}
                                onChange={e => updateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-24 text-right font-mono font-semibold"
                              />
                            ) : (
                              <span className="font-mono font-bold text-slate-900">{line.unitPrice.toFixed(3)}</span>
                            )}
                          </td>

                          {/* Tax */}
                          <td className="py-2 px-2 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-[11px]">
                              {line.taxesApplied || 'VAT 15%'}
                            </span>
                          </td>

                          {/* Discount */}
                          <td className="py-2 px-2 text-right font-mono text-slate-600">
                            {(line.discount || 0).toFixed(3)}
                          </td>

                          {/* Subtotal */}
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {line.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SR
                          </td>

                          {/* Remove */}
                          {isDraft && (
                            <td className="py-2 px-1 text-center">
                              <button
                                type="button"
                                onClick={() => removeLine(line.id)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                                title="Remove line"
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

                {/* Calculation Summary Row */}
                <div className="pt-2 flex justify-end">
                  <div className="w-full sm:w-80 bg-slate-50/80 p-5 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span className="font-medium">Amount Without Discount:</span>
                      <span className="font-mono font-semibold">
                        {amountWithoutDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SR
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="font-medium">Discount:</span>
                      <span className="font-mono font-semibold">
                        {discountTotal.toFixed(2)} SR
                      </span>
                    </div>
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
            )}

            {/* TAB 2: OTHER INFO */}
            {activeTab === 'other' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 font-medium block">Journal</span>
                    <span className="font-bold text-slate-800">Customer Invoices (Sale)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Account</span>
                    <span className="font-bold text-slate-800">479100 Revenue (Product Sales & Service)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Fiscal Position</span>
                    <span className="text-slate-700">Saudi Arabia National Tax (15%)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">ZATCA Clearance State</span>
                    <span className="font-semibold text-emerald-700">Cleared & Cryptographically Signed</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: VEHICLES */}
            {activeTab === 'vehicles' && (
              <div className="space-y-3">
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Plate Number</th>
                        <th className="py-2.5 px-3">Chassis Number</th>
                        <th className="py-2.5 px-3">Model</th>
                        <th className="py-2.5 px-3">GPS Device ID</th>
                        <th className="py-2.5 px-3">SIM Number</th>
                        {isDraft && <th className="py-2.5 px-2 w-7"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vehiclesList.map(veh => (
                        <tr key={veh.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-bold text-slate-800">{veh.plateNumber}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{veh.chassisNumber || '-'}</td>
                          <td className="py-2 px-3 text-slate-700">{veh.model || '-'}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{veh.gpsDeviceId || '-'}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{veh.simNumber || '-'}</td>
                          {isDraft && (
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => setVehiclesList(vehiclesList.filter(v => v.id !== veh.id))}
                                className="text-slate-400 hover:text-rose-600 p-1"
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

                {isDraft && (
                  <button
                    type="button"
                    onClick={() => {
                      const newVeh = {
                        id: `veh_${Date.now()}`,
                        plateNumber: `${Math.floor(1000 + Math.random() * 9000)}-KSA`,
                        chassisNumber: 'WDB2110261A993821',
                        model: 'Ford Ranger 4x4',
                        gpsDeviceId: '[FMC130] Teltonika',
                        simNumber: '0559001827',
                      }
                      setVehiclesList([...vehiclesList, newVeh])
                    }}
                    className="text-slate-700 hover:text-slate-900 text-xs font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <Plus size={14} /> Add a Vehicle
                  </button>
                )}
              </div>
            )}
          </div>

          {/* CARD: PAYMENTS & RECONCILIATION */}
          {invoice && !isDraft && invoice.state !== 'cancel' && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payments & Reconciliation</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${invoice.residual <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {invoice.residual <= 0 ? 'Fully settled' : 'Balance open'}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>Settled <b className="text-slate-800 font-mono">{moneyFormat(settled, invoice.currency)}</b></span>
                  <span>Due <b className="text-slate-800 font-mono">{moneyFormat(invoice.residual, invoice.currency)}</b></span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(settledPct)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${settledPct}%` }} />
                </div>
              </div>

              {invPayments.length === 0 ? (
                <p className="text-xs text-slate-400">
                  {invoice.residual <= 0 ? 'Settled directly (cash sale), with no separate payment to unreconcile.' : 'No payments matched yet. Use Reconciliation to match one.'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
                  {invPayments.map(p => (
                    <li key={p.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-slate-800">{p.paymentNumber}</div>
                        <div className="text-[11px] text-slate-500">{p.paymentDate} · {p.paymentMethod}{p.memo ? ` · ${p.memo}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-900">{moneyFormat(appliedTo(p), invoice.currency)}</span>
                        {onUnreconcile && (confirmUnrec === p.id ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500">Reopen this amount?</span>
                            <button type="button" onClick={() => { onUnreconcile(invoice.id, p.id); setConfirmUnrec(null) }} className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold">Yes, unreconcile</button>
                            <button type="button" onClick={() => setConfirmUnrec(null)} className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 font-semibold">Cancel</button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => setConfirmUnrec(p.id)} className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-rose-300 hover:text-rose-700 font-semibold transition">
                            Unreconcile
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Chatter */}
          {invoice && onPostNote && (
            <Chatter recordType="Invoice" recordId={invoice.id} recordName={invoice.number} logs={auditLogs} onPostNote={onPostNote} />
          )}
        </div>

        {/* Modal Drawer Footer */}
        <div className="bg-white px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition"
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
