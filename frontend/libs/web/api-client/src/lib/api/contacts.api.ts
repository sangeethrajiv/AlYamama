import type { Bill, Contact, ContactLookups, Invoice, PartnerDraft, ResPartner, ResUser } from '@erp/shared/contracts';

/** Customer/vendor documents shown on a contact (documents are matched to contacts by exact name in the prototype). */
export interface PartnerActivity {
  invoices: Invoice[];
  bills: Bill[];
}

/** Fields asked for when a user is created; everything else starts from defaults. */
export interface NewUser {
  name: string;
  login: string;
  email?: string;
  company_id: number;
  password: string;
}

/**
 * Contacts, users and access rights, and the contact master (section 6.2: identity + master data).
 * The prototype has no foreign keys between documents and contacts; relationships are by name.
 */
export abstract class ContactsApi {
  abstract lookups(): Promise<ContactLookups>;

  // Contacts directory ("Users" module: customers, vendors, staff, banks)
  abstract directory(): Promise<Contact[]>;
  /** Inserts (empty id) or replaces. Returns the stored record. */
  abstract saveContact(contact: Contact): Promise<Contact>;
  abstract archiveContact(id: string, active: boolean): Promise<void>;
  abstract activity(): Promise<PartnerActivity>;

  // Users and access rights
  abstract users(): Promise<ResUser[]>;
  abstract saveUser(user: ResUser): Promise<ResUser>;
  abstract createUser(draft: NewUser): Promise<ResUser>;
  /** Sets a new password for a user (admin reset). */
  abstract changeUserPassword(userId: number, password: string): Promise<void>;

  // Contact master (res.partner)
  abstract partners(): Promise<ResPartner[]>;
  abstract createPartner(draft: PartnerDraft): Promise<ResPartner>;
  abstract updatePartner(id: number, draft: PartnerDraft): Promise<ResPartner>;
  abstract setPartnerActive(id: number, active: boolean): Promise<void>;
}
