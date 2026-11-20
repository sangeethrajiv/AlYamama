import { Injectable, signal } from '@angular/core';
import type { CompanyId, UserRole } from '@erp/shared/contracts';

/**
 * The validated request context (section 7.2): who is calling and for which company. The shell sets it after sign-in
 * and every API adapter reads it. A real adapter would send it as headers and the server would re-verify it.
 */
@Injectable({ providedIn: 'root' })
export class RequestContext {
  readonly actorRole = signal<UserRole>('Accounts Manager');
  readonly companyId = signal<CompanyId>('co_1');
}
