import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@erp/web/ui';

export interface Crumb { label: string; link?: string[] }

/** Product > Master Data > Products > Record. The last crumb is the current page; middle crumbs collapse on phones. */
@Component({
  selector: 'erp-product-breadcrumb',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Breadcrumb" class="mb-3 min-w-0">
      <ol class="flex items-center gap-1 overflow-hidden whitespace-nowrap text-xs text-slate-500">
        @for (c of crumbs(); track $index; let i = $index; let last = $last) {
          <li class="min-w-0 items-center gap-1" [class]="i > 0 && !last ? 'hidden sm:flex' : 'flex'">
            @if (i > 0) { <erp-icon name="chevron-right" [size]="13" [flip]="true" class="text-slate-300" /> }
            @if (c.link && !last) { <a [routerLink]="c.link" class="truncate hover:text-slate-900">{{ c.label }}</a> }
            @else { <span class="truncate" [class]="last ? 'font-bold text-slate-900' : ''" [attr.aria-current]="last ? 'page' : null">{{ c.label }}</span> }
          </li>
        }
      </ol>
    </nav>`,
})
export class ProductBreadcrumbComponent {
  readonly crumbs = input.required<Crumb[]>();
}
