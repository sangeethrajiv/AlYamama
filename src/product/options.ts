export type Opt = { value: string; label: string }

export const PRODUCT_TYPE_OPTIONS: Opt[] = [
  { value: 'product', label: 'Storable Product' },
  { value: 'consu', label: 'Consumable' },
  { value: 'service', label: 'Service' },
]

export const TRACKING_OPTIONS: Opt[] = [
  { value: 'none', label: 'No Tracking' },
  { value: 'lot', label: 'By Lots' },
  { value: 'serial', label: 'By Unique Serial Number' },
]

export const INTERNAL_TYPE_OPTIONS: Opt[] = [
  { value: 'material', label: 'Material' },
  { value: 'labour', label: 'Labour' },
  { value: 'overhead', label: 'Overhead' },
]

export const MEASURE_TYPE_OPTIONS: Opt[] = [
  { value: 'unit', label: 'Units' },
  { value: 'weight', label: 'Weight' },
  { value: 'time', label: 'Time' },
  { value: 'length', label: 'Length' },
  { value: 'volume', label: 'Volume' },
]

export const UOM_TYPE_OPTIONS: Opt[] = [
  { value: 'reference', label: 'Reference Unit of Measure for this category' },
  { value: 'bigger', label: 'Bigger than the reference Unit of Measure' },
  { value: 'smaller', label: 'Smaller than the reference Unit of Measure' },
]

export const optLabel = (opts: Opt[], value: unknown): string =>
  opts.find((o) => o.value === value)?.label ?? (value ? String(value) : '')

export const YES_NO: Opt[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]
