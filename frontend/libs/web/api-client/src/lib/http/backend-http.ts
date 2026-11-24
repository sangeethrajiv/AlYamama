import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api/api-error';
import { RequestContext } from '../api/api-context';
import type { UserRole } from '@erp/shared/contracts';

/**
 * Where the Express backend lives and who the stub auth says we are. Until JWT exists the backend reads these three
 * headers (backend/src/middleware.ts). Company ids are the backend's numeric res.company ids, not the mock's 'co_1'.
 */
export interface BackendConfig {
  baseUrl: string;
  userId: number;
  companyId: number;
  allowedCompanyIds: number[];
  /** The backend user (res.users id) each demo role acts as, so approval by a second person can be shown. */
  userIdByRole?: Partial<Record<UserRole, number>>;
}

/** Settings a deployment can override in `config.js` (see apps/web/public/config.js), without rebuilding. */
interface RuntimeConfig { apiBase?: string; companyId?: number; allowedCompanyIds?: number[]; userIdByRole?: BackendConfig['userIdByRole'] }
const runtime = (): RuntimeConfig => (globalThis as { __ERP_CONFIG__?: RuntimeConfig }).__ERP_CONFIG__ ?? {};

export const BACKEND_CONFIG = new InjectionToken<BackendConfig>('BACKEND_CONFIG', {
  providedIn: 'root',
  factory: () => {
    const r = runtime();
    return {
      baseUrl: (r.apiBase ?? 'http://localhost:3000/v2').replace(/\/+$/, ''), userId: 2, companyId: r.companyId ?? 1,
      allowedCompanyIds: r.allowedCompanyIds ?? [1, 5, 6, 7, 9, 12],
      // res.users ids in the Odoo copy: 2 is admin, 6 to 9 are staff
      userIdByRole: r.userIdByRole ?? { 'Accounts Manager': 2, 'Finance Director': 6, 'Senior Accountant': 7, Accountant: 8, Auditor: 9 },
    };
  },
});

type Query = Record<string, string | number | boolean | undefined | null>;
interface Envelope<T> { success: boolean; data: T; message?: string; code?: string }
interface ListData<T> { records: T[]; total: number; page: number; limit: number }

/** Thin wrapper over HttpClient: adds the stub-auth headers, unwraps `{success, data}` and turns failures into ApiError. */
@Injectable({ providedIn: 'root' })
export class BackendHttp {
  private readonly http = inject(HttpClient);
  private readonly cfg = inject(BACKEND_CONFIG);
  private readonly ctx = inject(RequestContext);

  /** The backend user (res.users id) the signed-in demo role acts as. */
  currentUserId(): number { return this.cfg.userIdByRole?.[this.ctx.actorRole()] ?? this.cfg.userId; }

  /** The backend id of the active company (`co_5` -> 5); falls back to the configured one. */
  activeCompanyId(): number {
    const n = Number(String(this.ctx.companyId()).replace(/^co_/, ''));
    return Number.isInteger(n) && n > 0 ? n : this.cfg.companyId;
  }

  /** Contacts and products are shared across companies; accounting records belong to exactly one, the active one. */
  private headers(path: string) {
    const active = this.activeCompanyId();
    const accounting = path.startsWith('/accounting');
    return {
      'X-User-Id': String(this.cfg.userIdByRole?.[this.ctx.actorRole()] ?? this.cfg.userId),
      'X-Company-Id': String(active),
      'X-Allowed-Company-Ids': accounting ? String(active) : [...new Set([...this.cfg.allowedCompanyIds, active])].join(','),
    };
  }

  private async call<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== '') params[k] = String(v);
    try {
      const res = await firstValueFrom(
        this.http.request<Envelope<T>>(method, this.cfg.baseUrl + path, { headers: this.headers(path), params, body: opts.body }),
      );
      return res.data;
    } catch (e) {
      throw this.toApiError(e);
    }
  }

  private toApiError(e: unknown): unknown {
    if (!(e instanceof HttpErrorResponse)) return e;
    const body = (e.error ?? {}) as { message?: string; code?: string };
    const message = body.message ?? e.message;
    if (e.status === 404) return ApiError.notFound(message.replace(/ not found$/i, ''));
    if (e.status === 0) return ApiError.businessRule('BACKEND_UNREACHABLE', 'Backend not reachable', `Could not reach ${this.cfg.baseUrl}. Is the API running?`);
    if (e.status === 400 || e.status === 409 || e.status === 422) return ApiError.businessRule(body.code ?? 'BACKEND_REFUSED', 'Request refused', message);
    return ApiError.businessRule(body.code ?? 'BACKEND_ERROR', 'Server error', message);
  }

  get<T>(path: string, query?: Query): Promise<T> { return this.call<T>('GET', path, { query }); }
  post<T>(path: string, body?: unknown): Promise<T> { return this.call<T>('POST', path, { body: body ?? {} }); }
  put<T>(path: string, body: unknown): Promise<T> { return this.call<T>('PUT', path, { body }); }
  delete<T>(path: string): Promise<T> { return this.call<T>('DELETE', path); }

  /** Every record of a list endpoint, 500 per request (the backend's page cap). */
  async getAll<T>(path: string, query: Query = {}): Promise<T[]> {
    const out: T[] = [];
    for (let page = 1; ; page++) {
      const d = await this.get<ListData<T>>(path, { ...query, limit: 500, page });
      out.push(...d.records);
      if (out.length >= d.total || d.records.length === 0) return out;
    }
  }
}
