import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import type { Permission } from '@erp/shared/contracts';
import { PermissionService } from './permission.service';

/** `<button *erpHasPermission="'accounting.invoice.validate'">` renders only when the user holds the permission. */
@Directive({ selector: '[erpHasPermission]' })
export class HasPermissionDirective {
  private readonly perms = inject(PermissionService);
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  readonly erpHasPermission = input.required<Permission | Permission[]>();
  private shown = false;

  constructor() {
    effect(() => {
      const p = this.erpHasPermission();
      const ok = Array.isArray(p) ? this.perms.hasAny(...p) : this.perms.has(p);
      if (ok && !this.shown) { this.vcr.createEmbeddedView(this.tpl); this.shown = true; }
      else if (!ok && this.shown) { this.vcr.clear(); this.shown = false; }
    });
  }
}
