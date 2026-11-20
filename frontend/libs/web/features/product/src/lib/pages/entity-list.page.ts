import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService, SearchService } from '@erp/web/core';
import { EmptyStateComponent, I18n, IconComponent, PageHeaderComponent, PagerComponent, PillComponent, SegmentedComponent } from '@erp/web/ui';
import { PERM, type ProductEntityKey } from '@erp/shared/contracts';
import { ProductActions } from '../data/product-actions.service';
import { ProductListMemory, type ListState } from '../data/list-memory';
import { ProductStore } from '../data/product.store';
import { ProductBreadcrumbComponent, type Crumb } from '../components/product-breadcrumb.component';
import { ProductCellComponent } from '../components/product-cell.component';
import { ENTITY_BY_KEY } from '../models/product-entities';
import { relRecords } from '../models/product-helpers';
import { singularKey, titleKey, type HideFrom, type Rec } from '../models/product-types';

/** Full class names so Tailwind can see them. */
const HIDE: Record<HideFrom, string> = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell', '2xl': 'hidden 2xl:table-cell' };
const PAGE_SIZES = [10, 25, 50];

/**
 * List of one Product model (products, categories, units of measure, UoM categories): search, filters, active/archived,
 * sortable columns, paging and row actions. The model comes from the route (`data.entity`); all columns and filters are
 * declared in `product-entities.ts`.
 */
