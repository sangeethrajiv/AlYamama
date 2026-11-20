import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '@erp/web/api-client';
import type { HasUnsavedChanges } from '@erp/web/core';
import { MetadataFormComponent, type Rec as FormRec } from '@erp/web/metadata-forms';
import { EmptyStateComponent, ErrorBannerComponent, I18n, IconComponent, PageHeaderComponent, ToastService } from '@erp/web/ui';
import type { Product, ProductCategory, ProductEntityKey, Uom, UomCategory } from '@erp/shared/contracts';
import { ProductActions } from '../data/product-actions.service';
import { ProductStore } from '../data/product.store';
import { ProductBreadcrumbComponent, type Crumb } from '../components/product-breadcrumb.component';
import { ProductSmartButtonComponent } from '../components/product-smart-button.component';
import { ENTITY_BY_KEY } from '../models/product-entities';
import { relRecords } from '../models/product-helpers';
import { buildView, fromForm, noLookups, toForm } from '../models/product-view';
import { singularKey, titleKey, type FieldSpec, type Mode, type Rec, type Values } from '../models/product-types';

const isInput = (f: FieldSpec) => f.kind !== 'readonly' && !f.detailOnly;
/** API error codes that belong to one field. */
const CODE_FIELD: Record<string, string> = { PRODUCT_DUPLICATE_REFERENCE: 'default_code', PRODUCT_DUPLICATE_BARCODE: 'barcode' };

/**
 * Create / edit form for one Product model. Sections, fields, defaults and validation come from `product-entities.ts`;
 * rendering is the shared metadata form. Conditional visibility, read-only rules and on-change behaviour (Odoo `@api.onchange`)
 * follow the React reference module.
 */
