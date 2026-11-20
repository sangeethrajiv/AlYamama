/**
 * Exact decimal arithmetic on decimal strings (architecture v2.2 section 9: money and quantities are decimal
 * strings in JSON, never JavaScript floats). Values are held as BigInt scaled by 10^SCALE.
 * Rounding is half away from zero, applied explicitly by `round`/`mul`/`div`.
 */
export type Decimal = string;

const SCALE = 8;
const ONE = 10n ** BigInt(SCALE);
const NUMERIC = /^-?\d+(\.\d+)?$/;

/** Parse a decimal string (or finite number, for seed/input convenience) into the scaled BigInt. */
export function toScaled(value: Decimal | number | null | undefined): bigint {
  if (value === null || value === undefined || value === '') return 0n;
  let s = typeof value === 'number' ? numberToPlain(value) : String(value).trim().replace(/,/g, '');
  if (!NUMERIC.test(s)) return 0n;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const [intPart, frac = ''] = s.split('.');
  const fracPadded = (frac + '0'.repeat(SCALE)).slice(0, SCALE);
  // Round half up on the digit after SCALE when present
  let n = BigInt(intPart) * ONE + BigInt(fracPadded);
  if (frac.length > SCALE && frac.charCodeAt(SCALE) >= 53) n += 1n;
  return neg ? -n : n;
}

function numberToPlain(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const s = String(n);
  if (!/e/i.test(s)) return s;
  return n.toFixed(SCALE);
}

/** Format a scaled BigInt to a plain decimal string with exactly `places` decimals (half away from zero). */
export function fromScaled(n: bigint, places = 2): Decimal {
  const neg = n < 0n;
  let abs = neg ? -n : n;
  const drop = BigInt(SCALE - places);
  if (drop > 0n) {
    const div = 10n ** drop;
    const rem = abs % div;
    abs = abs / div;
    if (rem * 2n >= div) abs += 1n;
  } else if (drop < 0n) {
    abs = abs * 10n ** -drop;
  }
  const s = abs.toString().padStart(places + 1, '0');
  const intPart = places ? s.slice(0, -places) : s;
  const fracPart = places ? s.slice(-places) : '';
  const out = fracPart ? `${intPart}.${fracPart}` : intPart;
  return neg && /[1-9]/.test(out) ? `-${out}` : out;
}

export const dec = (v: Decimal | number | null | undefined, places = 2): Decimal => fromScaled(toScaled(v), places);
export const add = (a: Decimal, b: Decimal, places = 2): Decimal => fromScaled(toScaled(a) + toScaled(b), places);
export const sub = (a: Decimal, b: Decimal, places = 2): Decimal => fromScaled(toScaled(a) - toScaled(b), places);
export const mul = (a: Decimal, b: Decimal, places = 2): Decimal => fromScaled((toScaled(a) * toScaled(b)) / ONE + roundBump(toScaled(a) * toScaled(b)), places);
export const div = (a: Decimal, b: Decimal, places = 2): Decimal => {
  const d = toScaled(b);
  if (d === 0n) return fromScaled(0n, places);
  return fromScaled((toScaled(a) * ONE) / d, places);
};
export const neg = (a: Decimal, places = 2): Decimal => fromScaled(-toScaled(a), places);
export const abs = (a: Decimal, places = 2): Decimal => fromScaled(toScaled(a) < 0n ? -toScaled(a) : toScaled(a), places);
export const cmp = (a: Decimal, b: Decimal): -1 | 0 | 1 => {
  const x = toScaled(a);
  const y = toScaled(b);
  return x < y ? -1 : x > y ? 1 : 0;
};
export const eq = (a: Decimal, b: Decimal) => cmp(a, b) === 0;
export const gt = (a: Decimal, b: Decimal) => cmp(a, b) > 0;
export const gte = (a: Decimal, b: Decimal) => cmp(a, b) >= 0;
export const lt = (a: Decimal, b: Decimal) => cmp(a, b) < 0;
export const lte = (a: Decimal, b: Decimal) => cmp(a, b) <= 0;
export const isZero = (a: Decimal | null | undefined) => toScaled(a) === 0n;
export const min = (a: Decimal, b: Decimal): Decimal => (lte(a, b) ? a : b);
export const max = (a: Decimal, b: Decimal): Decimal => (gte(a, b) ? a : b);
export const sum = (values: ReadonlyArray<Decimal | null | undefined>, places = 2): Decimal =>
  fromScaled(values.reduce<bigint>((acc, v) => acc + toScaled(v), 0n), places);
/** `a * pct / 100`, e.g. percentOf('1000.00', '15') = '150.00'. */
export const percentOf = (a: Decimal, pct: Decimal, places = 2): Decimal => div(mul(a, pct, SCALE), '100', places);
/** Explicit rounding of an existing decimal string to `places`. */
export const round = (a: Decimal, places = 2): Decimal => fromScaled(toScaled(a), places);
/** Display-only conversion (charts, progress bars). Never feed the result back into arithmetic. */
export const toNumber = (a: Decimal | null | undefined): number => Number(fromScaled(toScaled(a), SCALE));

function roundBump(product: bigint): bigint {
  // product is scaled by ONE^2; the integer division above truncates toward zero, so add half-ulp correction
  const rem = (product < 0n ? -product : product) % ONE;
  if (rem * 2n >= ONE) return product < 0n ? -1n : 1n;
  return 0n;
}

/** `1,234.50` style display for a decimal string. */
export function formatDecimal(a: Decimal | null | undefined, places = 2, locale = 'en-US'): string {
  const s = fromScaled(toScaled(a), places);
  const neg = s.startsWith('-');
  const [i, f] = (neg ? s.slice(1) : s).split('.');
  const grouped = new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 }).format(BigInt(i));
  return `${neg ? '-' : ''}${grouped}${f ? `.${f}` : ''}`;
}
