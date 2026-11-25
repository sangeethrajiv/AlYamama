import { toProduct } from './http-product.api';

describe('toProduct (backend record -> Angular contract)', () => {
  const base = { id: 7, name: 'Pump', type: 'product', is_teltonika_product: true };

  it('keeps every assigned customer tax (many2many) and the genre (many2one) as ids', () => {
    const p = toProduct({ ...base, taxes_id: [{ id: 3, name: '15%' }, { id: 8, name: 'VAT 15%' }], product_type_id: { id: 3, name: 'Hardware Sales & Support' } });
    expect(p.taxes_id).toEqual([3, 8]);
    expect(p.product_type_id).toBe(3);
    expect(p.is_teltonika_product).toBe(true);
  });

  it('maps no taxes and no genre to an empty list and null', () => {
    const p = toProduct({ ...base, taxes_id: [], product_type_id: null });
    expect(p.taxes_id).toEqual([]);
    expect(p.product_type_id).toBeNull();
  });
});
