import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService } from '@erp/web/core';
import { PERM, type ResCompanyRow } from '@erp/shared/contracts';
import { DataGridComponent, IconComponent, PageHeaderComponent, SearchBoxComponent, type GridColumn } from '@erp/web/ui';
import { ContactsStore } from '../data/contacts.store';

/** Company (Users menu): the res.company records, each with the name of its partner. Opens the company form. */
@Component({
  selector: 'erp-companies-list-page',
  imports: [TranslocoPipe, PageHeaderComponent, SearchBoxComponent, DataGridComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="'contacts.co.title' | transloco" [subtitle]="'contacts.co.sub' | transloco">
        <ng-container actions>
          <erp-search-box [(value)]="q" [placeholder]="'contacts.co.searchPlaceholder' | transloco" />
          @if (canWrite()) { <button type="button" class="erp-btn-primary" (click)="add()"><erp-icon name="plus" [size]="15" />{{ 'contacts.co.new' | transloco }}</button> }
        </ng-container>
      </erp-page-header>
      <erp-data-grid [columns]="columns" [rows]="rows()" [trackBy]="trackId" [loading]="loading()" [(sortKey)]="sortKey"
        [emptyTitle]="'contacts.co.empty' | transloco" (rowClick)="open($event)" />
    </div>`,
})
export class CompaniesListPage {
  private readonly store = inject(ContactsStore);
  private readonly router = inject(Router);
  private readonly perms = inject(PermissionService);
  protected readonly canWrite = computed(() => this.perms.has(PERM.contact.write));

  protected readonly q = signal('');
  protected readonly sortKey = signal('name');
  protected readonly loading = signal(true);
  private readonly companies = signal<ResCompanyRow[]>([]);

  protected readonly columns: GridColumn<ResCompanyRow>[] = [
    { key: 'name', label: 'contacts.co.c.name', kind: 'name', fixed: true, text: c => c.name, avatar: c => ({ name: c.name }) },
    { key: 'partner_name', label: 'contacts.co.c.partner', text: c => c.partner_name },
  ];
  protected readonly rows = computed(() => {
    const term = this.q().trim().toLowerCase();
    return this.companies().filter(c => !term || [c.name, c.partner_name].some(v => v.toLowerCase().includes(term)));
  });
  protected readonly trackId = (c: ResCompanyRow) => c.id;

  constructor() {
    void this.store.companyList().then(list => { this.companies.set(list); this.loading.set(false); }, () => this.loading.set(false));
  }

  protected add(): void {
    void this.router.navigate(['/contacts/companies', 'new']);
  }

  protected open(c: ResCompanyRow): void {
    void this.router.navigate(['/contacts/companies', c.id]);
  }
}
