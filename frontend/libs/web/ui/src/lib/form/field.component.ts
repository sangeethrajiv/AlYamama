import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Label + control + hint/error. The control itself is projected so it can be any native/Material input. */
@Component({
  selector: 'erp-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.col-span-full]': 'full()' },
  template: `
    <label class="block">
      <span class="mb-1 flex items-center gap-1 text-[11px] font-bold text-slate-600">{{ label() }}@if (required()) { <span class="text-rose-500">*</span> }</span>
      <ng-content />
    </label>
    @if (error()) { <span role="alert" class="mt-1 block text-[11px] text-rose-600">{{ error() }}</span> }
    @else if (hint()) { <span class="mt-1 block text-[10px] text-slate-400">{{ hint() }}</span> }`,
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly required = input<boolean>(false);
  readonly hint = input<string>('');
  readonly error = input<string>('');
  readonly full = input<boolean>(false);
}
