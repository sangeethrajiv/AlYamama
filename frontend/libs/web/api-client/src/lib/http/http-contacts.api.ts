import { Injectable, inject } from '@angular/core';
import type { Contact, ContactLookups, PartnerDraft, ResPartner, ResUser } from '@erp/shared/contracts';
import { ContactsApi, type PartnerActivity } from '../api/contacts.api';
import { MockContactsApi } from '../mock/mock-contacts.api';
import { BackendHttp } from './backend-http';

type Rec = Record<string, unknown>;
type M2o = { id: number } | number | null | undefined;
type Tag = { id: number };

const id = (v: M2o): number | null => (v == null ? null : typeof v === 'object' ? v.id : v);
const str = (v: unknown): string => (v == null ? '' : String(v));
const dec = (v: unknown): string => (v == null || v === '' ? '0' : String(v));
const date = (v: unknown): string => (v ? String(v).slice(0, 10) : '');

/** Backend res.partner record (list `full=1` or detail) -> Angular ResPartner. */
export function toPartner(r: Rec): ResPartner {
  return {
    id: r['id'] as number,
    name: str(r['name']),
    display_name: str(r['display_name'] ?? r['name']),
    is_company: r['is_company'] === true,
    type: (r['type'] as ResPartner['type']) ?? 'contact',
    title: id(r['title'] as M2o),
    function: str(r['function']),
    parent_id: id(r['parent_id'] as M2o),
    commercial_partner_id: (id(r['commercial_partner_id'] as M2o) ?? (r['id'] as number)),
    company_name: str(r['company_name']),
    ref: str(r['ref']),
    email: str(r['email']),
    phone: str(r['phone']),
    mobile: str(r['mobile']),
    website: str(r['website']),
    fax: str(r['fax']),
    category_id: ((r['tags'] as Tag[] | undefined) ?? []).map(t => t.id),
    street: str(r['street']),
    street2: str(r['street2']),
    // Arabic is not exposed by the backend for now.
    arabic_street2_name: '',
    city: str(r['city']),
    arabic_city_name: '',
    l10n_sa_edi_building_number: str(r['l10n_sa_edi_building_number']),
    l10n_sa_edi_plot_identification: str(r['l10n_sa_edi_plot_identification']),
    state_id: id(r['state_id'] as M2o),
    zip: str(r['zip']),
    country_id: id(r['country_id'] as M2o),
    vat: str(r['vat']),
    barcode: str(r['barcode']),
    date: date(r['date']),
    comment: str(r['comment']),
    lang: str(r['lang']),
    tz: str(r['tz']),
    industry_id: id(r['industry_id'] as M2o),
    arabic_name: '',
    l10n_sa_registered_name: str(r['l10n_sa_registered_name']),
    l10n_sa_additional_identification_scheme: str(r['l10n_sa_additional_identification_scheme']),
    l10n_sa_additional_identification_number: str(r['l10n_sa_additional_identification_number']),
    vat_arabic: '',
    cr_number: str(r['cr_number']),
    customer: r['customer'] === true,
    supplier: r['supplier'] === true,
    employee: r['employee'] === true,
    cash_customer: r['cash_customer'] === true,
    customer_discount: dec(r['customer_discount']),
    discount: dec(r['discount']),
    customer_code: str(r['customer_code']),
    vandor_number: str(r['vandor_number']),
    company_name_code: str(r['company_name_code']),
    ext_res_id: null,
    credit_limit: dec(r['credit_limit']),
    user_id: id(r['user_id'] as M2o),
    company_id: id(r['company_id'] as M2o),
    partner_share: r['partner_share'] === true,
    color: (r['color'] as number) ?? 0,
    active: r['active'] !== false,
  };
}

const blank = (v: string | null | undefined) => (v === '' || v === undefined ? null : v);

