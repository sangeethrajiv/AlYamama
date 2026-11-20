import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../icon/icon.component';

/** Client-side pager. `page` is 1-based. Lists use bounded page sizes like the API (appendix A.6). */
@Component({
  selector: 'erp-pager',
  imports: [IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        <span>{{ 'common.showing' | transloco: { from: from(), to: to(), total: total() } }}</span>
        <div class="flex items-center gap-1">
          <button type="button" class="erp-btn-ghost erp-btn-sm" [disabled]="page() <= 1" (click)="page.set(page() - 1)" [attr.aria-label]="'common.back' | transloco"><erp-icon name="chevron-left" [size]="13" [flip]="true" /></button>
          <span class="px-2 font-mono">{{ page() }} / {{ pages() }}</span>
          <button type="button" class="erp-btn-ghost erp-btn-sm" [disabled]="page() >= pages()" (click)="page.set(page() + 1)"><erp-icon name="chevron-right" [size]="13" [flip]="true" /></button>
        </div>
      </div>
    }`,
})
export class PagerComponent {
  readonly total = input.required<number>();
  readonly pageSize = input<number>(25);
  readonly page = model<number>(1);
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  protected readonly to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
}
