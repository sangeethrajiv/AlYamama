import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface ActionItem {
  id: string;
  /** Already translated. */
  label: string;
  kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  title?: string;
  run?: () => void;
}

/** A row of document-level actions; the parent decides which ones apply to the document's stage. */
@Component({
  selector: 'erp-document-action-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length) {
      <div class="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3" role="toolbar">
        @for (i of items(); track i.id) {
          <button type="button" [disabled]="i.disabled || !i.run" [title]="i.title ?? ''" (click)="i.run?.()" class="h-8 rounded-lg px-3.5 text-xs font-bold transition disabled:opacity-50"
            [class]="i.kind === 'primary' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : i.kind === 'danger' ? 'ms-auto border border-rose-200 text-rose-700 hover:bg-rose-50' : 'border border-slate-300 text-slate-800 hover:bg-slate-50'">{{ i.label }}</button>
        }
      </div>
    }`,
})
export class DocumentActionBarComponent {
  readonly items = input.required<ActionItem[]>();
}
