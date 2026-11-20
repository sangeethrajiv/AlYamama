import { dec } from '@erp/shared/utils';

/** Maps a JSON key to the number of decimal places its numeric values get when converted to decimal strings. */
export type DecimalSpec = Readonly<Record<string, number>>;

/** Converts the numeric money/quantity fields of prototype seed data into decimal strings (contracts use Decimal). */
export function decimalize<T>(value: unknown, spec: DecimalSpec): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        out[k] = typeof x === 'number' && k in spec ? dec(x, spec[k]) : walk(x);
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

export const ACCOUNTING_SPEC: DecimalSpec = {
  unitPrice: 2, subtotal: 2, taxAmount: 2, total: 2, amountUntaxed: 2, amountTax: 2, amountTotal: 2, residual: 2,
  amountWithoutDiscount: 2, discountTotal: 2, contractAmount: 2, previouslyBilled: 2, retainageAmount: 2, amount: 2,
  amountBaseCurrency: 2, debit: 2, credit: 2, amountCurrency: 2, balance: 2, totalDebits: 2, totalCredits: 2,
  thresholdLevel1: 2, thresholdLevel2: 2, discount: 2,
  quantity: 4, mainQuantity: 4, taxRate: 4, currencyRate: 6, rateToBase: 6, advPercentage: 2, progressPercentage: 2,
};
export const CONTACTS_SPEC: DecimalSpec = { creditLimit: 2, discountPct: 2, discount: 2 };
export const PARTNERS_SPEC: DecimalSpec = { customer_discount: 2, discount: 2, credit_limit: 2 };
export const PRODUCT_SPEC: DecimalSpec = {
  // `factor` keeps 8 places (the decimal engine's scale) so 1 / (1 / 12) still reads back as 12.000000
  factor: 8, rounding: 6, list_price: 2, standard_price: 2, weight: 4, volume: 4, margin_perc: 2, qty_available: 4, virtual_available: 4,
};
