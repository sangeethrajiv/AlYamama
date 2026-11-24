import { Injectable, inject } from '@angular/core';
import type { Company, CompanyId, SessionInfo } from '@erp/shared/contracts';
import { ApiError } from '../api/api-error';
import { AUTH_USERS } from '../seed';
import { MockIdentityApi } from '../mock/mock-identity.api';
import { BackendHttp } from './backend-http';

type Rec = Record<string, unknown>;

const DB_PREFIX = 'db';
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

/**
 * Sign-in: the five demo accounts still work (they have fixed roles). Any other login is checked against res_users in
 * the backend, with the password set from the Users screen. Roles are not stored per user yet, so a database user
 * starts as an Auditor (read-only) until roles are mapped to access groups.
 * The list of companies is the real one from the backend. Ids are `co_<res.company id>`.
 */
@Injectable()
export class HttpIdentityApi extends MockIdentityApi {
  private readonly http = inject(BackendHttp);

  override async login(email: string, password: string): Promise<SessionInfo> {
    const key = email.trim().toLowerCase();
    if (AUTH_USERS.some(u => u.email.toLowerCase() === key)) return super.login(email, password);
    try {
      return this.fromRow(await this.http.post<Rec>('/auth/login', { login: email.trim(), password }));
    } catch (e) {
      throw e instanceof ApiError && e.problem.code === 'BACKEND_UNREACHABLE' ? e : ApiError.unauthorized('Incorrect login or password.');
    }
  }

  override async session(userId: string): Promise<SessionInfo | null> {
    if (!userId.startsWith(DB_PREFIX)) return super.session(userId);
    try {
      const row = await this.http.get<Rec>(`/res-users/${userId.slice(DB_PREFIX.length)}`);
      return row['active'] === false ? null : this.fromRow(row);
    } catch {
      return null;
    }
  }

  private fromRow(r: Rec): SessionInfo {
    const name = String(r['name'] ?? r['login'] ?? '');
    return this.info({ id: `${DB_PREFIX}${r['id']}`, email: String(r['login'] ?? ''), name, title: String(r['function'] ?? '') || 'User', role: 'Auditor', initials: initials(name) });
  }

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
