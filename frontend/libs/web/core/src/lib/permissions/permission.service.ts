import { Injectable, inject } from '@angular/core';
import type { Permission } from '@erp/shared/contracts';
import { AuthService } from '../auth/auth.service';

/** Convenience checks for the UI only. The API enforces authorization (section 10.2). */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);
  has(permission: Permission | null | undefined): boolean {
    return !permission || this.auth.permissions().has(permission);
  }
  hasAny(...permissions: Permission[]): boolean {
    return permissions.some(p => this.has(p));
  }
}
