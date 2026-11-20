import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DataChanges, SystemApi } from '@erp/web/api-client';
import type { ManifestItem, NavBadges, SystemManifest } from '@erp/shared/contracts';
import { CompanyContext } from '../company/company-context.service';
import { PermissionService } from '../permissions/permission.service';

/** Loads GET /api/v1/system/manifest (menu, enabled add-ons) and the live counters shown beside menu items. */
@Injectable({ providedIn: 'root' })
export class ManifestService {
  private readonly api = inject(SystemApi);
  private readonly perms = inject(PermissionService);
  private readonly company = inject(CompanyContext);
  private readonly changes = inject(DataChanges);

  private readonly manifestSig = signal<SystemManifest | null>(null);
  private readonly badgeSig = signal<NavBadges>({});

  readonly badges = this.badgeSig.asReadonly();
  readonly addons = computed(() => this.manifestSig()?.enabledAddons ?? []);

  /** Menu filtered by the user's permissions; groups with nothing visible disappear. */
  readonly menu = computed<ManifestItem[]>(() => {
    const prune = (items: ManifestItem[]): ManifestItem[] =>
      items
        .filter(i => this.perms.has(i.permission))
        .map(i => (i.children ? { ...i, children: prune(i.children) } : i))
        .filter(i => !i.children || i.children.length > 0 || i.path);
    return prune(this.manifestSig()?.menu ?? []);
  });

  constructor() {
    effect(() => {
      this.changes.revision();
      const id = this.company.activeId();
      void this.api.badges(id).then(b => this.badgeSig.set(b));
    });
  }

  async load(): Promise<void> {
    this.manifestSig.set(await this.api.manifest());
  }
}
