import type { Option } from '@erp/web/metadata-forms';
import type { ContactLookups, PartnerType } from '@erp/shared/contracts';

export const PARTNER_TYPES: { id: PartnerType; labelKey: string }[] = [
  { id: 'contact', labelKey: 'contacts.type.contact' },
  { id: 'invoice', labelKey: 'contacts.type.invoice' },
  { id: 'delivery', labelKey: 'contacts.type.delivery' },
  { id: 'other', labelKey: 'contacts.type.other' },
  { id: 'private', labelKey: 'contacts.type.private' },
];

export const ID_SCHEMES: { code: string; labelKey: string }[] = [
  { code: 'TIN', labelKey: 'contacts.scheme.TIN' }, { code: 'CRN', labelKey: 'contacts.scheme.CRN' },
  { code: 'MOM', labelKey: 'contacts.scheme.MOM' }, { code: 'MLS', labelKey: 'contacts.scheme.MLS' },
  { code: '700', labelKey: 'contacts.scheme.700' }, { code: 'SAG', labelKey: 'contacts.scheme.SAG' },
  { code: 'OTH', labelKey: 'contacts.scheme.OTH' },
];

export const TITLE_OPTIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Eng.', 'Sheikh'];
export const NOTIFICATION_TYPES: Option[] = [{ value: 'email', label: 'Handle by Emails' }, { value: 'inbox', label: 'Handle in Odoo' }];
export const SIDEBAR_TYPES: Option[] = [{ value: 'invisible', label: 'Invisible' }, { value: 'small', label: 'Small' }, { value: 'large', label: 'Large' }];
export const CHATTER_POSITIONS: Option[] = [{ value: 'normal', label: 'Normal' }, { value: 'sided', label: 'Sided' }];
export const ODOOBOT_STATES: Option[] = [
  'not_initialized', 'onboarding_emoji', 'onboarding_attachement', 'onboarding_command', 'onboarding_ping', 'idle', 'disabled',
].map(v => ({ value: v, label: v.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) }));
export const WORKING_STATUSES: Option[] = [
  { value: 'presently_working', label: 'Presently Working' }, { value: 'on_vacation', label: 'On Vacation' },
  { value: 'resigned', label: 'Resigned' }, { value: 'terminated', label: 'Terminated' },
];

export const labelOf = (opts: Option[], v?: string) => (v ? (opts.find(o => o.value === v)?.label ?? v) : '');
export const nameOf = (list: { id: number; name: string }[], id?: number | null) => (id ? (list.find(o => o.id === id)?.name ?? `#${id}`) : '');

/** Lookup lists turned into option arrays for metadata forms. */
export function lookupOptions(l: ContactLookups): Record<string, Option[]> {
  const o = (xs: { id: number; name: string }[]): Option[] => xs.map(x => ({ value: x.id, label: x.name }));
  return {
    countries: o(l.countries), titles: o(l.titles), salesTeams: o(l.salesTeams), jobs: o(l.jobs), departments: o(l.departments),
    employees: o(l.employees), companies: o(l.companies), industries: o(l.industries), tags: o(l.tags),
    languages: l.languages.map(x => ({ value: x.code, label: x.name })),
    timezones: l.timezones.map(t => ({ value: t, label: t })),
  };
}
