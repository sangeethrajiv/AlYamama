import type { ResPartner } from '@erp/shared/contracts';
import { DEFAULT_FILTERS, applyFilters, activeChips } from './partner-filters';

const mk = (o: Partial<ResPartner>): ResPartner => ({
  id: 1, name: '', display_name: '', arabic_name: '', email: '', phone: '', mobile: '', city: '', vat: '', ref: '', website: '', customer_code: '', vandor_number: '', cr_number: '',
  l10n_sa_registered_name: '', is_company: true, type: 'contact', customer: false, supplier: false, employee: false, active: true, country_id: 0, ...o,
}) as unknown as ResPartner;

const list = [
  mk({ id: 1, name: 'Acme', display_name: 'Acme', customer: true, email: 'a@acme.test' }),
  mk({ id: 2, name: 'Zed Supplies', display_name: 'Zed Supplies', supplier: true }),
  mk({ id: 3, name: 'Old Co', display_name: 'Old Co', active: false }),
  mk({ id: 4, name: 'Jane', display_name: 'Jane', is_company: false }),
];

describe('partner filters', () => {
  it('shows only active partners by default', () => {
    expect(applyFilters(list, DEFAULT_FILTERS, '').map(p => p.id)).toEqual([1, 2, 4]);
  });

  it('filters archived, by role and by kind', () => {
    expect(applyFilters(list, { ...DEFAULT_FILTERS, status: 'archived' }, '').map(p => p.id)).toEqual([3]);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, supplier: 'yes' }, '').map(p => p.id)).toEqual([2]);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, kind: 'individual' }, '').map(p => p.id)).toEqual([4]);
  });

  it('searches across fields case-insensitively', () => {
    expect(applyFilters(list, DEFAULT_FILTERS, 'ACME.TEST').map(p => p.id)).toEqual([1]);
  });

  it('describes only non-default filters as chips', () => {
    expect(activeChips(DEFAULT_FILTERS, k => k, () => '')).toEqual([]);
    const chips = activeChips({ ...DEFAULT_FILTERS, customer: 'yes', status: 'all' }, k => k, () => '');
    expect(chips.map(c => c.key)).toEqual(['customer', 'status']);
  });
});
