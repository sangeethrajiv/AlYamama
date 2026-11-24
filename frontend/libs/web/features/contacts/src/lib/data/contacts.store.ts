import { Injectable, effect, inject, signal } from '@angular/core';
import { ContactsApi, DataChanges, type NewUser, type PartnerActivity } from '@erp/web/api-client';
import type { Contact, ContactLookups, ResPartner, ResUser } from '@erp/shared/contracts';

const EMPTY_LOOKUPS: ContactLookups = {
  countries: [], states: [], titles: [], salesTeams: [], jobs: [], departments: [], employees: [], companies: [],
  languages: [], groups: [], timezones: [], industries: [], tags: [],
};

/** Feature-local state: signals filled from ContactsApi and refreshed whenever data changes (writes or pushes). */
@Injectable({ providedIn: 'root' })
export class ContactsStore {
  private readonly api = inject(ContactsApi);
  private readonly changes = inject(DataChanges);

  readonly contacts = signal<Contact[]>([]);
  readonly users = signal<ResUser[]>([]);
  readonly partners = signal<ResPartner[]>([]);
  readonly activity = signal<PartnerActivity>({ invoices: [], bills: [] });
  readonly lookups = signal<ContactLookups>(EMPTY_LOOKUPS);
  readonly loaded = signal(false);

  constructor() {
    effect(() => {
      this.changes.revision();
      void this.reload();
    });
  }

  async reload(): Promise<void> {
    const [contacts, users, partners, activity, lookups] = await Promise.all([
      this.api.directory(), this.api.users(), this.api.partners(), this.api.activity(), this.api.lookups(),
    ]);
    this.contacts.set(contacts);
    this.users.set(users);
    this.partners.set(partners);
    this.activity.set(activity);
    this.lookups.set(lookups);
    this.loaded.set(true);
  }

  saveContact(c: Contact) { return this.api.saveContact(c); }
  archiveContact(id: string, active: boolean) { return this.api.archiveContact(id, active); }
  saveUser(u: ResUser) { return this.api.saveUser(u); }
  /** Puts the new user into the local list straight away so its detail page can open before the reload lands. */
  async createUser(draft: NewUser): Promise<ResUser> {
    const u = await this.api.createUser(draft);
    this.users.update(list => (list.some(x => x.id === u.id) ? list : [...list, u]));
    return u;
  }
  changeUserPassword(id: number, password: string) { return this.api.changeUserPassword(id, password); }
  /**
   * The HTTP adapter does not signal DataChanges, and reloading every partner is 13+ requests,
   * so a saved partner is put into the local list here. Without this the detail page opened
   * right after a save cannot find the new contact and shows "Contact not found".
   */
  private upsertPartner(p: ResPartner): ResPartner {
    this.partners.update(list => (list.some(x => x.id === p.id) ? list.map(x => (x.id === p.id ? p : x)) : [...list, p]));
    return p;
  }

  async createPartner(d: Parameters<ContactsApi['createPartner']>[0]) { return this.upsertPartner(await this.api.createPartner(d)); }
  async updatePartner(id: number, d: Parameters<ContactsApi['updatePartner']>[1]) { return this.upsertPartner(await this.api.updatePartner(id, d)); }
  async setPartnerActive(id: number, active: boolean) {
    await this.api.setPartnerActive(id, active);
    this.partners.update(list => list.map(x => (x.id === id ? { ...x, active } : x)));
  }
}
