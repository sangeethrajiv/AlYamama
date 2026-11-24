import { Injectable, inject } from '@angular/core';
import { ALL_PERMISSIONS, PERM, type AuthUser, type Company, type Permission, type SessionInfo, type UserRole } from '@erp/shared/contracts';
import { ApiError } from '../api/api-error';
import { IdentityApi } from '../api/identity.api';
import { AUTH_USERS, DEMO_PASSWORD } from '../seed';
import { MockDb, copy } from './mock-db';

const READ_ONLY = ALL_PERMISSIONS.filter(p => p.endsWith('.read'));

/** Role -> permission bundles. On a real server roles are editable and assignments carry a company scope. */
const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  'Finance Director': ALL_PERMISSIONS,
  'Accounts Manager': ALL_PERMISSIONS.filter(p => p !== PERM.bill.approveL2),
  'Senior Accountant': ALL_PERMISSIONS.filter(
    p => ![PERM.bill.approveL1, PERM.bill.approveL2, PERM.settings.lockDate, PERM.contact.delete].includes(p as never),
  ),
  Accountant: ALL_PERMISSIONS.filter(
    p => ![PERM.invoice.validate, PERM.bill.approveL1, PERM.bill.approveL2, PERM.settings.lockDate, PERM.contact.delete, PERM.invoice.zatca].includes(p as never),
  ),
  Auditor: READ_ONLY,
};

@Injectable()
export class MockIdentityApi extends IdentityApi {
  private readonly db = inject(MockDb);

  override async login(email: string, password: string): Promise<SessionInfo> {
    const user = AUTH_USERS.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || password !== DEMO_PASSWORD) throw ApiError.unauthorized('Incorrect email or password.');
    return this.info(user);
  }

  override async session(userId: string): Promise<SessionInfo | null> {
    const user = AUTH_USERS.find(u => u.id === userId);
    return user ? this.info(user) : null;
  }

  override async roles(): Promise<UserRole[]> {
    return Object.keys(ROLE_PERMISSIONS) as UserRole[];
  }

  override async permissionsFor(role: UserRole): Promise<Permission[]> {
    return [...ROLE_PERMISSIONS[role]];
  }

  override async demoAccounts(): Promise<AuthUser[]> {
    return copy(AUTH_USERS);
  }

  override async companies(): Promise<Company[]> {
    return copy(this.db.accounting.companies);
  }

  protected info(user: AuthUser): SessionInfo {
    return {
      user: copy(user),
      permissions: [...ROLE_PERMISSIONS[user.role]],
      companyIds: this.db.accounting.companies.map(c => c.id),
    };
  }
}
