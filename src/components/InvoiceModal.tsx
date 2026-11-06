import { useState, useId } from 'react'
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  FileCheck2,
  Paperclip,
  CheckCircle2,
  Coins,
  History,
} from 'lucide-react'
import type { Invoice, InvoiceLine, CompanyId } from '../types/accounting'
import { mockAnalyticAccounts, mockCurrencies, moneyFormat } from '../data/mockAccountingData'

interface InvoiceModalProps {
  invoice?: Invoice
  companyId: CompanyId
  existingInvoices: Invoice[]
  onClose: () => void
  onSave: (invoice: Invoice, postImmediately?: boolean) => void
}

export default function InvoiceModal({
  invoice,
  companyId,
  existingInvoices,
  onClose,
  onSave,
}: InvoiceModalProps) {
  const isEditing = Boolean(invoice)
  const isDraft = !invoice || invoice.state === 'draft'

  // Form State
  const [partner, setPartner] = useState(invoice?.partner || 'Al-Yamama Steel Industries')
  const [customerVat, setCustomerVat] = useState(invoice?.customerVat || '300184920100003')
  const [dateInvoice, setDateInvoice] = useState(invoice?.dateInvoice || '2026-11-06')
  const [dateDue, setDateDue] = useState(invoice?.dateDue || '2026-11-20')
  const [paymentTerms, setPaymentTerms] = useState(invoice?.paymentTerms || '15 Days Net')
  const [reference, setReference] = useState(invoice?.reference || '')
  const [currency, setCurrency] = useState(invoice?.currency || 'SAR')
  const [currencyRate, setCurrencyRate] = useState(invoice?.currencyRate || 1.0)
  const [attachmentsCount, setAttachmentsCount] = useState(invoice?.attachmentsCount || 1)

  // Lines
  const [lines, setLines] = useState<InvoiceLine[]>(
    invoice?.lines || [
      {
        id: 'ln_init_1',
        product: 'HYD-CYL-SVC',
        description: 'Complete Disassembly, Cleaning, Honing & Rod Seal Replacement (Heavy Duty 400mm)',
        quantity: 1,
        unitPrice: 24500.00,
        taxRate: 0.15,
        subtotal: 24500.00,
        taxAmount: 3675.00,
        total: 28175.00,
        analyticAccountId: 'ana_1',
      },
    ]
  )

  // Duplicate warning detection (§4.1.1 INV-010)
  const isDuplicate = existingInvoices.some(
    inv =>
      inv.id !== invoice?.id &&
      inv.partner.trim().toLowerCase() === partner.trim().toLowerCase() &&
      inv.reference &&
      reference &&
      inv.reference.trim().toLowerCase() === reference.trim().toLowerCase()
  )

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
        const qty = Number(updated.quantity) || 0
        const price = Number(updated.unitPrice) || 0
        const taxR = Number(updated.taxRate) || 0
        const sub = qty * price
        const tax = sub * taxR
        return {
          ...updated,
          subtotal: sub,
          taxAmount: tax,
          total: sub + tax,
        }
      })
    )
  }

  const addLine = () => {
    if (!isDraft) return
    const newLine: InvoiceLine = {
      id: `ln_${Date.now()}`,
      product: 'PARTS-HYD-SEAL',
      description: 'Hallite High Pressure Polyurethane Piston Seal Ring Set',
      quantity: 1,
      unitPrice: 3200.00,
      taxRate: 0.15,
      subtotal: 3200.00,
      taxAmount: 480.00,
      total: 3680.00,
      analyticAccountId: 'ana_1',
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

  const handleSave = (postImmediately = false) => {
    if (!partner.trim() || grandTotal <= 0) {
      alert('Please enter a customer and at least one valid invoice line.')
      return
    }

    const nextSeq = invoice?.number || `INV/2026/${Math.floor(1000 + Math.random() * 9000)}`
    const isHighValue = grandTotal >= 200000

    const updatedInvoice: Invoice = {
      id: invoice?.id || `inv_${Date.now()}`,
      number: nextSeq,
      companyId: invoice?.companyId || companyId,
      partner,
      customerVat,
      dateInvoice,
      dateDue,
      paymentTerms,
      journalId: 'jour_sale',
      currency,
      currencyRate,
      reference,
      lines,
      amountUntaxed: untaxedTotal,
      amountTax: taxTotal,
      amountTotal: grandTotal,
      residual: invoice?.residual !== undefined ? (invoice.state === 'draft' ? grandTotal : invoice.residual) : grandTotal,
      state: postImmediately ? 'open' : (invoice?.state || 'draft'),
      approvalStatus: isHighValue ? 'pending_director' : (grandTotal >= 50000 ? 'pending_manager' : 'approved'),
      validatedBy: postImmediately ? 'Current User' : invoice?.validatedBy,
      validatedAt: postImmediately ? new Date().toISOString().replace('T', ' ').slice(0, 16) : invoice?.validatedAt,
      type: invoice?.type || 'out_invoice',
      attachmentsCount,
    }

    onSave(updatedInvoice, postImmediately)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-50 animate-in fade-in">
      <div className="bg-slate-50 w-full max-w-4xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
              <FileCheck2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-800">
                  {invoice ? `Customer Invoice: ${invoice.number}` : 'New Customer Invoice'}
                </h2>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">
                  {invoice?.state || 'draft'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Customer Billing Document
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Duplicate detection warning banner */}
        {isDuplicate && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-2 text-xs text-amber-900 font-semibold">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
            <span>
              Duplicate Warning: Another invoice with customer "{partner}" and reference "{reference}" already exists!
            </span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Attributes Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Invoice Header & Partner Information
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Customer / Partner *</label>
                <input
                  type="text"
                  value={partner}
                  disabled={!isDraft}
                  onChange={e => setPartner(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-70"
                  placeholder="Customer name"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Customer VAT Number</label>
                <input
                  type="text"
                  value={customerVat}
                  disabled={!isDraft}
                  onChange={e => setCustomerVat(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono disabled:opacity-70"
                  placeholder="300000000000003"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Customer PO Reference</label>
                <input
                  type="text"
                  value={reference}
                  disabled={!isDraft}
                  onChange={e => setReference(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 disabled:opacity-70"
                  placeholder="PO-2026-XXXX"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Invoice Date *</label>
                <input
                  type="date"
                  value={dateInvoice}
                  disabled={!isDraft}
                  onChange={e => setDateInvoice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 disabled:opacity-70"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Payment Terms</label>
                <select
                  value={paymentTerms}
                  disabled={!isDraft}
                  onChange={e => setPaymentTerms(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 disabled:opacity-70"
                >
                  <option>Immediate Payment</option>
                  <option>15 Days Net</option>
                  <option>30 Days Net</option>
                  <option>60 Days Net</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Due Date</label>
                <input
                  type="date"
                  value={dateDue}
                  disabled={!isDraft}
                  onChange={e => setDateDue(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 disabled:opacity-70"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1 flex items-center justify-between">
                  <span>Currency</span>
                  <Coins size={12} className="text-emerald-600" />
                </label>
                <select
                  value={currency}
                  disabled={!isDraft}
                  onChange={e => handleCurrencyChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold disabled:opacity-70"
                >
                  {mockCurrencies.map(c => (
                    <option key={c.currency} value={c.currency}>
                      {c.currency} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Exchange Rate to SAR</label>
                <input
                  type="number"
                  step="0.0001"
                  value={currencyRate}
                  disabled={!isDraft || currency === 'SAR'}
                  onChange={e => setCurrencyRate(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono disabled:opacity-70"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Journal</label>
                <input
                  type="text"
                  disabled
                  value="Customer Invoices (Sale)"
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Invoice Line Items (Products & Services)
                </span>
                <p className="text-[11px] text-slate-500">
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

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-y border-slate-200">
                    <th className="py-2.5 px-3">Product / Service</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-2 w-20 text-right">Qty</th>
                    <th className="py-2.5 px-3 w-28 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 w-24 text-center">Tax</th>
                    <th className="py-2.5 px-3 w-44">Cost Centre</th>
                    <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
                    {isDraft && <th className="py-2.5 px-2 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l, index) => (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={l.product}
                          disabled={!isDraft}
                          onChange={e => updateLine(l.id, 'product', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono font-semibold text-[11px]"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={l.description}
                          disabled={!isDraft}
                          onChange={e => updateLine(l.id, 'description', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px]"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min="1"
                          value={l.quantity}
                          disabled={!isDraft}
                          onChange={e => updateLine(l.id, 'quantity', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right font-mono text-[11px]"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={l.unitPrice}
                          disabled={!isDraft}
                          onChange={e => updateLine(l.id, 'unitPrice', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right font-mono text-[11px]"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <select
                          value={l.taxRate}
                          disabled={!isDraft}
                          onChange={e => updateLine(l.id, 'taxRate', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px] font-semibold"
                        >
                          <option value={0.15}>15% VAT</option>
                          <option value={0.0}>0% Zero</option>
                          <option value={0.0}>Exempt</option>
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={l.analyticAccountId || 'ana_1'}
                          disabled={!isDraft}
                          onChange={e => updateLine(l.id, 'analyticAccountId', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px]"
                        >
                          {mockAnalyticAccounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                        {moneyFormat(l.subtotal, currency)}
                      </td>
                      {isDraft && (
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(l.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
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

            {/* Calculations & Summary Section */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between gap-6">
              <div className="space-y-2 max-w-sm">
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  <Paperclip size={14} />
                  <span>Attachments ({attachmentsCount} files attached)</span>
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => setAttachmentsCount(v => v + 1)}
                      className="text-emerald-600 hover:underline font-bold ml-2"
                    >
                      + Add Doc
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  Includes Workshop Job Card, Inspection Sheet & Material Certifications.
                </div>
              </div>

              <div className="w-full sm:w-80 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Untaxed Amount:</span>
                  <span className="font-mono font-semibold">{moneyFormat(untaxedTotal, currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Standard VAT (15%):</span>
                  <span className="font-mono font-semibold">{moneyFormat(taxTotal, currency)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                  <span>Total ({currency}):</span>
                  <span className="font-mono text-emerald-800">{moneyFormat(grandTotal, currency)}</span>
                </div>
                {currency !== 'SAR' && (
                  <div className="text-[11px] text-slate-500 flex justify-between pt-1">
                    <span>Base Currency (SAR):</span>
                    <span className="font-mono font-bold">{moneyFormat(grandTotal * currencyRate, 'SAR')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Document Activity & Audit Trail */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <History size={14} className="text-emerald-600" />
              <span>Document Activity & Audit History</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              All field updates, approvals, and status transitions are recorded immutably.
            </p>
            <div className="space-y-2 text-xs border-l-2 border-emerald-500 pl-3">
              <div className="text-slate-600">
                <span className="font-bold text-slate-800">Sangeeth R.</span> created document and registered line items
                <span className="text-slate-400 text-[10px] ml-2">Today at 10:30 AM</span>
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

        {/* Modal Footer */}
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

