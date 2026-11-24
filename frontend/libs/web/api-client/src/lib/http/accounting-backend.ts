import { Injectable, inject } from '@angular/core';
import { BackendHttp } from './backend-http';
import { RequestContext } from '../api/api-context';

export type Rec = Record<string, unknown>;
export interface ListResult<T = Rec> { records: T[]; total: number; page: number; limit: number }
/** Structurally the same as `SelectOption` in @erp/web/ui, kept local so api-client does not depend on the ui library. */
export interface LookupOption { value: number; label: string; hint?: string; data?: unknown }

type Query = Record<string, string | number | boolean | undefined | null>;

/** Where each pickable model lives and how a row is named. Add a model here to get a dropdown for it. */
interface LookupDef { /** Only rows of the active company. */ company?: boolean; path: string; label: (r: Rec) => string; hint?: (r: Rec) => string; query?: Query; detail?: boolean; nameSearch?: boolean }
const s = (v: unknown) => (v == null ? '' : String(v));
const LOOKUPS = {
  partners: { path: '/contacts/name-search', label: r => s(r['name']), hint: r => s(r['vat'] ?? r['city']), nameSearch: true, detail: true },
  products: { path: '/accounting/lookups/products', label: r => s(r['name']), nameSearch: true },
  accounts: { company: true, path: '/accounting/accounts', label: r => `${s(r['code'])} ${s(r['name'])}`, query: { active: 'all' } },
  accountTypes: { path: '/accounting/account-types', label: r => s(r['name']) },
  accountGroups: { path: '/accounting/account-groups', label: r => `${s(r['code_prefix'])} ${s(r['name'])}`.trim() },
  journals: { company: true, path: '/accounting/journals', label: r => `${s(r['code'])} ${s(r['name'])}` },
  taxes: { company: true, path: '/accounting/taxes', label: r => s(r['name']), hint: r => `${s(r['type_tax_use'])}` },
  taxGroups: { path: '/accounting/tax-groups', label: r => s(r['name']) },
  paymentTerms: { company: true, path: '/accounting/payment-terms', label: r => s(r['name']) },
  fiscalPositions: { company: true, path: '/accounting/fiscal-positions', label: r => s(r['name']) },
  analyticAccounts: { company: true, path: '/accounting/analytic-accounts', label: r => `${r['code'] ? `[${s(r['code'])}] ` : ''}${s(r['name'])}` },
  analyticGroups: { path: '/accounting/analytic-groups', label: r => s(r['name']) },
  currencies: { path: '/accounting/currency-list', label: r => s(r['name']), query: { active: 'all' } },
  assetTypes: { company: true, path: '/accounting/asset-types', label: r => s(r['name']) },
  incoterms: { path: '/accounting/incoterms', label: r => `${s(r['code'])} ${s(r['name'])}` },
  invoices: { path: '/accounting/moves', label: r => s(r['name']), query: { kind: 'invoices', state: 'posted' } },
  users: { path: '/users', label: r => s(r['name'] ?? r['login']) },
  uoms: { path: '/uoms', label: r => s(r['name']) },
} satisfies Record<string, LookupDef>;
export type LookupKey = keyof typeof LOOKUPS;

/**
 * Generic access to the accounting API (`/v2/accounting/*`) for the screens that have no mock behind them
 * (config lists, vouchers, assets, reports), plus the async option sources the dropdowns use.
 */
@Injectable({ providedIn: 'root' })
export class AccountingBackend {
  private readonly http = inject(BackendHttp);
  private readonly ctx = inject(RequestContext);
  /** Changes when the user switches company; list pages read it so they reload. */
  readonly companyKey = this.ctx.companyId;

  list<T = Rec>(path: string, query: Query = {}): Promise<ListResult<T>> { return this.http.get<ListResult<T>>(path, { limit: 80, ...query }); }
  /** Every row, for small config tables. */
  all<T = Rec>(path: string, query: Query = {}): Promise<T[]> { return this.http.getAll<T>(path, query); }
  get<T = Rec>(path: string, query?: Query): Promise<T> { return this.http.get<T>(path, query); }
  create<T = Rec>(path: string, body: Rec): Promise<T> { return this.http.post<T>(path, body); }
  update<T = Rec>(path: string, body: Rec): Promise<T> { return this.http.put<T>(path, body); }
  remove(path: string): Promise<unknown> { return this.http.delete(path); }
  /** A state change such as `/accounting/moves/5/post`. */
  action<T = Rec>(path: string, body?: Rec): Promise<T> { return this.http.post<T>(path, body); }

  /**
   * Option source for `erp-select` / `erp-multi-select` / a FieldDef `search`.
   * `search(text)` lists matches; `search('', ids)` returns the labels of chosen ids.
   */
  lookup(key: LookupKey, extra: Query = {}): (q: string, ids?: (string | number | boolean | null)[]) => Promise<LookupOption[]> {
    const def = LOOKUPS[key] as LookupDef;
    const opt = (r: Rec): LookupOption => ({ value: r['id'] as number, label: def.label(r), hint: def.hint?.(r) || undefined, data: r });
    return async (text, ids) => {
      if (ids?.length) {
        const rows = await Promise.all(ids.filter((i): i is number => typeof i === 'number').map(async id => {
          try {
            if (def.nameSearch && !def.detail) { const r = await this.http.get<Rec[]>(def.path, { id, limit: 1 }); return r[0]; }
            return await this.http.get<Rec>(`${def.path.replace('/name-search', '')}/${id}`);
          } catch { return undefined; }
        }));
        return rows.filter((r): r is Rec => !!r).map(r => opt({ id: r['id'], ...r }));
      }
      const q: Query = { ...def.query, ...extra, q: text || undefined, limit: 20 };
      if (def.company) q['company_id'] = this.http.activeCompanyId();
      if (def.nameSearch) {
        // name-search endpoints take the text as `q` and return a plain array
        const rows = await this.http.get<Rec[]>(def.path, { ...q });
        return rows.map(opt);
      }
      const d = await this.http.get<ListResult>(def.path, q);
      return d.records.map(opt);
    };
  }
}
