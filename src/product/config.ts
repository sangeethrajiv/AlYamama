import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Opt } from './options'
import type { EntityKey, Id, ProductState, Rec, RelKey } from './types'
import type { Tone } from './ui'

export type Values = Record<string, any>
export type Mode = 'create' | 'edit'

export type FieldKind = 'text' | 'textarea' | 'number' | 'select' | 'relation' | 'boolean' | 'readonly'

export type FieldDef = {
  /** Odoo technical field name */
  key: string
  label: string
  kind: FieldKind
  required?: boolean
  help?: string
  placeholder?: string
  options?: Opt[]
  rel?: RelKey
  /** extra filter for relation options */
  domain?: (r: Rec, values: Values, s: ProductState) => boolean
  step?: string
  min?: number
  max?: number
  maxLength?: number
  integer?: boolean
  suffix?: string
  span?: 1 | 2
  rtl?: boolean
  mono?: boolean
  showWhen?: (v: Values, mode: Mode) => boolean
  readonlyWhen?: (v: Values, mode: Mode, s: ProductState) => boolean
  /** returns extra values to patch when this field changes (Odoo @api.onchange) */
  onChange?: (value: any, next: Values, s: ProductState) => Values
  /** read-only computed value (kind "readonly") */
  get?: (rec: Rec, s: ProductState) => ReactNode
  formOnly?: boolean
  detailOnly?: boolean
  /** hide in the detail view when empty */
  hideEmpty?: boolean
}

export type Section = { title: string; description?: string; fields: FieldDef[] }

export type Column = {
  key: string
  label: string
  render: (r: Rec, s: ProductState) => ReactNode
  sort?: (r: Rec, s: ProductState) => string | number
  align?: 'right'
  hide?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** allow the cell text to wrap (default: single line) */
  wrap?: boolean
  primary?: boolean
}

export type FilterDef = {
  key: string
  label: string
  options: (s: ProductState) => Opt[]
  match: (r: Rec, value: string, s: ProductState) => boolean
}

export type Related = {
  title: string
  entity: EntityKey
  items: (rec: Rec, s: ProductState) => Rec[]
  meta?: (r: Rec, s: ProductState) => ReactNode
  /** hash path to create a related record */
  addPath?: string
}

export type Stat = { label: string; value: ReactNode; hint?: string }

export type EntityConfig = {
  key: EntityKey
  route: string
  title: string
  singular: string
  /** Odoo model name shown as a technical caption */
  model: string
  subtitle: string
  icon: LucideIcon
  nameOf: (r: Rec, s: ProductState) => string
  columns: Column[]
  searchText: (r: Rec, s: ProductState) => string
  searchPlaceholder: string
  filters: FilterDef[]
  defaultSort: { key: string; dir: 'asc' | 'desc' }
  sections: Section[]
  defaults: (s: ProductState) => Values
  validate?: (v: Values, s: ProductState, id?: Id) => Record<string, string>
  /** extra initial form values derived from a record (e.g. factor_inv) */
  prepare?: (rec: Values, s: ProductState) => Values
  /** last transformation of the validated form values before they are stored */
  finalize?: (v: Values) => Values
  badges?: (r: Rec, s: ProductState) => { label: string; tone: Tone }[]
  stats?: (r: Rec, s: ProductState) => Stat[]
  related?: Related[]
  /** The Odoo 12 model has no `active` column: archive is a UI-only state in this prototype */
  uiOnlyActive?: boolean
}
