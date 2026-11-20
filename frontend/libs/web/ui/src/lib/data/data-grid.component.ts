import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, computed, contentChild, input, model, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AvatarComponent } from '../layout/avatar.component';
import { EmptyStateComponent } from '../layout/empty-state.component';
import { IconComponent } from '../icon/icon.component';
import { PagerComponent } from '../layout/pager.component';
import { PillComponent } from '../layout/pill.component';

export type GridValue = string | number | boolean | null | undefined;

export interface GridColumn<T> {
  key: string;
  /** Translation key. */
  label: string;
  /** Column picker group (translation key). */
  group?: string;
  text: (row: T) => GridValue;
  right?: boolean;
  /** Visible by default. */
  on?: boolean;
  /** Always shown, not removable in the picker. */
  fixed?: boolean;
  /** Visual style: `name` shows an avatar, `yes` a green pill for true, `active` an Active/Archived pill, `mono` monospaced. */
  kind?: 'text' | 'name' | 'yes' | 'active' | 'mono' | 'pill';
  avatar?: (row: T) => { name: string; src?: string; round?: boolean };
  /** For `pill` columns. */
  tone?: (row: T) => 'slate' | 'green' | 'amber' | 'red' | 'blue';
  /** Sort values when the displayed text is not sortable as-is. */
  sortValue?: (row: T) => string | number;
}

/**
 * Sortable, pageable table with a column picker and an optional row-actions column.
 * Sorting, paging and column choice live here; filtering is the host page's job.
 */
