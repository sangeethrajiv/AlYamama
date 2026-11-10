import { Plus, Trash2 } from 'lucide-react'
import type { InvoiceLine } from '../types/accounting'
import { mockCurrencies } from '../data/mockAccountingData'

export interface ProformaFormProps {
  isDraft: boolean
  invoiceStatus: 'pending' | 'invoiced'
  companyName: string
  journalName: string
  currency: string
  onCurrencyChange: (c: string) => void
  dateInvoice: string; setDateInvoice: (v: string) => void
  partner: string; setPartner: (v: string) => void
  salesperson: string; setSalesperson: (v: string) => void
  linkedInvoice: string
  billingEmail: string; setBillingEmail: (v: string) => void
  poNumber: string; setPoNumber: (v: string) => void
  prNumber: string; setPrNumber: (v: string) => void
  vendorProjectName: string; setVendorProjectName: (v: string) => void
  frequency: string; setFrequency: (v: string) => void
  advPercentage: number; setAdvPercentage: (v: number) => void
  lines: InvoiceLine[]
  updateLine: (id: string, field: keyof InvoiceLine, value: unknown) => void
  addLine: () => void
  removeLine: (id: string) => void
  totals: { price: number; tax: number; discount: number; grand: number }
}

const FREQUENCIES = ['One Year', 'Six Months', 'Quarterly', 'Monthly', 'One Time']
const SUBSCRIPTION_TYPES = ['Vehicle Subscription', 'Service Subscription', 'Maintenance Contract']
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:text-slate-500'
const cell = 'bg-white border border-slate-200 rounded px-1.5 py-1 text-xs disabled:bg-slate-50'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-5 items-center">
      <label className="col-span-2 font-bold text-slate-700">{label}</label>
      <div className="col-span-3">{children}</div>
    </div>
  )
}

