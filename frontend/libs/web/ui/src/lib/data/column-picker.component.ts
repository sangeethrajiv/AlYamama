import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../icon/icon.component';
import { I18n } from '../i18n/i18n.service';

export interface PickerColumn {
  key: string;
  /** Translation key. */
  label: string;
  /** Group heading (translation key). */
  group?: string;
  /** Always shown, not removable. */
  fixed?: boolean;
}

/** What the picker needs from a grid: `DataGridComponent` provides all of it. */
export interface ColumnPickerSource {
  columns(): readonly PickerColumn[];
  shown(): ReadonlySet<string>;
  toggleCol(key: string): void;
}

/**
 * Column chooser for an `erp-data-grid`. The grid shows it above the table with its label;
 * a page can instead place it anywhere (e.g. beside the search box) as an icon button: `<erp-column-picker [source]="grid" />`.
 */
@Component({
  selector: 'erp-column-picker',
  imports: [TranslocoPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative inline-block' },
  template: `
    <button type="button" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="true" class="erp-btn-ghost"
      [attr.aria-label]="label()" [attr.title]="withLabel() ? null : label()">
      <erp-icon name="columns-3" [size]="14" />@if (withLabel()) { {{ label() }} }
    </button>
    @if (open()) {
      <div class="fixed inset-0 z-20" (click)="open.set(false)" aria-hidden="true"></div>
      <div class="absolute end-0 top-full z-30 mt-1 max-h-[60vh] w-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-start shadow-lg">
        @for (g of groups(); track g.key) {
          <div>
            @if (g.key) { <div class="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{{ g.key | transloco }}</div> }
            @for (c of g.cols; track c.key) {
              <label class="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-slate-700">
                <input type="checkbox" class="accent-emerald-600" [checked]="source().shown().has(c.key)" [disabled]="c.fixed" (change)="source().toggleCol(c.key)" />
                <span class="flex-1">{{ c.label | transloco }}</span>
                @if (source().shown().has(c.key)) { <erp-icon name="check" [size]="12" class="text-emerald-600" /> }
              </label>
            }
          </div>
        }
      </div>
    }`,
})
export class ColumnPickerComponent {
  readonly source = input.required<ColumnPickerSource>();
  /** Show the text next to the icon (default: icon only). */
  readonly withLabel = input<boolean>(false);

  protected readonly open = signal(false);
  protected readonly groups = computed(() => {
    const m = new Map<string, PickerColumn[]>();
    for (const c of this.source().columns()) m.set(c.group ?? '', [...(m.get(c.group ?? '') ?? []), c]);
    return [...m.entries()].map(([key, cols]) => ({ key, cols }));
  });
  private readonly i18n = inject(I18n);

  /** "Columns (10/52)": the button text, or its tooltip and accessible name when only the icon shows. */
  protected readonly label = computed(() => {
    const s = this.source();
    const shown = s.columns().filter(c => s.shown().has(c.key)).length;
    return this.i18n.tr('grid.columns', { shown, total: s.columns().length });
  });
}
