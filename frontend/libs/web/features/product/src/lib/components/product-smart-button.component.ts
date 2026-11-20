import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@erp/web/ui';

/** Odoo "stat button": an icon, a count and a label, e.g. `12 Products`. Sits at the top-right of a form. */
@Component({
  selector: 'erp-product-smart-button',
  imports: [TranslocoPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" [disabled]="disabled()" (click)="pressed.emit()"
      class="inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-start shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:bg-white">
      <erp-icon [name]="icon()" [size]="18" class="text-emerald-700" />
      <span class="leading-tight">
        <span class="block font-display text-base font-extrabold tabular-nums text-slate-900">{{ count() }}</span>
        <span class="block text-[11px] font-semibold text-slate-600">{{ label() | transloco }}</span>
      </span>
    </button>`,
})
export class ProductSmartButtonComponent {
  readonly icon = input.required<string>();
  readonly count = input.required<number>();
  /** Translation key. */
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly pressed = output<void>();
}
