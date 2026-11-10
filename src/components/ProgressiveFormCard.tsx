import { mockCurrencies } from '../data/mockAccountingData'

export interface ProgressiveFormProps {
  locked: boolean // approved POs are read-only
  status: 'draft' | 'approved'
  poName: string; setPoName: (v: string) => void
  poDate: string; setPoDate: (v: string) => void
  partner: string; setPartner: (v: string) => void
  companyName: string
  currency: string; onCurrencyChange: (c: string) => void
  poTotal: number; setPoTotal: (v: number) => void
  billedAmount: number
  invoiceCount: number
  description: string; setDescription: (v: string) => void
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:text-slate-500'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-5 items-center">
      <label className="col-span-2 font-bold text-slate-700">{label}</label>
      <div className="col-span-3">{children}</div>
    </div>
  )
}

/** Progressive invoicing purchase order: one card with the PO details and how much is left to bill. */
export default function ProgressiveFormCard(p: ProgressiveFormProps) {
  const balance = p.poTotal - p.billedAmount
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Progressive PO details</div>
        <ol className="flex items-center gap-2 text-[11px] font-semibold" aria-label="Progressive PO status">
          {(['draft', 'approved'] as const).map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full capitalize ${p.status === s ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{s}</span>
              {i === 0 && <span className="text-slate-300">→</span>}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <input
          value={p.poName}
          disabled={p.locked}
          onChange={e => p.setPoName(e.target.value)}
          placeholder="PO name or number, e.g. PO-RIC-BLANKET-500K"
          aria-label="PO name"
          className="flex-1 min-w-64 text-lg font-extrabold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:text-slate-600"
        />
        <div className="rounded-lg border border-slate-200 px-4 py-2 min-w-36" aria-label="Linked invoices">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Invoices</div>
          <div className="font-mono font-bold text-slate-900">{p.invoiceCount}</div>
          <div className="font-mono text-[11px] text-slate-500">{fmt(p.billedAmount)} {p.currency}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3.5 text-xs">
        <div className="space-y-3">
          <Row label="PO Date"><input type="date" disabled={p.locked} value={p.poDate} onChange={e => p.setPoDate(e.target.value)} className={inputCls} /></Row>
          <Row label="Customer"><input list="erp-customers" type="text" disabled={p.locked} value={p.partner} onChange={e => p.setPartner(e.target.value)} className={`${inputCls} font-bold`} /></Row>
          <Row label="Company"><span className="font-semibold text-emerald-800">{p.companyName}</span></Row>
        </div>
        <div className="space-y-3">
          <Row label="Currency">
            <select disabled={p.locked} value={p.currency} onChange={e => p.onCurrencyChange(e.target.value)} className={`${inputCls} font-bold`}>
              {mockCurrencies.map(c => <option key={c.currency} value={c.currency}>{c.currency} - {c.name}</option>)}
            </select>
          </Row>
          <Row label="PO Total Amount">
            <div className="flex items-center gap-1.5">
              <input type="number" min={0} step="0.01" disabled={p.locked} value={p.poTotal}
                onChange={e => p.setPoTotal(Math.max(0, parseFloat(e.target.value) || 0))} className={`${inputCls} text-right font-mono`} />
              <span className="text-slate-500">{p.currency}</span>
            </div>
          </Row>
          <Row label="Balance">
            <span className={`font-mono font-bold ${balance < 0 ? 'text-rose-600' : 'text-slate-800'}`}>{fmt(balance)} {p.currency}</span>
          </Row>
          <div className="grid grid-cols-5">
            <label className="col-span-2 font-bold text-slate-700 pt-1">Description</label>
            <textarea rows={3} disabled={p.locked} value={p.description} onChange={e => p.setDescription(e.target.value)}
              className={`col-span-3 ${inputCls} resize-none`} />
          </div>
        </div>
      </div>
    </div>
  )
}
