import type { Invoice } from '../types/accounting'

interface Props {
  invoice?: Invoice
  isProforma: boolean
  onValidate: () => void
  onPreview?: () => void
  onPrint?: () => void
  onCancel: () => void
  onRenew?: () => void
}

/** Proforma / progressive: the few actions that make sense before and just after validation. */
export default function DocumentActionBar({ invoice, isProforma, onValidate, onPreview, onPrint, onCancel, onRenew }: Props) {
  const validated = !!invoice && invoice.state !== 'draft'
  const closed = invoice?.state === 'cancel'
  const base = 'h-8 px-3.5 rounded-lg text-xs font-bold transition disabled:opacity-50'
  const ghost = `${base} border border-slate-300 hover:bg-slate-50 text-slate-800`
  const saveFirst = invoice ? undefined : 'Save the document first'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3" role="toolbar" aria-label="Document actions">
      {!validated && (
        <button type="button" onClick={onValidate} className={`${base} bg-emerald-600 hover:bg-emerald-700 text-white`}>Validate</button>
      )}
      <button type="button" onClick={onPreview} disabled={!onPreview} title={saveFirst} className={ghost}>Preview</button>
      {isProforma && (
        <button type="button" onClick={onPrint} disabled={!onPrint} title={saveFirst} className={ghost}>Print Proforma Invoice</button>
      )}
      {isProforma && validated && !closed && (
        <button type="button" onClick={onRenew} disabled={!onRenew} className={ghost}>Renew</button>
      )}
      {!closed && (
        <button type="button" onClick={onCancel} className={`${base} ml-auto border border-rose-200 text-rose-700 hover:bg-rose-50`}>Cancel</button>
      )}
    </div>
  )
}
