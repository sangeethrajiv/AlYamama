import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'erp-error-banner',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (text()) {
      <div role="alert" class="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
        <erp-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0" /><span>{{ text() }}</span>
      </div>
    }`,
})
export class ErrorBannerComponent {
  readonly text = input<string>('');
}
