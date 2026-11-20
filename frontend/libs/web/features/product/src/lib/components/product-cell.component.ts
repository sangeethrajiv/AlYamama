import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PillComponent } from '@erp/web/ui';
import type { Cell } from '../models/product-types';

/** Renders one list cell described by the entity config (text, monospace code, name + Arabic name, badge or dash). */
@Component({
  selector: 'erp-product-cell',
  imports: [PillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (cell().kind) {
      @case ('dash') { <span class="text-slate-400">—</span> }
      @case ('mono') { <span class="font-mono text-[11px]">{{ $any(cell()).text }}</span> }
      @case ('rtl') { <span dir="rtl">{{ $any(cell()).text }}</span> }
      @case ('pill') { <erp-pill [tone]="$any(cell()).tone">{{ $any(cell()).text }}</erp-pill> }
      @case ('name') {
        <span class="block">{{ $any(cell()).text }}</span>
        @if ($any(cell()).sub) { <span dir="rtl" class="block text-end text-[11px] font-normal text-slate-500 sm:text-start">{{ $any(cell()).sub }}</span> }
      }
      @default { <span [class]="$any(cell()).danger ? 'font-bold text-rose-600' : ''">{{ $any(cell()).text }}</span> }
    }`,
})
export class ProductCellComponent {
  readonly cell = input.required<Cell>();
}
