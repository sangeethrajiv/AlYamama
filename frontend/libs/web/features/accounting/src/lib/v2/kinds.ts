/**
 * The document screens in the Customers and Vendors menus. They all show account.move rows of one kind;
 * the list adds `query` to the request and the form creates new ones with `moveType` and `category`.
 */
export type MoveType = 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund';
export interface DocKind {
  key: string;
  /** Path segment under /accounting. */
  path: string;
  title: string;
  singular: string;
  moveType: MoveType;
  /** New documents get this invoice_category (customer invoices). */
  category?: 'cash' | 'credit' | 'proforma' | 'progressive';
  /** Extra list filters. */
  query: Record<string, string>;
  /** Hide the "New" button (the approval queues are filtered views). */
  noNew?: boolean;
}

const out = (key: string, title: string, singular: string, category?: DocKind['category'], moveType: MoveType = 'out_invoice'): DocKind =>
  ({ key, path: key, title, singular, moveType, category, query: { move_type: moveType, ...(category ? { invoice_category: category } : {}) } });

export const DOC_KINDS: DocKind[] = [
  out('customer-invoices', 'Customer Invoices', 'Invoice'),
  out('cash-invoices', 'Cash Invoices', 'Cash invoice', 'cash'),
  out('credit-invoices', 'Credit Invoices', 'Credit invoice', 'credit'),
  out('proforma-invoices', 'Proforma Invoices', 'Proforma invoice', 'proforma'),
  out('progressive-invoices', 'Progressive Invoices', 'Progressive invoice', 'progressive'),
  out('credit-notes', 'Credit Notes', 'Credit note', undefined, 'out_refund'),
  { key: 'vendor-bills', path: 'vendor-bills', title: 'Vendor Bills', singular: 'Bill', moveType: 'in_invoice', query: { move_type: 'in_invoice' } },
  { key: 'bills-to-approve', path: 'bills-to-approve', title: 'Bills To Approve', singular: 'Bill', moveType: 'in_invoice', query: { move_type: 'in_invoice', request_status: 'to_approve' }, noNew: true },
  { key: 'bills-approved', path: 'bills-approved', title: 'Approved Bills', singular: 'Bill', moveType: 'in_invoice', query: { move_type: 'in_invoice', request_status: 'approved' }, noNew: true },
  { key: 'vendor-refunds', path: 'vendor-refunds', title: 'Vendor Refunds', singular: 'Vendor refund', moveType: 'in_refund', query: { move_type: 'in_refund' } },
];

export const kindOf = (key: string): DocKind => DOC_KINDS.find(k => k.key === key) ?? DOC_KINDS[0];
export const isSaleType = (t: MoveType) => t.startsWith('out_');
export const isRefundType = (t: MoveType) => t.endsWith('_refund');
/** Where a credit note / refund created from `t` is shown. */
export const refundKindFor = (t: MoveType): string => (t === 'out_invoice' ? 'credit-notes' : t === 'in_invoice' ? 'vendor-refunds' : t === 'out_refund' ? 'customer-invoices' : 'vendor-bills');
