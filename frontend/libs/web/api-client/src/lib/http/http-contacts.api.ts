import { Injectable, inject } from '@angular/core';
import type { Contact, ContactLookups, PartnerDraft, ResPartner, ResUser } from '@erp/shared/contracts';
import { ContactsApi, type NewUser, type PartnerActivity } from '../api/contacts.api';
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
 * Users (res_users + partner fields, password) are real too; access groups, the employee card, login history and document activity have no backend yet, so they stay on the mock adapter.
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

  // ---- users: res_users + its partner are real; access groups, employee and login history stay on the mock ----
  /** Backend user row (`/res-users`) -> ResUser, with the mock's groups/employee/logins for the same id. */
  private toUser(r: Rec, extra: ResUser | undefined): ResUser {
    const s = (v: unknown) => (v == null || v === '' ? undefined : String(v));
    const n = (v: unknown) => (v == null ? undefined : Number(v));
    const when = (v: unknown) => (v ? String(v).replace('T', ' ').slice(0, 16) : '');
    const companyIds = ((r['company_ids'] as number[] | undefined) ?? []).map(Number);
    const company_id = Number(r['company_id']);
    return {
      notification_type: 'email', odoobot_state: 'not_initialized', sidebar_type: 'large', chatter_position: 'sided', groups: [],
      ...(extra ?? {}),
      id: Number(r['id']), active: r['active'] !== false, login: str(r['login']), company_id, partner_id: Number(r['partner_id']),
      share: r['share'] === true, create_date: when(r['create_date']), write_date: when(r['write_date']),
      create_uid: n(r['create_uid']), write_uid: n(r['write_uid']), login_date: s(r['login_date']) ? when(r['login_date']) : extra?.login_date,
      name: str(r['name']), email: s(r['email']), phone: s(r['phone']), mobile: s(r['mobile']), function: s(r['function']), title: n(r['title']),
      lang: str(r['lang']) || 'en_US', tz: s(r['tz']), country_id: n(r['country_id']), state_id: n(r['state_id']), city: s(r['city']),
      street: s(r['street']), street2: s(r['street2']), zip: s(r['zip']), website: s(r['website']), comment: s(r['comment']),
      vat: s(r['vat']), ref: s(r['ref']),
      company_ids: companyIds.length ? companyIds : [company_id],
    };
  }

  override async users(): Promise<ResUser[]> {
    const [rows, extras] = await Promise.all([this.http.getAll<Rec>('/res-users', { active: 'all' }), this.mock.users()]);
    const byId = new Map(extras.map(u => [u.id, u]));
    return rows.map(r => this.toUser(r, byId.get(Number(r['id']))));
  }

  /** Blank fields are sent as null so that clearing a field in the form clears it in the database. */
  private userBody(u: ResUser): Rec {
    const n = (v: string | number | undefined) => (v === undefined || v === '' ? null : v);
    return {
      login: u.login, active: u.active, share: !!u.share, company_id: u.company_id, company_ids: u.company_ids,
      name: u.name, email: n(u.email), phone: n(u.phone), mobile: n(u.mobile), function: n(u.function), title: n(u.title),
      lang: n(u.lang), tz: n(u.tz), country_id: n(u.country_id), state_id: n(u.state_id), city: n(u.city), street: n(u.street),
      street2: n(u.street2), zip: n(u.zip), website: n(u.website), comment: n(u.comment), vat: n(u.vat), ref: n(u.ref),
    };
  }

  override async saveUser(user: ResUser): Promise<ResUser> {
    const row = await this.http.put<Rec>(`/res-users/${user.id}`, this.userBody(user));
    const stored = this.toUser(row, user);
    this.mock.upsertUserExtras(stored);
    return stored;
  }

  override async createUser(draft: NewUser): Promise<ResUser> {
    const row = await this.http.post<Rec>('/res-users', { name: draft.name, login: draft.login, email: draft.email, company_id: draft.company_id, password: draft.password });
    const stored = this.toUser(row, undefined);
    this.mock.upsertUserExtras(stored);
    return stored;
  }

  override async changeUserPassword(userId: number, password: string): Promise<void> {
    await this.http.post(`/res-users/${userId}/password`, { password });
  }

  // ---- not in the backend yet: mock ----
  override directory(): Promise<Contact[]> { return this.mock.directory(); }
  override saveContact(contact: Contact): Promise<Contact> { return this.mock.saveContact(contact); }
  override archiveContact(contactId: string, active: boolean): Promise<void> { return this.mock.archiveContact(contactId, active); }
  override activity(): Promise<PartnerActivity> { return this.mock.activity(); }
}
