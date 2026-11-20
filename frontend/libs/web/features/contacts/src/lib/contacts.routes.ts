import type { Routes } from '@angular/router';
import { permissionGuard, unsavedChangesGuard } from '@erp/web/core';
import { PERM } from '@erp/shared/contracts';
import { provideTranslocoScope } from '@jsverse/transloco';

/** Lazy dictionary for this feature; never downloaded unless the user opens a contacts route. */
const scope = provideTranslocoScope({
  scope: 'contacts',
  // The dictionaries are keyed `contacts.*`; Transloco nests a scope's translations under its name, so unwrap one level
  loader: { en: () => import('./i18n/en.json').then(m => m.default.contacts), ar: () => import('./i18n/ar.json').then(m => m.default.contacts) },
});

export const CONTACTS_ROUTES: Routes = [
  {
    path: '',
    providers: [scope],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      { path: 'users', canActivate: [permissionGuard(PERM.user.read)], title: 'Users', loadComponent: () => import('./pages/users-list.page').then(m => m.UsersListPage) },
      { path: 'users/:id', canActivate: [permissionGuard(PERM.user.read)], canDeactivate: [unsavedChangesGuard], title: 'User', loadComponent: () => import('./pages/user-detail.page').then(m => m.UserDetailPage) },
      { path: 'directory/:section', canActivate: [permissionGuard(PERM.contact.read)], title: 'Contacts', loadComponent: () => import('./pages/directory.page').then(m => m.DirectoryPage) },
      { path: 'master', canActivate: [permissionGuard(PERM.contact.read)], title: 'Contact', loadComponent: () => import('./pages/master-list.page').then(m => m.MasterListPage) },
      { path: 'master/new', canActivate: [permissionGuard(PERM.contact.write)], canDeactivate: [unsavedChangesGuard], title: 'New contact', loadComponent: () => import('./pages/master-form.page').then(m => m.MasterFormPage) },
      { path: 'master/:id', canActivate: [permissionGuard(PERM.contact.read)], title: 'Contact', loadComponent: () => import('./pages/master-detail.page').then(m => m.MasterDetailPage) },
      { path: 'master/:id/edit', canActivate: [permissionGuard(PERM.contact.write)], canDeactivate: [unsavedChangesGuard], title: 'Edit contact', loadComponent: () => import('./pages/master-form.page').then(m => m.MasterFormPage) },
    ],
  },
];
