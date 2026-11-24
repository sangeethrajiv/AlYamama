import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PermissionService } from '@erp/web/core';
import { AccountingBackend } from '@erp/web/api-client';
import { EmptyStateComponent, ErrorBannerComponent, IconComponent, PageHeaderComponent, PagerComponent, PillComponent, SearchBoxComponent } from '@erp/web/ui';
import type { Row } from './lines-editor.component';
import { makeSpecs } from './resources';
import { cellText, pillText, pillTone } from './resource-spec';

/** Generic list for any ResourceSpec: search, one status filter, server paging, click a row to open it. Route data: `{ resource: key }`. */
@Component({
  selector: 'erp-resource-list-page',
  imports: [RouterLink, PageHeaderComponent, SearchBoxComponent, IconComponent, EmptyStateComponent, PagerComponent, PillComponent, ErrorBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-page-header [title]="spec().title" [subtitle]="spec().note ?? ''">
      <ng-container actions>
        <erp-search-box [(value)]="search" placeholder="Search…" />
        @for (f of spec().filters ?? []; track f.key) {
          <select class="erp-input !w-auto" [attr.aria-label]="f.label" (change)="setFilter(f.key, $any($event.target).value)">
            <option value="">{{ f.label }}: all</option>
            @for (o of f.options; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
          </select>
        }
        @if (spec().canCreate && canWrite()) { <a class="erp-btn-primary" [routerLink]="['/accounting', spec().path, 'new']"><erp-icon name="plus" [size]="15" />New</a> }
      </ng-container>
    </erp-page-header>
    <erp-error-banner [text]="error()" />
    <div class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="erp-table w-full">
        <thead><tr>@for (c of spec().columns; track c.key) { <th [class.text-end]="c.right">{{ c.label }}</th> }</tr></thead>
        <tbody>
          @for (r of rows(); track r['id']) {
            <tr [class.cursor-pointer]="!!spec().fields.length" [tabindex]="spec().fields.length ? 0 : -1" (click)="open(r)" (keydown.enter)="open(r)">
              @for (c of spec().columns; track c.key; let i = $index) {
                <td [class.text-end]="c.right" [class.font-mono]="c.mono" [class.font-bold]="i === 0" [class.text-slate-900]="i === 0">
                  @if (c.pill) { <erp-pill [tone]="tone(text(c, r))">{{ pretty(text(c, r)) }}</erp-pill> } @else { {{ text(c, r) }} }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
      @if (!loading() && rows().length === 0) { <erp-empty-state title="No records yet" /> }
      <erp-pager [total]="total()" [pageSize]="pageSize" [(page)]="page" />
    </div>`,
})
export class ResourceListPage {
  private readonly ab = inject(AccountingBackend);
  private readonly router = inject(Router);
  private readonly perms = inject(PermissionService);

  /** Bound from route data by `withComponentInputBinding`. */
  readonly resource = input.required<string>();
  protected readonly spec = computed(() => makeSpecs(this.ab)[this.resource()]);
  protected readonly canWrite = computed(() => this.perms.has(this.spec().perm as never));
  protected readonly rows = signal<Row[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = 25;
  private readonly filterValues = signal<Record<string, string>>({});
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // reload on any change of resource, text, filter or page
    effect(() => {
      const spec = this.spec(); const q = this.search(); const page = this.page(); const filters = this.filterValues(); this.ab.companyKey();
      untracked(() => { clearTimeout(this.timer); this.timer = setTimeout(() => void this.load(spec.api, spec.listQuery ?? {}, q, page, filters), q ? 250 : 0); });
    });
    // a new search or filter starts at page 1
    effect(() => { this.search(); this.filterValues(); this.resource(); untracked(() => this.page.set(1)); });
  }

  private async load(api: string, base: Record<string, string>, q: string, page: number, filters: Record<string, string>): Promise<void> {
    this.loading.set(true);
    try {
      const d = await this.ab.list(api, { ...base, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), q: q || undefined, page, limit: this.pageSize });
      this.rows.set(d.records); this.total.set(d.total); this.error.set('');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not load the list.');
    } finally { this.loading.set(false); }
  }

  protected setFilter(key: string, value: string): void { this.filterValues.update(f => ({ ...f, [key]: value })); }
  protected text = cellText;
  protected tone = pillTone;
  protected pretty = pillText;
  protected open(r: Row): void {
    if (this.spec().fields.length) void this.router.navigate(['/accounting', this.spec().path, r['id']]);
  }
}