/** Proforma invoice header + lines, using the same card pattern as the standard invoice form. */
export default function ProformaFormCards(p: ProformaFormProps) {
  const d = !p.isDraft
  return (
    <>
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Proforma header & partner information</div>
          <ol className="flex items-center gap-2 text-[11px] font-semibold" aria-label="Proforma status">
            {(['Pending Payment', 'Invoiced'] as const).map((s, i) => {
              const active = (i === 0 && p.invoiceStatus === 'pending') || (i === 1 && p.invoiceStatus === 'invoiced')
              return (
                <li key={s} className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{s}</span>
                  {i === 0 && <span className="text-slate-300">→</span>}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3.5 text-xs">
          <div className="space-y-3">
            <Row label="Date"><input type="date" disabled={d} value={p.dateInvoice} onChange={e => p.setDateInvoice(e.target.value)} className={inputCls} /></Row>
            <Row label="Customer"><input type="text" disabled={d} value={p.partner} onChange={e => p.setPartner(e.target.value)} className={`${inputCls} font-bold`} /></Row>
            <Row label="Journal"><input type="text" disabled value={p.journalName} className="w-full bg-slate-100 border border-slate-200 rounded px-2.5 py-1 text-slate-600 font-medium cursor-not-allowed" /></Row>
            <Row label="Company"><span className="font-semibold text-emerald-800">{p.companyName}</span></Row>
            <Row label="Salesperson">
              <select disabled={d} value={p.salesperson} onChange={e => p.setSalesperson(e.target.value)} className={inputCls}>
                {[...new Set([p.salesperson, 'Administrator', 'Faraz Yousuff'])].map(n => <option key={n}>{n}</option>)}
              </select>
            </Row>
            <Row label="Currency">
              <select disabled={d} value={p.currency} onChange={e => p.onCurrencyChange(e.target.value)} className={`${inputCls} font-bold`}>
                {mockCurrencies.map(c => <option key={c.currency} value={c.currency}>{c.currency} - {c.name}</option>)}
              </select>
            </Row>
          </div>

          <div className="space-y-3">
            <Row label="Invoice"><span className="font-mono text-slate-700">{p.linkedInvoice || '—'}</span></Row>
            <Row label="Billing Email"><input type="email" disabled={d} value={p.billingEmail} onChange={e => p.setBillingEmail(e.target.value)} placeholder="billing@customer.com" className={inputCls} /></Row>
            <Row label="PO Number"><input type="text" disabled={d} value={p.poNumber} onChange={e => p.setPoNumber(e.target.value)} className={inputCls} /></Row>
            <Row label="PR Number"><input type="text" disabled={d} value={p.prNumber} onChange={e => p.setPrNumber(e.target.value)} className={inputCls} /></Row>
            <Row label="Vendor Project Name"><input type="text" disabled={d} value={p.vendorProjectName} onChange={e => p.setVendorProjectName(e.target.value)} className={inputCls} /></Row>
            <Row label="Frequency">
              <select disabled={d} value={p.frequency} onChange={e => p.setFrequency(e.target.value)} className={inputCls}>
                {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
              </select>
            </Row>
            <Row label="Adv. Percentage">
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} max={100} step="0.01" disabled={d} value={p.advPercentage}
                  onChange={e => p.setAdvPercentage(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} className={`${inputCls} w-28 text-right font-mono`} />
                <span className="text-slate-500">%</span>
              </div>
            </Row>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="border-b border-slate-200 flex items-center justify-between">
          <div className="pb-2 border-b-2 border-emerald-600 text-emerald-800 text-xs font-bold">Proforma Lines</div>
          {p.isDraft && (
            <button type="button" onClick={p.addLine} className="mb-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-xs font-bold flex items-center gap-1 transition">
              <Plus size={13} /> Add a line
            </button>
          )}
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3 min-w-[150px]">Description</th>
                <th className="py-2.5 px-3">Subscription Type</th>
                <th className="py-2.5 px-2 text-right">Subscriptions</th>
                <th className="py-2.5 px-3">Frequency</th>
                <th className="py-2.5 px-3">Start Date</th>
                <th className="py-2.5 px-3">End Date</th>
                <th className="py-2.5 px-3">Vehicles</th>
                <th className="py-2.5 px-2 text-right">Quantity</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-2 text-center">Taxes</th>
                <th className="py-2.5 px-2 text-right">Discount</th>
                <th className="py-2.5 px-3 text-right">Subtotal</th>
                {p.isDraft && <th className="w-7" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {p.lines.map(l => (
                <tr key={l.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-2 px-3"><input disabled={d} value={l.product} onChange={e => p.updateLine(l.id, 'product', e.target.value)} className={`${cell} w-28`} /></td>
                  <td className="py-2 px-3"><input disabled={d} value={l.description} onChange={e => p.updateLine(l.id, 'description', e.target.value)} className={`${cell} w-44`} /></td>
                  <td className="py-2 px-3">
                    <select disabled={d} value={l.subscriptionType || SUBSCRIPTION_TYPES[0]} onChange={e => p.updateLine(l.id, 'subscriptionType', e.target.value)} className={cell}>
                      {SUBSCRIPTION_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-2 text-right"><input type="number" min={0} disabled={d} value={l.subscriptions ?? 1} onChange={e => p.updateLine(l.id, 'subscriptions', parseInt(e.target.value) || 0)} className={`${cell} w-16 text-right font-mono`} /></td>
                  <td className="py-2 px-3">
                    <select disabled={d} value={l.frequency || 'One Year'} onChange={e => p.updateLine(l.id, 'frequency', e.target.value)} className={cell}>
                      {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-3"><input type="date" disabled={d} value={l.startDate || ''} onChange={e => p.updateLine(l.id, 'startDate', e.target.value)} className={cell} /></td>
                  <td className="py-2 px-3"><input type="date" disabled={d} value={l.endDate || ''} onChange={e => p.updateLine(l.id, 'endDate', e.target.value)} className={cell} /></td>
                  <td className="py-2 px-3"><input disabled={d} value={l.vehiclesText || ''} placeholder="Plate numbers" onChange={e => p.updateLine(l.id, 'vehiclesText', e.target.value)} className={`${cell} w-32`} /></td>
                  <td className="py-2 px-2 text-right"><input type="number" step="1" min={0} disabled={d} value={l.quantity} onChange={e => p.updateLine(l.id, 'quantity', parseFloat(e.target.value) || 0)} className={`${cell} w-16 text-right font-mono`} /></td>
                  <td className="py-2 px-3 text-right"><input type="number" step="0.001" min={0} disabled={d} value={l.unitPrice} onChange={e => p.updateLine(l.id, 'unitPrice', parseFloat(e.target.value) || 0)} className={`${cell} w-24 text-right font-mono font-semibold`} /></td>
                  <td className="py-2 px-2 text-center">
                    <select disabled={d} value={l.taxRate} onChange={e => { const r = parseFloat(e.target.value); p.updateLine(l.id, 'taxRate', r); p.updateLine(l.id, 'taxesApplied', r ? 'VAT 15%' : 'VAT 0%') }} className={cell}>
                      <option value={0.15}>VAT 15%</option>
                      <option value={0}>VAT 0%</option>
                    </select>
                  </td>
                  <td className="py-2 px-2 text-right"><input type="number" step="0.01" min={0} disabled={d} value={l.discount ?? 0} onChange={e => p.updateLine(l.id, 'discount', parseFloat(e.target.value) || 0)} className={`${cell} w-20 text-right font-mono`} /></td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{fmt(l.subtotal)}</td>
                  {p.isDraft && (
                    <td className="py-2 px-1 text-center">
                      <button type="button" onClick={() => p.removeLine(l.id)} className="text-slate-400 hover:text-rose-600 p-1" title="Remove line" aria-label="Remove line"><Trash2 size={13} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-2 flex justify-end">
          <div className="w-full sm:w-80 bg-slate-50/80 p-5 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600"><span className="font-medium">Total Price:</span><span className="font-mono font-semibold">{fmt(p.totals.price)}</span></div>
            <div className="flex justify-between text-slate-600"><span className="font-medium">Total Tax:</span><span className="font-mono font-semibold">{fmt(p.totals.tax)}</span></div>
            <div className="flex justify-between text-slate-600"><span className="font-medium">Total Discount:</span><span className="font-mono font-semibold">{fmt(p.totals.discount)}</span></div>
            <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
              <span>Grand Total:</span><span className="font-mono text-base text-emerald-800">{fmt(p.totals.grand)} {p.currency}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
