import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '@erp/web/ui';
import { ProductStore } from '../data/product.store';

/** What a Product screen shows until the data is there: the loading text, or the error with a way to try again. */
@Component({
  selector: 'erp-product-load-state',
  imports: [TranslocoPipe, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.failed()) {
      <erp-empty-state [title]="'common.errorGeneric' | transloco" [text]="'product.l.loadFailed' | transloco" icon="inbox">
        <button type="button" class="erp-btn-ghost mt-2" (click)="store.reload()">{{ 'product.l.retry' | transloco }}</button>
      </erp-empty-state>
    } @else { <p class="py-10 text-center text-sm text-slate-400" role="status">{{ 'common.loading' | transloco }}</p> }`,
})
export class ProductLoadStateComponent {
  protected readonly store = inject(ProductStore);
}
