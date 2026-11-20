/* eslint-disable @typescript-eslint/no-explicit-any -- the four Product models share one config-driven list/detail/form engine; records are addressed by field key */
import type { ProductEntityKey, ProductState } from '@erp/shared/contracts';

/** Any Product record (product.template, product.category, uom.uom, uom.category) addressed by Odoo field name. */
export type Rec = { id: number; active: boolean; [key: string]: any };
export type Values = Record<string, any>;
export type Mode = 'create' | 'edit';
/** Translation function (`I18n.tr`). Configs never import Angular services. */
export type Tr = (key: string, params?: Record<string, unknown>) => string;
/**
 * What every config callback may need: the current data and translation. `debug` is true when debug mode is on and the user
 * may write product data; it reveals technical fields (Odoo `groups="base.group_no_one"`).
 */
export interface Ctx { s: ProductState; tr: Tr; debug: boolean }

export type RelKey = ProductEntityKey | 'companies' | 'users' | 'taxes' | 'sequences' | 'removalStrategies' | 'accounts' | 'journals';
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
  /** Pin to the left (1) or right (2) column of the section. */
  column?: 1 | 2;
  /** Required only while this is true (Odoo `attrs required`). */
  requiredWhen?: (v: Values) => boolean;
  /** Technical field: shown (form and detail) only in debug mode. */
  debugOnly?: boolean;
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
  /** Shown in the detail page's title instead of as a row of the sheet (the form still has it). */
  detailHidden?: boolean;
  /** Small grey hint under the value on the detail view (e.g. the ratio formula). */
  detailHint?: (r: Rec, c: Ctx) => string;
}

export interface SectionSpec {
  titleKey: string;
  fields: FieldSpec[];
  /** Inner grid columns (default 2). */
  columns?: 1 | 2;
  /** Share a row with the next half-width section on wide screens. */
  half?: boolean;
  /** How the read-only detail sheet differs from the form (reference view only). */
  detail?: { title?: boolean; columns?: 1 | 2; half?: boolean };
}
/** Odoo stat button ("Products"): a count that opens the related list filtered to this record. */
export interface SmartButton {
  labelKey: string;
  icon: string;
  count: (r: Rec, c: Ctx) => number;
  /** List to open and the filter key (on that list) that narrows it to this record. */
  entity: ProductEntityKey;
  filterKey: string;
}
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
  /** Reference-view page title (the Odoo `name` field) and an optional second line, e.g. the Arabic name. */
  detailTitle?: (r: Rec, c: Ctx) => { text: string; secondary?: string };
  /** Stat button at the top-right of the form. */
  smartButton?: SmartButton;
  /** Odoo form conventions: Save / Discard buttons instead of Create / Save changes / Cancel. */
  odooForm?: boolean;
  /**
   * Reference (Odoo) presentation of the list and detail pages: a plain list with a checkbox column and a read-only
   * label/value sheet. The list has no buttons; the detail shows only Edit (no create, archive or delete) for now.
   */
  odooView?: boolean;
  /** The Odoo 12 model has no `active` column: archive is a UI-only state in this prototype. */
  uiOnlyActive?: boolean;
}

export const titleKey = (e: ProductEntityKey) => `product.e.${e}.title`;
export const singularKey = (e: ProductEntityKey) => `product.e.${e}.singular`;
