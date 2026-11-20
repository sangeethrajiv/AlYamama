import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MetadataFormComponent, type Rec, type ViewDef } from '@erp/web/metadata-forms';
import { AvatarComponent, CardComponent, DialogFrameComponent, DialogService, ErrorBannerComponent, IconComponent, PillComponent, ToastService, I18n } from '@erp/web/ui';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { viewChild } from '@angular/core';
import type { PartnerDraft, ResPartner } from '@erp/shared/contracts';
import { ContactsStore } from '../data/contacts.store';
import { PARTNER_TYPES, lookupOptions, nameOf } from '../models/options';
import { BLANK_PARTNER, EMAIL_RE, PHONE_RE } from '../views/partner.view';

const CHILD_VIEW: ViewDef = { entity: 'partner-child', type: 'form', sections: [{ id: 'c', columns: 2, fields: [
  { key: 'is_company', type: 'select', label: 'contacts.cm.f.kind', options: [{ value: false, label: 'contacts.cm.kind.individual' }, { value: true, label: 'contacts.cm.kind.company' }], translateOptions: true, emptyOption: false },
  { key: 'type', type: 'select', label: 'contacts.cm.f.type', options: PARTNER_TYPES.map(t => ({ value: t.id, label: t.labelKey })), translateOptions: true, emptyOption: false },
  { key: 'name', type: 'text', label: 'contacts.cm.f.name', required: true, span: 'full' },
  { key: 'function', type: 'text', label: 'contacts.cm.f.function', visible: v => v['is_company'] !== true },
  { key: 'email', type: 'text', label: 'contacts.cm.f.email', pattern: EMAIL_RE, patternMessage: 'contacts.cm.err.email' },
  { key: 'phone', type: 'tel', label: 'contacts.cm.f.phone', pattern: PHONE_RE, patternMessage: 'contacts.cm.err.phone' },
  { key: 'mobile', type: 'tel', label: 'contacts.cm.f.mobile', pattern: PHONE_RE, patternMessage: 'contacts.cm.err.mobile' },
  { key: 'street', type: 'text', label: 'contacts.cm.f.street', span: 'full' },
  { key: 'city', type: 'text', label: 'contacts.cm.f.city' }, { key: 'zip', type: 'text', label: 'contacts.cm.f.zip' },
  { key: 'country_id', type: 'many2one', label: 'contacts.cm.f.country', resource: 'countries', clears: ['state_id'] },
  { key: 'state_id', type: 'many2one', label: 'contacts.cm.f.state', options: (v, l) => (l['states'] ?? []).filter(o => o.group === v['country_id']), disabled: v => !v['country_id'] },
] }] };

export interface ChildDialogData { parent: ResPartner; child?: ResPartner; company?: boolean }

