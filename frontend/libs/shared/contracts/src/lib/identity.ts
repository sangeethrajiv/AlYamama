import type { CompanyId, UserRole } from './common';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  title: string;
  role: UserRole;
  initials: string;
}

export interface Session {
  userId: string;
  role: UserRole;
  companyId: CompanyId;
  arabic: boolean;
  remember: boolean;
}

/** Permission strings such as `accounting.invoice.read` (section 10.2). */
export type Permission = string;

export interface SessionInfo {
  user: AuthUser;
  permissions: Permission[];
  companyIds: CompanyId[];
}

export interface ManifestItem {
  /** Stable id; also the route segment under the feature. */
  id: string;
  /** Translation key. */
  labelKey: string;
  icon?: string;
  path?: string;
  permission?: Permission;
  badge?: 'openInvoices' | 'openBills' | 'unreconciled' | 'invoice.cash' | 'invoice.credit' | 'invoice.proforma' | 'invoice.progressive';
  queryParams?: Record<string, string>;
  children?: ManifestItem[];
  /** Section heading that precedes the item inside a group. */
  sectionKey?: string;
}

export interface SystemManifest {
  version: string;
  enabledAddons: string[];
  menu: ManifestItem[];
}

export type NavBadges = Partial<Record<NonNullable<ManifestItem['badge']>, number>>;
