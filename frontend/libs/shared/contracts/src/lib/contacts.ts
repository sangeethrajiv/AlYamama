import type { Decimal } from './common';

// ---------------------------------------------------------------- Contacts directory ("Users" module)
export type ContactKind = 'company' | 'individual';
export type AddressType = 'invoice' | 'delivery' | 'other' | 'private';
export type OtherKind = 'own_company' | 'bank' | 'other';

export interface ContactAddress {
  id: string;
  type: AddressType;
  street: string;
  city: string;
  region: string;
  zip: string;
  country: string;
  neighborhood?: string;
  streetAr?: string;
  cityAr?: string;
  buildingNumber?: string;
  plotId?: string;
}

export interface Contact {
  id: string;
  kind: ContactKind;
  name: string;
  parentId?: string;
  jobTitle?: string;
  isCustomer: boolean;
  isVendor: boolean;
  isLogin?: boolean;
  isEmployee?: boolean;
  otherKind?: OtherKind;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  vat: string;
  crNumber: string;
  taxRegime: 'VAT registered' | 'Not registered' | 'Exempt';
  paymentTerms: string;
  creditLimit: Decimal;
  currency: string;
  addresses: ContactAddress[];
  tags: string[];
  notes: string;
  active: boolean;
  image?: string;
  legalName?: string;
  idScheme?: 'CRN' | 'MOM' | 'MLS' | 'SAG' | 'OTH' | 'TIN' | '700';
  idNumber?: string;
  customerCode?: string;
  vendorNo?: string;
  discountPct?: Decimal;
  cashCustomer?: boolean;
  language?: string;
  title?: string;
  fax?: string;
  taxIdArabic?: string;
  discount?: Decimal;
  girfalcoId?: string;
  companyCode?: string;
  signature?: string;
  seal?: string;
  signatory?: string;
  signatoryTitle?: string;
  salesperson?: string;
  vendorPaymentTerms?: string;
  latitude?: string;
  longitude?: string;
  locationNotes?: string;
  bankName?: string;
  iban?: string;
  swift?: string;
  billingEmail?: string;
  invoiceDelivery?: 'email' | 'print' | 'both';
  createdAt: string;
}

// ---------------------------------------------------------------- Contact master (res.partner)
export type PartnerType = 'contact' | 'invoice' | 'delivery' | 'other' | 'private';

/** res.partner record. Keys keep the Odoo column names of the source prototype. */
export interface ResPartner {
  id: number;
  name: string;
  display_name: string;
  is_company: boolean;
  type: PartnerType;
  title: number | null;
  function: string;
  parent_id: number | null;
  commercial_partner_id: number;
  company_name: string;
  ref: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  fax: string;
  category_id: number[];
  street: string;
  street2: string;
  arabic_street2_name: string;
  city: string;
  arabic_city_name: string;
  l10n_sa_edi_building_number: string;
  l10n_sa_edi_plot_identification: string;
  state_id: number | null;
  zip: string;
  country_id: number | null;
  vat: string;
  barcode: string;
  date: string;
  comment: string;
  lang: string;
  tz: string;
  industry_id: number | null;
  arabic_name: string;
  l10n_sa_registered_name: string;
  l10n_sa_additional_identification_scheme: string;
  l10n_sa_additional_identification_number: string;
  vat_arabic: string;
  cr_number: string;
  customer: boolean;
  supplier: boolean;
  employee: boolean;
  cash_customer: boolean;
  customer_discount: Decimal;
  discount: Decimal;
  customer_code: string;
  vandor_number: string;
  company_name_code: string;
  ext_res_id: number | null;
  credit_limit: Decimal;
  user_id: number | null;
  company_id: number | null;
  partner_share: boolean;
  color: number;
  active: boolean;
}

export type PartnerDraft = Omit<ResPartner, 'id' | 'display_name' | 'commercial_partner_id'>;

// ---------------------------------------------------------------- Users and access rights (res.users)
export interface Employee {
  id: number;
  name: string;
  active: boolean;
  employee_code?: string;
  job_title?: string;
  job_id?: number;
  department_id?: number;
  parent_id?: number;
  coach_id?: number;
  work_email?: string;
  work_phone?: string;
  mobile_phone?: string;
  work_location?: string;
  date_of_joining?: string;
  date_of_relieving?: string;
  working_status?: string;
  company_id?: number;
}

export interface ResUser {
  id: number;
  active: boolean;
  login: string;
  company_id: number;
  partner_id: number;
  share?: boolean;
  signature?: string;
  action_id?: number;
  create_date: string;
  write_date: string;
  create_uid?: number;
  write_uid?: number;
  notification_type: string;
  odoobot_state: string;
  sidebar_type: string;
  chatter_position: string;
  sale_team_id?: number;
  target_sales_won?: number;
  target_sales_done?: number;
  target_sales_invoiced?: number;
  website_id?: number;
  helpdesk_target_closed?: number;
  helpdesk_target_rating?: number;
  helpdesk_target_success?: number;
  pseudo_name?: string;
  is_gcc_user?: boolean;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  function?: string;
  title?: number;
  lang: string;
  tz?: string;
  country_id?: number;
  state_id?: number;
  city?: string;
  street?: string;
  street2?: string;
  zip?: string;
  website?: string;
  comment?: string;
  vat?: string;
  ref?: string;
  arabic_name?: string;
  extension_number?: string;
  parent_id?: number;
  employee?: boolean;
  signup_type?: string;
  company_ids: number[];
  groups: number[];
  login_date?: string;
  logins?: string[];
  emp?: Employee;
}

export interface LookupOption {
  id: number;
  name: string;
}
export interface StateOption extends LookupOption {
  country_id: number;
}
export interface CompanyOption extends LookupOption {
  parent_id: number | null;
}
export interface SecurityGroup {
  id: number;
  name: string;
  category: string | null;
  share: boolean;
}
/** Dropdown sources shared by the users and contact-master screens. */
export interface ContactLookups {
  countries: LookupOption[];
  states: StateOption[];
  titles: LookupOption[];
  salesTeams: LookupOption[];
  jobs: LookupOption[];
  departments: LookupOption[];
  employees: LookupOption[];
  companies: CompanyOption[];
  languages: { code: string; name: string }[];
  groups: SecurityGroup[];
  timezones: string[];
  industries: LookupOption[];
  tags: LookupOption[];
}
