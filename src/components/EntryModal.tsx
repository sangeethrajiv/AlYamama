import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Modal from './Modal'
import type { DrawerType, Invoice, Bill, Payment } from '../types'

type Props = {
  type: Exclude<DrawerType, null>
  onClose: () => void
  onSaveInvoice: (value: Invoice) => void
  onSaveBill: (value: Bill) => void
  onSavePayment: (value: Payment) => void
}

export default function EntryModal({ type, onClose, onSaveInvoice, onSaveBill, onSavePayment }: Props) {
  const [partner, setPartner] = useState(type === 'payment' ? 'Al-Yamama Steel' : '')
  const [date, setDate] = useState('2026-11-06')
  const [due, setDue] = useState('2026-12-06')
  const [amount, setAmount] = useState(type === 'payment' ? '85000' : '45000')
  const [reference, setReference] = useState('')
  const [method, setMethod] = useState('Electronic Bank Transfer SARIE')
  const [progressive, setProgressive] = useState(false)
  const [lineCount, setLineCount] = useState(1)
  const [description, setDescription] = useState('Hydraulic Repair')
  const [saved, setSaved] = useState(false)
  const title = type === 'invoice' ? 'New Invoice' : type === 'bill' ? 'New Vendor Bill' : 'Receive Payment'
  const numericAmount = Math.max(0, Number(amount) || 0)
  const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  const save = () => {
    if (!partner.trim() || numericAmount <= 0) return
    const stamp = Date.now().toString().slice(-4)
    if (type === 'invoice') onSaveInvoice({ date: dateLabel(date), num: `INV/2026/${stamp}`, customer: partner, due: dateLabel(due), dueAmt: numericAmount * 1.15, total: numericAmount * 1.15, status: 'Open' })
    if (type === 'bill') onSaveBill({ date: dateLabel(date), number: `BILL/2026/${stamp}`, vendor: partner, due: dateLabel(due), amount: numericAmount * 1.15, status: 'To Approve' })
    if (type === 'payment') onSavePayment({ date: dateLabel(date), reference: `PAY/2026/${stamp}`, partner, method, amount: numericAmount, type: 'Received' })
    setSaved(true)
  }
  if (saved) return <Modal title="Entry saved" onClose={onClose} footer={<button className="primary-button" onClick={onClose}>Done</button>}>
    <div className="success-state"><div>✓</div><h3>{title} saved</h3><p>The new record has been added to this local prototype.</p></div>
  </Modal>
  return <Modal title={title} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={save}>Save and close</button></>}>
    <div className="form-grid">
      <label className="field"><span>{type === 'invoice' ? 'Customer' : type === 'bill' ? 'Vendor' : 'Customer'}</span><input value={partner} onChange={e => setPartner(e.target.value)} placeholder="Search or enter name" /></label>
      <label className="field"><span>{type === 'payment' ? 'Payment Date' : type === 'bill' ? 'Bill Date' : 'Invoice Date'}</span><input type="date" value={date} onChange={e => setDate(e.target.value)}/></label>
      {type !== 'payment' && <label className="field"><span>Due Date</span><input type="date" value={due} onChange={e => setDue(e.target.value)}/></label>}
      <label className="field"><span>{type === 'payment' ? 'Amount Received (SAR)' : 'Amount (SAR)'}</span><input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}/></label>
      {type === 'payment' && <label className="field"><span>Payment Method</span><select value={method} onChange={e => setMethod(e.target.value)}><option>Electronic Bank Transfer SARIE</option><option>Mada Debit</option><option>Corporate Cheque</option><option>Cash</option></select></label>}
      <label className="field"><span>{type === 'payment' ? 'Reference' : type === 'bill' ? 'Vendor Invoice #' : 'Reference / PO Number'}</span><input value={reference} onChange={e => setReference(e.target.value)} placeholder="Enter reference"/></label>
      {type === 'invoice' && <label className="field full"><span>Equipment / Service Details</span><input value={description} onChange={e => setDescription(e.target.value)}/></label>}
    </div>
    {type === 'invoice' && <div className="progressive-box">
      <label className="check-label"><input type="checkbox" checked={progressive} onChange={e => setProgressive(e.target.checked)}/> Progressive / milestone invoice</label>
      {progressive && <div className="form-grid compact"><label className="field"><span>Blanket PO Amount</span><input placeholder="500,000.00"/></label><label className="field"><span>Previously Invoiced</span><input placeholder="150,000.00"/></label><label className="field"><span>Current Progress %</span><input placeholder="30%"/></label><label className="field"><span>Retainage</span><input placeholder="50,000.00"/></label></div>}
    </div>}
    <div className="section-heading"><strong>{type === 'payment' ? 'Invoices to apply payment to' : 'Line items'}</strong>{type !== 'payment' && <button className="text-button" onClick={() => setLineCount(v => v + 1)}><Plus size={14}/> Add line</button>}</div>
    {type !== 'payment' && <div className="line-list">{Array.from({ length: lineCount }, (_, i) => <div className="line-row" key={i}><span>{i + 1}</span><input defaultValue={i === 0 ? description : 'Additional service'} aria-label="Line description"/><span>15% VAT</span><button className="icon-button" onClick={() => setLineCount(v => Math.max(1, v - 1))} aria-label="Remove line"><Trash2 size={15}/></button></div>)}</div>}
    {type === 'payment' && <div className="applied-invoice"><span><b>INV/2026/0042</b><small>Al-Yamama Steel · Due Nov 15, 2026</small></span><b>{numericAmount.toLocaleString('en-US', {minimumFractionDigits: 2})} SR</b></div>}
    <div className="totals"><div><span>Subtotal (Tax Excluded)</span><b>{numericAmount.toLocaleString('en-US', {minimumFractionDigits: 2})} SR</b></div><div><span>15% VAT</span><b>{(numericAmount * .15).toLocaleString('en-US', {minimumFractionDigits: 2})} SR</b></div><div className="total-line"><span>Total</span><b>{(numericAmount * (type === 'payment' ? 1 : 1.15)).toLocaleString('en-US', {minimumFractionDigits: 2})} SR</b></div></div>
  </Modal>
}
