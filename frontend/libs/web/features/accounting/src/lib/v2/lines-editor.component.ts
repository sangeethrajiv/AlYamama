import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent, MultiSelectComponent, SelectComponent, type SelectOption, type SelectSearch } from '@erp/web/ui';

export type Row = Record<string, unknown>;
export interface LineColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'm2o' | 'm2m' | 'select' | 'readonly';
  /** Tailwind width class, e.g. `w-44`. */
  width?: string;
  /** m2o / m2m: async option source. */
  search?: SelectSearch;
  /** select (and m2o with a short fixed list). */
  options?: SelectOption[];
  right?: boolean;
  mono?: boolean;
  placeholder?: string;
  /** Called after the user picks a many2one option, to fill sibling cells (a product fills price and unit). */
  onPick?: (row: Row, option: SelectOption | null) => Row;
}

/**
 * Editable grid for the one2many parts of a document: invoice lines, journal items, payment-term lines.
 * Rows are plain objects. A many2one cell stores the id under `key` and its name under `key_label`
 * (the dropdown shows that name until it has loaded the option).
 */
@Component({
  selector: 'erp-lines-editor',
  imports: [FormsModule, IconComponent, SelectComponent, MultiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto rounded-lg border border-slate-200">
      <table class="erp-table w-full">
        <thead>
          <tr>
            @for (c of columns(); track c.key) { <th [class]="(c.width ?? '') + (c.right ? ' text-end' : '')">{{ c.label }}</th> }
            @if (!readonly()) { <th class="w-8"></th> }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track $index; let i = $index) {
            <tr>
              @for (c of columns(); track c.key) {
                <td class="!px-1.5 !py-1 align-top" [class.text-end]="c.right">
                  @switch (c.type) {
                    @case ('m2o') {
                      <erp-select [ngModel]="row[c.key] ?? null" [options]="c.options ?? []" [search]="c.search" [labelHint]="hint(row, c)" [placeholder]="c.placeholder ?? ''"
                        [disabled]="readonly()" (ngModelChange)="set(i, c.key, $event)" (picked)="picked(i, c, $event)" />
                    }
                    @case ('m2m') {
                      <erp-multi-select [ngModel]="$any(row[c.key]) ?? []" [options]="c.options ?? []" [search]="c.search" [placeholder]="c.placeholder ?? ''"
                        [disabled]="readonly()" (ngModelChange)="set(i, c.key, $event)" />
                    }
                    @case ('select') {
                      <select class="erp-input erp-input-sm" [disabled]="readonly()" [ngModel]="row[c.key] ?? ''" (ngModelChange)="set(i, c.key, $event)">
                        @for (o of c.options ?? []; track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
                      </select>
                    }
                    @case ('number') {
                      <input type="text" inputmode="decimal" class="erp-input erp-input-sm text-end font-mono" [disabled]="readonly()" [ngModel]="row[c.key] ?? ''" (ngModelChange)="set(i, c.key, $event)" />
                    }
                    @case ('date') { <input type="date" class="erp-input erp-input-sm" [disabled]="readonly()" [ngModel]="row[c.key] ?? ''" (ngModelChange)="set(i, c.key, $event)" /> }
                    @case ('readonly') { <span class="block px-2 py-1.5 text-xs" [class.font-mono]="c.mono ?? c.right">{{ row[c.key] ?? '' }}</span> }
                    @default {
                      <input type="text" class="erp-input erp-input-sm" [class.font-mono]="c.mono" [placeholder]="c.placeholder ?? ''" [disabled]="readonly()" [ngModel]="row[c.key] ?? ''" (ngModelChange)="set(i, c.key, $event)" />
                    }
                  }
                </td>
              }
              @if (!readonly()) {
                <td class="!px-1 !py-1 align-top"><button type="button" class="p-1 text-rose-500 hover:text-rose-700" aria-label="Remove line" (click)="remove(i)"><erp-icon name="trash" [size]="14" /></button></td>
              }
            </tr>
          } @empty {
            <tr><td [attr.colspan]="columns().length + 1" class="py-4 text-center text-xs text-slate-400">No lines yet</td></tr>
          }
        </tbody>
      </table>
      @if (!readonly()) {
        <div class="border-t border-slate-100 p-1.5"><button type="button" class="erp-btn-ghost erp-btn-sm" (click)="add()"><erp-icon name="plus" [size]="13" />Add a line</button></div>
      }
    </div>`,
})
export class LinesEditorComponent {
  readonly columns = input.required<LineColumn[]>();
  readonly rows = input.required<Row[]>();
  readonly readonly = input<boolean>(false);
  readonly newRow = input<() => Row>(() => ({}));
  readonly rowsChange = output<Row[]>();

  protected hint(row: Row, c: LineColumn): string { return String(row[`${c.key}_label`] ?? ''); }

  protected set(i: number, key: string, value: unknown): void {
    this.rowsChange.emit(this.rows().map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  protected picked(i: number, c: LineColumn, o: SelectOption | null): void {
    this.rowsChange.emit(this.rows().map((r, idx) => {
      if (idx !== i) return r;
      // the value change and the pick arrive back to back, before the parent has passed the new rows down: set the value here too
      const next = { ...r, [c.key]: o?.value ?? null, [`${c.key}_label`]: o?.label ?? '' };
      return c.onPick ? { ...next, ...c.onPick(next, o) } : next;
    }));
  }
  protected add(): void { this.rowsChange.emit([...this.rows(), this.newRow()()]); }
  protected remove(i: number): void { this.rowsChange.emit(this.rows().filter((_, idx) => idx !== i)); }
}
