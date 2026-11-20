import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogService, EmptyStateComponent, IconComponent, PageHeaderComponent, PagerComponent, PillComponent, SearchBoxComponent, I18n } from '@erp/web/ui';
import { CrudDialogComponent, type CrudDialogData } from './crud-dialog.component';
import type { ListColumn, Lookups, Rec, ViewDef } from './view.model';

/**
 * Metadata-driven list + form dialog for simple master data and settings (section 12.4). The page supplies the
 * columns, the view and a save callback; searching, sorting, paging and the form dialog come from here.
 */
@Component({
  selector: 'erp-crud-page',
  imports: [TranslocoPipe, PageHeaderComponent, SearchBoxComponent, IconComponent, EmptyStateComponent, PillComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-page-header [title]="title() | transloco" [subtitle]="subtitle() ? (subtitle() | transloco) : ''">
      <ng-container actions>
        <erp-search-box [(value)]="local" [placeholder]="'common.search' | transloco" />
        @if (!readOnly()) { <button type="button" class="erp-btn-primary" (click)="create()"><erp-icon name="plus" [size]="15" />{{ 'common.create' | transloco }}</button> }
      </ng-container>
    </erp-page-header>

    <div class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="erp-table">
        <thead>
          <tr>
            @for (c of columns(); track c.key) {
              <th [class.text-end]="c.right" [attr.aria-sort]="sortKey() === c.key ? (sortDir() === 1 ? 'ascending' : 'descending') : 'none'">
                @if (c.sortable !== false) {
                  <button type="button" class="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800" (click)="sortBy(c.key)">
                    {{ c.label | transloco }}@if (sortKey() === c.key) { <erp-icon [name]="sortDir() === 1 ? 'arrow-up' : 'arrow-down'" [size]="11" /> }
                  </button>
                } @else { {{ c.label | transloco }} }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (r of pageRows(); track r.id) {
            <tr class="cursor-pointer" tabindex="0" (click)="edit(r)" (keydown.enter)="edit(r)">
              @for (c of columns(); track c.key; let i = $index) {
                <td [class.text-end]="c.right" [class.font-bold]="i === 0 || c.kind === 'strong'" [class.text-slate-900]="i === 0 || c.kind === 'strong'" [class.font-mono]="c.kind === 'mono'">
                  @if (c.kind === 'pill-active') { <erp-pill [tone]="c.text(r) === 'true' ? 'green' : 'slate'">{{ (c.text(r) === 'true' ? 'common.active' : 'common.archived') | transloco }}</erp-pill> }
                  @else { {{ c.text(r) }} }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
      @if (shown().length === 0) { <erp-empty-state [title]="'common.noResults' | transloco" /> }
      <erp-pager [total]="shown().length" [pageSize]="pageSize" [(page)]="page" />
    </div>`,
})
export class CrudPageComponent<T extends { id: number }> {
  private readonly dialogs = inject(DialogService);
  private readonly i18n = inject(I18n);

  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  /** Translation key for one record, used in the dialog title: "New {{entity}}". */
  readonly entity = input.required<string>();
  readonly columns = input.required<ListColumn<T>[]>();
  readonly rows = input.required<T[]>();
  readonly view = input.required<ViewDef>();
  readonly lookups = input<Lookups>({});
  readonly blank = input.required<() => T>();
  readonly validate = input<((r: T) => string) | undefined>(undefined);
  readonly searchText = input.required<(r: T) => string>();
  /** Global header search text, combined with the local box. */
  readonly globalSearch = input<string>('');
  readonly readOnly = input<boolean>(false);
  readonly save = input.required<(r: T) => Promise<void> | void>();
  readonly opened = output<T>();

  protected readonly local = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = 25;
  protected readonly sortKey = signal('');
  protected readonly sortDir = signal<1 | -1>(1);

  protected readonly shown = computed(() => {
    const q = (this.local() || this.globalSearch()).trim().toLowerCase();
    const text = this.searchText();
    let list = this.rows().filter(r => !q || text(r).toLowerCase().includes(q));
    const col = this.columns().find(c => c.key === this.sortKey());
    if (col) list = [...list].sort((a, b) => col.text(a).localeCompare(col.text(b), undefined, { numeric: true }) * this.sortDir());
    return list;
  });
  protected readonly pageRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.shown().slice(start, start + this.pageSize);
  });

  protected sortBy(key: string): void {
    if (this.sortKey() === key) this.sortDir.update(d => (d === 1 ? -1 : 1));
    else { this.sortKey.set(key); this.sortDir.set(1); }
  }
  protected create(): void {
    this.open(this.blank()(), true);
  }
  protected edit(r: T): void {
    this.opened.emit(r);
    this.open({ ...r }, false);
  }
  private open(record: T, isNew: boolean): void {
    const name = this.i18n.tr(this.entity());
    const data: CrudDialogData<T> = {
      title: isNew ? this.i18n.tr('common.newEntity', { entity: name }) : name,
      record,
      view: this.view(),
      lookups: this.lookups(),
      readOnly: this.readOnly(),
      validate: this.validate(),
      save: this.save(),
    };
    this.dialogs.open<CrudDialogComponent<T>, CrudDialogData<T>, boolean>(CrudDialogComponent, { data, kind: 'modal-wide' });
  }
}
