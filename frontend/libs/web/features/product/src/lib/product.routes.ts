import type { Route, Routes } from '@angular/router';
import { permissionGuard, unsavedChangesGuard } from '@erp/web/core';
import { PERM, type ProductEntityKey } from '@erp/shared/contracts';
import { provideTranslocoScope } from '@jsverse/transloco';

const scope = provideTranslocoScope({
  scope: 'product',
  loader: { en: () => import('./i18n/en.json').then(m => m.default.product) },
});
// Permission ids keep their original `inventory.*` names so existing roles and access rights are unaffected.
const read = [permissionGuard(PERM.inventory.read)];
const write = [permissionGuard(PERM.inventory.write)];

const list = () => import('./pages/entity-list.page').then(m => m.EntityListPage);
const detail = () => import('./pages/entity-detail.page').then(m => m.EntityDetailPage);
const form = () => import('./pages/entity-form.page').then(m => m.EntityFormPage);

/** list, new, detail, edit for one model. `data.entity` selects the model; `:id` is bound to the page's `id` input. */
function crud(path: string, entity: ProductEntityKey, title: string): Route[] {
  const data = { entity };
  return [
    { path, title, data, loadComponent: list },
    { path: `${path}/new`, title: `New ${title}`, data, canActivate: write, canDeactivate: [unsavedChangesGuard], loadComponent: form },
    { path: `${path}/:id`, title, data, loadComponent: detail },
    { path: `${path}/:id/edit`, title: `Edit ${title}`, data, canActivate: write, canDeactivate: [unsavedChangesGuard], loadComponent: form },
  ];
}

export const PRODUCT_ROUTES: Routes = [
  {
    path: '',
    providers: [scope],
    canActivate: read,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', title: 'Product overview', loadComponent: () => import('./pages/overview.page').then(m => m.OverviewPage) },
      ...crud('products', 'products', 'Products'),
      ...crud('categories', 'categories', 'Product categories'),
      ...crud('uom', 'uoms', 'Units of measure'),
      ...crud('uom-categories', 'uomCategories', 'UoM categories'),
    ],
  },
];
