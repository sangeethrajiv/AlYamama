import { dec } from '@erp/shared/utils';
import type { FieldDef, Lookups, Option, Rec as FormRec, SectionDef, ViewDef } from '@erp/web/metadata-forms';
import { relOptions } from './product-helpers';
import type { Ctx, EntityConfig, FieldSpec, Mode, Rec, Values } from './product-types';

const isInput = (f: FieldSpec) => f.kind !== 'readonly' && !f.detailOnly;
const unitKey = (cfg: EntityConfig, f: FieldSpec) => `product.fu.${cfg.key}.${f.key}`;

/** Maps one field spec onto the shared metadata form's field definition. */
function toField(cfg: EntityConfig, f: FieldSpec, mode: Mode, ctx: () => Ctx): FieldDef {
  const base: FieldDef = {
    key: f.key, type: 'text', label: f.suffix ? unitKey(cfg, f) : f.labelKey, required: f.required, span: f.span === 2 ? 2 : 1,
    hint: f.helpKey, placeholder: f.placeholderKey, mono: f.mono, rtl: f.rtl, column: f.column, requiredWhen: f.requiredWhen,
  };
  const showWhen = f.showWhen, debugOnly = f.debugOnly;
  // Debug-only fields read the live context, so they appear and disappear with debug mode.
  if (showWhen || debugOnly) base.visible = v => (!debugOnly || ctx().debug) && (!showWhen || showWhen(v, mode));
  const own = f.readonlyWhen;
  if (own) base.disabled = v => own(v, mode, ctx());
  switch (f.kind) {
    case 'text': {
      const max = f.maxLength;
      return { ...base, type: 'text', validate: max ? (v => (typeof v === 'string' && v.trim().length > max ? ctx().tr('product.v.maxLength', { max }) : null)) : undefined };
    }
    case 'textarea': return { ...base, type: 'textarea' };
    case 'number': return { ...base, type: 'number', min: f.min, max: f.max };
    case 'boolean': return { ...base, type: 'boolean' };
    case 'select': return { ...base, type: 'select', options: (f.options ?? []).map(o => ({ value: o.value, label: o.labelKey })), translateOptions: true, emptyOption: !f.required };
    case 'relation': {
      const rel = f.rel, domain = f.domain;
      if (!rel) return base;
      return {
        ...base, type: 'many2one',
        options: (value: FormRec): Option[] => {
          const c = ctx();
          const dom = domain ? (r: Rec) => domain(r, value as Values, c) : undefined;
          return relOptions(c.s, rel, value[f.key] as number | null, dom).map(o => ({ value: o.id, label: o.active ? o.label : `${o.label} (${c.tr('product.archivedTag')})` }));
        },
      };
    }
    case 'readonly': return { ...base, type: 'readonly', visible: () => mode === 'edit' };
  }
}

/** The form view for a model: every input field plus (in edit mode) its computed read-only fields. `ctx` is read lazily so options track the live data. */
export function buildView(cfg: EntityConfig, mode: Mode, ctx: () => Ctx): ViewDef {
  const sections: SectionDef[] = cfg.sections
    .map((sec, i) => ({
      id: `${cfg.key}-${i}`, title: sec.titleKey, columns: sec.columns ?? (2 as const), half: sec.half,
      fields: sec.fields.filter(f => isInput(f) || (f.kind === 'readonly' && !f.detailOnly && mode === 'edit')).map(f => toField(cfg, f, mode, ctx)),
    }))
    .filter(sec => sec.fields.length > 0);
  return { entity: cfg.key, type: 'form', sections };
}

export const noLookups: Lookups = {};

/** Record -> values the form edits: decimal strings become numbers (typed freely), computed fields are filled in. */
export function toForm(cfg: EntityConfig, src: Values, ctx: Ctx): Values {
  const out: Values = { ...src, ...cfg.prepare?.(src) };
  for (const sec of cfg.sections) {
    for (const f of sec.fields) {
      if (f.kind === 'number' && out[f.key] != null && out[f.key] !== '') out[f.key] = Number(out[f.key]);
      else if (f.kind === 'readonly' && f.get && !f.detailOnly && src['id'] != null) out[f.key] = f.get(src as Rec, ctx);
      else if (f.kind === 'select' && !out[f.key]) out[f.key] = null;
    }
  }
  return out;
}

/** Form values -> the values to validate and save (numbers back to decimal strings, text trimmed). */
export function fromForm(cfg: EntityConfig, v: Values): Values {
  const out: Values = { ...v };
  for (const sec of cfg.sections) {
    for (const f of sec.fields) {
      if (!isInput(f)) continue;
      const raw = v[f.key];
      if (f.kind === 'number') out[f.key] = raw === null || raw === '' || raw === undefined ? '0' : dec(String(raw), f.places ?? 2);
      else if (f.kind === 'boolean') out[f.key] = !!raw;
      else if (f.kind === 'relation') out[f.key] = raw ?? null;
      else if (f.kind === 'select') out[f.key] = raw ?? '';
      else out[f.key] = typeof raw === 'string' ? raw.trim() : (raw ?? '');
    }
  }
  return out;
}
