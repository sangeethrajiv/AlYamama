import { useState } from 'react'
import {
  Landmark,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  RotateCcw,
  DollarSign,
} from 'lucide-react'
import type { ChequeRecord, Account, CompanyId } from '../types/accounting'
import { moneyFormat } from '../data/mockAccountingData'

interface BankingViewProps {
  cheques: ChequeRecord[]
  accounts: Account[]
  companyId: CompanyId
  onBounceCheque: (chequeId: string, reason: string) => void
  onClearCheque: (chequeId: string) => void
  onRecordDirectBankTx: (journalId: string, amount: number, isCharge: boolean, memo: string) => void
}

export default function BankingView({
  cheques,
  accounts,
  companyId,
  onBounceCheque,
  onClearCheque,
  onRecordDirectBankTx,
}: BankingViewProps) {
  const [bounceModalChequeId, setBounceModalChequeId] = useState<string | null>(null)
  const [bounceReason, setBounceReason] = useState('')

  // Direct Bank Tx Modal
  const [showDirectTxModal, setShowDirectTxModal] = useState(false)
  const [txJournalId, setTxJournalId] = useState('acc_101')
  const [txAmount, setTxAmount] = useState<number>(150)
  const [isCharge, setIsCharge] = useState(true)
  const [txMemo, setTxMemo] = useState('Monthly SARIE transfer maintenance fee')

  const bankAccounts = accounts.filter(a => a.type === 'Bank and Cash')
  const totalCashBank = bankAccounts.reduce((sum, a) => sum + (a.currency === 'USD' ? a.balance * 3.75 : a.balance), 0)

  const handleConfirmBounce = () => {
    if (bounceModalChequeId && bounceReason.trim()) {
      onBounceCheque(bounceModalChequeId, bounceReason)
      setBounceModalChequeId(null)
      setBounceReason('')
    }
  }

  const handleSaveDirectTx = () => {
    if (txAmount <= 0) {
      alert('Amount must be positive.')
      return
    }
    onRecordDirectBankTx(txJournalId, txAmount, isCharge, txMemo)
    setShowDirectTxModal(false)
  }

  const getChequeStatusBadge = (status: ChequeRecord['status']) => {
    switch (status) {
      case 'issued':
        return <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Issued</span>
      case 'presented':
        return <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Clock size={11} /> Presented</span>
      case 'cleared':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><CheckCircle2 size={11} /> Cleared</span>
      case 'bounced':
        return <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><AlertTriangle size={11} /> Bounced</span>
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Cash & Bank Management</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time bank balances, direct transactions, and end-to-end cheque lifecycle management with bounce reversal.
          </p>
        </div>

        <button
          onClick={() => setShowDirectTxModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus size={16} />
          <span>Record Direct Bank Transaction</span>
        </button>
      </div>

      {/* Real-Time Bank & Cash Accounts Dashboard */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Live Bank & Cash Journals (Total: {moneyFormat(totalCashBank, 'SAR')})
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {bankAccounts.map(b => (
            <div
              key={b.id}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-mono text-slate-400 font-bold">{b.code}</span>
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                    <Landmark size={15} />
                  </div>
                </div>
                <div className="font-bold text-xs text-slate-800 line-clamp-1">{b.name}</div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-[11px] text-slate-400">Available:</span>
                <span className="text-base font-black font-mono text-slate-900">
                  {moneyFormat(b.balance, b.currency || 'SAR')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cheque Lifecycle Register */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Corporate Cheque Register & Lifecycle
            </h3>
            <p className="text-[11px] text-slate-500">
              Lifecycle: <span className="font-semibold text-slate-700">Issued → Presented → Cleared / Bounced</span>. Bouncing reverses original payment and reopens invoice.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-3 px-3.5">Cheque Number</th>
                <th className="py-3 px-3">Cheque Date</th>
                <th className="py-3 px-3">Payee / Beneficiary</th>
                <th className="py-3 px-3">Drawee Bank</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cheques.map(chq => (
                <tr key={chq.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3.5 font-bold font-mono text-slate-800">
                    {chq.chequeNumber}
                  </td>
                  <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{chq.chequeDate}</td>
                  <td className="py-3 px-3 font-semibold text-slate-900">{chq.payeeName}</td>
                  <td className="py-3 px-3 text-slate-600">{chq.bankName}</td>
                  <td className="py-3 px-3 text-right font-bold font-mono text-slate-900 whitespace-nowrap">
                    {moneyFormat(chq.amount, chq.currency)}
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    {getChequeStatusBadge(chq.status)}
                    {chq.bounceReason && (
                      <div className="text-[10px] text-rose-600 mt-0.5 truncate max-w-xs mx-auto" title={chq.bounceReason}>
                        {chq.bounceReason}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {chq.status === 'presented' && (
                        <>
                          <button
                            onClick={() => onClearCheque(chq.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition flex items-center gap-1"
                            title="Confirm Cheque Clearance"
                          >
                            <CheckCircle2 size={12} />
                            <span>Clear</span>
                          </button>
                          <button
                            onClick={() => setBounceModalChequeId(chq.id)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition flex items-center gap-1"
                            title="Mark Cheque Bounced"
                          >
                            <AlertTriangle size={12} />
                            <span>Bounce</span>
                          </button>
                        </>
                      )}
                      {chq.status === 'cleared' && (
                        <span className="text-[10px] text-emerald-700 font-mono font-semibold">
                          Cleared on {chq.clearanceDate || '2026-10-24'}
                        </span>
                      )}
                      {chq.status === 'bounced' && (
                        <span className="text-[10px] text-rose-700 font-mono font-semibold">
                          Reversed & Penalised
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bounce Cheque Reason Modal */}
      {bounceModalChequeId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-slate-200">
            <div className="flex items-center gap-2 text-rose-600 mb-2">
              <AlertTriangle size={20} />
              <h3 className="font-bold text-sm text-slate-800">Process Bounced Cheque</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Marking this cheque as bounced will automatically:
              <br />1. Reverse the original payment journal entry
              <br />2. Reopen the unpaid invoice balance
              <br />3. Record bank return charges
            </p>
            <textarea
              value={bounceReason}
              onChange={e => setBounceReason(e.target.value)}
              placeholder="Enter bank return memo (e.g., Insufficient funds / Signature mismatch notice #8821)..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 mb-4 focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setBounceModalChequeId(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBounce}
                disabled={!bounceReason.trim()}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs transition disabled:opacity-50"
              >
                Confirm Bounce & Reopen Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Bank Transaction Modal */}
      {showDirectTxModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-slate-200 text-xs">
            <h3 className="font-bold text-sm text-slate-800 mb-2">
              Direct Bank Transaction
            </h3>
            <p className="text-slate-500 mb-4">
              Record bank charges, interest income, or non-invoice direct transfers directly against bank journals.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Bank Account</label>
                <select
                  value={txJournalId}
                  onChange={e => setTxJournalId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                >
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({moneyFormat(b.balance, b.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Transaction Type</label>
                  <select
                    value={isCharge ? 'expense' : 'income'}
                    onChange={e => setIsCharge(e.target.value === 'expense')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold"
                  >
                    <option value="expense">Bank Fee / Charge (Debit Expense)</option>
                    <option value="income">Interest / Direct Deposit (Credit Income)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Amount (SAR)</label>
                  <input
                    type="number"
                    min="1"
                    value={txAmount}
                    onChange={e => setTxAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Memo / Purpose</label>
                <input
                  type="text"
                  value={txMemo}
                  onChange={e => setTxMemo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowDirectTxModal(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDirectTx}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition"
              >
                Post Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

