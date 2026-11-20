import type { Opt, Tr } from './product-types';

/** Selection lists. Values are the Odoo selection keys; labels are translation keys. */
export const PRODUCT_TYPE_OPTIONS: Opt[] = [
  { value: 'product', labelKey: 'product.o.type.product' },
  { value: 'consu', labelKey: 'product.o.type.consu' },
  { value: 'service', labelKey: 'product.o.type.service' },
];
export const TRACKING_OPTIONS: Opt[] = [
  { value: 'none', labelKey: 'product.o.tracking.none' },
  { value: 'lot', labelKey: 'product.o.tracking.lot' },
  { value: 'serial', labelKey: 'product.o.tracking.serial' },
];
export const INTERNAL_TYPE_OPTIONS: Opt[] = [
  { value: 'material', labelKey: 'product.o.internal.material' },
  { value: 'labour', labelKey: 'product.o.internal.labour' },
  { value: 'overhead', labelKey: 'product.o.internal.overhead' },
];
export const MEASURE_TYPE_OPTIONS: Opt[] = [
  { value: 'unit', labelKey: 'product.o.measure.unit' },
  { value: 'weight', labelKey: 'product.o.measure.weight' },
  { value: 'time', labelKey: 'product.o.measure.time' },
  { value: 'length', labelKey: 'product.o.measure.length' },
  { value: 'volume', labelKey: 'product.o.measure.volume' },
];
export const UOM_TYPE_OPTIONS: Opt[] = [
  { value: 'reference', labelKey: 'product.o.uomType.reference' },
  { value: 'bigger', labelKey: 'product.o.uomType.bigger' },
  { value: 'smaller', labelKey: 'product.o.uomType.smaller' },
];
export const YES_NO: Opt[] = [
  { value: 'yes', labelKey: 'product.o.yes' },
  { value: 'no', labelKey: 'product.o.no' },
];

/** Label of an option value, or the raw value when unknown, or '' when empty. */
export const optLabel = (opts: Opt[], value: unknown, tr: Tr): string => {
  const o = opts.find(x => x.value === value);
  return o ? tr(o.labelKey) : value ? String(value) : '';
};
