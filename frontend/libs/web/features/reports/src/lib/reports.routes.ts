import type { Routes } from '@angular/router';
import { permissionGuard } from '@erp/web/core';
import { PERM } from '@erp/shared/contracts';
import { provideTranslocoScope } from '@jsverse/transloco';

const scope = provideTranslocoScope({
  scope: 'reports',
  loader: { en: () => import('./i18n/en.json').then(m => m.default.reports), ar: () => import('./i18n/ar.json').then(m => m.default.reports) },
});

export const REPORTS_ROUTES: Routes = [
  { path: '', providers: [scope], canActivate: [permissionGuard(PERM.report.read)], title: 'Financial reports', loadComponent: () => import('./pages/reports.page').then(m => m.ReportsPage) },
];
