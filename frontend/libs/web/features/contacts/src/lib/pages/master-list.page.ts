import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService, SearchService } from '@erp/web/core';
import { DataGridComponent, DialogService, IconComponent, KpiComponent, PageHeaderComponent, SearchBoxComponent, ToastService, I18n } from '@erp/web/ui';
import { PERM, type ResPartner } from '@erp/shared/contracts';
import { ContactsStore } from '../data/contacts.store';
import { DEFAULT_FILTERS, activeChips, applyFilters, type Filters, type Tri } from '../models/partner-filters';
import { PARTNER_TYPES, nameOf } from '../models/options';
import { partnerColumns } from '../models/partner-columns';

/** Contact master list: search, advanced filters with a live match count, removable chips, sortable/selectable columns, paging, row actions. */
@Component({
  selector: 'erp-master-list-page',
  imports: [TranslocoPipe, PageHeaderComponent, KpiComponent, SearchBoxComponent, DataGridComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="'contacts.cm.title' | transloco" [subtitle]="'contacts.cm.subtitle' | transloco: { total: partners().length, active: active() }">
        <ng-container actions>
          @if (canWrite()) { <button type="button" class="erp-btn-primary" (click)="add()"><erp-icon name="plus" [size]="14" />{{ 'contacts.cm.add' | transloco }}</button> }
        </ng-container>
      </erp-page-header>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <erp-kpi [label]="'contacts.cm.kpi.total' | transloco" [value]="partners().length" />
        <erp-kpi [label]="'contacts.cm.kpi.active' | transloco" [value]="active()" />
        <erp-kpi [label]="'contacts.cm.kpi.archived' | transloco" [value]="partners().length - active()" />
        <erp-kpi [label]="'contacts.cm.kpi.companies' | transloco" [value]="companies()" [hint]="('contacts.cm.kpi.individuals' | transloco: { n: partners().length - companies() })" />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <erp-search-box [value]="q()" (valueChange)="q.set($event); page.set(1)" [placeholder]="'contacts.cm.searchPlaceholder' | transloco" />
        <button type="button" (click)="panel.set(!panel())" [attr.aria-expanded]="panel()" class="erp-btn-ghost" [class]="panel() || chips().length ? '!border-emerald-400 !bg-emerald-50 !text-emerald-800' : ''">
          <erp-icon name="filter" [size]="14" />{{ 'contacts.cm.filters' | transloco }}
          @if (chips().length) { <span class="rounded-full bg-emerald-600 px-1.5 font-mono text-[10px] text-white">{{ chips().length }}</span> }
        </button>
      </div>

      @if (panel()) {
        <form (submit)="$event.preventDefault(); apply()" [attr.aria-label]="'contacts.cm.advanced' | transloco" class="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <label><span class="mb-1 block font-bold text-slate-600">{{ 'contacts.cm.fl.name' | transloco }}</span><input class="erp-input" [value]="draft().name" (input)="setDraft({ name: $any($event.target).value })" /></label>
            <label><span class="mb-1 block font-bold text-slate-600">{{ 'contacts.cm.fl.email' | transloco }}</span><input class="erp-input" [value]="draft().email" (input)="setDraft({ email: $any($event.target).value })" /></label>
            <label><span class="mb-1 block font-bold text-slate-600">{{ 'contacts.cm.fl.phone' | transloco }}</span><input class="erp-input" [value]="draft().phone" (input)="setDraft({ phone: $any($event.target).value })" /></label>
            <label><span class="mb-1 block font-bold text-slate-600">{{ 'contacts.cm.fl.kind' | transloco }}</span>
              <select class="erp-input" [value]="draft().kind" (change)="setDraft({ kind: $any($event.target).value })"><option value="all">{{ 'common.all' | transloco }}</option><option value="individual">{{ 'contacts.cm.kind.individual' | transloco }}</option><option value="company">{{ 'contacts.cm.kind.company' | transloco }}</option></select></label>
            <label><span class="mb-1 block font-bold text-slate-600">{{ 'contacts.cm.fl.type' | transloco }}</span>
              <select class="erp-input" [value]="draft().type" (change)="setDraft({ type: $any($event.target).value })"><option value="">{{ 'contacts.cm.fl.allTypes' | transloco }}</option>@for (t of types; track t.id) { <option [value]="t.id">{{ t.labelKey | transloco }}</option> }</select></label>
            @for (k of tris; track k) {
              <label><span class="mb-1 block font-bold text-slate-600">{{ 'contacts.cm.f.' + k | transloco }}</span>
                <select class="erp-input" [value]="draft()[k]" (change)="setTri(k, $any($event.target).value)"><option value="any">{{ 'contacts.cm.fl.any' | transloco }}</option><option value="yes">{{ 'common.yes' | transloco }}</option><option value="no">{{ 'common.no' | transloco }}</option></select></label>
            }
            <label><span class="mb-1 block font-bold text-slate-600">{{ 'contacts.cm.fl.status' | transloco }}</span>
              <select class="erp-input" [value]="draft().status" (change)="setDraft({ status: $any($event.target).value })"><option value="active">{{ 'common.active' | transloco }}</option><option value="archived">{{ 'common.archived' | transloco }}</option><option value="all">{{ 'contacts.cm.chip.allStatus' | transloco }}</option></select></label>
            <label><span class="mb-1 block font-bold text-slate-600">{{ 'contacts.cm.f.country' | transloco }}</span>
              <select class="erp-input" [value]="draft().country_id" (change)="setDraft({ country_id: +$any($event.target).value })"><option value="0">{{ 'contacts.cm.fl.allCountries' | transloco }}</option>@for (c of store.lookups().countries; track c.id) { <option [value]="c.id">{{ c.name }}</option> }</select></label>
          </div>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <button type="submit" class="erp-btn-primary">{{ 'contacts.cm.fl.apply' | transloco }}</button>
            <button type="button" class="erp-btn-ghost" (click)="clear()">{{ 'contacts.cm.fl.clear' | transloco }}</button>
            <span class="ms-1 text-xs text-slate-500" aria-live="polite">{{ draftChanged() ? ('contacts.cm.fl.wouldMatch' | transloco: { n: draftCount() }) : ('contacts.cm.fl.applied' | transloco) }}</span>
          </div>
        </form>
      }

      <div class="flex flex-wrap items-center gap-2 text-xs" aria-live="polite">
        <span class="font-bold text-slate-700" data-testid="result-count">{{ 'contacts.cm.count' | transloco: { n: rows().length, total: partners().length } }}{{ chips().length === 0 && !term() ? (' ' + ('contacts.cm.activeOnly' | transloco)) : '' }}</span>
        @for (c of chips(); track c.key) {
          <span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 py-0.5 pe-1 ps-2.5 font-bold text-emerald-800">{{ c.label }}
            <button type="button" (click)="removeChip(c.key)" class="rounded-full p-0.5 hover:bg-emerald-100" [attr.aria-label]="'contacts.cm.fl.removeChip' | transloco"><erp-icon name="x" [size]="11" /></button></span>
        }
        @if (term()) { <span class="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 py-0.5 pe-1 ps-2.5 font-bold text-sky-800">{{ 'contacts.cm.chip.search' | transloco: { v: term() } }}
          <button type="button" (click)="q.set('')" class="rounded-full p-0.5 hover:bg-sky-100" [attr.aria-label]="'common.clear' | transloco"><erp-icon name="x" [size]="11" /></button></span> }
        @if (chips().length || term()) { <button type="button" (click)="clear()" class="font-bold text-emerald-700 hover:underline">{{ 'contacts.cm.fl.clearAll' | transloco }}</button> }
      </div>

      <erp-data-grid [columns]="columns()" [rows]="rows()" [trackBy]="trackId" [picker]="true" [loading]="loading()" [muted]="isArchived" [pageSize]="10"
        [(sortKey)]="sortKey" [(page)]="page" [emptyTitle]="(partners().length ? 'contacts.cm.noMatch' : 'contacts.cm.none') | transloco" [emptyText]="(partners().length ? 'contacts.cm.noMatchHint' : 'contacts.cm.noneHint') | transloco" (rowClick)="open($event)">
        <ng-template #actions let-c>
          <div class="inline-flex items-center gap-0.5">
            <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700" [attr.aria-label]="'contacts.cm.act.view' | transloco" (click)="open(c)"><erp-icon name="eye" [size]="14" /></button>
            @if (canWrite()) {
              <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700" [attr.aria-label]="'common.edit' | transloco" (click)="edit(c)"><erp-icon name="pencil" [size]="14" /></button>
              @if (c.active) { <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700" [attr.aria-label]="'contacts.cm.act.archive' | transloco" (click)="archive(c)"><erp-icon name="archive" [size]="14" /></button> }
              @else { <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700" [attr.aria-label]="'contacts.cm.act.restore' | transloco" (click)="restore(c)"><erp-icon name="archive-restore" [size]="14" /></button> }
              @if (canWrite()) { <button type="button" class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" [attr.aria-label]="'common.delete' | transloco" (click)="remove(c)"><erp-icon name="trash" [size]="14" /></button> }
            }
          </div>
        </ng-template>
      </erp-data-grid>
    </div>`,
})
export class MasterListPage {
  protected readonly store = inject(ContactsStore);
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionService);
  private readonly i18n = inject(I18n);

  protected readonly partners = this.store.partners;
  protected readonly types = PARTNER_TYPES;
  protected readonly tris = ['customer', 'supplier', 'employee'] as const;
  protected readonly q = signal('');
  protected readonly draft = signal<Filters>(DEFAULT_FILTERS);
  protected readonly applied = signal<Filters>(DEFAULT_FILTERS);
  protected readonly panel = signal(false);
  protected readonly sortKey = signal('name');
  protected readonly page = signal(1);
  protected readonly loading = computed(() => !this.store.loaded());

  protected readonly canWrite = computed(() => this.perms.has(PERM.contact.write));
  protected readonly canDelete = computed(() => this.perms.has(PERM.contact.delete));
  protected readonly term = computed(() => (this.q().trim() || this.search.query().trim().toLowerCase()));
  protected readonly active = computed(() => this.partners().filter(c => c.active).length);
  protected readonly companies = computed(() => this.partners().filter(c => c.is_company).length);
  private readonly byId = computed(() => new Map(this.partners().map(c => [c.id, c])));
  protected readonly columns = computed(() => partnerColumns(this.store.lookups(), this.byId(), k => this.i18n.tr(k)));
  protected readonly rows = computed(() => applyFilters(this.partners(), this.applied(), this.term()));
  protected readonly chips = computed(() => activeChips(this.applied(), (k, p) => this.i18n.tr(k, p), id => nameOf(this.store.lookups().countries, id)));
  protected readonly draftChanged = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.applied()));
  protected readonly draftCount = computed(() => (this.panel() ? applyFilters(this.partners(), this.draft(), this.term()).length : 0));
  protected readonly trackId = (c: ResPartner) => c.id;
  protected readonly isArchived = (c: ResPartner) => !c.active;

  protected setDraft(p: Partial<Filters>): void { this.draft.update(d => ({ ...d, ...p })); }
  protected setTri(k: 'customer' | 'supplier' | 'employee', v: Tri): void { this.setDraft({ [k]: v } as Partial<Filters>); }
  protected apply(): void { this.applied.set(this.draft()); this.page.set(1); }
  protected clear(): void { this.draft.set(DEFAULT_FILTERS); this.applied.set(DEFAULT_FILTERS); this.q.set(''); this.page.set(1); }
  protected removeChip(k: keyof Filters): void {
    this.applied.update(a => ({ ...a, [k]: DEFAULT_FILTERS[k] }));
    this.draft.update(d => ({ ...d, [k]: DEFAULT_FILTERS[k] }));
    this.page.set(1);
  }

  protected open(c: ResPartner): void { void this.router.navigate(['/contacts/master', c.id]); }
  protected add(): void { void this.router.navigate(['/contacts/master/new']); }
  protected edit(c: ResPartner): void { void this.router.navigate(['/contacts/master', c.id, 'edit']); }
  protected async archive(c: ResPartner): Promise<void> {
    if (!(await this.dialogs.confirm({ title: this.i18n.tr('contacts.cm.archiveTitle', { name: c.name }), message: this.i18n.tr('contacts.cm.archiveText'), confirmLabel: this.i18n.tr('contacts.cm.act.archive'), danger: false }))) return;
    await this.store.setPartnerActive(c.id, false);
    this.toast.success(this.i18n.tr('contacts.cm.archived', { name: c.name }));
  }
  protected async restore(c: ResPartner): Promise<void> {
    await this.store.setPartnerActive(c.id, true);
    this.toast.success(this.i18n.tr('contacts.cm.restored', { name: c.name }));
  }
  /** Permanent deletion is not part of the prototype contract, so it is refused with an explanation. */
  protected async remove(c: ResPartner): Promise<void> {
    await this.dialogs.confirm({ title: this.i18n.tr('contacts.cm.deleteTitle', { name: c.name }), message: this.i18n.tr('contacts.cm.deleteText'), confirmLabel: this.i18n.tr('common.delete'), danger: true });
    this.toast.info(this.i18n.tr('contacts.cm.deleteKept', { name: c.name }));
  }
}