@Component({
  selector: 'erp-product-form-page',
  imports: [RouterLink, TranslocoPipe, MetadataFormComponent, ErrorBannerComponent, IconComponent, EmptyStateComponent, PageHeaderComponent, ProductBreadcrumbComponent, ProductSmartButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!store.loaded()) { <p class="py-10 text-center text-sm text-slate-400">{{ 'common.loading' | transloco }}</p> }
    @else if (id() && !existing()) {
      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <erp-empty-state [title]="'product.d.notFound' | transloco: { what: singular() }" [text]="'product.d.notFoundHint' | transloco" icon="inbox">
          <a class="erp-btn-ghost mt-2" [routerLink]="['/product', cfg().route]">{{ 'product.d.backTo' | transloco: { what: title() } }}</a>
        </erp-empty-state>
      </section>
    } @else if (ready()) {
      <div class="max-w-5xl space-y-3">
        <erp-product-breadcrumb [crumbs]="crumbs()" />
        <a [routerLink]="backLink()" class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"><erp-icon name="chevron-left" [size]="13" [flip]="true" />{{ (mode() === 'create' ? title() : ('product.f.backToRecord' | transloco)) }}</a>
        <erp-page-header [title]="heading()">
          <ng-container actions>
            <button type="button" class="erp-btn-ghost" (click)="cancel()">{{ discardKey() | transloco }}</button>
            <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="save()"><erp-icon name="save" [size]="14" />{{ saveKey() | transloco }}</button>
          </ng-container>
        </erp-page-header>
        @if (smart(); as sb) {
          <div class="flex justify-end">
            <erp-product-smart-button [icon]="sb.icon" [count]="sb.count" [label]="sb.label" [disabled]="mode() === 'create'" (pressed)="openSmartButton()" />
          </div>
        }
        <erp-error-banner [text]="err()" />
        <erp-metadata-form [view]="view()" [value]="seed()" [lookups]="lookups" [serverErrors]="errors()" (valueChange)="changed($event)" />
        <div class="flex justify-end gap-2 pb-2">
          <button type="button" class="erp-btn-ghost" (click)="cancel()">{{ discardKey() | transloco }}</button>
          <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="save()"><erp-icon name="save" [size]="14" />{{ saveKey() | transloco }}</button>
        </div>
      </div>
    }`,
})
export class EntityFormPage implements HasUnsavedChanges {
  protected readonly store = inject(ProductStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);
  private readonly actions = inject(ProductActions);
  private readonly form = viewChild(MetadataFormComponent);

  /** Route data: which model this form edits. */
  readonly entity = input.required<ProductEntityKey>();
  /** Route param; absent when creating. */
  readonly id = input<string | undefined>(undefined);

  protected readonly cfg = computed(() => ENTITY_BY_KEY[this.entity()]);
  protected readonly mode = computed<Mode>(() => (this.id() ? 'edit' : 'create'));
  protected readonly existing = computed<Rec | undefined>(() => (this.id() ? relRecords(this.store.s(), this.entity()).find(r => r.id === Number(this.id())) : undefined));
  protected readonly view = computed(() => buildView(this.cfg(), this.mode(), () => this.store.ctx()));
  protected readonly lookups = noLookups;

  protected readonly seed = signal<Rec>({ id: 0, active: true });
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly err = signal('');
  protected readonly busy = signal(false);
  private readonly loadedKey = signal('');
  private live: Values = {};
  private submitted = false;
  private leaving = false;

  /** Odoo-style forms say Save / Discard; the Products form keeps Create / Save changes / Cancel. */
  protected readonly saveKey = computed(() => (this.cfg().odooForm ? 'product.f.save' : this.mode() === 'create' ? 'product.f.create' : 'product.f.saveChanges'));
  protected readonly discardKey = computed(() => (this.cfg().odooForm ? 'product.f.discard' : 'product.f.cancel'));
  /** The stat button (Odoo `oe_stat_button`) for models that have one; counts the saved record. */
  protected readonly smart = computed(() => {
    const sb = this.cfg().smartButton, ex = this.existing();
    return sb ? { icon: sb.icon, label: sb.labelKey, count: ex ? sb.count(ex, this.store.ctx()) : 0 } : null;
  });

  protected readonly currentKey = computed(() => `${this.entity()}/${this.id() ?? 'new'}`);
  protected readonly ready = computed(() => this.store.loaded() && this.loadedKey() === this.currentKey());
  protected readonly title = computed(() => this.i18n.tr(titleKey(this.entity())));
  protected readonly singular = computed(() => this.i18n.tr(singularKey(this.entity())));
  protected readonly heading = computed(() => {
    const ex = this.existing();
    return this.mode() === 'create' ? this.i18n.tr('product.l.new', { what: this.singular() }) : this.i18n.tr('product.f.edit', { name: ex ? this.cfg().nameOf(ex, this.store.ctx()) : '' });
  });
  protected readonly backLink = computed(() => { const id = this.id(); return id ? ['/product', this.cfg().route, id] : ['/product', this.cfg().route]; });
  protected readonly crumbs = computed<Crumb[]>(() => {
    const out: Crumb[] = [{ label: this.i18n.tr('product.crumb.root'), link: ['/product', 'overview'] }, { label: this.i18n.tr('product.crumb.masterData') }, { label: this.title(), link: ['/product', this.cfg().route] }];
    const ex = this.existing();
    if (this.mode() === 'create') out.push({ label: this.i18n.tr('product.crumb.new') });
    else out.push({ label: ex ? this.cfg().nameOf(ex, this.store.ctx()) : `#${this.id()}`, link: this.backLink() }, { label: this.i18n.tr('product.crumb.edit') });
    return out;
  });

  constructor() {
    // Load the record (or the defaults) into the form once the data is there and whenever the route changes.
    effect(() => {
      if (!this.store.loaded()) return;
      const key = this.currentKey();
      untracked(() => {
        if (this.id() && !this.existing()) return;
        if (this.loadedKey() === key) return;
        const cfg = this.cfg(), c = this.store.ctx();
        const base = this.existing() ?? { id: 0, active: true, ...cfg.defaults(c.s) };
        const values = toForm(cfg, base as Values, c);
        this.live = values;
        this.seed.set({ ...(base as Rec), ...values } as Rec);
        this.errors.set({}); this.err.set(''); this.submitted = false; this.leaving = false;
        this.loadedKey.set(key);
      });
    });
  }

  hasUnsavedChanges(): boolean { return !this.leaving && (this.form()?.dirty ?? false); }

  /** The user edited a field: run `@api.onchange` rules and keep error messages in step. */
  protected changed(next: FormRec): void {
    const cfg = this.cfg(), prev = this.live;
    this.live = next as Values;
    const changedKeys: string[] = [];
    for (const sec of cfg.sections) {
      for (const f of sec.fields) {
        if (next[f.key] === prev[f.key]) continue;
        changedKeys.push(f.key);
        if (f.onChange) this.form()?.patchValue(f.onChange(next[f.key], next as Values, this.store.ctx()));
      }
    }
    if (this.submitted) this.errors.set(this.check(this.form()?.current() as Values ?? next as Values));
    else if (changedKeys.length) this.errors.update(e => Object.fromEntries(Object.entries(e).filter(([k]) => !changedKeys.includes(k))));
  }

  /** Cross-field and uniqueness rules for the values as they would be saved. */
  private check(raw: Values): Record<string, string> {
    return this.cfg().validate?.(fromForm(this.cfg(), raw), this.store.ctx(), this.existing()?.id) ?? {};
  }

  protected cancel(): void { void this.router.navigate(this.backLink()); }

  /** Open the related list already narrowed to this record (like Odoo's `search_default_categ_id`). */
  protected openSmartButton(): void {
    const ex = this.existing();
    if (ex) this.actions.openSmartButton(this.cfg(), ex);
  }

  protected async save(): Promise<void> {
    const f = this.form();
    if (!f) return;
    this.err.set('');
    this.submitted = true;
    const cfg = this.cfg(), mode = this.mode(), c = this.store.ctx();
    const raw = f.current() as Values;
    const okForm = f.validate();
    const errs = this.check(raw);
    this.errors.set(errs);
    if (!okForm || Object.keys(errs).length) {
      this.err.set(this.i18n.tr('product.f.fixFields'));
      this.toast.error(this.i18n.tr('product.f.fixFields'));
      return;
    }
    // Only input fields that are shown (or any in edit mode) are written; computed fields are left to the data layer.
    const parsed = fromForm(cfg, raw);
    const payload: Values = {};
    for (const sec of cfg.sections) for (const fs of sec.fields) if (isInput(fs) && fs.key in parsed && (!fs.showWhen || fs.showWhen(raw, mode) || mode === 'edit')) payload[fs.key] = parsed[fs.key];
    const final = cfg.finalize ? cfg.finalize(payload) : payload;
    const existing = this.existing();
    const record = { ...(existing ?? { ...cfg.defaults(c.s) }), ...final } as Values;
    this.busy.set(true);
    try {
      const saved = await this.persist(record);
      this.leaving = true;
      this.toast.success(this.i18n.tr(mode === 'create' ? 'product.toast.created' : 'product.toast.saved', { what: this.singular(), name: cfg.nameOf({ ...(record as Rec), id: saved }, this.store.ctx()) }));
      void this.router.navigate(['/product', cfg.route, saved]);
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  private async persist(r: Values): Promise<number> {
    const api = this.store.api;
    switch (this.entity()) {
      case 'products': return (await api.saveProduct(r as Product)).id;
      case 'categories': return (await api.saveCategory(r as ProductCategory)).id;
      case 'uoms': return (await api.saveUom(r as Uom)).id;
      case 'uomCategories': return (await api.saveUomCategory(r as UomCategory)).id;
    }
  }

  private fail(e: unknown): void {
    if (!(e instanceof ApiError)) { this.err.set(this.i18n.tr('common.errorGeneric')); return; }
    const p = e.problem;
    const byField: Record<string, string> = {};
    for (const x of p.errors ?? []) byField[x.field] = x.message;
    const field = p.code ? CODE_FIELD[p.code] : undefined;
    if (field) byField[field] = p.detail ?? p.title;
    this.errors.set(byField);
    this.err.set(Object.keys(byField).length ? this.i18n.tr('product.f.fixFields') : (p.detail ?? p.title));
  }
}
