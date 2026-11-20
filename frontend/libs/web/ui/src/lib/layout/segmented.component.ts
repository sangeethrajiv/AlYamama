import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

@Component({
  selector: 'erp-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="tablist" class="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-slate-100 p-1 text-xs font-bold">
      @for (o of options(); track o.id) {
        <button type="button" role="tab" [attr.aria-selected]="value() === o.id" (click)="value.set(o.id)"
          class="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 transition"
          [class]="value() === o.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'">
          <span>{{ o.label }}</span>
          @if (o.count !== undefined) { <span class="rounded-full bg-slate-200 px-1.5 font-mono text-[10px] text-slate-700">{{ o.count }}</span> }
        </button>
      }
    </div>`,
})
export class SegmentedComponent {
  readonly options = input.required<SegmentOption[]>();
  readonly value = model.required<string>();
}
