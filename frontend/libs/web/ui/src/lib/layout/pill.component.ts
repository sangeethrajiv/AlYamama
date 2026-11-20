import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const TONES = {
  slate: 'bg-slate-100 text-slate-700 border-slate-300',
  green: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  amber: 'bg-amber-100 text-amber-800 border-amber-300',
  red: 'bg-rose-100 text-rose-800 border-rose-300',
  blue: 'bg-sky-100 text-sky-800 border-sky-300',
} as const;

@Component({
  selector: 'erp-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold" [class]="cls()"><ng-content /></span>`,
})
export class PillComponent {
  readonly tone = input<keyof typeof TONES>('slate');
  protected readonly cls = computed(() => TONES[this.tone()]);
}
