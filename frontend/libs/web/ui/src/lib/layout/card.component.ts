import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'erp-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
      @if (title()) {
        <div class="flex items-center justify-between border-b border-slate-100" [class]="dense() ? 'px-3 py-2' : 'px-4 py-2.5'">
          <h3 class="text-xs font-extrabold uppercase tracking-wide text-slate-800">{{ title() }}</h3>
          <div class="flex items-center gap-2"><ng-content select="[actions]" /></div>
        </div>
      }
      <div [class]="dense() ? 'p-3' : 'p-4'"><ng-content /></div>
    </section>`,
})
export class CardComponent {
  readonly title = input<string>('');
  readonly dense = input<boolean>(false);
}
