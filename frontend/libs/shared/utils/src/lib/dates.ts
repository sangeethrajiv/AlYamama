/** ISO 8601 helpers. Dates are `YYYY-MM-DD` strings, timestamps are `YYYY-MM-DD HH:mm[:ss]` in mock data. */
export const todayIso = (): string => new Date().toISOString().slice(0, 10);
export const nowStamp = (): string => new Date().toISOString().replace('T', ' ').slice(0, 19);
export const nowMinute = (): string => new Date().toISOString().replace('T', ' ').slice(0, 16);

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

export const isIsoDate = (v: string | null | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** "Nov 05, 2026" */
export function formatDate(iso: string | null | undefined, locale = 'en-GB'): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
}
