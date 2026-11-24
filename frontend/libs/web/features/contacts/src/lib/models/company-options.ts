import type { Option } from '@erp/web/metadata-forms';

/** res.company `l10n_sa_additional_identification_scheme` selection (Odoo 12 labels). */
export const ID_SCHEMES: Record<string, string> = {
  TIN: 'Tax Identification Number', CRN: 'Commercial Registration Number', MOM: 'Momra License', MLS: 'MLSD License', '700': '700 Number',
  SAG: 'Sagia License', NAT: 'National ID', GCC: 'GCC ID', IQA: 'Iqama Number', PAS: 'Passport ID', OTH: 'Other ID',
};
export const ID_SCHEME_OPTIONS: Option[] = Object.entries(ID_SCHEMES).map(([value, label]) => ({ value, label }));
