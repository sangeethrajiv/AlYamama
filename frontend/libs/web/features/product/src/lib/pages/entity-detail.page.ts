import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService } from '@erp/web/core';
import { CardComponent, EmptyStateComponent, I18n, IconComponent, PillComponent } from '@erp/web/ui';
import { PERM, type ProductEntityKey } from '@erp/shared/contracts';
import { ProductActions } from '../data/product-actions.service';
import { ProductStore } from '../data/product.store';
import { ProductBreadcrumbComponent, type Crumb } from '../components/product-breadcrumb.component';
import { ProductSmartButtonComponent } from '../components/product-smart-button.component';
import { ENTITY_BY_KEY } from '../models/product-entities';
import { fmtNum, relLabel, relRecords } from '../models/product-helpers';
import { optLabel } from '../models/product-options';
import { singularKey, titleKey, type Ctx, type FieldSpec, type Rec } from '../models/product-types';

/** How a field value is shown on the detail screen. */
interface Shown { kind: 'dash' | 'bool' | 'text' | 'link'; text: string; yes: boolean; mono: boolean; rtl: boolean; pre: boolean; suffix: string; link: (string | number)[] }
const shown = (kind: Shown['kind'], p: Partial<Shown> = {}): Shown => ({ kind, text: '', yes: false, mono: false, rtl: false, pre: false, suffix: '', link: [], ...p });

const ENTITY_REL = new Set<string>(['products', 'categories', 'uoms', 'uomCategories']);