@Component({
  selector: 'erp-product-list-page',
  imports: [RouterLink, TranslocoPipe, IconComponent, PageHeaderComponent, SegmentedComponent, PagerComponent, EmptyStateComponent, PillComponent, ProductBreadcrumbComponent, ProductCellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-1">
      <erp-product-breadcrumb [crumbs]="crumbs()" />
      <erp-page-header [title]="title()" [subtitle]="subtitle()">
        <ng-container actions>
          @if (canWrite()) { <a class="erp-btn-primary" [routerLink]="['/product', cfg().route, 'new']"><erp-icon name="plus" [size]="14" />{{ 'product.l.new' | transloco: { what: singular() } }}</a> }
        </ng-container>
      </erp-page-header>

      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="space-y-3 border-b border-slate-200 p-4">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="flex flex-1 items-center gap-2">
              <div class="relative max-w-md flex-1">
                <erp-icon name="search" [size]="14" class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="search" class="erp-input !ps-9 !pe-8" [value]="st().q" (input)="patch({ q: $any($event.target).value })" [placeholder]="searchPlaceholder()" [attr.aria-label]="searchPlaceholder()" />
                @if (st().q) { <button type="button" class="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700" [attr.aria-label]="'product.l.clearSearch' | transloco" (click)="patch({ q: '' })"><erp-icon name="x" [size]="14" /></button> }
              </div>
              @if (cfg().filters.length > 0) {
                <button type="button" class="erp-btn-ghost" [attr.aria-expanded]="showFilters()" (click)="filtersOpen.set(!showFilters())">
                  <erp-icon name="sliders-horizontal" [size]="14" />{{ 'product.l.filters' | transloco }}
                  @if (activeFilters() > 0) { <span class="rounded-full bg-emerald-600 px-1.5 text-[10px] text-white">{{ activeFilters() }}</span> }
                </button>
              }
            </div>
            <erp-segmented [options]="segments()" [value]="st().status" (valueChange)="patch({ status: $any($event) })" />
          </div>
          @if (cfg().filters.length > 0 && showFilters()) {
            <div class="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              @for (f of cfg().filters; track f.key) {
                <select class="erp-input" [class]="st().filters[f.key] ? '!border-emerald-500 !bg-emerald-50/60' : ''" [attr.aria-label]="f.labelKey | transloco"
                  [value]="st().filters[f.key] ?? ''" (change)="setFilter(f.key, $any($event.target).value)">
                  <option value="">{{ f.labelKey | transloco }}: {{ 'product.l.all' | transloco }}</option>
                  @for (o of f.options(ctx()); track o.value) { <option [value]="o.value" [selected]="o.value === st().filters[f.key]">{{ o.label }}</option> }
                </select>
              }
            </div>
          }
          @if (hasCriteria()) {
            <div class="flex items-center gap-2 text-[11px] text-slate-500">
              <span>{{ 'product.l.results' | transloco: { n: rows().length } }}</span>
              <button type="button" class="font-bold text-emerald-700 hover:underline" (click)="clear()">{{ 'product.l.clear' | transloco }}</button>
            </div>
          }
        </div>

        @if (visible().length === 0) {
          <erp-empty-state [title]="emptyTitle()" [text]="hasCriteria() ? ('product.l.emptyTry' | transloco) : ''" [icon]="cfg().icon">
            @if (hasCriteria()) { <button type="button" class="erp-btn-ghost mt-2" (click)="clear()">{{ 'product.l.clear' | transloco }}</button> }
            @else if (st().status === 'active' && canWrite()) { <a class="erp-btn-primary mt-2" [routerLink]="['/product', cfg().route, 'new']"><erp-icon name="plus" [size]="14" />{{ 'product.l.new' | transloco: { what: singular() } }}</a> }
          </erp-empty-state>
        } @else {
          <div class="overflow-x-auto">
            <table class="erp-table min-w-[640px]">
              <thead>
                <tr>
                  @for (c of cfg().columns; track c.key) {
                    <th scope="col" [class]="(c.right ? '!text-end ' : '') + (c.hide ? hide[c.hide] : '')" [attr.aria-sort]="ariaSort(c.key)">
                      @if (c.sort) {
                        <button type="button" class="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900" [class]="(st().sort.key === c.key ? 'text-slate-900 ' : '') + (c.right ? 'flex-row-reverse' : '')" (click)="toggleSort(c.key)">
                          {{ c.labelKey | transloco }}
                          <erp-icon [name]="st().sort.key === c.key ? (st().sort.dir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down'" [size]="11" [class]="st().sort.key === c.key ? '' : 'opacity-40'" />
                        </button>
                      } @else { {{ c.labelKey | transloco }} }
                    </th>
                  }
                  <th scope="col">{{ 'product.l.status' | transloco }}</th>
                  <th scope="col" class="!text-end">{{ 'product.l.actions' | transloco }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of visible(); track r.id) {
                  <tr class="group cursor-pointer" [class]="r.active ? '' : 'bg-slate-50/60 text-slate-500'" (click)="open(r)">
                    @for (c of cfg().columns; track c.key) {
                      <td [class]="(c.primary ? 'min-w-[200px] ' : c.wrap ? '' : 'whitespace-nowrap ') + (c.right ? 'text-end tabular-nums ' : '') + (c.hide ? hide[c.hide] : '')">
                        @if (c.primary) {
                          <a [routerLink]="['/product', cfg().route, r.id]" (click)="$event.stopPropagation()" class="font-bold text-slate-900 hover:text-emerald-700 hover:underline"><erp-product-cell [cell]="c.cell(r, ctx())" /></a>
                        } @else { <erp-product-cell [cell]="c.cell(r, ctx())" /> }
                      </td>
                    }
                    <td><erp-pill [tone]="r.active ? 'green' : 'slate'">{{ (r.active ? 'product.l.active' : 'product.l.archived') | transloco }}</erp-pill></td>
                    <td>
                      <div class="flex items-center justify-end gap-0.5">
                        <a class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" [routerLink]="['/product', cfg().route, r.id]" (click)="$event.stopPropagation()" [attr.aria-label]="'product.act.view' | transloco" [title]="'product.act.view' | transloco"><erp-icon name="eye" [size]="15" /></a>
                        @if (canWrite()) {
                          <a class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" [routerLink]="['/product', cfg().route, r.id, 'edit']" (click)="$event.stopPropagation()" [attr.aria-label]="'product.act.edit' | transloco" [title]="'product.act.edit' | transloco"><erp-icon name="pencil" [size]="15" /></a>
                          @if (r.active) {
                            <button type="button" class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" (click)="$event.stopPropagation(); archive(r)" [attr.aria-label]="'product.act.archive' | transloco" [title]="'product.act.archive' | transloco"><erp-icon name="archive" [size]="15" /></button>
                          } @else {
                            <button type="button" class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" (click)="$event.stopPropagation(); restore(r)" [attr.aria-label]="'product.act.restore' | transloco" [title]="'product.act.restore' | transloco"><erp-icon name="archive-restore" [size]="15" /></button>
                          }
                          <button type="button" class="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600" (click)="$event.stopPropagation(); remove(r)" [attr.aria-label]="'product.act.delete' | transloco" [title]="'product.act.delete' | transloco"><erp-icon name="trash" [size]="15" /></button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (rows().length > 0) {
          <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pe-4">
            <erp-pager class="min-w-0 flex-1" [total]="rows().length" [pageSize]="st().pageSize" [page]="page()" (pageChange)="patch({ page: $event }, false)" />
            <label class="flex items-center gap-1.5 text-[11px] text-slate-500">{{ 'product.l.rows' | transloco }}
              <select class="erp-input !w-auto !py-1" [attr.aria-label]="'product.l.rows' | transloco" (change)="patch({ pageSize: +$any($event.target).value })">
                @for (n of pageSizes; track n) { <option [value]="n" [selected]="n === st().pageSize">{{ n }}</option> }
              </select>
            </label>
          </div>
        }
      </section>
    </div>`,
})
export class EntityListPage {
  private readonly store = inject(ProductStore);
  private readonly memory = inject(ProductListMemory);
  private readonly actions = inject(ProductActions);
  private readonly perms = inject(PermissionService);
  private readonly search = inject(SearchService);
  private readonly i18n = inject(I18n);
  private readonly router = inject(Router);

  /** Route data: which model this list shows. */
  readonly entity = input.required<ProductEntityKey>();
  protected readonly hide = HIDE;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly ctx = this.store.ctx;
  protected readonly cfg = computed(() => ENTITY_BY_KEY[this.entity()]);
  protected readonly canWrite = computed(() => this.perms.has(PERM.inventory.write));
  protected readonly filtersOpen = signal<boolean | null>(null);

  private readonly states = signal<Partial<Record<ProductEntityKey, ListState>>>({});
  protected readonly st = computed<ListState>(() => {
    const cfg = this.cfg();
    return this.states()[cfg.key] ?? this.memory.get(cfg.key) ?? { q: '', status: 'active', filters: {}, sort: cfg.defaultSort, page: 1, pageSize: 10 };
  });

  protected readonly title = computed(() => this.i18n.tr(titleKey(this.entity())));
  protected readonly singular = computed(() => this.i18n.tr(singularKey(this.entity())));
  protected readonly subtitle = computed(() => `${this.i18n.tr(`product.e.${this.entity()}.subtitle`)}  ·  ${this.cfg().model}`);
  protected readonly searchPlaceholder = computed(() => this.i18n.tr(`product.e.${this.entity()}.search`));
  protected readonly crumbs = computed<Crumb[]>(() => [
    { label: this.i18n.tr('product.crumb.root'), link: ['/product', 'overview'] },
    { label: this.i18n.tr('product.crumb.masterData') },
    { label: this.title() },
  ]);

  private readonly all = computed(() => relRecords(this.store.s(), this.entity()));
  protected readonly segments = computed(() => {
    const all = this.all();
    return [
      { id: 'active', label: this.i18n.tr('product.l.active'), count: all.filter(r => r.active).length },
      { id: 'archived', label: this.i18n.tr('product.l.archived'), count: all.filter(r => !r.active).length },
      { id: 'all', label: this.i18n.tr('product.l.allRecords'), count: all.length },
    ];
  });
  protected readonly activeFilters = computed(() => this.cfg().filters.filter(f => this.st().filters[f.key]).length);
  protected readonly showFilters = computed(() => this.filtersOpen() ?? (this.cfg().filters.length <= 4 || this.activeFilters() > 0));
  /** The header search box and this list's own search box both narrow the list. */
  private readonly query = computed(() => (this.st().q || this.search.query()).trim().toLowerCase());
  protected readonly hasCriteria = computed(() => !!this.query() || this.activeFilters() > 0);

  protected readonly rows = computed<Rec[]>(() => {
    const cfg = this.cfg(), st = this.st(), c = this.ctx();
    const tokens = this.query().split(/\s+/).filter(Boolean);
    const col = cfg.columns.find(x => x.key === st.sort.key);
    const out = this.all().filter(r => {
      if (st.status === 'active' && !r.active) return false;
      if (st.status === 'archived' && r.active) return false;
      for (const f of cfg.filters) { const v = st.filters[f.key]; if (v && !f.match(r, v, c)) return false; }
      if (tokens.length) { const text = cfg.searchText(r, c).toLowerCase(); if (!tokens.every(t => text.includes(t))) return false; }
      return true;
    });
    const sort = col?.sort;
    if (sort) {
      const dir = st.sort.dir === 'asc' ? 1 : -1;
      out.sort((a, b) => { const x = sort(a, c), y = sort(b, c); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir; });
    }
    return out;
  });
  protected readonly page = computed(() => Math.min(this.st().page, Math.max(1, Math.ceil(this.rows().length / this.st().pageSize))));
  protected readonly visible = computed(() => this.rows().slice((this.page() - 1) * this.st().pageSize, this.page() * this.st().pageSize));
  protected readonly emptyTitle = computed(() => {
    const what = this.title().toLowerCase();
    return this.i18n.tr(this.hasCriteria() ? 'product.l.emptyMatch' : this.st().status === 'archived' ? 'product.l.emptyArchived' : 'product.l.emptyNone', { what });
  });

  protected patch(p: Partial<ListState>, resetPage = true): void {
    const key = this.cfg().key;
    const next: ListState = { ...this.st(), ...(resetPage ? { page: 1 } : {}), ...p };
    this.states.update(m => ({ ...m, [key]: next }));
    this.memory.set(key, next);
  }
  protected setFilter(key: string, value: string): void { this.patch({ filters: { ...this.st().filters, [key]: value } }); }
  protected clear(): void { this.patch({ q: '', filters: {} }); }
  protected toggleSort(key: string): void {
    const s = this.st().sort;
    this.patch({ sort: s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' } });
  }
  protected ariaSort(key: string): 'ascending' | 'descending' | null {
    const s = this.st().sort;
    return s.key === key ? (s.dir === 'asc' ? 'ascending' : 'descending') : null;
  }
  protected open(r: Rec): void { void this.router.navigate(['/product', this.cfg().route, r.id]); }
  protected archive(r: Rec): void { void this.actions.requestArchive(this.cfg(), r); }
  protected restore(r: Rec): void { void this.actions.restore(this.cfg(), r); }
  protected remove(r: Rec): void { void this.actions.requestDelete(this.cfg(), r); }
}
