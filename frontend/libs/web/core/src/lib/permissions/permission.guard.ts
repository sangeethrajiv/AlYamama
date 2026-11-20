import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import type { Permission } from '@erp/shared/contracts';
import { PermissionService } from './permission.service';

/** `canActivate: [permissionGuard('accounting.invoice.read')]` */
export const permissionGuard =
  (permission: Permission): CanActivateFn =>
  () => {
    if (inject(PermissionService).has(permission)) return true;
    return inject(Router).createUrlTree(['/forbidden']);
  };
