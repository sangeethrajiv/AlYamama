import type { Invoice, Bill, Payment } from './types'

export const initialInvoices: Invoice[] = [
  { date: 'Nov 01, 2026', num: 'INV/2026/0042', customer: 'Al-Yamama Steel', due: 'Nov 15, 2026', dueAmt: 85000, total: 85000, status: 'Open' },
  { date: 'Oct 28, 2026', num: 'INV/2026/0041', customer: 'Riyad Construction', due: 'Nov 10, 2026', dueAmt: 57500, total: 120000, status: 'Overdue' },
  { date: 'Oct 15, 2026', num: 'INV/2026/0039', customer: 'Bosch Rexroth AG', due: 'Oct 30, 2026', dueAmt: 0, total: 58420, status: 'Paid' },
]

export const initialBills: Bill[] = [
  { date: 'Nov 02, 2026', number: 'BILL/2026/0018', vendor: 'Dammam Steel', due: 'Nov 20, 2026', amount: 6900, status: 'To Approve' },
  { date: 'Oct 25, 2026', number: 'BILL/2026/0017', vendor: 'Gulf Hydraulic Supplies', due: 'Nov 12, 2026', amount: 12400, status: 'Approved' },
]

export const initialPayments: Payment[] = [
  { date: 'Nov 05, 2026', reference: 'PAY/2026/0088', partner: 'Al-Yamama Steel', method: 'Bank Transfer', amount: 85000, type: 'Received' },
  { date: 'Nov 03, 2026', reference: 'PAY/2026/0087', partner: 'Dammam Steel', method: 'Corporate Cheque', amount: 6900, type: 'Paid' },
]

export const money = (value: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
