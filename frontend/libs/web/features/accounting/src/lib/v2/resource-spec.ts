import type { FieldDef } from '@erp/web/metadata-forms';
import type { LineColumn, Row } from './lines-editor.component';

/** One screen of the accounting module, described as data: the generic list and form pages render it. */
export interface ColumnSpec {
  key: string;
  label: string;
  /** Text for the cell; defaults to the value, or a many2one's name. */
  get?: (r: Row) => string;
  right?: boolean;
  /** Render as a coloured status pill. */
  pill?: boolean;
  mono?: boolean;
}
export interface ActionSpec {
  id: string;
  label: string;
  /** Shown when true. Defaults to always. */
  when?: (r: Row) => boolean;
  kind?: 'primary' | 'ghost' | 'danger';
  /** Ask before running. */
  confirm?: string;
  /** Not offered to the user who prepared the record (the backend refuses self-approval anyway). */
  notByPreparer?: boolean;
  /** Needs a typed reason (rejections); sent as `{ reason }`. */
  reason?: string;
  /** Extra JSON body. */
  body?: Row;
  /** The action returns a different record (a reversal): open it at this path instead of reloading. */
  openResult?: (res: Row) => string;
}
export interface FilterSpec { key: string; label: string; options: { value: string; label: string }[] }
export interface LinesSpec {
  /** Key of the array in the record (also the key sent back). */
  key: string;
  title: string;
  columns: LineColumn[];
  newRow: () => Row;
  /** Shown but never edited (the depreciation board). */
  readonly?: boolean;
  /** Only editable while this returns true. */
  editableWhen?: (r: Row) => boolean;
}
export interface ResourceSpec {
  key: string;
  /** Page title (plural). */
  title: string;
  singular: string;
  /** Backend collection, e.g. `/accounting/taxes`. */
  api: string;
  /** Front-end path segment under /accounting. */
  path: string;
  columns: ColumnSpec[];
  fields: FieldDef[];
  lines?: LinesSpec[];
  actions?: ActionSpec[];
  filters?: FilterSpec[];
  /** Always sent on the list call, e.g. `{ move_type: 'entry' }`. */
  listQuery?: Record<string, string>;
  /** Defaults for a new record. */
  blank?: () => Row;
  canCreate?: boolean;
  canDelete?: boolean;
  /** The record cannot be edited once this is true (posted documents). */
  lockedWhen?: (r: Row) => boolean;
  /** Field with the record's state, shown as a badge in the header. */
  stateKey?: string;
  /** Shown above the list. */
  note?: string;
  /** Odoo model name, for the notes and attachments panel. */
  model?: string;
  /** Permission needed to create, edit or act. Defaults to accounting.account.write. */
  perm?: string;
  /** Items shown read-only under the form, e.g. the payments an entry was reconciled with. */
  subtitle?: (r: Row) => string;
}

// ---- record <-> form -------------------------------------------------------------------------------------------

const isM2o = (v: unknown): v is { id: number; name?: string | null } => !!v && typeof v === 'object' && !Array.isArray(v) && 'id' in v;

/**
 * Backend record -> form record. A many2one `{id, name}` becomes the id plus `<key>_label` (the dropdown shows the
 * name until it has loaded the option); a list of such objects becomes a list of ids. Line arrays are normalised row by row.
 */
export function toForm(rec: Row, lineKeys: string[] = []): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(rec)) {
    if (lineKeys.includes(k) && Array.isArray(v)) { out[k] = v.map(r => toForm(r as Row)); continue; }
    if (isM2o(v)) { out[k] = v.id; out[`${k}_label`] = v.name ?? ''; continue; }
    // a DATE column may arrive as a full timestamp; the date input wants YYYY-MM-DD
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) { out[k] = v.slice(0, 10); continue; }
    if (Array.isArray(v) && v.every(isM2o)) { out[k] = v.map(x => x.id); continue; }
    out[k] = v;
  }
  return out;
}

/** Form record -> request body: drops `_label` helpers and read-only noise, turns empty strings into null. */
export function toBody(rec: Row, fields: FieldDef[], lines: LinesSpec[] = []): Row {
  const body: Row = {};
  const editable = new Set(fields.filter(f => f.type !== 'readonly').map(f => f.key));
  for (const k of editable) {
    if (!(k in rec)) continue;
    const v = rec[k];
    body[k] = v === '' ? null : v;
  }
  for (const l of lines.filter(x => !x.readonly)) {
    const keys = l.columns.filter(c => c.type !== 'readonly').map(c => c.key);
    body[l.key] = ((rec[l.key] as Row[]) ?? []).map(r => {
      const row: Row = {};
      for (const k of keys) if (k in r) row[k] = r[k] === '' ? null : r[k];
      return row;
    });
  }
  return body;
}

/** Plain text of a cell. */
export function cellText(c: ColumnSpec, r: Row): string {
  if (c.get) return c.get(r);
  const v = r[c.key];
  if (v === null || v === undefined) return '';
  if (isM2o(v)) return String(v.name ?? '');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

const TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'slate'> = {
  posted: 'green', paid: 'green', approved: 'green', reconciled: 'green', open: 'blue', confirm: 'amber', partial: 'amber', in_payment: 'amber',
  to_approve: 'amber', draft: 'slate', not_paid: 'slate', not_required: 'slate', cancel: 'red', cancelled: 'red', rejected: 'red', close: 'slate', sent: 'blue',
};
export const pillTone = (state: string) => TONE[state] ?? 'slate';
export const pillText = (state: string) => state.replace(/_/g, ' ');
