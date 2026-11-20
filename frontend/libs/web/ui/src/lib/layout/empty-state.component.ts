import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'erp-empty-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid justify-items-center gap-1.5 px-6 py-10 text-center text-xs text-slate-400">
      <erp-icon [name]="icon()" [size]="26" class="text-slate-300" />
      <b class="text-sm text-slate-600">{{ title() }}</b>
      @if (text()) { <span>{{ text() }}</span> }
      <ng-content />
    </div>`,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly text = input<string>('');
  readonly icon = input<string>('inbox');
}
