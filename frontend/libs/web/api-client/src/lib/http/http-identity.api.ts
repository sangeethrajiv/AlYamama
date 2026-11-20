import { Injectable } from '@angular/core';
import type { Company, CompanyId } from '@erp/shared/contracts';
import { MockIdentityApi } from '../mock/mock-identity.api';
import { BackendHttp } from './backend-http';
import { inject } from '@angular/core';

type Rec = Record<string, unknown>;

/**
 * Sign-in, roles and permissions stay on the mock identity (there is no auth module yet), but the list of companies is
 * the real one from the backend, so the company switcher offers your actual companies. Ids are `co_<res.company id>`.
 */
@Injectable()
export class HttpIdentityApi extends MockIdentityApi {
  private readonly http = inject(BackendHttp);

  override async companies(): Promise<Company[]> {
    const rows = await this.http.getAll<Rec>('/companies');
    return rows.map(r => ({
      id: `co_${r['id']}` as CompanyId,
      name: String(r['name'] ?? ''),
      legalName: String(r['name'] ?? ''),
      crNumber: '',
      vatNumber: String(r['vat'] ?? ''),
      baseCurrency: 'SAR',
      city: String(r['city'] ?? ''),
      code: String(r['name'] ?? '').split(/\s+/).filter(w => w.length > 2).map(w => w[0].toUpperCase()).join('').slice(0, 4) || `C${r['id']}`,
    }));
  }
}