/** Add / edit one child contact or company of a parent. Written straight to the contact list (not held until the form saves). */
@Component({
  selector: 'erp-child-contact-dialog',
  imports: [DialogFrameComponent, MetadataFormComponent, ErrorBannerComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="title()">
      <div class="space-y-3"><erp-error-banner [text]="error()" /><erp-metadata-form [view]="view" [value]="seed" [lookups]="options()" /></div>
      <div footer class="contents">
        <button type="button" class="erp-btn-ghost" (click)="ref.close()">{{ 'common.cancel' | transloco }}</button>
        <button type="button" class="erp-btn-primary" (click)="save()">{{ (data.child ? 'common.save' : data.company ? 'contacts.cm.child.addCompany' : 'contacts.cm.child.addContact') | transloco }}</button>
      </div>
    </erp-dialog-frame>`,
})
export class ChildContactDialogComponent {
  protected readonly data = inject<ChildDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  private readonly store = inject(ContactsStore);
  private readonly i18n = inject(I18n);
  private readonly form = viewChild.required(MetadataFormComponent);
  protected readonly view = CHILD_VIEW;
  protected readonly error = signal('');
  protected readonly options = computed(() => { const l = this.store.lookups(); return { ...lookupOptions(l), states: l.states.map(s => ({ value: s.id, label: s.name, group: s.country_id })) }; });
  protected readonly seed: Rec = (this.data.child ?? { ...BLANK_PARTNER, is_company: !!this.data.company, street: this.data.parent.street, city: this.data.parent.city, zip: this.data.parent.zip, country_id: this.data.parent.country_id, state_id: this.data.parent.state_id }) as unknown as Rec;
  protected title(): string {
    const p = this.data.parent.name;
    return this.data.child ? this.i18n.tr('contacts.cm.child.edit', { name: this.data.child.name }) : this.data.company ? this.i18n.tr('contacts.cm.child.titleCompany', { name: p }) : this.i18n.tr('contacts.cm.child.titleContact', { name: p });
  }
  protected async save(): Promise<void> {
    const f = this.form();
    if (!f.validate()) return this.error.set(f.firstError());
    const v = f.current() as unknown as PartnerDraft;
    const clean = { ...v, name: v.name.trim() };
    const { parent, child } = this.data;
    if (child) {
      const { id: _i, display_name: _d, commercial_partner_id: _c, ...draft } = child;
      await this.store.updatePartner(child.id, { ...draft, ...clean });
      this.ref.close(this.i18n.tr('contacts.cm.updated', { name: clean.name }));
    } else {
      await this.store.createPartner({ ...BLANK_PARTNER, ...clean, parent_id: parent.id, company_id: parent.company_id, lang: parent.lang, tz: parent.tz });
      this.ref.close(this.i18n.tr('contacts.cm.child.added', { name: clean.name, parent: parent.name }));
    }
  }
}

/** "Contacts & Addresses" section of a company's edit form: children whose parent is this company. */
@Component({
  selector: 'erp-child-contacts',
  imports: [NgTemplateOutlet, TranslocoPipe, CardComponent, AvatarComponent, PillComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-card [title]="('contacts.cm.child.companies' | transloco) + ' (' + companies().length + ')'" [dense]="true">
      <button actions type="button" class="erp-btn-primary erp-btn-sm" (click)="openDialog(undefined, true)"><erp-icon name="plus" [size]="12" />{{ 'contacts.cm.child.addCompany' | transloco }}</button>
      <p class="mb-2 text-[11px] text-slate-400">{{ 'contacts.cm.child.hintCompanies' | transloco: { name: parent().name } }}</p>
      <ng-container [ngTemplateOutlet]="list" [ngTemplateOutletContext]="{ rows: companies(), empty: 'contacts.cm.child.noCompanies' }" />
    </erp-card>
    <div class="mt-3">
      <erp-card [title]="('contacts.cm.child.contacts' | transloco) + ' (' + people().length + ')'" [dense]="true">
        <button actions type="button" class="erp-btn-primary erp-btn-sm" (click)="openDialog(undefined, false)"><erp-icon name="plus" [size]="12" />{{ 'contacts.cm.child.addContact' | transloco }}</button>
        <p class="mb-2 text-[11px] text-slate-400">{{ 'contacts.cm.child.hintContacts' | transloco: { name: parent().name } }}</p>
        <ng-container [ngTemplateOutlet]="list" [ngTemplateOutletContext]="{ rows: people(), empty: 'contacts.cm.child.noContacts' }" />
      </erp-card>
    </div>
    <ng-template #list let-rows="rows" let-empty="empty">
      @if (rows.length === 0) { <div class="py-4 text-center text-xs text-slate-400">{{ empty | transloco }}</div> }
      @else {
        <ul class="divide-y divide-slate-100">
          @for (ch of rows; track ch.id) {
            <li class="flex items-center gap-2.5 py-1.5" [class.opacity-60]="!ch.active">
              <erp-avatar [name]="ch.name" [size]="28" [round]="!ch.is_company" />
              <span class="min-w-0 flex-1"><span class="block truncate text-xs font-bold text-slate-900">{{ ch.name }}</span><span class="block truncate text-[11px] text-slate-500">{{ sub(ch) }}</span></span>
              @if (ch.type !== 'contact') { <erp-pill tone="amber">{{ 'contacts.type.' + ch.type | transloco }}</erp-pill> }
              @if (!ch.active) { <erp-pill>{{ 'common.archived' | transloco }}</erp-pill> }
              <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700" [attr.aria-label]="'common.edit' | transloco" (click)="openDialog(ch)"><erp-icon name="pencil" [size]="13" /></button>
              @if (ch.active) { <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700" [attr.aria-label]="'contacts.cm.act.archive' | transloco" (click)="archive(ch)"><erp-icon name="archive" [size]="13" /></button> }
              @else { <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700" [attr.aria-label]="'contacts.cm.act.restore' | transloco" (click)="restore(ch)"><erp-icon name="archive-restore" [size]="13" /></button> }
            </li>
          }
        </ul>
      }
    </ng-template>`,
})
export class ChildContactsComponent {
  private readonly store = inject(ContactsStore);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);
  readonly parent = input.required<ResPartner>();

  private readonly all = computed(() => this.store.partners().filter(x => x.parent_id === this.parent().id).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)));
  protected readonly companies = computed(() => this.all().filter(x => x.is_company));
  protected readonly people = computed(() => this.all().filter(x => !x.is_company));

  protected sub(ch: ResPartner): string {
    const l = this.store.lookups();
    const first = ch.is_company ? [ch.city, nameOf(l.countries, ch.country_id)].filter(Boolean).join(', ') : ch.function;
    return [first, ch.email || ch.phone].filter(Boolean).join(' · ') || this.i18n.tr(`contacts.type.${ch.type}`);
  }
  protected async openDialog(child?: ResPartner, company?: boolean): Promise<void> {
    const ref = this.dialogs.open<ChildContactDialogComponent, ChildDialogData, string>(ChildContactDialogComponent, { data: { parent: this.parent(), child, company }, kind: 'modal-wide' });
    ref.closed.subscribe(msg => msg && this.toast.success(msg));
  }
  protected async archive(ch: ResPartner): Promise<void> {
    if (!(await this.dialogs.confirm({ title: this.i18n.tr('contacts.cm.archiveTitle', { name: ch.name }), message: this.i18n.tr('contacts.cm.child.archiveText'), confirmLabel: this.i18n.tr('contacts.cm.act.archive') }))) return;
    await this.store.setPartnerActive(ch.id, false);
    this.toast.success(this.i18n.tr('contacts.cm.archived', { name: ch.name }));
  }
  protected async restore(ch: ResPartner): Promise<void> {
    await this.store.setPartnerActive(ch.id, true);
    this.toast.success(this.i18n.tr('contacts.cm.restored', { name: ch.name }));
  }
}
