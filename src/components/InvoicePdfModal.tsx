import { X, Printer, Download, CheckCircle2 } from 'lucide-react'
import type { Invoice } from '../types/accounting'
import { mockCompanies, moneyFormat } from '../data/mockAccountingData'

interface InvoicePdfModalProps {
  invoice: Invoice
  onClose: () => void
}

export default function InvoicePdfModal({ invoice, onClose }: InvoicePdfModalProps) {
  const company = mockCompanies.find(c => c.id === invoice.companyId) || mockCompanies[0]

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Top Action Bar */}
        <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm tracking-wide">
              Tax Invoice Preview — {invoice.number}
            </h3>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded">
              ZATCA Tax Invoice
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
            >
              <Printer size={14} /> Print Document
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Invoice Printable Sheet */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center">
          <div className="bg-white shadow-md border border-slate-200 w-full max-w-2xl p-8 rounded-lg text-slate-800 text-xs">
            {/* Header: Company & QR */}
            <div className="flex justify-between items-start border-b-2 border-emerald-600 pb-5">
              <div>
                <div className="text-emerald-700 font-black text-lg tracking-wide uppercase">
                  {company.name}
                </div>
                <div className="text-[11px] text-slate-500">{company.legalName}</div>
                <div className="text-[11px] text-slate-500">{company.city}, Kingdom of Saudi Arabia</div>
                <div className="mt-2 text-[11px] text-slate-700 font-mono space-y-0.5">
                  <div><strong>CR No:</strong> {company.crNumber}</div>
                  <div><strong>VAT / Tax ID:</strong> {company.vatNumber}</div>
                </div>
              </div>

              {/* QR Code Placeholder (ZATCA e-invoicing simulation) */}
              <div className="text-center">
                <div className="w-24 h-24 bg-slate-900 rounded p-1.5 flex items-center justify-center text-white mx-auto shadow-xs">
                  <div className="grid grid-cols-4 gap-1 w-full h-full p-1 bg-white">
                    <div className="bg-black col-span-2 row-span-2"></div>
                    <div className="bg-black"></div>
                    <div className="bg-black"></div>
                    <div className="bg-black col-span-2"></div>
                    <div className="bg-black"></div>
                    <div className="bg-black"></div>
                    <div className="bg-black col-span-2 row-span-2"></div>
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 mt-1 font-mono uppercase">ZATCA Verified</div>
              </div>
            </div>

            {/* Title & Document Meta */}
            <div className="my-5 flex justify-between items-end">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  {invoice.category === 'cash'
                    ? 'CASH INVOICE / فاتورة نقدية'
                    : invoice.category === 'proforma'
                    ? 'PROFORMA INVOICE / فاتورة شكلية'
                    : invoice.category === 'progressive'
                    ? 'PROGRESSIVE TAX INVOICE / فاتورة مرحلية'
                    : 'TAX INVOICE / فاتورة ضريبية'}
                </h1>
                <div className="text-xs font-mono font-bold text-emerald-800">{invoice.number}</div>
              </div>
              <div className="text-right text-[11px] space-y-1">
                <div><span className="text-slate-500">Invoice Date:</span> <strong>{invoice.dateInvoice}</strong></div>
                <div><span className="text-slate-500">Due Date:</span> <strong>{invoice.dateDue}</strong></div>
                <div><span className="text-slate-500">Payment Terms:</span> <strong>{invoice.paymentTerms}</strong></div>
                {invoice.reference && (
                  <div><span className="text-slate-500">Customer PO:</span> <strong>{invoice.reference}</strong></div>
                )}
              </div>
            </div>

            {/* Progressive Project Milestone Box */}
            {invoice.category === 'progressive' && (
              <div className="mb-6 p-3 rounded-lg bg-amber-50/70 border border-amber-200 grid grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Contract Total</span>
                  <strong className="font-mono">{moneyFormat(invoice.contractAmount || 500000, invoice.currency)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Previously Billed</span>
                  <strong className="font-mono">{moneyFormat(invoice.previouslyBilled || 0, invoice.currency)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Current Progress</span>
                  <strong className="font-mono">{invoice.progressPercentage || 30}%</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Retainage</span>
                  <strong className="font-mono">{moneyFormat(invoice.retainageAmount || 0, invoice.currency)}</strong>
                </div>
              </div>
            )}

            {/* Customer Box */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Billed To
              </div>
              <div className="font-bold text-sm text-slate-900">{invoice.partner}</div>
              {invoice.customerVat && (
                <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                  VAT Number: <strong>{invoice.customerVat}</strong>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <table className="w-full text-left text-xs mb-6 border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-y border-slate-200">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Item & Description</th>
                  <th className="py-2.5 px-2 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-center">VAT</th>
                  <th className="py-2.5 px-3 text-right">Total ({invoice.currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.lines.map((l, i) => (
                  <tr key={l.id}>
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{i + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{l.product}</div>
                      <div className="text-[11px] text-slate-500">{l.description}</div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">{l.quantity}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{moneyFormat(l.unitPrice, invoice.currency)}</td>
                    <td className="py-2.5 px-3 text-center font-mono">15%</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {moneyFormat(l.total, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals Summary */}
            <div className="flex justify-end mb-6">
              <div className="w-72 bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold">{moneyFormat(invoice.amountUntaxed, invoice.currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>VAT Amount:</span>
                  <span className="font-mono font-semibold">{moneyFormat(invoice.amountTax, invoice.currency)}</span>
                </div>
                <div className="pt-2 border-t border-slate-300 flex justify-between font-bold text-sm text-slate-900">
                  <span>Total Amount Due:</span>
                  <span className="font-mono text-emerald-800">{moneyFormat(invoice.amountTotal, invoice.currency)}</span>
                </div>
              </div>
            </div>

            {/* Bank details & footer */}
            <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center">
              <div>
                <p><strong>Bank Details:</strong> Al Rajhi Bank • IBAN: SA0380000201829104928102</p>
                <p>Thank you for choosing Al-Yamama Hydraulic Engineering.</p>
              </div>
              <div className="flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 size={13} />
                <span>Digitally Sealed & Confirmed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

