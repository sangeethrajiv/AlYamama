import type { Routes } from '@angular/router';
import { permissionGuard } from '@erp/web/core';
import { PERM } from '@erp/shared/contracts';
import { provideTranslocoScope } from '@jsverse/transloco';

const scope = provideTranslocoScope({
  scope: 'dashboard',
  loader: { en: () => import('./i18n/en.json').then(m => m.default.dashboard), ar: () => import('./i18n/ar.json').then(m => m.default.dashboard) },
});

export const DASHBOARD_ROUTES: Routes = [
  { path: '', providers: [scope], canActivate: [permissionGuard(PERM.dashboard.read)], title: 'Dashboard', loadComponent: () => import('./pages/dashboard.page').then(m => m.DashboardPage) },
];
