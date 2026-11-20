import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'erp-search-box',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <erp-icon name="search" [size]="14" class="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input [value]="value()" (input)="value.set($any($event.target).value)" [placeholder]="placeholder()" [attr.aria-label]="placeholder()"
        class="w-56 rounded-lg border border-slate-200 bg-white py-2 pe-3 ps-8 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600" />
    </div>`,
})
export class SearchBoxComponent {
  readonly value = model<string>('');
  readonly placeholder = input<string>('Search…');
}
