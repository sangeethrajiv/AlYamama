import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Document pipeline: `Draft › Waiting › Ready › Done`, the current step highlighted. */
@Component({
  selector: 'erp-status-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white text-[11px] font-bold" aria-label="Status">
      @for (s of steps(); track s.id; let i = $index) {
        <li class="border-e border-slate-200 px-3 py-1.5 last:border-e-0" [attr.aria-current]="s.id === value() ? 'step' : null"
          [class]="s.id === value() ? 'bg-emerald-600 text-white' : i < index() ? 'bg-slate-50 text-slate-600' : 'text-slate-400'">{{ s.label }}</li>
      }
    </ol>`,
})
export class StatusBarComponent {
  readonly steps = input.required<{ id: string; label: string }[]>();
  readonly value = input.required<string>();
  protected readonly index = computed(() => this.steps().findIndex(s => s.id === this.value()));
}
