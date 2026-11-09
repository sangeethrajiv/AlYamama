import { useState } from 'react'
import {
  X,
  Plus,
  Trash2,
  Car,
  Layers,
  CheckCircle2,
} from 'lucide-react'
import type { Invoice, InvoiceLine, CompanyId, InvoiceCategory } from '../types/accounting'
import { mockAnalyticAccounts, mockCurrencies } from '../data/mockAccountingData'

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

  // Top Left Fields
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

  // Top Right Fields
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

  // Tabs: Invoice Lines | Other Info | Vehicles
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

  // Update line item
  const updateLine = (id: string, field: keyof InvoiceLine, value: any) => {
    if (!isDraft) return
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
      attachmentsCount: 1,
      vehicles: vehiclesList,
    }

    onSave(updatedInvoice, postImmediately)
  }

  const invoiceTitle = invoice?.number ? invoice.number : 'Draft Invoice'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-6xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Top Header Bar with Close X */}
        <div className="bg-white px-6 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Customer Invoices /</span>
            <span className="text-slate-900 font-bold">{invoiceTitle}</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body (Matches Exact Layout in Screenshot 1 & 2) */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          {/* Main Title Header */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {invoiceTitle}
            </h1>
          </div>

          {/* Two-Column Form Layout Matching Screenshot 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-3.5 gap-x-12 text-xs">
            {/* LEFT COLUMN */}
            <div className="space-y-3">
              {/* No of Subscription Items */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">
                  No of Subscription Items
                </label>
                <div className="col-span-7">
                  {isDraft ? (
                    <input
                      type="number"
                      value={noOfSubscriptionItems}
                      onChange={e => setNoOfSubscriptionItems(parseInt(e.target.value) || 0)}
                      className="w-24 bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                    />
                  ) : (
                    <span className="text-slate-800">{noOfSubscriptionItems}</span>
                  )}
                </div>
              </div>

              {/* Subscription Invoice Toggle */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">
                  Subscription Invoice
                </label>
                <div className="col-span-7">
                  <button
                    type="button"
                    disabled={!isDraft}
                    onClick={() => setIsSubscriptionInvoice(!isSubscriptionInvoice)}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
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

              {/* Frequency */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Frequency</label>
                <div className="col-span-7">
                  {isDraft ? (
                    <select
                      value={subscriptionFrequency}
                      onChange={e => setSubscriptionFrequency(e.target.value)}
                      className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                    >
                      <option value="One Year">One Year</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Semi-Annual">Semi-Annual</option>
                      <option value="Two Years">Two Years</option>
                    </select>
                  ) : (
                    <span className="text-slate-800">{subscriptionFrequency}</span>
                  )}
                </div>
              </div>

              {/* Type */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Type</label>
                <div className="col-span-7">
                  {isDraft ? (
                    <select
                      value={subscriptionType}
                      onChange={e => setSubscriptionType(e.target.value)}
                      className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                    >
                      <option value="Vehicle Subscription">Vehicle Subscription</option>
                      <option value="Equipment Subscription">Equipment Subscription</option>
                      <option value="Software Subscription">Software Subscription</option>
                      <option value="Maintenance Retainer">Maintenance Retainer</option>
                    </select>
                  ) : (
                    <span className="text-slate-800">{subscriptionType}</span>
                  )}
                </div>
              </div>

              {/* Start Date */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Start Date</label>
                <div className="col-span-7">
                  {isDraft ? (
                    <input
                      type="text"
                      value={subscriptionStartDate}
                      onChange={e => setSubscriptionStartDate(e.target.value)}
                      placeholder="02/01/2026"
                      className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                    />
                  ) : (
                    <span className="text-slate-800">{subscriptionStartDate}</span>
                  )}
                </div>
              </div>

              {/* End Date */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">End Date</label>
                <div className="col-span-7">
                  {isDraft ? (
                    <input
                      type="text"
                      value={subscriptionEndDate}
                      onChange={e => setSubscriptionEndDate(e.target.value)}
                      placeholder="01/31/2027"
                      className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                    />
                  ) : (
                    <span className="text-slate-800">{subscriptionEndDate}</span>
                  )}
                </div>
              </div>

              {/* Alert Date */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Alert Date</label>
                <div className="col-span-7">
                  {isDraft ? (
                    <input
                      type="text"
                      value={subscriptionAlertDate}
                      onChange={e => setSubscriptionAlertDate(e.target.value)}
                      placeholder="12/31/2026"
                      className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                    />
                  ) : (
                    <span className="text-slate-800">{subscriptionAlertDate}</span>
                  )}
                </div>
              </div>

              {/* Customer with Multi-line Address */}
              <div className="grid grid-cols-12 items-start pt-2">
                <label className="col-span-5 font-bold text-slate-700 pt-1">Customer</label>
                <div className="col-span-7 space-y-1">
                  {isDraft ? (
                    <input
                      type="text"
                      value={partner}
                      onChange={e => setPartner(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-teal-800 font-semibold"
                    />
                  ) : (
                    <span className="text-teal-800 font-bold block">{partner}</span>
                  )}

                  <div className="text-[11px] text-slate-600 leading-relaxed font-sans pt-0.5">
                    {isDraft ? (
                      <textarea
                        rows={4}
                        value={customerAddress}
                        onChange={e => setCustomerAddress(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-700 text-xs resize-none"
                      />
                    ) : (
                      <div className="whitespace-pre-line">{customerAddress}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Project */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Project</label>
                <div className="col-span-7">
                  <input
                    type="text"
                    disabled={!isDraft}
                    value={project}
                    onChange={e => setProject(e.target.value)}
                    className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent"
                  />
                </div>
              </div>

              {/* Contact Person */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Contact Person</label>
                <div className="col-span-7">
                  <input
                    type="text"
                    disabled={!isDraft}
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                    className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent"
                  />
                </div>
              </div>

              {/* Payment Terms */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Payment Terms</label>
                <div className="col-span-7">
                  {isDraft ? (
                    <select
                      value={paymentTerms}
                      onChange={e => setPaymentTerms(e.target.value)}
                      className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-teal-800 font-semibold"
                    >
                      <option value="On Completion">On Completion</option>
                      <option value="Immediate Payment">Immediate Payment</option>
                      <option value="15 Days Net">15 Days Net</option>
                      <option value="30 Days Net">30 Days Net</option>
                      <option value="60 Days">60 Days</option>
                    </select>
                  ) : (
                    <span className="text-teal-800 font-semibold">{paymentTerms}</span>
                  )}
                </div>
              </div>

              {/* Show Discount */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Show Discount</label>
                <div className="col-span-7">
                  <input
                    type="checkbox"
                    disabled={!isDraft}
                    checked={showDiscount}
                    onChange={e => setShowDiscount(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700 h-4 w-4"
                  />
                </div>
              </div>

              {/* Vendor Project Name */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">
                  Vendor Project Name
                </label>
                <div className="col-span-7">
                  <input
                    type="text"
                    disabled={!isDraft}
                    value={vendorProjectName}
                    onChange={e => setVendorProjectName(e.target.value)}
                    className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent"
                  />
                </div>
              </div>

              {/* PR Number */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">PR Number</label>
                <div className="col-span-7">
                  <input
                    type="text"
                    disabled={!isDraft}
                    value={prNumber}
                    onChange={e => setPrNumber(e.target.value)}
                    className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent font-mono"
                  />
                </div>
              </div>

              {/* PO Number */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">PO Number</label>
                <div className="col-span-7">
                  <input
                    type="text"
                    disabled={!isDraft}
                    value={poNumber}
                    onChange={e => setPoNumber(e.target.value)}
                    className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent font-mono"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-3">
              {/* Invoice Date with Time */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">
                  Invoice Date with Time
                </label>
                <div className="col-span-7 font-mono text-slate-700">
                  {invoiceDateWithTime}
                </div>
              </div>

              {/* Invoice Date */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Invoice Date</label>
                <div className="col-span-7">
                  {isDraft ? (
                    <input
                      type="date"
                      value={dateInvoice}
                      onChange={e => setDateInvoice(e.target.value)}
                      className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                    />
                  ) : (
                    <span className="text-slate-800">{dateInvoice}</span>
                  )}
                </div>
              </div>

              {/* Due Date */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Due Date</label>
                <div className="col-span-7">
                  {isDraft ? (
                    <input
                      type="text"
                      value={dateDue}
                      onChange={e => setDateDue(e.target.value)}
                      placeholder="03/14/2026"
                      className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                    />
                  ) : (
                    <span className="text-slate-800">{dateDue}</span>
                  )}
                </div>
              </div>

              {/* Salesperson */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Salesperson</label>
                <div className="col-span-7 text-teal-800 font-semibold">
                  {salesperson}
                </div>
              </div>

              {/* Equipment Details Group Task */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">
                  Equipment Details Group Task
                </label>
                <div className="col-span-7">
                  {isDraft ? (
                    <select
                      value={equipmentGroupTask}
                      onChange={e => setEquipmentGroupTask(e.target.value)}
                      className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                    >
                      <option value="Based On Main Task">Based On Main Task</option>
                      <option value="No Grouping">No Grouping</option>
                      <option value="By Task">By Task</option>
                      <option value="By Equipment">By Equipment</option>
                    </select>
                  ) : (
                    <span className="text-slate-800">{equipmentGroupTask}</span>
                  )}
                </div>
              </div>

              {/* Source Document */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">
                  Source Document
                </label>
                <div className="col-span-7">
                  {isDraft ? (
                    <input
                      type="text"
                      value={sourceDocument}
                      onChange={e => setSourceDocument(e.target.value)}
                      className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-mono"
                    />
                  ) : (
                    <span className="font-mono text-slate-800">{sourceDocument}</span>
                  )}
                </div>
              </div>

              {/* Company Seal on Invoice */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">
                  Company Seal on Invoice
                </label>
                <div className="col-span-7">
                  <input
                    type="checkbox"
                    disabled={!isDraft}
                    checked={companySeal}
                    onChange={e => setCompanySeal(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700 h-4 w-4"
                  />
                </div>
              </div>

              {/* Show Out from Stock Button */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">
                  Show Out from Stock Button
                </label>
                <div className="col-span-7">
                  <input
                    type="checkbox"
                    disabled={!isDraft}
                    checked={showOutFromStock}
                    onChange={e => setShowOutFromStock(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700 h-4 w-4"
                  />
                </div>
              </div>

              {/* Is Progressive Inv. ? */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">
                  Is Progressive Inv. ?
                </label>
                <div className="col-span-7">
                  <input
                    type="checkbox"
                    disabled={!isDraft}
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
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Sales Team</label>
                <div className="col-span-7">
                  <input
                    type="text"
                    disabled={!isDraft}
                    value={salesTeam}
                    onChange={e => setSalesTeam(e.target.value)}
                    placeholder="-"
                    className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 disabled:bg-transparent disabled:border-transparent"
                  />
                </div>
              </div>

              {/* Currency */}
              <div className="grid grid-cols-12 items-center">
                <label className="col-span-5 font-bold text-slate-700">Currency</label>
                <div className="col-span-7">
                  {isDraft ? (
                    <select
                      value={currency}
                      onChange={e => {
                        setCurrency(e.target.value)
                        const match = mockCurrencies.find(c => c.currency === e.target.value)
                        if (match) setCurrencyRate(match.rateToBase)
                      }}
                      className="w-full max-w-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-bold"
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

          {/* Form Tabs: Invoice Lines | Other Info | Vehicles */}
          <div className="border-b border-slate-200 flex gap-4 text-xs font-bold pt-4">
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
            <button
              type="button"
              onClick={() => setActiveTab('vehicles')}
              className={`pb-2 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'vehicles'
                  ? 'border-teal-700 text-teal-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Car size={14} />
              <span>Vehicles</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-normal">
                {vehiclesList.length}
              </span>
            </button>
          </div>

          {/* TAB 1: INVOICE LINES TABLE (Matches Exact Screenshot 2 Columns) */}
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
                      <th className="py-2.5 px-3 min-w-[150px]">Description</th>
                      <th className="py-2.5 px-3">Account</th>
                      <th className="py-2.5 px-3">Analytic Account</th>
                      <th className="py-2.5 px-2 text-right">Main Qty</th>
                      <th className="py-2.5 px-2 text-right">Quantity</th>
                      <th className="py-2.5 px-2">Unit of Measure</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-2 text-center">Taxes</th>
                      <th className="py-2.5 px-2 text-right">Discount</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      {isDraft && <th className="py-2.5 px-1 w-7"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map(line => (
                      <tr key={line.id} className="hover:bg-slate-50/70">
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
                            className="rounded border-slate-300 text-teal-700"
                          />
                        </td>

                        {/* Show Line */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            disabled={!isDraft}
                            checked={line.showLine || false}
                            onChange={e => updateLine(line.id, 'showLine', e.target.checked)}
                            className="rounded border-slate-300 text-teal-700"
                          />
                        </td>

                        {/* Main Quantity Checkbox */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            disabled={!isDraft}
                            checked={line.showMainQuantity || false}
                            onChange={e => updateLine(line.id, 'showMainQuantity', e.target.checked)}
                            className="rounded border-slate-300 text-teal-700"
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
                        <td className="py-2 px-3">
                          <span className="text-slate-800 font-semibold font-mono">
                            {line.accountCode || '479100'}
                          </span>
                        </td>

                        {/* Analytic Account */}
                        <td className="py-2 px-3">
                          {isDraft ? (
                            <select
                              value={line.analyticAccountId || ''}
                              onChange={e => updateLine(line.id, 'analyticAccountId', e.target.value)}
                              className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs w-28"
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

              {/* Add a line */}
              {isDraft && (
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

              {/* Bottom Right Totals Box */}
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

          {/* TAB 3: VEHICLES TAB */}
          {activeTab === 'vehicles' && (
            <div className="space-y-3">
              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
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
                        <td className="py-2 px-3 font-bold text-teal-800">{veh.plateNumber}</td>
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
                  className="text-teal-700 hover:text-teal-900 text-xs font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <Plus size={14} /> Add a Vehicle
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer (No Print, No Action, No Send & Print) */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-semibold transition"
          >
            Close
          </button>

          {isDraft && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSave(false)}
                className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded text-xs font-semibold transition"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <CheckCircle2 size={14} />
                <span>Validate & Post</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
