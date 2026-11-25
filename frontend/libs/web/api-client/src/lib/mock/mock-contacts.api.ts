import { Injectable, inject } from '@angular/core';
import { ApiError } from '../api/api-error';
import { ContactsApi, type NewUser, type PartnerActivity } from '../api/contacts.api';
import type { CompanyDraft, Contact, ContactLookups, LookupOption, PartnerDraft, ResCompany, ResCompanyRow, ResPartner, ResUser } from '@erp/shared/contracts';
import { newId } from '@erp/shared/utils';
import { MockDb, copy } from './mock-db';

/** display_name and commercial_partner_id are recomputed on every write, as the source system does. */
function normalize(list: ResPartner[]): ResPartner[] {
  const byId = new Map(list.map(x => [x.id, x]));
  const commercial = (x: ResPartner): number => {
    let cur = x;
    for (let i = 0; i < 20 && !cur.is_company && cur.parent_id != null; i++) {
      const up = byId.get(cur.parent_id);
      if (!up) break;
      cur = up;
    }
    return cur.id;
  };
  return list.map(x => {
    const parent = !x.is_company && x.parent_id != null ? byId.get(x.parent_id) : undefined;
    const display_name = parent ? `${parent.name}, ${x.name}` : x.name;
    const commercial_partner_id = commercial(x);
    return x.display_name === display_name && x.commercial_partner_id === commercial_partner_id ? x : { ...x, display_name, commercial_partner_id };
  });
}

@Injectable()
export class MockContactsApi extends ContactsApi {
  private readonly db = inject(MockDb);

  constructor() {
    super();
    this.db.partners = normalize(this.db.partners);
  }

  override async lookups(): Promise<ContactLookups> {
    return this.db.lookups;
  }

  override async directory(): Promise<Contact[]> {
    return copy(this.db.contacts);
  }

  override async saveContact(contact: Contact): Promise<Contact> {
    const name = contact.name.trim();
    if (!name) throw ApiError.validation([{ field: 'name', message: 'Name is required.' }]);
    const dup = this.db.contacts.find(o => o.id !== contact.id && o.name.trim().toLowerCase() === name.toLowerCase());
    if (dup) throw ApiError.businessRule('CONTACT_DUPLICATE_NAME', 'Duplicate contact', `A contact named "${dup.name}" already exists.`);
    const stored: Contact = { ...copy(contact), name, id: contact.id || newId('ct') };
    const exists = this.db.contacts.some(c => c.id === stored.id);
    this.db.contacts = exists ? this.db.contacts.map(c => (c.id === stored.id ? stored : c)) : [stored, ...this.db.contacts];
    this.db.touch();
    return copy(stored);
  }

  override async archiveContact(id: string, active: boolean): Promise<void> {
    this.db.contacts = this.db.contacts.map(c => (c.id === id ? { ...c, active } : c));
    this.db.touch();
  }

  override async activity(): Promise<PartnerActivity> {
    return { invoices: copy(this.db.accounting.invoices), bills: copy(this.db.accounting.bills) };
  }

  override async users(): Promise<ResUser[]> {
    return copy(this.db.users);
  }

  override async saveUser(user: ResUser): Promise<ResUser> {
    if (!user.name.trim()) throw ApiError.validation([{ field: 'name', message: 'Name is required.' }]);
    if (!user.login.trim()) throw ApiError.validation([{ field: 'login', message: 'Login is required.' }]);
    this.db.users = this.db.users.map(x => (x.id === user.id ? copy(user) : x));
    this.db.touch();
    return copy(user);
  }

  /** Keeps the parts of a user the backend does not store yet (access groups, employee, logins) next to it by id. */
  upsertUserExtras(user: ResUser): void {
    const stored = copy(user);
    this.db.users = this.db.users.some(x => x.id === user.id) ? this.db.users.map(x => (x.id === user.id ? stored : x)) : [...this.db.users, stored];
    this.db.touch();
  }

