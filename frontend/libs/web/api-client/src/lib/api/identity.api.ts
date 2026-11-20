import type { AuthUser, Company, Permission, SessionInfo, UserRole } from '@erp/shared/contracts';

/** Identity and access (section 6.2). The server owns credentials and sessions; this is the client-facing contract. */
export abstract class IdentityApi {
  /** Exchanges credentials for a session. Rejects with a 401 ApiError. */
  abstract login(email: string, password: string): Promise<SessionInfo>;
  /** Re-reads the session for a user id kept in the browser (demo restore). */
  abstract session(userId: string): Promise<SessionInfo | null>;
  /** Roles a user may switch to (demo role switcher). */
  abstract roles(): Promise<UserRole[]>;
  abstract permissionsFor(role: UserRole): Promise<Permission[]>;
  abstract demoAccounts(): Promise<AuthUser[]>;
  abstract companies(): Promise<Company[]>;
}
