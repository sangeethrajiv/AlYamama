import { AmountPipe, DatePipe, MoneyPipe, QuantityPipe } from './format.pipes';

describe('display pipes', () => {
  it('formats money from decimal strings', () => {
    const p = new MoneyPipe();
    expect(p.transform('1234.5')).toBe('1,234.50');
    expect(p.transform(null)).toBe('0.00');
  });

  it('appends the currency, SR for SAR', () => {
    const p = new AmountPipe();
    expect(p.transform('10')).toBe('10.00 SR');
    expect(p.transform('10', 'USD')).toBe('10.00 USD');
  });

  it('trims quantity zeros', () => {
    const p = new QuantityPipe();
    expect(p.transform('10.0000')).toBe('10');
    expect(p.transform('2.5000')).toBe('2.5');
  });

  it('formats dates and tolerates empty values', () => {
    const p = new DatePipe();
    expect(typeof p.transform('2026-11-19')).toBe('string');
    expect(p.transform(undefined)).toBe(p.transform(null));
  });
});
