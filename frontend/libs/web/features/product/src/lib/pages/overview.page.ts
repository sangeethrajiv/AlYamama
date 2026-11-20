import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService } from '@erp/web/core';
import { CardComponent, I18n, IconComponent, PageHeaderComponent, PillComponent } from '@erp/web/ui';
import { PERM, type Product, type ProductEntityKey } from '@erp/shared/contracts';
import { ProductStore } from '../data/product.store';
import { ProductBreadcrumbComponent, type Crumb } from '../components/product-breadcrumb.component';
import { ENTITY_BY_KEY } from '../models/product-entities';
import { categoryName, fmtNum, stockValue } from '../models/product-helpers';
import { PRODUCT_TYPE_OPTIONS, TRACKING_OPTIONS } from '../models/product-options';
import { lte } from '@erp/shared/utils';

interface Bar { label: string; value: number; link?: (string | number)[] }
interface Kpi { key: ProductEntityKey; icon: string; value: number; label: string; hint: string; link: string[] }
interface Issue { label: string; items: Product[] }

/**
 * Product Overview: key counts, breakdowns by type / tracking / category, data-quality checks and a stock snapshot.
 * Everything shown is derived from the (mock) master data in the store.
 */
@Component({
  selector: 'erp-product-overview-page',
  imports: [NgTemplateOutlet, RouterLink, TranslocoPipe, IconComponent, CardComponent, PageHeaderComponent, PillComponent, ProductBreadcrumbComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-1">
      <erp-product-breadcrumb [crumbs]="crumbs()" />
      <erp-page-header [title]="'product.ov.title' | transloco" [subtitle]="'product.ov.subtitle' | transloco">
        <ng-container actions>
          @if (canWrite()) { <a class="erp-btn-primary" [routerLink]="['/product', 'products', 'new']"><erp-icon name="plus" [size]="14" />{{ 'product.ov.newProduct' | transloco }}</a> }
        </ng-container>
      </erp-page-header>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        @for (k of kpis(); track k.key) {
          <a [routerLink]="k.link" class="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow">
            <div class="flex items-center justify-between text-slate-400 group-hover:text-emerald-600"><erp-icon [name]="k.icon" [size]="18" /><erp-icon name="chevron-right" [size]="14" [flip]="true" class="opacity-0 transition group-hover:opacity-100" /></div>
            <p class="mt-3 font-display text-2xl font-extrabold tabular-nums text-slate-900">{{ k.value }}</p>
            <p class="text-sm font-semibold text-slate-700">{{ k.label }}</p>
            <p class="mt-0.5 text-[11px] text-slate-400">{{ k.hint }}</p>
          </a>
        }
      </div>

      <div class="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <erp-card [title]="'product.ov.byType' | transloco"><p class="mb-3 text-[11px] text-slate-500">{{ 'product.ov.activeProducts' | transloco: { n: live().length } }}</p><ng-container [ngTemplateOutlet]="bars" [ngTemplateOutletContext]="{ rows: byType() }" /></erp-card>
        <erp-card [title]="'product.ov.byTracking' | transloco"><p class="mb-3 text-[11px] text-slate-500">{{ 'product.ov.trackingHint' | transloco }}</p><ng-container [ngTemplateOutlet]="bars" [ngTemplateOutletContext]="{ rows: byTracking() }" /></erp-card>
        <erp-card [title]="'product.ov.topCats' | transloco"><p class="mb-3 text-[11px] text-slate-500">{{ 'product.ov.topCatsHint' | transloco }}</p><ng-container [ngTemplateOutlet]="bars" [ngTemplateOutletContext]="{ rows: topCats() }" /></erp-card>

        <section class="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <header class="border-b border-slate-100 px-4 py-2.5"><h3 class="text-xs font-extrabold uppercase tracking-wide text-slate-800">{{ 'product.ov.attention' | transloco }}</h3><p class="text-[11px] text-slate-500">{{ 'product.ov.attentionHint' | transloco }}</p></header>
          <ul class="divide-y divide-slate-100">
            @for (g of issues(); track g.label) {
              <li class="px-4 py-3">
                <div class="flex items-center justify-between gap-3">
                  <span class="flex items-center gap-2 text-sm text-slate-700">@if (g.items.length > 0) { <erp-icon name="alert-triangle" [size]="14" class="text-amber-500" /> }{{ g.label }}</span>
                  @if (g.items.length === 0) { <erp-pill tone="green">{{ 'product.ov.allGood' | transloco }}</erp-pill> } @else { <erp-pill tone="amber">{{ g.items.length }}</erp-pill> }
                </div>
                @if (g.items.length > 0) {
                  <p class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 ps-6 text-[11px]">
                    @for (p of g.items.slice(0, 4); track p.id) { <a class="text-emerald-700 hover:underline" [routerLink]="['/product', 'products', p.id]">{{ p.name }}</a> }
                    @if (g.items.length > 4) { <span class="text-slate-400">{{ 'product.ov.more' | transloco: { n: g.items.length - 4 } }}</span> }
                  </p>
                }
              </li>
            }
          </ul>
        </section>

        <erp-card [title]="'product.ov.stock' | transloco">
          <p class="text-[11px] text-slate-500">{{ 'product.ov.stockHint' | transloco }}</p>
          <p class="mt-2 font-display text-3xl font-extrabold tabular-nums text-slate-900">{{ stock() }} <span class="text-base font-normal text-slate-400">SAR</span></p>
          <p class="mt-1 text-xs text-slate-500">{{ 'product.ov.stockDetail' | transloco: { units: units(), n: storable().length } }}</p>
        </erp-card>
      </div>
    </div>

    <ng-template #bars let-rows="rows">
      <ul class="space-y-3">
        @for (r of rows; track r.label) {
          <li>
            <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
              @if (r.link) { <a [routerLink]="r.link" class="truncate text-slate-700 hover:text-emerald-700 hover:underline">{{ r.label }}</a> } @else { <span class="truncate text-slate-700">{{ r.label }}</span> }
              <span class="font-bold tabular-nums text-slate-900">{{ r.value }}</span>
            </div>
            <div class="h-2 rounded-full bg-slate-100" role="img" [attr.aria-label]="r.label + ': ' + r.value"><div class="h-2 rounded-full bg-emerald-500" [style.width.%]="(r.value / max(rows)) * 100"></div></div>
          </li>
        } @empty { <li class="py-2 text-center text-xs text-slate-400">{{ 'product.d.nothing' | transloco }}</li> }
      </ul>
    </ng-template>`,
})
export class OverviewPage {
  private readonly store = inject(ProductStore);
  private readonly i18n = inject(I18n);
  private readonly perms = inject(PermissionService);
  protected readonly canWrite = computed(() => this.perms.has(PERM.inventory.write));
  protected readonly max = (rows: Bar[]) => Math.max(1, ...rows.map(r => r.value));

  protected readonly crumbs = computed<Crumb[]>(() => [{ label: this.i18n.tr('product.crumb.root'), link: ['/product', 'overview'] }, { label: this.i18n.tr('product.crumb.dashboard') }]);
  protected readonly live = computed(() => this.store.s().products.filter(p => p.active));
  protected readonly storable = computed(() => this.live().filter(p => p.type === 'product'));

  protected readonly kpis = computed<Kpi[]>(() => {
    const s = this.store.s(), t = (k: string, p?: Record<string, unknown>) => this.i18n.tr(k, p);
    const live = this.live();
    const link = (k: ProductEntityKey) => ['/product', ENTITY_BY_KEY[k].route];
    return [
      { key: 'products', icon: ENTITY_BY_KEY['products'].icon, value: live.length, label: t('product.ov.kpiProducts'), hint: t('product.ov.nArchived', { n: s.products.length - live.length }), link: link('products') },
      { key: 'categories', icon: ENTITY_BY_KEY['categories'].icon, value: s.categories.filter(c => c.active).length, label: t('product.ov.kpiCategories'), hint: t('product.ov.nRoot', { n: s.categories.filter(c => !c.parent_id).length }), link: link('categories') },
      { key: 'uoms', icon: ENTITY_BY_KEY['uoms'].icon, value: s.uoms.filter(u => u.active).length, label: t('product.ov.kpiUoms'), hint: t('product.ov.nCategories', { n: s.uom_categories.length }), link: link('uoms') },
      { key: 'uomCategories', icon: ENTITY_BY_KEY['uomCategories'].icon, value: s.uom_categories.filter(c => c.active).length, label: t('product.ov.kpiUomCats'), hint: t('product.ov.uomCatsHint'), link: link('uomCategories') },
    ];
  });

  protected readonly byType = computed<Bar[]>(() => PRODUCT_TYPE_OPTIONS.map(o => ({ label: this.i18n.tr(o.labelKey), value: this.live().filter(p => p.type === o.value).length, link: ['/product', 'products'] })));
  protected readonly byTracking = computed<Bar[]>(() => TRACKING_OPTIONS.map(o => ({ label: this.i18n.tr(o.labelKey), value: this.storable().filter(p => p.tracking === o.value).length })));
  protected readonly topCats = computed<Bar[]>(() => {
    const s = this.store.s();
    return s.categories.filter(c => c.active)
      .map(c => ({ label: categoryName(s, c.id).replace(/^All \/ /, ''), value: s.products.filter(p => p.active && p.categ_id === c.id).length, link: ['/product', 'categories', c.id] }))
      .filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 7);
  });

  protected readonly issues = computed<Issue[]>(() => {
    const live = this.live(), t = (k: string) => this.i18n.tr(k);
    return [
      { label: t('product.ov.noReference'), items: live.filter(p => !p.default_code) },
      { label: t('product.ov.noTracking'), items: live.filter(p => p.type === 'product' && p.tracking === 'none') },
      { label: t('product.ov.outOfStock'), items: live.filter(p => p.type === 'product' && lte(p.qty_available, '0')) },
    ];
  });

  protected readonly stock = computed(() => fmtNum(stockValue(this.store.s(), this.storable()), 0));
  protected readonly units = computed(() => fmtNum(this.storable().reduce((a, p) => a + Number(p.qty_available), 0), 0));
}
