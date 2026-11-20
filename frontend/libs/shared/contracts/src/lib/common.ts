/** Money and high-precision quantities travel as decimal strings (architecture v2.2 section 9). */
export type Decimal = string;
/** ISO 8601 date, `YYYY-MM-DD`. */
export type IsoDate = string;

export type CompanyId = 'co_1' | 'co_2' | 'co_3' | 'co_4' | 'co_5';

export interface Company {
  id: CompanyId;
  name: string;
  legalName: string;
  crNumber: string;
  vatNumber: string;
  baseCurrency: string;
  city: string;
  code: string;
}

/** Roles are editable permission bundles (section 10.2); these are the five seeded by the prototype. */
export type UserRole = 'Finance Director' | 'Accounts Manager' | 'Senior Accountant' | 'Accountant' | 'Auditor';

/** Page envelope for list endpoints (appendix A.6). */
export interface Page<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

/** RFC 9457 Problem Details with stable application codes (section 9 / appendix A.6). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  errors?: { field: string; message: string }[];
  correlationId?: string;
}
