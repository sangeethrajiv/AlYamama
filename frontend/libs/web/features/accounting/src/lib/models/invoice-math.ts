import type { DirectoryProduct, InvoiceLine } from '@erp/shared/contracts';
import { add, dec, gt, max, mul, sub, sum, toNumber, type Decimal } from '@erp/shared/utils';

/** VAT choices of the prototype's line editor (the rate is a fraction string). */
export const TAX_OPTIONS = [
  { value: '0.1500', label: 'VAT 15%' },
  { value: '0.0000', label: 'VAT 0%' },
];

export const taxLabel = (rate: Decimal): string => (gt(rate, '0') ? `VAT ${Math.round(toNumber(rate) * 100)}%` : 'No tax');

export function blankLine(partial: Partial<InvoiceLine> = {}): InvoiceLine {
  return recompute({
    id: `ln_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, mainTask: 'European', category: 'Supply', showSeparately: false, showLine: false, showMainQuantity: true,
    partnerNumberType: 'FAY', productSubType: '', product: '', description: '', accountCode: '479100', accountName: 'Revenue (Product Sales & Service)', analyticAccountId: '',
    analyticAccountName: '', mainQuantity: '1.0000', quantity: '1.0000', unitOfMeasure: 'pcs', unitPrice: '0.00', taxRate: '0.1500', taxesApplied: 'VAT 15%', discount: '0.00',
    subtotal: '0.00', taxAmount: '0.00', total: '0.00', ...partial,
  });
}

/** subtotal = max(0, qty × price − discount); tax = subtotal × rate; every step in exact decimals. */
export function recompute(l: InvoiceLine): InvoiceLine {
  const gross = mul(l.quantity, l.unitPrice, 4);
  const net = max('0.00', sub(gross, l.discount ?? '0.00'));
  const tax = mul(net, l.taxRate, 2);
  return { ...l, subtotal: dec(net), taxAmount: tax, total: add(net, tax) };
}

export function applyProduct(l: InvoiceLine, p: DirectoryProduct): InvoiceLine {
  return recompute({ ...l, product: p.sku, description: p.name, unitPrice: p.salePrice, unitOfMeasure: p.uom, taxRate: p.taxRate, taxesApplied: taxLabel(p.taxRate) });
}

export interface Totals { withoutDiscount: Decimal; discount: Decimal; untaxed: Decimal; tax: Decimal; total: Decimal }
export function totalsOf(lines: InvoiceLine[]): Totals {
  const untaxed = sum(lines.map(l => l.subtotal));
  const tax = sum(lines.map(l => l.taxAmount));
  return { withoutDiscount: sum(lines.map(l => mul(l.quantity, l.unitPrice))), discount: sum(lines.map(l => l.discount ?? '0')), untaxed, tax, total: add(untaxed, tax) };
}

export const CATEGORY_LABEL_KEY: Record<string, string> = { cash: 'accounting.invoice.type.cash', credit: 'accounting.invoice.type.credit', proforma: 'accounting.invoice.type.proforma', progressive: 'accounting.invoice.type.progressive' };
