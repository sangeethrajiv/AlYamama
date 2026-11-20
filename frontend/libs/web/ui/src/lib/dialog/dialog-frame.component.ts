import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../icon/icon.component';

/**
 * Standard frame for anything opened through DialogService: title bar, scrolling body, footer slot.
 * `<erp-dialog-frame title="..."> body <div footer> buttons </div> </erp-dialog-frame>`
 */
@Component({
  selector: 'erp-dialog-frame',
  imports: [IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full min-h-0 flex-col' },
  template: `
    <header class="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
      <div class="min-w-0">
        <h2 class="truncate font-display text-base font-extrabold text-slate-900">{{ title() }}</h2>
        @if (subtitle()) { <p class="truncate text-[11px] text-slate-500">{{ subtitle() }}</p> }
      </div>
      <div class="flex items-center gap-1"><ng-content select="[headerActions]" />
        <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" [attr.aria-label]="'common.close' | transloco" (click)="close()">
          <erp-icon name="x" [size]="18" />
        </button>
      </div>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5"><ng-content /></div>
    <footer class="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3 empty:hidden"><ng-content select="[footer]" /></footer>`,
})
export class DialogFrameComponent {
  private readonly ref = inject(DialogRef, { optional: true });
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly closed = output<void>();
  close(): void {
    this.closed.emit();
    this.ref?.close();
  }
}
