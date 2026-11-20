import type { CompanyId, CurrencyRate, NavBadges, SystemManifest } from '@erp/shared/contracts';

/** GET /api/v1/system/manifest and the counters shown in the navigation. */
export abstract class SystemApi {
  abstract manifest(): Promise<SystemManifest>;
  abstract badges(companyId: CompanyId): Promise<NavBadges>;
  /** Active currencies and daily rates against the company base currency. */
  abstract currencies(): Promise<CurrencyRate[]>;
}
