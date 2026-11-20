import type { Routes } from '@angular/router';
import { permissionGuard } from '@erp/web/core';
import { PERM } from '@erp/shared/contracts';
import { provideTranslocoScope } from '@jsverse/transloco';

const scope = provideTranslocoScope({
  scope: 'admin',
  loader: { en: () => import('./i18n/en.json').then(m => m.default.admin), ar: () => import('./i18n/ar.json').then(m => m.default.admin) },
});

export const ADMINISTRATION_ROUTES: Routes = [
  {
    path: '',
    providers: [scope],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'settings' },
      { path: 'audit', canActivate: [permissionGuard(PERM.audit.read)], title: 'Audit log', loadComponent: () => import('./pages/audit.page').then(m => m.AuditPage) },
      { path: 'settings', canActivate: [permissionGuard(PERM.settings.read)], title: 'Settings', loadComponent: () => import('./pages/settings.page').then(m => m.SettingsPage) },
    ],
  },
];
