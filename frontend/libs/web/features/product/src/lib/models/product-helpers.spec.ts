import type { ProductState } from '@erp/shared/contracts';
import { seedProducts } from '@erp/web/api-client';
import { categoryName, countProducts, descendantsOf, factorInv, fmtQty, getUom, relLabel, relOptions, stockValue, uomRatio } from './product-helpers';

const state = {
  categories: [{ id: 1, name: 'All', parent_id: null }, { id: 2, name: 'Consumables', parent_id: 1 }],
  uoms: [{ id: 5, name: 'kg' }],
} as unknown as ProductState;

describe('product helpers', () => {
  it('builds category paths', () => {
    expect(categoryName(state, 2)).toBe('All / Consumables');
    expect(categoryName(state, 1)).toBe('All');
    expect(categoryName(state, 99)).toBe('');
    expect(categoryName(state, null)).toBe('');
  });

  it('stops on a category cycle instead of looping', () => {
    const loop = { categories: [{ id: 1, name: 'A', parent_id: 2 }, { id: 2, name: 'B', parent_id: 1 }] } as unknown as ProductState;
    expect(categoryName(loop, 1)).toBe('B / A');
  });

  it('looks up a unit of measure', () => {
    expect(getUom(state, 5)?.name).toBe('kg');
    expect(getUom(state, 99)).toBeUndefined();
  });

  it('formats quantities', () => {
    expect(fmtQty('2.0000')).toBe('2');
    expect(fmtQty('2.5000')).toBe('2.5');
    expect(fmtQty(undefined)).toBe('0');
  });

  it('inverts a UoM factor', () => {
    expect(factorInv({ factor: '0.5' })).toBe('2.000000');
  });
});

describe('product helpers on the seed data', () => {
  const s = seedProducts() as unknown as ProductState;

  it('keeps a bigger unit readable: 1 / (1 / 12) is 12', () => {
    const dozen = s.uoms.find(u => u.name === 'Dozen(s)')!;
    expect(uomRatio(dozen)).toBe('12');
    expect(uomRatio(s.uoms.find(u => u.name === 'g')!)).toBe('1000');
    expect(uomRatio(s.uoms.find(u => u.name === 'kg')!)).toBe('1');
    expect(uomRatio(s.uoms.find(u => u.name === 'Gallon(s)')!)).toBe('3.78541');
  });

  it('counts products of a category including its sub-categories', () => {
    const hoses = s.categories.find(c => c.name === 'Hydraulic Hoses')!;
    const pipes = s.categories.find(c => c.name === 'Hoses & Pipes')!;
    const direct = s.products.filter(p => p.categ_id === hoses.id).length;
    expect(direct).toBeGreaterThan(0);
    expect(countProducts(s, pipes.id)).toBeGreaterThan(direct);
    expect(descendantsOf(s.categories, pipes.id, 'parent_id').map(c => c.name)).toContain('Hydraulic Hoses');
  });

  it('labels relations and offers archived records only while selected', () => {
    const company = s.companies[1];
    expect(relLabel(s, 'companies', company.id)).toBe(company.name);
    expect(relLabel(s, 'users', null)).toBe('');
    const archived = s.products.find(p => !p.active)!;
    expect(relOptions(s, 'products', null).some(o => o.id === archived.id)).toBe(false);
    expect(relOptions(s, 'products', archived.id).find(o => o.id === archived.id)?.active).toBe(false);
  });

  it('values stock with exact decimal arithmetic', () => {
    const one = s.products.filter(p => p.active && p.type === 'product').slice(0, 1);
    const expected = (Number(one[0].qty_available) * Number(one[0].standard_price)).toFixed(4);
    expect(stockValue(s, one)).toBe(expected);
  });
});
