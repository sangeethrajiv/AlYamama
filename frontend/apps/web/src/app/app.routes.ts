import type { Route } from '@angular/router';
import { ForbiddenPage, LoginPage, NotFoundPage, ShellComponent, authGuard, guestGuard } from '@erp/web/core';

/**
 * The app owns only wiring (section 5): the shell, login and one lazy route per feature library. Disabled add-ons
 * never register routes, so their chunks are never downloaded.
 */
export const appRoutes: Route[] = [
  { path: 'login', component: LoginPage, canActivate: [guestGuard], title: 'Sign in' },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadChildren: () => import('@erp/web/features/dashboard').then(m => m.DASHBOARD_ROUTES) },
      { path: 'accounting', loadChildren: () => import('@erp/web/features/accounting').then(m => m.ACCOUNTING_ROUTES) },
      { path: 'reports', loadChildren: () => import('@erp/web/features/reports').then(m => m.REPORTS_ROUTES) },
      { path: 'administration', loadChildren: () => import('@erp/web/features/administration').then(m => m.ADMINISTRATION_ROUTES) },
      { path: 'contacts', loadChildren: () => import('@erp/web/features/contacts').then(m => m.CONTACTS_ROUTES) },
      { path: 'product', loadChildren: () => import('@erp/web/features/product').then(m => m.PRODUCT_ROUTES) },
      { path: 'forbidden', component: ForbiddenPage },
      { path: '**', component: NotFoundPage },
    ],
  },
];
