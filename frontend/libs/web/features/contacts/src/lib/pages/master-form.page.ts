import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { type HasUnsavedChanges } from '@erp/web/core';
import { MetadataFormComponent, type Rec } from '@erp/web/metadata-forms';
import { ApiError } from '@erp/web/api-client';
import { CardComponent, DialogService, ErrorBannerComponent, IconComponent, ToastService, I18n } from '@erp/web/ui';
import type { PartnerDraft, ResPartner } from '@erp/shared/contracts';
import { ChildContactsComponent } from '../components/child-contacts.component';
import { ContactsStore } from '../data/contacts.store';
import { lookupOptions } from '../models/options';
import { BLANK_PARTNER, PARTNER_VIEW } from '../views/partner.view';

/** Add / edit contact form (one component for both). Validation shows on blur and again when Save is pressed. */
@Component({
  selector: 'erp-master-form-page',
  imports: [TranslocoPipe, RouterLink, MetadataFormComponent, ChildContactsComponent, CardComponent, ErrorBannerComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <nav class="flex items-center gap-1 text-xs"><a routerLink="/contacts/master" class="font-bold text-emerald-700 hover:underline">{{ 'contacts.cm.title' | transloco }}</a>
        <erp-icon name="chevron-right" [size]="12" [flip]="true" class="text-slate-400" /><span class="truncate font-bold text-slate-700">{{ title() }}</span></nav>
      <div><h1 class="font-display text-xl font-extrabold tracking-tight text-slate-900">{{ title() }}</h1>
        <p class="mt-0.5 text-xs text-slate-500">{{ 'contacts.cm.requiredHint' | transloco }}</p></div>
      <erp-error-banner [text]="error()" />

      @if (ready()) {
        <erp-metadata-form [view]="view" [value]="seed()" [lookups]="options()" [serverErrors]="serverErrors()" layout="split">
          @if (partner(); as p) { @if (p.is_company) { <erp-child-contacts [parent]="p" /> } }
          @else if (isCompanyDraft()) { <erp-card [title]="'contacts.cm.child.sectionTitle' | transloco" [dense]="true"><p class="py-2 text-xs text-slate-500">{{ 'contacts.cm.child.saveFirst' | transloco }}</p></erp-card> }
        </erp-metadata-form>
      }

      <div class="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-100/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <button type="button" class="erp-btn-ghost" (click)="cancel()">{{ 'common.cancel' | transloco }}</button>
        @if (!partner()) { <button type="button" class="erp-btn-ghost" (click)="clear()"><erp-icon name="eraser" [size]="13" />{{ 'contacts.cm.clear' | transloco }}</button> }
        <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="save()"><erp-icon name="save" [size]="14" />{{ (partner() ? 'contacts.cm.saveChanges' : 'contacts.cm.saveContact') | transloco }}</button>
      </div>
    </div>`,
})
export class MasterFormPage implements HasUnsavedChanges {
  private readonly store = inject(ContactsStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);
  private readonly dialogs = inject(DialogService);
  private readonly forms = viewChild.required(MetadataFormComponent);

  /** Route param on `master/:id/edit`; absent on `master/new`. */
  readonly id = input<string | undefined>(undefined);
  protected readonly view = PARTNER_VIEW;
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly serverErrors = signal<Record<string, string>>({});
  private readonly resetKey = signal(0);

  protected readonly partner = computed<ResPartner | undefined>(() => (this.id() ? this.store.partners().find(p => p.id === Number(this.id())) : undefined));
  protected readonly ready = computed(() => this.store.loaded() && (!this.id() || !!this.partner()));
  protected readonly seed = computed<Rec>(() => { this.resetKey(); return structuredClone((this.partner() ?? BLANK_PARTNER) as unknown as Rec); });
  protected readonly isCompanyDraft = computed(() => this.forms()?.state()?.['is_company'] === true);
  protected readonly title = computed(() => (this.partner() ? this.i18n.tr('contacts.cm.editTitle', { name: this.partner()?.name }) : this.i18n.tr('contacts.cm.newTitle')));
  protected readonly options = computed(() => {
    const l = this.store.lookups();
    const self = this.partner();
    const banned = new Set<number>(self ? [self.id, ...this.descendants(self.id)] : []);
    const parents = this.store.partners().filter(x => x.is_company && !banned.has(x.id)).sort((a, b) => a.name.localeCompare(b.name)).map(x => ({ value: x.id, label: x.name + (x.active ? '' : ' ✕') }));
    return { ...lookupOptions(l), parents, states: l.states.map(s => ({ value: s.id, label: s.name, group: s.country_id })) };
  });

  /** Set once the form was saved (or deliberately left), so the leave guard stays quiet. */
  private leaving = false;
  hasUnsavedChanges(): boolean { return !this.leaving && (this.forms()?.dirty ?? false); }

  /** Ids of every contact below `id` (stops a contact becoming its own ancestor). */
  private descendants(id: number): number[] {
    const list = this.store.partners();
    const out = new Set<number>();
    let frontier = [id];
    while (frontier.length) {
      const next = list.filter(x => x.parent_id != null && frontier.includes(x.parent_id) && !out.has(x.id)).map(x => x.id);
      next.forEach(n => out.add(n));
      frontier = next;
    }
    return [...out];
  }

  protected clear(): void { this.resetKey.update(v => v + 1); this.error.set(''); }
  protected cancel(): void { void this.router.navigate(this.partner() ? ['/contacts/master', this.partner()?.id] : ['/contacts/master']); }

  protected async save(): Promise<void> {
    this.error.set('');
    this.serverErrors.set({});
    const f = this.forms();
    if (!f.validate()) return this.error.set(this.i18n.tr('contacts.cm.fixErrors') + ' ' + f.firstError());
    const { id: _i, display_name: _d, commercial_partner_id: _c, ...draft } = f.current() as unknown as ResPartner;
    const d: PartnerDraft = { ...draft, name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim(), mobile: draft.mobile.trim(), website: draft.website.trim(), fax: draft.fax.trim() };
    this.busy.set(true);
    try {
      const p = this.partner();
      const saved = p ? await this.store.updatePartner(p.id, d) : await this.store.createPartner(d);
      this.toast.success(this.i18n.tr(p ? 'contacts.cm.updated' : 'contacts.cm.created', { name: saved.name }));
      this.leaving = true;
      await this.router.navigate(['/contacts/master', saved.id]);
    } catch (e) {
      if (e instanceof ApiError) { this.error.set(e.problem.detail ?? e.problem.title); this.serverErrors.set(Object.fromEntries((e.problem.errors ?? []).map(x => [x.field, x.message]))); }
      else this.error.set(this.i18n.tr('common.errorGeneric'));
    } finally { this.busy.set(false); }
  }
  protected readonly confirmLeave = this.dialogs;
}
