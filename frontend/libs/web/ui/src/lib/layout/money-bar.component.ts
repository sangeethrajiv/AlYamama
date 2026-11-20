import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MoneyPipe } from '../pipes/format.pipes';

export interface MoneySegment {
  id: string;
  /** Already translated. */
  label: string;
  count: number;
  amount: string;
  color: 'blue' | 'orange' | 'red' | 'green' | 'purple';
}

const BAR: Record<MoneySegment['color'], string> = { blue: 'bg-slate-500', orange: 'bg-amber-500', red: 'bg-rose-500', green: 'bg-emerald-500', purple: 'bg-slate-500' };
const ON: Record<MoneySegment['color'], string> = {
  blue: 'border-slate-600 bg-slate-50/80 text-slate-900 ring-2 ring-slate-500/20', orange: 'border-amber-600 bg-amber-50/80 text-amber-900 ring-2 ring-amber-500/20',
  red: 'border-rose-600 bg-rose-50/80 text-rose-900 ring-2 ring-rose-500/20', green: 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20', purple: 'border-slate-600 bg-slate-50/80 text-slate-900 ring-2 ring-slate-500/20',
};
const OFF: Record<MoneySegment['color'], string> = {
  blue: 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800', orange: 'border-slate-200 hover:border-amber-300 hover:bg-slate-50 text-slate-800',
  red: 'border-slate-200 hover:border-rose-300 hover:bg-slate-50 text-slate-800', green: 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50 text-slate-800', purple: 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800',
};

/** Clickable summary tiles that double as a filter ("Overview summary — click a category to filter"). */
@Component({
  selector: 'erp-money-bar',
  imports: [TranslocoPipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ 'moneyBar.title' | transloco }}</span>
        @if (selected() !== 'all') { <button type="button" class="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline" (click)="selected.set('all')">{{ 'moneyBar.clear' | transloco }}</button> }
      </div>
      <div class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        @for (s of segments(); track s.id) {
          <button type="button" (click)="selected.set(selected() === s.id ? 'all' : s.id)" class="relative cursor-pointer overflow-hidden rounded-xl border bg-white p-3 text-start shadow-sm transition-all" [class]="selected() === s.id ? ON[s.color] : OFF[s.color]">
            <div class="absolute inset-x-0 top-0 h-1.5" [class]="BAR[s.color]"></div>
            <div class="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500"><span>{{ s.label }}</span><span class="rounded-full bg-slate-100 px-1.5 font-mono text-[10px] text-slate-400">{{ s.count }}</span></div>
            <div class="font-mono text-base font-bold text-slate-900 sm:text-lg">{{ s.amount | erpMoney }} {{ currency() === 'SAR' ? 'SR' : currency() }}</div>
          </button>
        }
      </div>
    </div>`,
})
export class MoneyBarComponent {
  readonly segments = input.required<MoneySegment[]>();
  readonly selected = model<string>('all');
  readonly currency = input<string>('SAR');
  protected readonly BAR = BAR;
  protected readonly ON = ON;
  protected readonly OFF = OFF;
}
