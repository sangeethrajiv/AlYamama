import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'erp-kpi',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div class="text-[10px] font-bold uppercase tracking-wide text-slate-500">{{ label() }}</div>
      <div class="mt-0.5 text-xl font-extrabold" [class]="tone() === 'red' ? 'text-rose-600' : tone() === 'amber' ? 'text-amber-600' : 'text-slate-900'">{{ value() }}</div>
      @if (hint()) { <div class="mt-0.5 text-[11px] text-slate-500">{{ hint() }}</div> }
    </div>`,
})
export class KpiComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input<string>('');
  readonly tone = input<'red' | 'amber' | null>(null);
}
