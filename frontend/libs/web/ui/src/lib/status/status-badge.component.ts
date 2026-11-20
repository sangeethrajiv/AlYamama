import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

const TONES: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  blue: 'bg-sky-50 text-sky-700 border-sky-200',
  purple: 'bg-violet-50 text-violet-700 border-violet-200',
};

/** Document/record states in one palette: draft, open, in_payment, paid, cancel, posted, ... */
const STATE_TONE: Record<string, string> = {
  draft: 'slate', open: 'blue', in_payment: 'amber', paid: 'green', cancel: 'rose', cancelled: 'rose', posted: 'green',
  reconciled: 'purple', approved: 'green', rejected: 'rose', pending_manager: 'amber', pending_director: 'amber', not_required: 'slate',
  issued: 'blue', presented: 'amber', cleared: 'green', bounced: 'rose', done: 'green', confirm: 'amber', assigned: 'blue',
  waiting: 'amber', confirmed: 'blue', active: 'green', archived: 'slate',
};

@Component({
  selector: 'erp-status-badge',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" [class]="tone()">{{ labelKey() | transloco }}</span>`,
})
export class StatusBadgeComponent {
  /** Raw state value, e.g. `in_payment`. */
  readonly state = input.required<string>();
  /** Overrides the colour, e.g. `green`. */
  readonly colour = input<keyof typeof TONES | null>(null);
  /** Translation key prefix; the label is `<prefix>.<state>`. */
  readonly prefix = input<string>('status');
  protected readonly labelKey = computed(() => `${this.prefix()}.${this.state()}`);
  protected readonly tone = computed(() => TONES[this.colour() ?? STATE_TONE[this.state()] ?? 'slate']);
}
