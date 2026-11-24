import type { Routes } from '@angular/router';
import { V2_ROUTES } from './v2/accounting-v2.routes';
import { provideTranslocoScope } from '@jsverse/transloco';

/** Lazy dictionary for this feature. The files are keyed `accounting.*`; a scope nests under its own name, so unwrap one level. */
const scope = provideTranslocoScope({
  scope: 'accounting',
  loader: { en: () => import('./i18n/en.json').then(m => m.default.accounting), ar: () => import('./i18n/ar.json').then(m => m.default.accounting) },
});

export const ACCOUNTING_ROUTES: Routes = [
  {
    path: '',
    providers: [scope],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      ...V2_ROUTES,
    ],
  },
];
