import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { type HasUnsavedChanges } from '@erp/web/core';
import { MetadataFormComponent, type Rec } from '@erp/web/metadata-forms';
import { ApiError } from '@erp/web/api-client';
import { ErrorBannerComponent, IconComponent, ToastService, I18n } from '@erp/web/ui';
import type { CompanyDraft, LookupOption, ResCompany } from '@erp/shared/contracts';
import { ContactsStore } from '../data/contacts.store';
import { lookupOptions } from '../models/options';
import { BLANK_COMPANY, COMPANY_VIEW } from '../views/company.view';

const IMAGE_KEYS = ['company_seal', 'company_header_boxed', 'company_footer_boxed'] as const;

/** New Company (creates the res.company record and its partner) and Edit Company: one form for both. */
@Component({
  selector: 'erp-company-form-page',
  imports: [TranslocoPipe, RouterLink, MetadataFormComponent, ErrorBannerComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <nav class="flex items-center gap-1 text-xs"><a routerLink="/contacts/directory/other" class="font-bold text-emerald-700 hover:underline">{{ 'contacts.co.title' | transloco }}</a>
        <erp-icon name="chevron-right" [size]="12" [flip]="true" class="text-slate-400" /><span class="truncate font-bold text-slate-700">{{ title() }}</span></nav>
      <div><h1 class="font-display text-xl font-extrabold tracking-tight text-slate-900">{{ title() }}</h1>
        <p class="mt-0.5 text-xs text-slate-500">{{ 'contacts.cm.requiredHint' | transloco }}</p></div>
      <erp-error-banner [text]="error()" />

      @if (ready()) {
        <erp-metadata-form [view]="view" [value]="seed()" [lookups]="options()" [serverErrors]="serverErrors()" layout="split" />
      } @else if (failed()) {
        <p class="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">{{ 'contacts.co.notFound' | transloco }}</p>
      }

      <div class="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-100/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <button type="button" class="erp-btn-ghost" (click)="cancel()">{{ 'common.cancel' | transloco }}</button>
        <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="save()"><erp-icon name="save" [size]="14" />{{ (company() ? 'contacts.co.saveChanges' : 'contacts.co.save') | transloco }}</button>
      </div>
    </div>`,
})
export class CompanyFormPage implements HasUnsavedChanges {
  protected readonly store = inject(ContactsStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);
  private readonly forms = viewChild(MetadataFormComponent);

  protected readonly view = COMPANY_VIEW;
  /** Route param on `companies/:id/edit`; absent on `companies/new`. */
  readonly id = input<string | undefined>(undefined);
  protected readonly company = signal<ResCompany | null>(null);
  protected readonly failed = signal(false);
  protected readonly seed = signal<Rec>({ ...BLANK_COMPANY } as unknown as Rec);
  protected readonly ready = computed(() => this.store.loaded() && (!this.id() || !!this.company()));
  protected readonly title = computed(() => (this.company() ? this.i18n.tr('contacts.co.editTitle', { name: this.company()?.name }) : this.i18n.tr('contacts.co.new')));
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly serverErrors = signal<Record<string, string>>({});
  private readonly currencies = signal<LookupOption[]>([]);

  protected readonly options = computed(() => {
    const l = this.store.lookups();
    return {
      ...lookupOptions(l),
      currencies: this.currencies().map(c => ({ value: c.id, label: c.name })),
      states: l.states.map(s => ({ value: s.id, label: s.name, group: s.country_id })),
    };
  });

  /** Set once the company was saved (or deliberately left), so the leave guard stays quiet. */
  private leaving = false;
  hasUnsavedChanges(): boolean { return !this.leaving && (this.forms()?.dirty ?? false); }

  constructor() {
    effect(() => {
      const id = this.id();
      if (!id) return;
      void this.store.company(Number(id)).then(c => { this.company.set(c); this.seed.set(c as unknown as Rec); }, () => this.failed.set(true));
    });
    void this.store.currencies().then(list => this.currencies.set(list), () => this.currencies.set([]));
  }

  protected cancel(): void { void this.router.navigate(this.company() ? ['/contacts/companies', this.company()?.id] : ['/contacts/directory/other']); }

  protected async save(): Promise<void> {
    this.error.set('');
    this.serverErrors.set({});
    const f = this.forms();
    if (!f) return;
    if (!f.validate()) return this.error.set(this.i18n.tr('contacts.cm.fixErrors') + ' ' + f.firstError());
    const draft = f.current() as unknown as CompanyDraft;
    this.busy.set(true);
    try {
      const editing = this.company();
      let saved: ResCompany;
      if (editing) {
        // An image that was not touched is not sent again: the server keeps the picture it has
        const changes: Record<string, unknown> = { ...draft, name: draft.name.trim() };
        for (const k of IMAGE_KEYS) if (changes[k] === (editing[k] ?? null) || (changes[k] === '' && !editing[k])) delete changes[k];
        saved = await this.store.updateCompany(editing.id, changes as Partial<CompanyDraft>);
        this.toast.success(this.i18n.tr('contacts.co.updated', { name: saved.name }));
      } else {
        saved = await this.store.createCompany({ ...draft, name: draft.name.trim() });
        this.toast.success(this.i18n.tr('contacts.co.created', { name: saved.name }));
      }
      this.leaving = true;
      await this.router.navigate(['/contacts/companies', saved.id]);
    } catch (e) {
      if (e instanceof ApiError) { this.error.set(e.problem.detail ?? e.problem.title); this.serverErrors.set(Object.fromEntries((e.problem.errors ?? []).map(x => [x.field, x.message]))); }
      else this.error.set(this.i18n.tr('common.errorGeneric'));
    } finally { this.busy.set(false); }
  }
}
