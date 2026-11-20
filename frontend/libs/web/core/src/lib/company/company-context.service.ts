import { Injectable, computed, inject, signal } from '@angular/core';
import { RequestContext } from '@erp/web/api-client';
import type { Company, CompanyId } from '@erp/shared/contracts';

/** Active company (a selector, not proof of authorization: the server re-verifies, section 7.2). */
@Injectable({ providedIn: 'root' })
export class CompanyContext {
  private readonly ctx = inject(RequestContext);
  private readonly list = signal<Company[]>([]);

  readonly companies = this.list.asReadonly();
  readonly activeId = this.ctx.companyId;
  readonly active = computed<Company | null>(() => this.list().find(c => c.id === this.activeId()) ?? this.list()[0] ?? null);

  setCompanies(companies: Company[]): void {
    this.list.set(companies);
  }
  select(id: CompanyId): void {
    this.ctx.companyId.set(id);
  }
}
