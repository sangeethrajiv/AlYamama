import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SearchService } from '@erp/web/core';
import { DataGridComponent, KpiComponent, PageHeaderComponent, SearchBoxComponent, SegmentedComponent } from '@erp/web/ui';
import type { ResUser } from '@erp/shared/contracts';
import { ContactsStore } from '../data/contacts.store';
import { nameOf } from '../models/options';
import { userColumns } from '../models/user-columns';

type UserFilter = 'active' | 'archived' | 'internal' | 'portal' | 'all';

/** All Users: every login account with its linked partner record. */
@Component({
  selector: 'erp-users-list-page',
  imports: [TranslocoPipe, PageHeaderComponent, KpiComponent, SegmentedComponent, SearchBoxComponent, DataGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="'contacts.users.title' | transloco" [subtitle]="'contacts.users.subtitle' | transloco" />
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <erp-kpi [label]="'contacts.users.kpi.total' | transloco" [value]="store.users().length" />
        <erp-kpi [label]="'contacts.users.kpi.active' | transloco" [value]="count(isActive)" />
        <erp-kpi [label]="'contacts.users.kpi.archived' | transloco" [value]="count(isArchived)" />
        <erp-kpi [label]="'contacts.users.kpi.portal' | transloco" [value]="count(isPortal)" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <erp-segmented [options]="filters()" [(value)]="filter" />
        <select class="erp-input w-auto font-bold" [attr.aria-label]="'contacts.users.company' | transloco" [value]="company()" (change)="company.set(+$any($event.target).value)">
          <option value="0">{{ 'contacts.users.allCompanies' | transloco }}</option>
          @for (c of companies(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
        </select>
        <div class="ms-auto"><erp-search-box [(value)]="q" [placeholder]="'contacts.users.searchPlaceholder' | transloco" /></div>
      </div>
      <erp-data-grid [columns]="columns()" [rows]="rows()" [trackBy]="trackId" [picker]="true" [muted]="isArchived" [(sortKey)]="sortKey"
        [emptyTitle]="'contacts.users.empty' | transloco" [emptyText]="'contacts.users.emptyHint' | transloco" (rowClick)="open($event)" />
    </div>`,
})
export class UsersListPage {
  protected readonly store = inject(ContactsStore);
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);

  protected readonly q = signal('');
  protected readonly filter = signal<string>('active');
  protected readonly company = signal(0);
  protected readonly sortKey = signal('name');

  protected readonly isActive = (u: ResUser) => u.active;
  protected readonly isArchived = (u: ResUser) => !u.active;
  protected readonly isPortal = (u: ResUser) => !!u.share;
  protected readonly trackId = (u: ResUser) => u.id;
  protected count(f: (u: ResUser) => boolean): number {
    return this.store.users().filter(f).length;
  }

  protected readonly columns = computed(() => userColumns(this.store.lookups()));
  protected readonly companies = computed(() => this.store.lookups().companies.filter(c => this.store.users().some(u => u.company_id === c.id)));
  protected readonly filters = computed(() => [
    { id: 'active', label: 'Active', count: this.count(this.isActive) }, { id: 'archived', label: 'Archived', count: this.count(this.isArchived) },
    { id: 'internal', label: 'Internal', count: this.count(u => !u.share) }, { id: 'portal', label: 'Portal / Public', count: this.count(this.isPortal) },
    { id: 'all', label: 'All', count: this.store.users().length },
  ]);

  protected readonly rows = computed(() => {
    const term = (this.q() || this.search.query()).trim().toLowerCase();
    const f = this.filter();
    return this.store.users().filter(u =>
      (f === 'all' || (f === 'active' ? u.active : f === 'archived' ? !u.active : f === 'portal' ? !!u.share : !u.share)) &&
      (!this.company() || u.company_id === this.company()) &&
      (!term || [u.name, u.login, u.email, u.phone, u.mobile].some(v => v?.toLowerCase().includes(term))),
    );
  });

  protected open(u: ResUser): void {
    void this.router.navigate(['/contacts/users', u.id]);
  }
  protected companyName = (id: number) => nameOf(this.store.lookups().companies, id);
}
