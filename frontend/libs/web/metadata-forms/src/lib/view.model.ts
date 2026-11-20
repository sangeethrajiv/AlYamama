import type { Decimal } from '@erp/shared/utils';

/**
 * Metadata view format (architecture appendix A.10). A view describes PRESENTATION only: it never grants
 * authorization and never replaces API validation (section 12.4).
 */
export type FieldType =
  | 'text' | 'textarea' | 'email' | 'tel' | 'url' | 'number' | 'money' | 'date' | 'boolean'
  | 'select' | 'many2one' | 'many2many' | 'image' | 'one2many' | 'readonly';

export type Primitive = string | number | boolean | null;
export type Rec = Record<string, unknown>;

export interface Option {
  value: Primitive;
  label: string;
  /** Parent key for dependent lists, e.g. a state's country id. */
  group?: Primitive;
}
/** Named option lists supplied by the page (e.g. countries), referenced by `resource`. */
export type Lookups = Record<string, Option[]>;

export interface ColumnDef {
  key: string;
  /** Translation key. */
  label: string;
  type?: 'text' | 'select';
  options?: Option[] | ((row: Rec, lookups: Lookups) => Option[]);
  mono?: boolean;
  rtl?: boolean;
  /** Tailwind width class, e.g. `w-40`. */
  width?: string;
}

export interface FieldDef {
  /** Property of the record. */
  key: string;
  type: FieldType;
  /** Translation key. */
  label: string;
  required?: boolean;
  /** 1-4 grid columns; `full` spans the whole row. */
  span?: 1 | 2 | 3 | 4 | 'full';
  hint?: string;
  placeholder?: string;
  mono?: boolean;
  /** Right-to-left text input (Arabic names/addresses). */
  rtl?: boolean;
  readonly?: boolean;
  options?: Option[] | ((value: Rec, lookups: Lookups) => Option[]);
  /** Free-text field with suggestions taken from this `lookups` resource (an HTML datalist). */
  suggestions?: string;
  /** Key into the `lookups` input for select / many2one / many2many. */
  resource?: string;
  /** Option labels are translation keys. */
  translateOptions?: boolean;
  /** Include an empty choice in select / many2one. Default true. */
  emptyOption?: boolean;
  pattern?: RegExp;
  patternMessage?: string;
  min?: number;
  max?: number;
  /** Decimal places for `money`. */
  places?: number;
  /** Row columns for `one2many`. */
  columns?: ColumnDef[];
  /** Factory for a new `one2many` row. */
  newRow?: () => Rec;
  /** Fields reset to empty when the user changes this one (e.g. country clears state). */
  clears?: string[];
  visible?: (value: Rec) => boolean;
  disabled?: (value: Rec) => boolean;
  /** Custom validation: return a translation key or message, or null when valid. */
  validate?: (value: unknown, record: Rec) => string | null;
}

export interface SectionDef {
  id: string;
  /** Translation key; omit for an untitled block. */
  title?: string;
  columns?: 1 | 2 | 3 | 4;
  /** Column in a `split` layout (default 1). */
  column?: 1 | 2;
  /** Tab this section belongs to (see ViewDef.tabs). */
  tab?: string;
  visible?: (value: Rec) => boolean;
  fields: FieldDef[];
}

export interface ViewDef {
  entity: string;
  type: 'form';
  tabs?: { id: string; label: string }[];
  sections: SectionDef[];
}

export interface ListColumn<T> {
  key: string;
  /** Translation key. */
  label: string;
  right?: boolean;
  /** Plain text for the cell, sorting and export. */
  text: (row: T) => string;
  /** Visual style of the cell. */
  kind?: 'strong' | 'mono' | 'pill-active' | 'muted';
  sortable?: boolean;
}

export const DECIMAL_RE = /^-?\d+(\.\d+)?$/;
export type { Decimal };
