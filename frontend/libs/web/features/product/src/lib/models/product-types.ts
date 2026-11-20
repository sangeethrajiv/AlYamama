/* eslint-disable @typescript-eslint/no-explicit-any -- the four Product models share one config-driven list/detail/form engine; records are addressed by field key */
import type { ProductEntityKey, ProductState } from '@erp/shared/contracts';

/** Any Product record (product.template, product.category, uom.uom, uom.category) addressed by Odoo field name. */
export type Rec = { id: number; active: boolean; [key: string]: any };
export type Values = Record<string, any>;
export type Mode = 'create' | 'edit';
/** Translation function (`I18n.tr`). Configs never import Angular services. */
export type Tr = (key: string, params?: Record<string, unknown>) => string;
/** What every config callback may need: the current data and translation. */
export interface Ctx { s: ProductState; tr: Tr }

export type RelKey = ProductEntityKey | 'companies' | 'users';
export type PillTone = 'slate' | 'green' | 'amber' | 'red' | 'blue';
/** Option whose label is a translation key. */
export interface Opt { value: string; labelKey: string }
export interface Choice { value: string; label: string }

/** A list cell. The list page renders each kind; configs never produce markup. */
export type Cell =
  | { kind: 'text'; text: string; danger?: boolean }
  | { kind: 'mono'; text: string }
  | { kind: 'name'; text: string; sub?: string }
  | { kind: 'rtl'; text: string }
  | { kind: 'pill'; text: string; tone: PillTone }
  | { kind: 'dash' };

export type HideFrom = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface ColumnSpec {
  key: string;
  labelKey: string;
  primary?: boolean;
  right?: boolean;
  hide?: HideFrom;
  /** Allow the cell text to wrap (default: single line). */
  wrap?: boolean;
  sort?: (r: Rec, c: Ctx) => string | number;
  cell: (r: Rec, c: Ctx) => Cell;
}

export interface FilterSpec {
  key: string;
  labelKey: string;
  options: (c: Ctx) => Choice[];
  match: (r: Rec, value: string, c: Ctx) => boolean;
}

export type FieldKind = 'text' | 'textarea' | 'number' | 'select' | 'relation' | 'boolean' | 'readonly';

export interface FieldSpec {
  /** Odoo technical field name. */
  key: string;
  labelKey: string;
  kind: FieldKind;
  required?: boolean;
  /** Translation key of the help text. */
  helpKey?: string;
  options?: Opt[];
  /** Related model for `relation` fields. */
  rel?: RelKey;
  /** Extra filter for relation options. */
  domain?: (r: Rec, values: Values, c: Ctx) => boolean;
  /** Decimal places kept for `number` fields (decimal strings). */
  places?: number;
  min?: number;
  max?: number;
  maxLength?: number;
  /** Translation key of the input placeholder. */
  placeholderKey?: string;
  /** Unit shown with the value (kg, SAR, %). */
  suffix?: string;
  span?: 1 | 2;
  rtl?: boolean;
  mono?: boolean;
  showWhen?: (v: Values, mode: Mode) => boolean;
  readonlyWhen?: (v: Values, mode: Mode, c: Ctx) => boolean;
  /** Returns extra values to patch when this field changes (Odoo `@api.onchange`). */
  onChange?: (value: any, next: Values, c: Ctx) => Values;
  /** Read-only computed value (`readonly` fields). */
  get?: (r: Rec, c: Ctx) => string;
  /** Hide in the detail view when empty. */
  hideEmpty?: boolean;
  /** Only shown on the detail view (computed by stock etc.). */
  detailOnly?: boolean;
}

export interface SectionSpec { titleKey: string; fields: FieldSpec[] }
export interface Stat { labelKey: string; value: string; hint?: string }
export interface Badge { text: string; tone: PillTone }
export interface RelatedSpec {
  titleKey: string;
  entity: ProductEntityKey;
  items: (r: Rec, c: Ctx) => Rec[];
  meta?: (r: Rec, c: Ctx) => string;
}

export interface EntityConfig {
  key: ProductEntityKey;
  /** Route segment under /product. */
  route: string;
  /** Odoo model name shown as a technical caption. */
  model: string;
  icon: string;
  /** i18n keys: `product.e.<key>.title|singular|subtitle|search`. */
  nameOf: (r: Rec, c: Ctx) => string;
  searchText: (r: Rec, c: Ctx) => string;
  defaultSort: { key: string; dir: 'asc' | 'desc' };
  columns: ColumnSpec[];
  filters: FilterSpec[];
  badges?: (r: Rec, c: Ctx) => Badge[];
  stats?: (r: Rec, c: Ctx) => Stat[];
  sections: SectionSpec[];
  defaults: (s: ProductState) => Values;
  /** Extra initial form values derived from a record (e.g. factor_inv). */
  prepare?: (rec: Values) => Values;
  /** Last transformation of the validated form values before they are saved. */
  finalize?: (v: Values) => Values;
  /** Cross-field and uniqueness checks. Returns messages by field key. */
  validate?: (v: Values, c: Ctx, id?: number) => Record<string, string>;
  related?: RelatedSpec[];
  /** The Odoo 12 model has no `active` column: archive is a UI-only state in this prototype. */
  uiOnlyActive?: boolean;
}

export const titleKey = (e: ProductEntityKey) => `product.e.${e}.title`;
export const singularKey = (e: ProductEntityKey) => `product.e.${e}.singular`;
