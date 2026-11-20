import { add, cmp, div, dec, formatDecimal, mul, percentOf, sub, sum, toNumber } from './decimal';

describe('decimal arithmetic', () => {
  it('adds without floating point drift', () => {
    expect(add('0.10', '0.20')).toBe('0.30');
    expect(sum(['0.1', '0.2', '0.3'])).toBe('0.60');
  });

  it('subtracts and keeps the sign', () => {
    expect(sub('10.00', '12.505')).toBe('-2.51');
    expect(sub('5', '5')).toBe('0.00');
  });

  it('multiplies with half-away-from-zero rounding', () => {
    expect(mul('3', '33.335')).toBe('100.01');
    expect(mul('-3', '33.335')).toBe('-100.01');
    expect(mul('10', '1000')).toBe('10000.00');
  });

  it('computes percentages exactly', () => {
    expect(percentOf('1000.00', '15')).toBe('150.00');
    expect(percentOf('33.33', '15')).toBe('5.00');
  });

  it('divides and guards divide-by-zero', () => {
    expect(div('10', '4')).toBe('2.50');
    expect(div('10', '0')).toBe('0.00');
  });

  it('compares numerically, not lexically', () => {
    expect(cmp('9.00', '10.00')).toBe(-1);
    expect(cmp('1.50', '1.5')).toBe(0);
  });

  it('formats with grouping and normalises seed numbers', () => {
    expect(formatDecimal('1234567.5')).toBe('1,234,567.50');
    expect(dec(85000)).toBe('85000.00');
    expect(dec(0.1 + 0.2)).toBe('0.30');
    expect(toNumber('12.34')).toBe(12.34);
  });
});
