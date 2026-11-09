import { useState } from 'react'
import { X, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react'
import Chatter from './Chatter'
import type { AuditLogEntry, Bill, InvoiceLine, CompanyId } from '../types/accounting'
import { mockAnalyticAccounts, moneyFormat } from '../data/mockAccountingData'

interface BillModalProps {
  bill?: Bill
  companyId: CompanyId
  existingBills: Bill[]
  auditLogs?: AuditLogEntry[]
  onPostNote?: (recordType: AuditLogEntry['recordType'], recordId: string, recordName: string, text: string) => void
  onClose: () => void
  onSave: (bill: Bill, postImmediately?: boolean) => void
}

export default function BillModal({
  bill,
  companyId,
  existingBills,
  auditLogs = [],
  onPostNote,
  onClose,
  onSave,
}: BillModalProps) {
  const isEditing = Boolean(bill)
  const isDraft = !bill || bill.state === 'draft'

  const [vendor, setVendor] = useState(bill?.vendor || 'Dammam Special Steel & Honed Tubes Co.')
  const [vendorVat, setVendorVat] = useState(bill?.vendorVat || '300481920100003')
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(bill?.supplierInvoiceNumber || '')
  const [dateBill, setDateBill] = useState(bill?.dateBill || '2026-11-06')
  const [dateDue, setDateDue] = useState(bill?.dateDue || '2026-11-26')
  const [paymentTerms, setPaymentTerms] = useState(bill?.paymentTerms || '20 Days Net')
  const [attachmentsCount, setAttachmentsCount] = useState(bill?.attachmentsCount || 1)

  const [lines, setLines] = useState<InvoiceLine[]>(
    bill?.lines || [
      {
        id: 'bln_1',
        product: 'RAW-CHROME-ROD-100',
        description: 'Hard Chrome Plated Steel Rod Dia 100mm x 3000mm (EN8D / 20MnV6)',
        quantity: 2,
        unitPrice: 12500.00,
        taxRate: 0.15,
        subtotal: 25000.00,
        taxAmount: 3750.00,
        total: 28750.00,
        analyticAccountId: 'ana_1',
      },
    ]
  )

  // Duplicate vendor bill detection (§4.2.1 BILL-007)
  const isDuplicate = existingBills.some(
    b =>
      b.id !== bill?.id &&
      b.vendor.trim().toLowerCase() === vendor.trim().toLowerCase() &&
      b.supplierInvoiceNumber &&
      supplierInvoiceNumber &&
      b.supplierInvoiceNumber.trim().toLowerCase() === supplierInvoiceNumber.trim().toLowerCase() &&
      b.state !== 'cancel'
  )

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
      id: `bln_${Date.now()}`,
      product: 'PETRO-HYD-OIL',
      description: 'ISO VG 46 Hydraulic Oil Drums (208 Litres)',
      quantity: 4,
      unitPrice: 1950.00,
      taxRate: 0.15,
      subtotal: 7800.00,
      taxAmount: 1170.00,
      total: 8970.00,
      analyticAccountId: 'ana_4',
    }
    setLines(prev => [...prev, newLine])
  }

  const removeLine = (id: string) => {
    if (!isDraft || lines.length <= 1) return
    setLines(prev => prev.filter(l => l.id !== id))
  }

  const untaxedTotal = lines.reduce((acc, l) => acc + l.subtotal, 0)
  const taxTotal = lines.reduce((acc, l) => acc + l.taxAmount, 0)
  const grandTotal = untaxedTotal + taxTotal

  const handleSave = (postImmediately = false) => {
    if (!vendor.trim() || !supplierInvoiceNumber.trim() || grandTotal <= 0) {
      alert('Please provide vendor, vendor invoice reference number, and at least one line item.')
      return
    }

    const nextSeq = bill?.number || `BILL/2026/${Math.floor(1000 + Math.random() * 9000)}`
    
    // Approval workflow thresholds (§19.2)
    let approval: Bill['approvalStatus'] = 'approved'
    if (grandTotal >= 200000) {
      approval = 'pending_director'
    } else if (grandTotal >= 50000) {
      approval = 'pending_manager'
    }

    const updatedBill: Bill = {
      id: bill?.id || `bill_${Date.now()}`,
      number: nextSeq,
      supplierInvoiceNumber,
      companyId: bill?.companyId || companyId,
      vendor,
      vendorVat,
      dateBill,
      dateDue,
      paymentTerms,
      journalId: 'jour_purchase',
      currency: 'SAR',
      currencyRate: 1.0,
      lines,
      amountUntaxed: untaxedTotal,
      amountTax: taxTotal,
      amountTotal: grandTotal,
      residual: bill?.residual !== undefined ? (bill.state === 'draft' ? grandTotal : bill.residual) : grandTotal,
      state: postImmediately ? 'open' : (bill?.state || 'draft'),
      approvalStatus: approval,
      type: bill?.type || 'in_invoice',
      attachmentsCount,
    }

    onSave(updatedBill, postImmediately)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-50 animate-in fade-in">
      <div className="bg-slate-50 w-full max-w-4xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-800">
                  {bill ? `Vendor Bill: ${bill.number}` : 'New Vendor Bill (Supplier Expense)'}
                </h2>
                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase">
                  {bill?.state || 'draft'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Vendor Purchase Document
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Duplicate bill detection banner */}
        {isDuplicate && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center gap-2 text-xs text-rose-900 font-semibold">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>
              Duplicate Warning: Vendor "{vendor}" with Supplier Invoice Number "{supplierInvoiceNumber}" is already in system!
            </span>
          </div>
        )}

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Vendor Information & Reference
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Vendor / Supplier *</label>
                <input
                  type="text"
                  value={vendor}
                  disabled={!isDraft}
                  onChange={e => setVendor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 disabled:opacity-70"
                  placeholder="Vendor name"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Supplier Tax Invoice Number *</label>
                <input
                  type="text"
                  value={supplierInvoiceNumber}
                  disabled={!isDraft}
                  onChange={e => setSupplierInvoiceNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono disabled:opacity-70"
                  placeholder="e.g. INV-DAMM-9941"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Vendor VAT ID</label>
                <input
                  type="text"
                  value={vendorVat}
                  disabled={!isDraft}
                  onChange={e => setVendorVat(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono disabled:opacity-70"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Bill Date *</label>
                <input
                  type="date"
                  value={dateBill}
                  disabled={!isDraft}
                  onChange={e => setDateBill(e.target.value)}
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
                  <option>Immediate</option>
                  <option>15 Days Net</option>
                  <option>20 Days Net</option>
                  <option>30 Days Net</option>
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
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Bill Lines (Expenses & Materials)
                </span>
                <p className="text-[11px] text-slate-500">
                  Cost Centre is required for operational expense tracking.
                </p>
              </div>
              {isDraft && (
                <button
                  type="button"
                  onClick={addLine}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus size={14} /> Add Line
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-y border-slate-200">
                    <th className="py-2.5 px-3">Product / Expense</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-2 w-20 text-right">Qty</th>
                    <th className="py-2.5 px-3 w-28 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 w-24 text-center">VAT</th>
                    <th className="py-2.5 px-3 w-44">Cost Centre</th>
                    <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
                    {isDraft && <th className="py-2.5 px-2 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={l.product}
                          disabled={!isDraft}
                          onChange={e => updateLine(l.id, 'product', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono text-[11px]"
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
                          className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px]"
                        >
                          <option value={0.15}>15% Input VAT</option>
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
                        {moneyFormat(l.subtotal)}
                      </td>
                      {isDraft && (
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(l.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
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

            {/* Calculations & Summary */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between gap-6">
              <div className="space-y-2 max-w-sm">
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  
                  <span>Attachments ({attachmentsCount} files attached)</span>
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => setAttachmentsCount(v => v + 1)}
                      className="text-amber-600 hover:underline font-bold ml-2"
                    >
                      + Upload Scan
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  Supplier invoice scan and delivery note attached for 3-way matching.
                </div>
              </div>

              <div className="w-full sm:w-80 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal (Untaxed):</span>
                  <span className="font-mono font-semibold">{moneyFormat(untaxedTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Input VAT 15% (Recoverable):</span>
                  <span className="font-mono font-semibold">{moneyFormat(taxTotal)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                  <span>Total Payable:</span>
                  <span className="font-mono text-amber-800">{moneyFormat(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {bill && onPostNote && (
            <Chatter recordType="Vendor Bill" recordId={bill.id} recordName={bill.number} logs={auditLogs} onPostNote={onPostNote} />
          )}
        </div>

        {/* Footer */}
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
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <CheckCircle2 size={15} />
                <span>Confirm & Submit for Approval</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