/** Angular PartnerDraft -> backend body. Derived, Arabic and UI-only fields are left out. */
export function toPartnerBody(d: PartnerDraft): Rec {
  return {
    name: d.name, title: d.title, function: blank(d.function), ref: blank(d.ref), barcode: blank(d.barcode), date: blank(d.date),
    comment: blank(d.comment), is_company: d.is_company, type: d.type, industry_id: d.industry_id, parent_id: d.parent_id,
    company_name: blank(d.company_name), email: blank(d.email), phone: blank(d.phone), mobile: blank(d.mobile),
    website: blank(d.website), fax: blank(d.fax), street: blank(d.street), street2: blank(d.street2), zip: blank(d.zip),
    city: blank(d.city), state_id: d.state_id, country_id: d.country_id, lang: blank(d.lang), tz: blank(d.tz),
    user_id: d.user_id, company_id: d.company_id, customer: d.customer, supplier: d.supplier, employee: d.employee,
    vat: blank(d.vat), credit_limit: d.credit_limit, active: d.active, color: d.color,
    customer_code: blank(d.customer_code), vandor_number: blank(d.vandor_number), cr_number: blank(d.cr_number),
    cash_customer: d.cash_customer, discount: d.discount, customer_discount: d.customer_discount,
    company_name_code: blank(d.company_name_code),
    l10n_sa_edi_building_number: blank(d.l10n_sa_edi_building_number),
    l10n_sa_edi_plot_identification: blank(d.l10n_sa_edi_plot_identification),
    l10n_sa_additional_identification_scheme: blank(d.l10n_sa_additional_identification_scheme),
    l10n_sa_additional_identification_number: blank(d.l10n_sa_additional_identification_number),
    l10n_sa_registered_name: blank(d.l10n_sa_registered_name),
    tags: d.category_id,
  };
}

/**
 * Contacts served by the Express backend (`/v2`). Only the Contact Master (res.partner) and its dropdowns are real.
 * The Users directory, access rights and document activity have no backend yet, so they stay on the mock adapter.
 */
@Injectable()
export class HttpContactsApi extends ContactsApi {
  private readonly http = inject(BackendHttp);
  private readonly mock = inject(MockContactsApi);

  override async lookups(): Promise<ContactLookups> {
    const base = await this.mock.lookups();
    const [countries, states, titles, industries, tags, companies] = await Promise.all([
      this.http.getAll<Rec>('/countries'),
      this.http.getAll<Rec>('/states'),
      this.http.getAll<Rec>('/partner-titles'),
      this.http.getAll<Rec>('/partner-industries'),
      this.http.getAll<Rec>('/partner-categories'),
      this.http.getAll<Rec>('/companies'),
    ]);
    const opt = (r: Rec) => ({ id: r['id'] as number, name: str(r['name']) });
    return {
      ...base,
      countries: countries.map(opt),
      states: states.map(r => ({ ...opt(r), country_id: r['country_id'] as number })),
      titles: titles.map(opt),
      industries: industries.map(opt),
      tags: tags.map(opt),
      companies: companies.map(r => ({ ...opt(r), parent_id: (r['parent_id'] as number | null) ?? null })),
    };
  }

  override async partners(): Promise<ResPartner[]> {
    return (await this.http.getAll<Rec>('/contacts', { full: 1, active: 'all' })).map(toPartner);
  }

  private async fetchOne(partnerId: number): Promise<ResPartner> {
    return toPartner(await this.http.get<Rec>(`/contacts/${partnerId}`));
  }

  override async createPartner(draft: PartnerDraft): Promise<ResPartner> {
    const created = await this.http.post<Rec>('/contacts', toPartnerBody(draft));
    return this.fetchOne(created['id'] as number);
  }

  override async updatePartner(partnerId: number, draft: PartnerDraft): Promise<ResPartner> {
    await this.http.put(`/contacts/${partnerId}`, toPartnerBody(draft));
    return this.fetchOne(partnerId);
  }

  override async setPartnerActive(partnerId: number, active: boolean): Promise<void> {
    await this.http.post(`/contacts/${partnerId}/${active ? 'unarchive' : 'archive'}`);
  }

  // ---- not in the backend yet: mock ----
  override directory(): Promise<Contact[]> { return this.mock.directory(); }
  override saveContact(contact: Contact): Promise<Contact> { return this.mock.saveContact(contact); }
  override archiveContact(contactId: string, active: boolean): Promise<void> { return this.mock.archiveContact(contactId, active); }
  override activity(): Promise<PartnerActivity> { return this.mock.activity(); }
  override users(): Promise<ResUser[]> { return this.mock.users(); }
  override saveUser(user: ResUser): Promise<ResUser> { return this.mock.saveUser(user); }
}
