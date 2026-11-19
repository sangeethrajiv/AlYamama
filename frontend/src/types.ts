export type TabId = 'dashboard' | 'invoices' | 'expenses' | 'payments'
export type DrawerType = 'invoice' | 'payment' | 'bill' | null
export type InvoiceStatus = 'Open' | 'Overdue' | 'Paid'

export interface Invoice {
  date: string
  num: string
  customer: string
  due: string
  dueAmt: number
  total: number
  status: InvoiceStatus
}

export interface Bill {
  date: string
  number: string
  vendor: string
  due: string
  amount: number
  status: 'To Approve' | 'Approved' | 'Paid'
}

export interface Payment {
  date: string
  reference: string
  partner: string
  method: string
  amount: number
  type: 'Received' | 'Paid'
}
