import { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  FileCheck2,
  CheckCircle2,
  Coins,
  History,
  CreditCard,
  Layers,
  FileText,
  Calculator,
  Printer,
  ChevronDown,
  Send,
  Eye,
  ShieldCheck,
  Building,
  User,
  Calendar,
  DollarSign,
  Tag,
} from 'lucide-react'
import type { Invoice, InvoiceLine, CompanyId, InvoiceCategory } from '../types/accounting'
import { mockChartOfAccounts, mockAnalyticAccounts, mockCurrencies, moneyFormat } from '../data/mockAccountingData'

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
  existingInvoices,
  defaultCategory = 'credit',
  onClose,
  onSave,
}: InvoiceModalProps) {
  const [isEditing, setIsEditing] = useState(!invoice || invoice.state === 'draft')
  const isDraft = !invoice || invoice.state === 'draft'

  // Invoice Category
  const [category, setCategory] = useState<InvoiceCategory>(
    invoice?.category || defaultCategory
  )

  // Header Left Column Fields
  const [isSubscriptionInvoice, setIsSubscriptionInvoice] = useState<boolean>(
    invoice?.isSubscriptionInvoice ?? false
  )
  const [partner, setPartner] = useState(
    invoice?.partner || 'Al Yamama Company for Trading and Contracting'
  )
  const [customerAddress, setCustomerAddress] = useState(
    invoice?.customerAddress ||
      'الحارث بن مرة, الحارث بن مرة\nالأمير محمد بن سعود DMM 32241\n7507 5440\nSaudi Arabia - 300436215600003'
  )
  const [customerVat, setCustomerVat] = useState(invoice?.customerVat || '300436215600003')
  const [project, setProject] = useState(invoice?.project || '')
  const [contactPerson, setContactPerson] = useState(
    invoice?.contactPerson || 'Al Yamama Company for Trading and Contracting, Abdul Khadir'
  )
  const [paymentTerms, setPaymentTerms] = useState(invoice?.paymentTerms || '60 Days')
  const [showDiscount, setShowDiscount] = useState<boolean>(invoice?.showDiscount ?? false)
  const [vendorProjectName, setVendorProjectName] = useState(invoice?.vendorProjectName || '')
  const [prNumber, setPrNumber] = useState(invoice?.prNumber || '')
  const [poNumber, setPoNumber] = useState(invoice?.poNumber || 'PO not Received')

  // Header Right Column Fields
  const [invoiceDateWithTime, setInvoiceDateWithTime] = useState(
    invoice?.invoiceDateWithTime || '06/18/2026 12:42:06'
  )
  const [dateInvoice, setDateInvoice] = useState(invoice?.dateInvoice || '2026-06-21')
  const [dateDue, setDateDue] = useState(invoice?.dateDue || '2026-08-20')
  const [salesperson, setSalesperson] = useState(invoice?.salesperson || 'Administrator')
  const [equipmentGroupTask, setEquipmentGroupTask] = useState(
    invoice?.equipmentGroupTask || 'No Grouping'
  )
  const [sourceDocument, setSourceDocument] = useState(invoice?.sourceDocument || 'SO13060')
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

  // Progressive Milestone Attributes
  const [contractAmount, setContractAmount] = useState<number>(invoice?.contractAmount || 500000)
  const [previouslyBilled, setPreviouslyBilled] = useState<number>(invoice?.previouslyBilled || 150000)
  const [progressPercentage, setProgressPercentage] = useState<number>(invoice?.progressPercentage || 30)
  const [retainageAmount, setRetainageAmount] = useState<number>(invoice?.retainageAmount || 15000)

  // Tabs
  const [activeTab, setActiveTab] = useState<'lines' | 'other'>('lines')

  // Dropdown states for Print & Action
  const [printMenuOpen, setPrintMenuOpen] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [zatcaSuccess, setZatcaSuccess] = useState(false)

  // Lines
  const [lines, setLines] = useState<InvoiceLine[]>(
    invoice?.lines || [
      {
        id: 'ln_init_1',
        mainTask: 'Supply of',
        category: 'Supply',
        showSeparately: false,
        showLine: false,
        showMainQuantity: false,
        partnerNumberType: 'FAY',
        productSubType: 'Torquing - Bolt Torquing Work',
        product: '[RP25] Repair Kit',
        description:
          'Area: GCP-07 : All Charges for Bolt (Hydraulic) Torquing Work with Equipment in Flange Joint - Size-1 inch Sub Contracting charges for Piping Work',
        accountCode: '479100',
        accountName: 'Revenue (Product Sales & Service)',
        mainQuantity: 1.0,
        quantity: 125.0,
        unitOfMeasure: 'EA',
        unitPrice: 265.35,
        taxRate: 0.15,
        taxesApplied: 'VAT 15%',
        discount: 0.0,
        subtotal: 33169.0,
        taxAmount: 4975.35,
        total: 38144.35,
      },
    ]
  )

  // Category switch helper
  const handleCategoryChange = (newCat: InvoiceCategory) => {
    if (!isEditing && !isDraft) return
    setCategory(newCat)
    if (newCat === 'cash') {
      setPaymentTerms('Immediate Payment')
      setDateDue(dateInvoice)
      setIsProgressive(false)
    } else if (newCat === 'credit') {
      setPaymentTerms('60 Days')
      setIsProgressive(false)
    } else if (newCat === 'proforma') {
      setPaymentTerms('Advance / Proforma')
      setIsProgressive(false)
    } else if (newCat === 'progressive') {
      setPaymentTerms('30 Days Net')
      setIsProgressive(true)
    }
  }

  // Update line item
  const updateLine = (id: string, field: keyof InvoiceLine, value: any) => {
    if (!isEditing && !isDraft) return
    setLines(prev =>
      prev.map(l => {
        if (l.id !== id) return l
        const updated = { ...l, [field]: value }

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
    if (!isEditing && !isDraft) return
    const newLine: InvoiceLine = {
      id: `ln_${Date.now()}`,
      mainTask: isSubscriptionInvoice ? 'Annual Service Subscription' : 'Supply of',
      category: isSubscriptionInvoice ? 'Subscription' : 'Supply',
      showSeparately: false,
      showLine: false,
      showMainQuantity: false,
      partnerNumberType: 'FAY',
      productSubType: isSubscriptionInvoice ? 'Service - New Subscription' : 'General Maintenance',
      product: isSubscriptionInvoice ? 'Annual Service Subscription - 1 Year' : 'Spare Parts & Consumables',
      description: isSubscriptionInvoice ? 'Annual Service Subscription - 1 Year' : 'Workshop hydraulic service items',
      accountCode: isSubscriptionInvoice ? '479104' : '479100',
      accountName: isSubscriptionInvoice ? 'Revenue (Renewal)' : 'Revenue (Product Sales & Service)',
      mainQuantity: 1.0,
      quantity: 1.0,
      unitOfMeasure: 'EA',
      unitPrice: isSubscriptionInvoice ? 325.0 : 500.0,
      taxRate: 0.15,
      taxesApplied: 'VAT 15%',
      discount: 0.0,
      subtotal: isSubscriptionInvoice ? 325.0 : 500.0,
      taxAmount: isSubscriptionInvoice ? 48.75 : 75.0,
      total: isSubscriptionInvoice ? 373.75 : 575.0,
    }
    setLines(prev => [...prev, newLine])
  }

  const removeLine = (id: string) => {
    if (!isEditing && !isDraft) return
    if (lines.length <= 1) return
    setLines(prev => prev.filter(l => l.id !== id))
  }

  // Totals
  const amountWithoutDiscount = lines.reduce((acc, l) => acc + (Number(l.quantity) * Number(l.unitPrice) || 0), 0)
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
      const stamp = Math.floor(10000 + Math.random() * 90000)
      if (category === 'cash') nextNum = `CSH2026-${stamp}`
      else if (category === 'proforma') nextNum = `PRO2026-${stamp}`
      else if (category === 'progressive') nextNum = `PRG2026-${stamp}`
      else nextNum = `CRH2026-${stamp}`
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
      contractAmount: isProgressive ? contractAmount : undefined,
      previouslyBilled: isProgressive ? previouslyBilled : undefined,
      progressPercentage: isProgressive ? progressPercentage : undefined,
      retainageAmount: isProgressive ? retainageAmount : undefined,
      approvalStatus: 'approved',
      validatedBy: postImmediately ? 'Administrator' : invoice?.validatedBy,
      validatedAt: postImmediately ? new Date().toISOString().slice(0, 16).replace('T', ' ') : invoice?.validatedAt,
      type: 'out_invoice',
      attachmentsCount: 1,
    }

    onSave(updatedInvoice, postImmediately)
    setIsEditing(false)
  }

  const categoryLabel = 
    category === 'cash' ? 'Cash Invoices' :
    category === 'proforma' ? 'Proforma Invoices' :
    category === 'progressive' ? 'Progressive Invoices' :
    'Credit Invoices'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5">
      <div className="bg-slate-100 rounded-xl shadow-2xl border border-slate-300 w-full max-w-6xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Top Control Bar: Breadcrumb + Window Controls */}
        <div className="bg-white px-6 py-2.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">{categoryLabel} /</span>
            <span className="text-slate-900 font-bold">
              {invoice?.number || 'New Draft'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline">
              Entity: <strong className="text-slate-700">Flames of Al Yamama Trading Co</strong>
            </span>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action Toolbar (Matches Screenshot 3) */}
        <div className="bg-white px-6 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Left Action Buttons */}
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3.5 py-1 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded shadow-xs transition"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  className="px-3.5 py-1 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded shadow-xs transition"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded shadow-xs transition"
                >
                  Discard
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setLines([])
                addLine()
                setIsEditing(true)
              }}
              className="px-3.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded shadow-xs transition"
            >
              Create
            </button>

            {/* Print dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPrintMenuOpen(!printMenuOpen)}
                className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded shadow-xs inline-flex items-center gap-1 transition"
              >
                <span>Print</span>
                <ChevronDown size={12} />
              </button>
              {printMenuOpen && (
                <div className="absolute left-0 mt-1 w-44 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-20 text-xs">
                  <button
                    onClick={() => {
                      setPrintMenuOpen(false)
                      window.print()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 text-slate-700"
                  >
                    Original Tax Invoice (PDF)
                  </button>
                  <button
                    onClick={() => setPrintMenuOpen(false)}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 text-slate-700"
                  >
                    Commercial Duplicate
                  </button>
                  <button
                    onClick={() => setPrintMenuOpen(false)}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 text-slate-700"
                  >
                    Delivery Slip
                  </button>
                </div>
              )}
            </div>

            {/* Action dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActionMenuOpen(!actionMenuOpen)}
                className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded shadow-xs inline-flex items-center gap-1 transition"
              >
                <span>Action</span>
                <ChevronDown size={12} />
              </button>
              {actionMenuOpen && (
                <div className="absolute left-0 mt-1 w-36 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-20 text-xs">
                  <button
                    onClick={() => setActionMenuOpen(false)}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 text-slate-700"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => setActionMenuOpen(false)}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 text-rose-600"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Workflow Stepper on Right (Draft -> Open -> Paid) */}
          <div className="flex items-center gap-1 text-xs font-semibold">
            <span
              className={`px-3 py-0.5 rounded-l border ${
                invoice?.state === 'draft' || isDraft
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              Draft
            </span>
            <span
              className={`px-3 py-0.5 border-y ${
                invoice?.state === 'open'
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              Open
            </span>
            <span
              className={`px-3 py-0.5 rounded-r border ${
                invoice?.state === 'paid'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              Paid
            </span>
          </div>
        </div>

        {/* Workflow Action Bar (Matches Screenshot 3) */}
        <div className="bg-slate-50 px-6 py-2 border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleSave(true)}
            className="px-3 py-1 bg-teal-800 hover:bg-teal-900 text-white font-semibold rounded shadow-xs transition"
          >
            Send & Print
          </button>

          <button
            type="button"
            className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold rounded shadow-xs transition"
          >
            Add Credit Note
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold rounded shadow-xs transition"
          >
            Preview
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold rounded shadow-xs transition"
          >
            Cancel
          </button>

          {/* Teal Submit to ZATCA Button */}
          <button
            type="button"
            onClick={() => setZatcaSuccess(true)}
            className="px-3.5 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded shadow-xs transition flex items-center gap-1.5"
          >
            <ShieldCheck size={14} />
            <span>Submit to ZATCA</span>
          </button>

          {zatcaSuccess && (
            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 size={12} /> ZATCA Phase-2 Clearance Approved (Cryptographic Stamp Active)
            </span>
          )}
        </div>

        {/* Scrollable Document Sheet Form */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            {/* Title */}
            <div className="mb-6">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {invoice?.number || 'Draft Invoice'}
              </h1>
            </div>

            {/* Two Column Grid Fields (Matches Screenshots 1, 2, 3) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-4 gap-x-10 text-xs pb-6 border-b border-slate-200">
              {/* LEFT COLUMN */}
              <div className="space-y-3.5">
                {/* Subscription Invoice Switch */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Subscription Invoice</label>
                  <div className="col-span-2">
                    <button
                      type="button"
                      disabled={!isEditing}
                      onClick={() => setIsSubscriptionInvoice(!isSubscriptionInvoice)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isSubscriptionInvoice ? 'bg-teal-700' : 'bg-slate-300'
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

                {/* Customer */}
                <div className="grid grid-cols-3 items-start">
                  <label className="font-bold text-slate-700 pt-1.5">Customer</label>
                  <div className="col-span-2 space-y-1">
                    {isEditing ? (
                      <input
                        type="text"
                        value={partner}
                        onChange={e => setPartner(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-teal-700"
                        placeholder="Customer name..."
                      />
                    ) : (
                      <span className="text-teal-800 font-bold block">{partner}</span>
                    )}

                    {/* Customer Address Details in Arabic/English */}
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 leading-relaxed font-sans">
                      {isEditing ? (
                        <textarea
                          rows={3}
                          value={customerAddress}
                          onChange={e => setCustomerAddress(e.target.value)}
                          className="w-full bg-transparent border-0 p-0 text-slate-700 focus:outline-none resize-none"
                          placeholder="Customer address..."
                        />
                      ) : (
                        <div className="whitespace-pre-line">{customerAddress}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Project */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Project</label>
                  <div className="col-span-2">
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={project}
                      onChange={e => setProject(e.target.value)}
                      placeholder="Project reference / code..."
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                {/* Contact Person */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Contact Person</label>
                  <div className="col-span-2">
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={contactPerson}
                      onChange={e => setContactPerson(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                {/* Payment Terms */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Payment Terms</label>
                  <div className="col-span-2">
                    {isEditing ? (
                      <select
                        value={paymentTerms}
                        onChange={e => setPaymentTerms(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:ring-1 focus:ring-teal-700"
                      >
                        <option value="Immediate Payment">Immediate Payment</option>
                        <option value="15 Days Net">15 Days Net</option>
                        <option value="30 Days Net">30 Days Net</option>
                        <option value="60 Days">60 Days</option>
                        <option value="Advance / Proforma">Advance / Proforma</option>
                      </select>
                    ) : (
                      <span className="text-slate-800 font-medium">{paymentTerms}</span>
                    )}
                  </div>
                </div>

                {/* Show Discount */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Show Discount</label>
                  <div className="col-span-2">
                    <input
                      type="checkbox"
                      disabled={!isEditing}
                      checked={showDiscount}
                      onChange={e => setShowDiscount(e.target.checked)}
                      className="rounded border-slate-300 text-teal-700 h-4 w-4"
                    />
                  </div>
                </div>

                {/* Vendor Project Name */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Vendor Project Name</label>
                  <div className="col-span-2">
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={vendorProjectName}
                      onChange={e => setVendorProjectName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                {/* PR Number */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">PR Number</label>
                  <div className="col-span-2">
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={prNumber}
                      onChange={e => setPrNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent focus:ring-1 focus:ring-teal-700 font-mono"
                    />
                  </div>
                </div>

                {/* PO Number */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">PO Number</label>
                  <div className="col-span-2">
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={poNumber}
                      onChange={e => setPoNumber(e.target.value)}
                      placeholder="PO not Received"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent focus:ring-1 focus:ring-teal-700 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-3.5">
                {/* Invoice Date with Time */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Invoice Date with Time</label>
                  <div className="col-span-2 font-mono text-slate-700">
                    {invoiceDateWithTime}
                  </div>
                </div>

                {/* Invoice Date */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Invoice Date</label>
                  <div className="col-span-2">
                    {isEditing ? (
                      <input
                        type="date"
                        value={dateInvoice}
                        onChange={e => setDateInvoice(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:ring-1 focus:ring-teal-700"
                      />
                    ) : (
                      <span className="text-slate-800 font-medium">{dateInvoice}</span>
                    )}
                  </div>
                </div>

                {/* Due Date */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Due Date</label>
                  <div className="col-span-2">
                    {isEditing ? (
                      <input
                        type="date"
                        value={dateDue}
                        onChange={e => setDateDue(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:ring-1 focus:ring-teal-700"
                      />
                    ) : (
                      <span className="text-slate-800 font-medium">{dateDue}</span>
                    )}
                  </div>
                </div>

                {/* Salesperson */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Salesperson</label>
                  <div className="col-span-2 text-teal-800 font-semibold">
                    {salesperson}
                  </div>
                </div>

                {/* Equipment Details Group Task */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Equipment Details Group Task</label>
                  <div className="col-span-2">
                    {isEditing ? (
                      <select
                        value={equipmentGroupTask}
                        onChange={e => setEquipmentGroupTask(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:ring-1 focus:ring-teal-700"
                      >
                        <option value="No Grouping">No Grouping</option>
                        <option value="By Task">By Task</option>
                        <option value="By Equipment">By Equipment</option>
                      </select>
                    ) : (
                      <span className="text-slate-800 font-medium">{equipmentGroupTask}</span>
                    )}
                  </div>
                </div>

                {/* Source Document */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Source Document</label>
                  <div className="col-span-2">
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={sourceDocument}
                      onChange={e => setSourceDocument(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent focus:ring-1 focus:ring-teal-700 font-mono"
                    />
                  </div>
                </div>

                {/* Company Seal on Invoice */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Company Seal on Invoice</label>
                  <div className="col-span-2">
                    <input
                      type="checkbox"
                      disabled={!isEditing}
                      checked={companySeal}
                      onChange={e => setCompanySeal(e.target.checked)}
                      className="rounded border-slate-300 text-teal-700 h-4 w-4"
                    />
                  </div>
                </div>

                {/* Show Out from Stock Button */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Show Out from Stock Button</label>
                  <div className="col-span-2">
                    <input
                      type="checkbox"
                      disabled={!isEditing}
                      checked={showOutFromStock}
                      onChange={e => setShowOutFromStock(e.target.checked)}
                      className="rounded border-slate-300 text-teal-700 h-4 w-4"
                    />
                  </div>
                </div>

                {/* Is Progressive Inv. ? */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Is Progressive Inv. ?</label>
                  <div className="col-span-2">
                    <input
                      type="checkbox"
                      disabled={!isEditing}
                      checked={isProgressive}
                      onChange={e => {
                        setIsProgressive(e.target.checked)
                        if (e.target.checked) setCategory('progressive')
                      }}
                      className="rounded border-slate-300 text-teal-700 h-4 w-4"
                    />
                  </div>
                </div>

                {/* Sales Team */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Sales Team</label>
                  <div className="col-span-2">
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={salesTeam}
                      onChange={e => setSalesTeam(e.target.value)}
                      placeholder="e.g. Industrial Sales"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                {/* Currency */}
                <div className="grid grid-cols-3 items-center">
                  <label className="font-bold text-slate-700">Currency</label>
                  <div className="col-span-2">
                    {isEditing ? (
                      <select
                        value={currency}
                        onChange={e => setCurrency(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-semibold focus:ring-1 focus:ring-teal-700"
                      >
                        {mockCurrencies.map(c => (
                          <option key={c.currency} value={c.currency}>
                            {c.currency}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-bold text-slate-900">{currency}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Notebook Tabs: Invoice Lines | Other Info */}
            <div className="border-b border-slate-200 flex gap-4 text-xs font-bold my-4">
              <button
                type="button"
                onClick={() => setActiveTab('lines')}
                className={`pb-2 border-b-2 transition ${
                  activeTab === 'lines'
                    ? 'border-teal-700 text-teal-800'
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
                    ? 'border-teal-700 text-teal-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Other Info
              </button>
            </div>

            {/* TAB 1: INVOICE LINES TABLE (Matches Screenshots 1, 2, 3) */}
            {activeTab === 'lines' && (
              <div className="space-y-3">
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Main Task</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-2 text-center">Show Separately</th>
                        <th className="py-2.5 px-2 text-center">Show Line</th>
                        <th className="py-2.5 px-2 text-center">Main Quantity</th>
                        <th className="py-2.5 px-2">Partner Number Type</th>
                        <th className="py-2.5 px-3">Product SubType</th>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Description</th>
                        <th className="py-2.5 px-3">Account</th>
                        <th className="py-2.5 px-3">Analytic Account</th>
                        <th className="py-2.5 px-2 text-right">Main Qty</th>
                        <th className="py-2.5 px-2 text-right">Quantity</th>
                        <th className="py-2.5 px-2">Unit of Measure</th>
                        <th className="py-2.5 px-3 text-right">Price</th>
                        <th className="py-2.5 px-2 text-center">Taxes</th>
                        <th className="py-2.5 px-2 text-right">Discount</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                        {isEditing && <th className="py-2.5 px-1 w-7"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map(line => (
                        <tr key={line.id} className="hover:bg-slate-50/70">
                          {/* Main Task */}
                          <td className="py-2 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={line.mainTask || ''}
                                onChange={e => updateLine(line.id, 'mainTask', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-28"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">{line.mainTask || '-'}</span>
                            )}
                          </td>

                          {/* Category */}
                          <td className="py-2 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={line.category || ''}
                                onChange={e => updateLine(line.id, 'category', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-24"
                              />
                            ) : (
                              <span className="text-slate-700">{line.category || '-'}</span>
                            )}
                          </td>

                          {/* Show Separately */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              disabled={!isEditing}
                              checked={line.showSeparately || false}
                              onChange={e => updateLine(line.id, 'showSeparately', e.target.checked)}
                              className="rounded border-slate-300 text-teal-700"
                            />
                          </td>

                          {/* Show Line */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              disabled={!isEditing}
                              checked={line.showLine || false}
                              onChange={e => updateLine(line.id, 'showLine', e.target.checked)}
                              className="rounded border-slate-300 text-teal-700"
                            />
                          </td>

                          {/* Main Quantity Checkbox */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              disabled={!isEditing}
                              checked={line.showMainQuantity || false}
                              onChange={e => updateLine(line.id, 'showMainQuantity', e.target.checked)}
                              className="rounded border-slate-300 text-teal-700"
                            />
                          </td>

                          {/* Partner Number Type */}
                          <td className="py-2 px-2">
                            {isEditing ? (
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
                            {isEditing ? (
                              <input
                                type="text"
                                value={line.productSubType || ''}
                                onChange={e => updateLine(line.id, 'productSubType', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-36"
                              />
                            ) : (
                              <span className="text-slate-700">{line.productSubType || '-'}</span>
                            )}
                          </td>

                          {/* Product */}
                          <td className="py-2 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={line.product}
                                onChange={e => updateLine(line.id, 'product', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold text-slate-900 w-44"
                              />
                            ) : (
                              <span className="font-bold text-slate-900">{line.product}</span>
                            )}
                          </td>

                          {/* Description */}
                          <td className="py-2 px-3 max-w-xs whitespace-normal">
                            {isEditing ? (
                              <textarea
                                rows={2}
                                value={line.description}
                                onChange={e => updateLine(line.id, 'description', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-full min-w-[220px]"
                              />
                            ) : (
                              <span className="text-slate-600 block line-clamp-2">{line.description}</span>
                            )}
                          </td>

                          {/* Account */}
                          <td className="py-2 px-3">
                            <span className="text-slate-800 font-semibold">
                              {line.accountCode || '479100'} {line.accountName || 'Revenue'}
                            </span>
                          </td>

                          {/* Analytic Account */}
                          <td className="py-2 px-3">
                            {isEditing ? (
                              <select
                                value={line.analyticAccountId || ''}
                                onChange={e => updateLine(line.id, 'analyticAccountId', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-32"
                              >
                                <option value="">(None)</option>
                                {mockAnalyticAccounts.map(a => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-slate-600">
                                {mockAnalyticAccounts.find(a => a.id === line.analyticAccountId)?.name || '-'}
                              </span>
                            )}
                          </td>

                          {/* Main Qty */}
                          <td className="py-2 px-2 text-right font-mono">
                            {(line.mainQuantity || 1).toFixed(2)}
                          </td>

                          {/* Quantity */}
                          <td className="py-2 px-2 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                step="1"
                                value={line.quantity}
                                onChange={e => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-20 text-right font-mono"
                              />
                            ) : (
                              <span className="font-mono font-semibold">{line.quantity.toFixed(3)}</span>
                            )}
                          </td>

                          {/* Unit of Measure */}
                          <td className="py-2 px-2 font-mono text-slate-700">
                            {line.unitOfMeasure || 'EA'}
                          </td>

                          {/* Price */}
                          <td className="py-2 px-3 text-right">
                            {isEditing ? (
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

                          {/* Taxes */}
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
                          {isEditing && (
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

                {/* Add a line link */}
                {isEditing && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={addLine}
                      className="text-teal-700 hover:text-teal-900 text-xs font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <Plus size={14} /> Add a line
                    </button>
                  </div>
                )}

                {/* Summary Section on Bottom Right (Matches Screenshots 1, 2, 3) */}
                <div className="pt-4 flex justify-end">
                  <div className="w-80 space-y-2 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span className="font-bold">Amount Without Discount:</span>
                      <span className="font-mono font-semibold">
                        {amountWithoutDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SR
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="font-bold">Discount:</span>
                      <span className="font-mono font-semibold">
                        {discountTotal.toFixed(2)} SR
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="font-bold">Untaxed Amount:</span>
                      <span className="font-mono font-semibold">
                        {untaxedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SR
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="font-bold">Taxes (VAT 15%):</span>
                      <span className="font-mono font-semibold">
                        {taxTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SR
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-300 flex justify-between font-bold text-sm text-slate-900">
                      <span>Total:</span>
                      <span className="font-mono font-black text-teal-800">
                        {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SR
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: OTHER INFO */}
            {activeTab === 'other' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded text-xs space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 font-medium block">Journal</span>
                    <span className="font-bold text-slate-800">Customer Invoices (SAR)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Account</span>
                    <span className="font-bold text-slate-800">120010 Account Receivables</span>
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
          </div>
        </div>
      </div>
    </div>
  )
}