@Component({
  selector: 'erp-data-grid',
  imports: [NgTemplateOutlet, TranslocoPipe, IconComponent, PillComponent, AvatarComponent, EmptyStateComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (picker()) {
      <div class="relative mb-2 flex justify-end">
        <button type="button" (click)="pickerOpen.set(!pickerOpen())" [attr.aria-expanded]="pickerOpen()" class="erp-btn-ghost">
          <erp-icon name="columns-3" [size]="14" />{{ 'grid.columns' | transloco: { shown: visible().length, total: columns().length } }}
        </button>
        @if (pickerOpen()) {
          <div class="fixed inset-0 z-20" (click)="pickerOpen.set(false)" aria-hidden="true"></div>
          <div class="absolute end-0 top-full z-30 mt-1 max-h-[60vh] w-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            @for (g of groups(); track g.key) {
              <div>
                @if (g.key) { <div class="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{{ g.key | transloco }}</div> }
                @for (c of g.cols; track c.key) {
                  <label class="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-slate-700">
                    <input type="checkbox" class="accent-emerald-600" [checked]="shown().has(c.key)" [disabled]="c.fixed" (change)="toggleCol(c.key)" />
                    <span class="flex-1">{{ c.label | transloco }}</span>
                    @if (shown().has(c.key)) { <erp-icon name="check" [size]="12" class="text-emerald-600" /> }
                  </label>
                }
              </div>
            }
          </div>
        }
      </div>
    }
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="erp-table" [attr.aria-busy]="loading()">
        <thead>
          <tr>
            @for (c of visible(); track c.key) {
              <th scope="col" class="whitespace-nowrap" [class.text-end]="c.right" [attr.aria-sort]="sortKey() === c.key ? (sortDir() === 1 ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="inline-flex items-center gap-1 font-bold uppercase tracking-wide hover:text-slate-900" [class.text-emerald-700]="sortKey() === c.key" (click)="sortBy(c.key)">
                  {{ c.label | transloco }}@if (sortKey() === c.key) { <erp-icon [name]="sortDir() === 1 ? 'arrow-up' : 'arrow-down'" [size]="11" /> }
                </button>
              </th>
            }
            @if (actions()) { <th scope="col" class="sticky end-0 bg-slate-50 text-end">{{ 'common.actions' | transloco }}</th> }
          </tr>
        </thead>
        <tbody>
          @if (loading()) {
            @for (i of skeleton; track i) {
              <tr aria-hidden="true">@for (c of visible(); track c.key; let j = $index) { <td class="!py-3"><div class="h-3 animate-pulse rounded bg-slate-100" [class]="j === 0 ? 'w-36' : 'w-16'"></div></td> }</tr>
            }
          } @else {
            @for (r of pageRows(); track trackBy()(r)) {
              <tr class="group" [class.cursor-pointer]="clickable()" [class.text-slate-400]="muted()(r)" [attr.tabindex]="clickable() ? 0 : null" (click)="clickable() && rowClick.emit(r)" (keydown.enter)="clickable() && rowClick.emit(r)">
                @for (c of visible(); track c.key) {
                  <td class="whitespace-nowrap" [class.text-end]="c.right" [class.tabular-nums]="c.right">
                    @switch (c.kind) {
                      @case ('name') {
                        @if (c.avatar?.(r); as a) {
                          <div class="flex min-w-[180px] items-center gap-2.5"><erp-avatar [name]="a.name" [src]="a.src" [size]="28" [round]="!!a.round" /><span class="font-bold text-slate-900">{{ c.text(r) }}</span></div>
                        }
                      }
                      @case ('yes') { @if (c.text(r)) { <erp-pill tone="green">{{ 'common.yes' | transloco }}</erp-pill> } @else { <span class="text-slate-300">—</span> } }
                      @case ('active') { <erp-pill [tone]="c.text(r) ? 'green' : 'slate'">{{ (c.text(r) ? 'common.active' : 'common.archived') | transloco }}</erp-pill> }
                      @case ('pill') { <erp-pill [tone]="c.tone?.(r) ?? 'slate'">{{ c.text(r) }}</erp-pill> }
                      @default {
                        @if (c.text(r) === '' || c.text(r) === null || c.text(r) === undefined) { <span class="text-slate-300">—</span> }
                        @else { <span [class.font-mono]="c.kind === 'mono'">{{ c.text(r) }}</span> }
                      }
                    }
                  </td>
                }
                @if (actions(); as tpl) { <td class="sticky end-0 whitespace-nowrap bg-white text-end group-hover:bg-slate-50" (click)="$event.stopPropagation()"><ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: r }" /></td> }
              </tr>
            }
          }
        </tbody>
      </table>
      @if (!loading() && rows().length === 0) { <erp-empty-state [title]="emptyTitle() || ('common.noResults' | transloco)" [text]="emptyText()" /> }
      @if (!loading()) { <erp-pager [total]="rows().length" [pageSize]="pageSize()" [(page)]="page" /> }
    </div>`,
})
export class DataGridComponent<T> {
  readonly columns = input.required<GridColumn<T>[]>();
  readonly rows = input.required<T[]>();
  readonly trackBy = input<(row: T) => unknown>(r => r);
  readonly loading = input<boolean>(false);
  readonly picker = input<boolean>(false);
  readonly clickable = input<boolean>(true);
  readonly pageSize = input<number>(25);
  readonly emptyTitle = input<string>('');
  readonly emptyText = input<string>('');
  /** Greys out a row (e.g. archived records). */
  readonly muted = input<(row: T) => boolean>(() => false);
  readonly sortKey = model<string>('');
  readonly sortDir = model<1 | -1>(1);
  readonly page = model<number>(1);
  readonly rowClick = output<T>();
  protected readonly actions = contentChild<TemplateRef<{ $implicit: T }>>('actions');
  protected readonly pickerOpen = signal(false);
  protected readonly skeleton = [0, 1, 2, 3, 4, 5, 6, 7];
  protected readonly custom = signal<ReadonlySet<string> | null>(null);

  protected readonly shown = computed<ReadonlySet<string>>(
    () => this.custom() ?? new Set(this.columns().filter(c => c.on !== false || c.fixed).map(c => c.key)),
  );
  protected readonly visible = computed(() => this.columns().filter(c => this.shown().has(c.key)));
  protected readonly groups = computed(() => {
    const m = new Map<string, GridColumn<T>[]>();
    for (const c of this.columns()) m.set(c.group ?? '', [...(m.get(c.group ?? '') ?? []), c]);
    return [...m.entries()].map(([key, cols]) => ({ key, cols }));
  });

  protected readonly sorted = computed(() => {
    const col = this.columns().find(c => c.key === this.sortKey());
    if (!col) return this.rows();
    const val = (r: T): string | number => col.sortValue?.(r) ?? String(col.text(r) ?? '');
    return [...this.rows()].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      // Empty values always sink to the bottom
      if ((x === '') !== (y === '')) return x === '' ? 1 : -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' })) * this.sortDir();
    });
  });
  protected readonly pageRows = computed(() => {
    const size = this.pageSize();
    const pages = Math.max(1, Math.ceil(this.sorted().length / size));
    const p = Math.min(this.page(), pages);
    return this.sorted().slice((p - 1) * size, p * size);
  });

  protected sortBy(key: string): void {
    if (this.sortKey() === key) this.sortDir.update(d => (d === 1 ? -1 : 1));
    else { this.sortKey.set(key); this.sortDir.set(1); }
    this.page.set(1);
  }
  protected toggleCol(key: string): void {
    const next = new Set(this.shown());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.custom.set(next);
  }
}
