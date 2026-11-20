import { applyProduct, blankLine, recompute, taxLabel, totalsOf } from './invoice-math';
import type { DirectoryProduct } from '@erp/shared/contracts';

describe('invoice line maths', () => {
  it('computes subtotal, VAT and total in exact decimals', () => {
    const l = recompute(blankLine({ quantity: '3.0000', unitPrice: '33.33' }));
    expect(l.subtotal).toBe('99.99');
    expect(l.taxAmount).toBe('15.00');
    expect(l.total).toBe('114.99');
  });

  it('applies the discount to the net and never goes negative', () => {
    expect(recompute(blankLine({ quantity: '1.0000', unitPrice: '100.00', discount: '10.00' })).subtotal).toBe('90.00');
    expect(recompute(blankLine({ quantity: '1.0000', unitPrice: '5.00', discount: '50.00' })).subtotal).toBe('0.00');
  });

  it('charges no tax at a 0% rate', () => {
    const l = recompute(blankLine({ quantity: '2.0000', unitPrice: '10.00', taxRate: '0.0000' }));
    expect(l.taxAmount).toBe('0.00');
    expect(l.total).toBe('20.00');
  });

  it('sums document totals without float drift', () => {
    const lines = [0.1, 0.2, 0.3].map(p => recompute(blankLine({ quantity: '1.0000', unitPrice: p.toFixed(2), taxRate: '0.0000' })));
    const t = totalsOf(lines);
    expect(t.untaxed).toBe('0.60');
    expect(t.total).toBe('0.60');
  });

  it('copies price, unit and tax from a catalogue product', () => {
    const p = { sku: 'SKU-1', name: 'Seal kit', salePrice: '200.00', uom: 'set', taxRate: '0.1500' } as DirectoryProduct;
    const l = applyProduct(blankLine({ quantity: '2.0000' }), p);
    expect(l.product).toBe('SKU-1');
    expect(l.unitPrice).toBe('200.00');
    expect(l.subtotal).toBe('400.00');
    expect(l.taxesApplied).toBe('VAT 15%');
  });

  it('labels tax rates', () => {
    expect(taxLabel('0.1500')).toBe('VAT 15%');
    expect(taxLabel('0.0000')).toBe('No tax');
  });
});
