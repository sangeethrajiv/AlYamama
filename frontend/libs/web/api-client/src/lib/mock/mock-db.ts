import { Injectable, inject } from '@angular/core';
import { DataChanges } from '../api/data-changes';
import {
  seedAccounting, seedContactDirectory, seedLookups, seedPartners, seedProducts, seedUsers,
  type AccountingSeed,
} from '../seed';
import type { Contact, ContactLookups, ResPartner, ResUser, ProductState } from '@erp/shared/contracts';

/**
 * In-memory database behind the mock API adapters. It is a stand-in for the server's PostgreSQL: it is NOT a
 * transactional store, nothing here is durable, and a reload restores the seed.
 * Reads hand out structured clones so callers can never mutate it by accident, like a network boundary.
 */
@Injectable({ providedIn: 'root' })
export class MockDb {
  private readonly changes = inject(DataChanges);

  accounting: AccountingSeed = seedAccounting();
  contacts: Contact[] = seedContactDirectory();
  partners: ResPartner[] = seedPartners();
  users: ResUser[] = seedUsers();
  lookups: ContactLookups = seedLookups();
  product: ProductState = seedProducts();

  /** Call after every write so subscribers re-read. */
  touch(): void {
    this.changes.bump();
  }
}

export const copy = <T>(v: T): T => structuredClone(v);
