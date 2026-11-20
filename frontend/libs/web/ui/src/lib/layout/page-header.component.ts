import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title block with an actions slot: `<erp-page-header title="..."><button actions>...</button></erp-page-header>`. */
@Component({
  selector: 'erp-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0">
        @if (eyebrow()) { <div class="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{{ eyebrow() }}</div> }
        <h1 class="font-display text-xl font-extrabold tracking-tight text-slate-900">{{ title() }}</h1>
        @if (subtitle()) { <p class="mt-1 text-xs text-slate-500">{{ subtitle() }}</p> }
      </div>
      <div class="flex flex-wrap items-center gap-2"><ng-content select="[actions]" /></div>
    </div>`,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
}
