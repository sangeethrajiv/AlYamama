import type { EnvironmentProviders, Provider } from '@angular/core';
import { makeEnvironmentProviders } from '@angular/core';
import { IdentityApi } from './api/identity.api';
import { SystemApi } from './api/system.api';
import { ContactsApi } from './api/contacts.api';
import { AccountingApi } from './api/accounting.api';
import { CatalogApi } from './api/catalog.api';
import { ProductApi } from './api/product.api';
import { MockIdentityApi } from './mock/mock-identity.api';
import { MockSystemApi } from './mock/mock-system.api';
import { MockContactsApi } from './mock/mock-contacts.api';
import { MockAccountingApi } from './mock/mock-accounting.api';
import { MockCatalogApi } from './mock/mock-catalog.api';
import { MockProductApi } from './mock/mock-product.api';

/**
 * Wires the feature-specific MOCK adapters. The backend (NestJS `/api/v1`) is not part of this build; when it exists
 * a `provideHttpApiClient()` replaces this one and nothing in the features changes.
 */
export function provideMockApiClient(...extra: Provider[]): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: IdentityApi, useClass: MockIdentityApi },
    { provide: SystemApi, useClass: MockSystemApi },
    { provide: ContactsApi, useClass: MockContactsApi },
    { provide: AccountingApi, useClass: MockAccountingApi },
    { provide: CatalogApi, useClass: MockCatalogApi },
    { provide: ProductApi, useClass: MockProductApi },
    ...extra,
  ]);
}
