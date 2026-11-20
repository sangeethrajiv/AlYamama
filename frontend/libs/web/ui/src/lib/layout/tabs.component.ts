import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
  count?: number | null;
}

@Component({
  selector: 'erp-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="tablist" class="flex flex-wrap gap-1 border-b border-slate-200">
      @for (t of tabs(); track t.id) {
        <button type="button" role="tab" [attr.aria-selected]="t.id === active()"
          class="-mb-px border-b-2 px-3 py-2 text-xs font-semibold transition"
          [class]="t.id === active() ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'"
          (click)="active.set(t.id)">
          {{ t.label }}
          @if (t.count !== undefined && t.count !== null) { <span class="ms-1 rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500">{{ t.count }}</span> }
        </button>
      }
    </div>`,
})
export class TabsComponent {
  readonly tabs = input.required<TabItem[]>();
  readonly active = model.required<string>();
}
