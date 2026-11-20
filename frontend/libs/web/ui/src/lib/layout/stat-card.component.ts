import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'erp-stat-card',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between text-[11px] font-semibold text-slate-500">
        <span>{{ title() }}</span>
        @if (icon()) { <erp-icon [name]="icon()!" [size]="15" class="text-slate-400" /> }
      </div>
      <div class="mt-2 font-display text-xl font-extrabold tracking-tight text-slate-800" [class]="valueClass()">
        {{ value() }} @if (unit()) { <small class="text-[10px] font-semibold text-slate-400">{{ unit() }}</small> }
      </div>
      @if (note()) { <div class="mt-1 text-[10px] text-slate-400">{{ note() }}</div> }
    </article>`,
})
export class StatCardComponent {
  readonly title = input.required<string>();
  readonly value = input.required<string>();
  readonly unit = input<string>('');
  readonly note = input<string>('');
  readonly icon = input<string | null>(null);
  readonly valueClass = input<string>('');
}