  override async createUser(draft: NewUser): Promise<ResUser> {
    const name = draft.name.trim();
    const login = draft.login.trim();
    if (!name) throw ApiError.validation([{ field: 'name', message: 'Name is required.' }]);
    if (!login) throw ApiError.validation([{ field: 'login', message: 'Login is required.' }]);
    if (draft.password.length < 8) throw ApiError.validation([{ field: 'password', message: 'Password must be at least 8 characters.' }]);
    if (this.db.users.some(u => u.login.toLowerCase() === login.toLowerCase())) throw ApiError.businessRule('USER_DUPLICATE_LOGIN', 'Duplicate login', `A user with login "${login}" already exists.`);
    const id = this.db.users.reduce((m, u) => Math.max(m, u.id), 0) + 1;
    const partner_id = Math.max(this.db.users.reduce((m, u) => Math.max(m, u.partner_id), 0), this.db.partners.reduce((m, p) => Math.max(m, p.id), 0)) + 1;
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const user: ResUser = {
      id, active: true, login, company_id: draft.company_id, partner_id, share: false, create_date: now, write_date: now,
      notification_type: 'email', odoobot_state: 'not_initialized', sidebar_type: 'large', chatter_position: 'sided',
      name, email: draft.email?.trim() || undefined, lang: 'en_US', tz: 'Asia/Riyadh', employee: false, company_ids: [draft.company_id], groups: [],
    };
    this.db.users = [...this.db.users, user];
    this.db.touch();
    return copy(user);
  }

  override async changeUserPassword(userId: number, password: string): Promise<void> {
    if (!this.db.users.some(x => x.id === userId)) throw ApiError.notFound('User');
    if (password.length < 8) throw ApiError.validation([{ field: 'password', message: 'Password must be at least 8 characters.' }]);
    // The prototype keeps no credentials; the change is accepted and not stored.
  }

  /** The prototype only knows each company's name and parent; a company's partner carries the company's own name. */
  override async companyList(): Promise<ResCompanyRow[]> {
    return this.db.lookups.companies.map(c => ({ id: c.id, name: c.name, parent_id: c.parent_id, partner_id: 0, partner_name: c.name }));
  }

  override async company(id: number): Promise<ResCompany> {
    const row = (await this.companyList()).find(c => c.id === id);
    if (!row) throw ApiError.notFound('Company');
    return { ...row, parent_name: this.db.lookups.companies.find(c => c.id === row.parent_id)?.name ?? null };
  }

  override async createCompany(draft: CompanyDraft): Promise<ResCompany> {
    const name = draft.name.trim();
    if (!name) throw ApiError.validation([{ field: 'name', message: 'Name is required.' }]);
    const list = this.db.lookups.companies;
    if (list.some(c => c.name.toLowerCase() === name.toLowerCase())) throw ApiError.businessRule('DUPLICATE_COMPANY', 'Duplicate company', `A company named "${name}" already exists.`);
    const id = list.reduce((m, c) => Math.max(m, c.id), 0) + 1;
    this.db.lookups = { ...this.db.lookups, companies: [...list, { id, name, parent_id: draft.parent_id ?? null }] };
    this.db.touch();
    return this.company(id);
  }

  override async updateCompany(id: number, changes: Partial<CompanyDraft>): Promise<ResCompany> {
    const list = this.db.lookups.companies;
    if (!list.some(c => c.id === id)) throw ApiError.notFound('Company');
    const name = changes.name?.trim();
    if (changes.name !== undefined && !name) throw ApiError.validation([{ field: 'name', message: 'Name is required.' }]);
    if (name && list.some(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) throw ApiError.businessRule('DUPLICATE_COMPANY', 'Duplicate company', `A company named "${name}" already exists.`);
    this.db.lookups = { ...this.db.lookups, companies: list.map(c => (c.id === id ? { ...c, name: name ?? c.name, parent_id: changes.parent_id !== undefined ? changes.parent_id ?? null : c.parent_id } : c)) };
    this.db.touch();
    return this.company(id);
  }

  /** The prototype's only currency is the Saudi riyal (Odoo id 153). */
  override async currencies(): Promise<LookupOption[]> {
    return [{ id: 153, name: 'SAR' }];
  }

  override async partners(): Promise<ResPartner[]> {
    return copy(this.db.partners);
  }

  override async createPartner(draft: PartnerDraft): Promise<ResPartner> {
    const id = this.db.partners.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    this.db.partners = normalize([{ ...copy(draft), id, display_name: '', commercial_partner_id: id }, ...this.db.partners]);
    this.db.touch();
    return copy(this.db.partners.find(x => x.id === id) as ResPartner);
  }

  override async updatePartner(id: number, draft: PartnerDraft): Promise<ResPartner> {
    if (!this.db.partners.some(x => x.id === id)) throw ApiError.notFound('Contact');
    this.db.partners = normalize(this.db.partners.map(x => (x.id === id ? { ...x, ...copy(draft) } : x)));
    this.db.touch();
    return copy(this.db.partners.find(x => x.id === id) as ResPartner);
  }

  override async setPartnerActive(id: number, active: boolean): Promise<void> {
    this.db.partners = normalize(this.db.partners.map(x => (x.id === id ? { ...x, active } : x)));
    this.db.touch();
  }
}