/** Read-only view of one record: header with actions, key figures, every field grouped as in the form, and related records. */
@Component({
  selector: 'erp-product-detail-page',
  imports: [NgTemplateOutlet, RouterLink, TranslocoPipe, IconComponent, CardComponent, EmptyStateComponent, PillComponent, ProductBreadcrumbComponent, ProductSmartButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!store.loaded()) { <p class="py-10 text-center text-sm text-slate-400">{{ 'common.loading' | transloco }}</p> }
    @else {
      <div class="space-y-3">
        <erp-product-breadcrumb [crumbs]="crumbs()" />
        @let r = rec();
        @if (!r) {
          <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
            <erp-empty-state [title]="'product.d.notFound' | transloco: { what: singular() }" [text]="'product.d.notFoundHint' | transloco" icon="inbox">
              <a class="erp-btn-ghost mt-2" [routerLink]="['/product', cfg().route]">{{ 'product.d.backTo' | transloco: { what: title() } }}</a>
            </erp-empty-state>
          </section>
        } @else {
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              @if (!cfg().odooView) { <a [routerLink]="['/product', cfg().route]" class="mb-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"><erp-icon name="chevron-left" [size]="13" [flip]="true" />{{ title() }}</a> }
              <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 class="truncate font-display text-xl font-extrabold tracking-tight text-slate-900">{{ heading().text }}</h1>
                @if (heading().secondary) { <span class="text-base font-semibold text-slate-500" dir="rtl">{{ heading().secondary }}</span> }
                @if (!cfg().odooView || !r.active) { <erp-pill [tone]="r.active ? 'green' : 'slate'">{{ (r.active ? 'product.l.active' : 'product.l.archived') | transloco }}</erp-pill> }
                @for (b of badges(); track b.text) { <erp-pill [tone]="b.tone">{{ b.text }}</erp-pill> }
              </div>
              @if (!cfg().odooView) { <p class="mt-1 text-xs text-slate-500">ID {{ r.id }}</p> }
            </div>
            @if (smart(); as sb) { <erp-product-smart-button [icon]="sb.icon" [count]="sb.count" [label]="sb.label" (pressed)="openSmartButton()" /> }
            @if (canWrite()) {
              <div class="flex flex-wrap items-center gap-2">
                <a [class]="cfg().odooView ? 'erp-btn-primary' : 'erp-btn-ghost'" [routerLink]="['/product', cfg().route, r.id, 'edit']"><erp-icon name="pencil" [size]="14" />{{ 'product.act.edit' | transloco }}</a>
                <!-- Archive / Restore / Delete stay off the reference pages for now -->
                @if (!cfg().odooView) {
                  @if (r.active) { <button type="button" class="erp-btn-ghost" (click)="archive()"><erp-icon name="archive" [size]="14" />{{ 'product.act.archive' | transloco }}</button> }
                  @else { <button type="button" class="erp-btn-ghost" (click)="restore()"><erp-icon name="archive-restore" [size]="14" />{{ 'product.act.restore' | transloco }}</button> }
                  <button type="button" class="erp-btn-danger" (click)="remove()"><erp-icon name="trash" [size]="14" />{{ 'product.act.delete' | transloco }}</button>
                }
              </div>
            }
          </div>

          @if (!r.active && !cfg().odooView) {
            <div role="status" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">{{ 'product.d.archivedBanner' | transloco: { what: singular().toLowerCase() } }}</div>
          }

          @if (stats().length > 0) {
            <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
              @for (s of stats(); track s.labelKey) {
                <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p class="text-[11px] font-semibold text-slate-500">{{ s.labelKey | transloco }}</p>
                  <p class="mt-1 font-display text-lg font-extrabold tabular-nums text-slate-900">{{ s.value }}</p>
                  @if (s.hint) { <p class="mt-0.5 text-[10px] text-slate-400">{{ s.hint }}</p> }
                </div>
              }
            </div>
          }

          <div class="grid grid-cols-1 gap-3" [class]="related().length > 0 ? 'xl:grid-cols-3' : ''">
            <div class="min-w-0 space-y-3" [class]="related().length > 0 ? 'xl:col-span-2' : ''">
              @if (cfg().odooView) {
                <section class="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <div class="grid gap-x-10 gap-y-5 lg:grid-cols-2">
                    @for (sec of sections(); track sec.titleKey) {
                      <div class="min-w-0" [class]="sec.half ? '' : 'lg:col-span-2'">
                        @if (sec.showTitle) { <h3 class="mb-2 text-base font-bold text-emerald-700">{{ sec.titleKey | transloco }}</h3> }
                        <dl class="grid grid-cols-1 gap-x-10" [class]="sec.columns === 1 ? '' : 'sm:grid-cols-2 sm:grid-flow-dense'">
                          @for (f of sec.fields; track f.key) {
                            @let v = show(f, r);
                            <div class="flex min-w-0 items-start py-1.5" [class]="f.column === 2 ? 'sm:col-start-2' : f.column === 1 ? 'sm:col-start-1' : ''">
                              <dt class="w-36 shrink-0 pe-3 text-[13px] font-bold text-slate-800 sm:w-44">{{ f.labelKey | transloco }}</dt>
                              <dd class="min-w-0 flex-1 break-words border-s border-slate-300 ps-3 text-[13px] text-slate-700">
                                <ng-container [ngTemplateOutlet]="valueTpl" [ngTemplateOutletContext]="{ $implicit: v, odoo: true }" />
                                @if (hint(f, r); as h) { <p class="mt-1 text-[11px] text-slate-400">{{ h }}</p> }
                              </dd>
                            </div>
                          }
                        </dl>
                      </div>
                    }
                  </div>
                </section>
              } @else {
              @for (sec of sections(); track sec.titleKey) {
                <erp-card [title]="sec.titleKey | transloco" [dense]="true">
                  <dl class="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                    @for (f of sec.fields; track f.key) {
                      <div [class]="f.span === 2 || f.kind === 'textarea' ? 'sm:col-span-2' : ''">
                        <dt class="text-[11px] font-medium text-slate-500">{{ f.labelKey | transloco }}</dt>
                        <dd class="mt-0.5 break-words text-sm text-slate-900">
                          @let v = show(f, r);
                          <ng-container [ngTemplateOutlet]="valueTpl" [ngTemplateOutletContext]="{ $implicit: v, odoo: false }" />
                        </dd>
                      </div>
                    }
                  </dl>
                </erp-card>
              }
              }
            </div>
            @if (related().length > 0) {
              <div class="min-w-0 space-y-3">
                @for (rel of related(); track rel.titleKey) {
                  <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <header class="border-b border-slate-100 px-4 py-2.5"><h3 class="text-xs font-extrabold uppercase tracking-wide text-slate-800">{{ rel.titleKey | transloco }} ({{ rel.items.length }})</h3></header>
                    @if (rel.items.length === 0) { <p class="px-5 py-6 text-center text-xs text-slate-400">{{ 'product.d.nothing' | transloco }}</p> }
                    @else {
                      <ul class="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                        @for (it of rel.items.slice(0, 50); track it.rec.id) {
                          <li>
                            <a [routerLink]="['/product', rel.route, it.rec.id]" class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
                              <span class="min-w-0">
                                <span class="block truncate font-bold" [class]="it.rec.active ? 'text-slate-800' : 'text-slate-400 line-through'">{{ it.name }}</span>
                                @if (it.meta) { <span class="block truncate text-[11px] text-slate-500">{{ it.meta }}</span> }
                              </span>
                              @if (!it.rec.active) { <erp-pill>{{ 'product.l.archived' | transloco }}</erp-pill> }
                            </a>
                          </li>
                        }
                        @if (rel.items.length > 50) { <li class="px-4 py-2 text-[11px] text-slate-400">{{ 'product.d.showingFirst' | transloco: { n: 50, total: rel.items.length } }}</li> }
                      </ul>
                    }
                  </section>
                }
              </div>
            }
          </div>
        }
      </div>
    }
    <ng-template #valueTpl let-v let-odoo="odoo">
      @switch (v.kind) {
        @case ('dash') { @if (odoo) { <span>&nbsp;</span> } @else { <span class="text-slate-400">—</span> } }
        @case ('bool') {
          @if (odoo) { <input type="checkbox" class="accent-emerald-600" disabled [checked]="v.yes" /><span class="sr-only">{{ (v.yes ? 'product.o.yes' : 'product.o.no') | transloco }}</span> }
          @else { <erp-pill [tone]="v.yes ? 'green' : 'slate'">{{ (v.yes ? 'product.o.yes' : 'product.o.no') | transloco }}</erp-pill> }
        }
        @case ('link') { <a class="text-emerald-700 hover:underline" [routerLink]="v.link">{{ v.text }}</a> }
        @default { <span [class]="(v.mono ? 'font-mono text-[13px] ' : '') + (v.pre ? 'whitespace-pre-wrap' : '')" [attr.dir]="v.rtl ? 'rtl' : null">{{ v.text }}</span>@if (v.suffix) { <span class="ms-1 text-slate-400">{{ v.suffix }}</span> } }
      }
    </ng-template>`,
})
export class EntityDetailPage {
  protected readonly store = inject(ProductStore);
  private readonly actions = inject(ProductActions);
  private readonly perms = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);

  readonly entity = input.required<ProductEntityKey>();
  readonly id = input.required<string>();

  protected readonly cfg = computed(() => ENTITY_BY_KEY[this.entity()]);
  private readonly ctx = this.store.ctx;
  protected readonly canWrite = computed(() => this.perms.has(PERM.inventory.write));
  protected readonly rec = computed<Rec | undefined>(() => relRecords(this.store.s(), this.entity()).find(r => r.id === Number(this.id())));
  protected readonly title = computed(() => this.i18n.tr(titleKey(this.entity())));
  protected readonly singular = computed(() => this.i18n.tr(singularKey(this.entity())));
  protected readonly name = computed(() => { const r = this.rec(); return r ? this.cfg().nameOf(r, this.ctx()) : ''; });
  /** Page title: the record name (reference view: the Odoo `name` field, plus e.g. the Arabic name next to it). */
  protected readonly heading = computed(() => { const r = this.rec(), cfg = this.cfg(); return r && cfg.odooView && cfg.detailTitle ? cfg.detailTitle(r, this.ctx()) : { text: this.name(), secondary: '' }; });
  protected readonly smart = computed(() => {
    const sb = this.cfg().smartButton, r = this.rec();
    return sb && r && this.cfg().odooView ? { icon: sb.icon, label: sb.labelKey, count: sb.count(r, this.ctx()) } : null;
  });
  protected readonly badges = computed(() => { const r = this.rec(); return r ? (this.cfg().badges?.(r, this.ctx()) ?? []) : []; });
  protected readonly stats = computed(() => { const r = this.rec(); return r && !this.cfg().odooView ? (this.cfg().stats?.(r, this.ctx()) ?? []) : []; });
  protected readonly crumbs = computed<Crumb[]>(() => [
    { label: this.i18n.tr('product.crumb.root'), link: ['/product', 'overview'] },
    { label: this.i18n.tr('product.crumb.masterData') },
    { label: this.title(), link: ['/product', this.cfg().route] },
    { label: this.name() || `#${this.id()}` },
  ]);

  /** Sections with the fields that have something to show (empty "hide when empty" fields are left out). */
  protected readonly sections = computed(() => {
    const r = this.rec();
    if (!r) return [];
    return this.cfg().sections
      .map(sec => ({
        titleKey: sec.titleKey,
        // the reference sheet may lay a section out differently from the form (e.g. stacked instead of side by side)
        columns: sec.detail?.columns ?? sec.columns, half: sec.detail?.half ?? sec.half,
        showTitle: sec.detail?.title ?? this.cfg().sections.length > 1,
        fields: sec.fields.filter(f => !(f.debugOnly && !this.ctx().debug) && !(f.detailHidden && this.cfg().odooView) && !(f.hideEmpty && (f.kind === 'readonly' && f.get ? !f.get(r, this.ctx()) : r[f.key] === '' || r[f.key] == null || r[f.key] === false))),
      }))
      .filter(sec => sec.fields.length > 0);
  });

  protected readonly related = computed(() => {
    const r = this.rec(), c = this.ctx();
    return (r && !this.cfg().odooView ? this.cfg().related ?? [] : []).map(rel => {
      const target = ENTITY_BY_KEY[rel.entity];
      return { titleKey: rel.titleKey, route: target.route, items: rel.items(r as Rec, c).map(it => ({ rec: it, name: target.nameOf(it, c), meta: rel.meta?.(it, c) ?? '' })) };
    });
  });

  protected show(f: FieldSpec, r: Rec): Shown {
    const c: Ctx = this.ctx();
    if (f.kind === 'readonly') { const t = f.get ? f.get(r, c) : ''; return t ? shown('text', { text: t }) : shown('dash'); }
    const v = r[f.key];
    switch (f.kind) {
      case 'boolean': return shown('bool', { yes: !!v });
      case 'number': return v === '' || v == null ? shown('dash') : shown('text', { text: this.cfg().odooView && f.places != null ? Number(v).toFixed(f.places) : fmtNum(v), suffix: f.suffix ?? '' });
      case 'select': return v ? shown('text', { text: optLabel(f.options ?? [], v, c.tr) }) : shown('dash');
      case 'relation': {
        if (v == null) return shown('dash');
        const rel = f.rel;
        const text = rel ? relLabel(c.s, rel, v) : '';
        if (!rel || !text) return shown('dash');
        return ENTITY_REL.has(rel) ? shown('link', { text, link: ['/product', ENTITY_BY_KEY[rel as ProductEntityKey].route, v] }) : shown('text', { text });
      }
      case 'textarea': return v ? shown('text', { text: String(v), pre: true }) : shown('dash');
      default: return v ? shown('text', { text: String(v), mono: !!f.mono, rtl: !!f.rtl }) : shown('dash');
    }
  }

  protected openSmartButton(): void { const r = this.rec(); if (r) this.actions.openSmartButton(this.cfg(), r); }
  protected hint(f: FieldSpec, r: Rec): string { return f.detailHint?.(r, this.ctx()) ?? ''; }

  protected archive(): void { const r = this.rec(); if (r) void this.actions.requestArchive(this.cfg(), r); }
  protected restore(): void { const r = this.rec(); if (r) void this.actions.restore(this.cfg(), r); }
  protected async remove(): Promise<void> {
    const r = this.rec();
    if (r && (await this.actions.requestDelete(this.cfg(), r))) void this.router.navigate(['/product', this.cfg().route]);
  }
}
