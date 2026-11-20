let counter = 0;

/** Client-side id for mock records only. A real API assigns ids server-side. */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** 4-digit stamp used by the prototype for mock document numbers. */
export const stamp4 = (): number => 1000 + Math.floor(Math.random() * 9000);

export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}
