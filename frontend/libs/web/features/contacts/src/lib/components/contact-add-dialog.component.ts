import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { MetadataFormComponent, type Rec, type ViewDef } from '@erp/web/metadata-forms';
import { DialogFrameComponent, ErrorBannerComponent, I18n } from '@erp/web/ui';
import type { Contact, ContactAddress } from '@erp/shared/contracts';
import { TITLE_OPTIONS } from '../models/options';
import { EMAIL_RE, blankContact } from '../views/contact.view';

export interface AddDialogData { kind: 'person' | 'company'; parent: Contact; isNew: boolean }
export type AddDialogResult = { contact: Contact } | { address: ContactAddress };

const PERSON: ViewDef = { entity: 'contact-person', type: 'form', sections: [{ id: 'p', columns: 2, fields: [
  { key: 'name', type: 'text', label: 'contacts.add.userName', required: true, span: 'full' },
  { key: 'title', type: 'select', label: 'contacts.f.title', options: TITLE_OPTIONS.map(t => ({ value: t, label: t })) },
  { key: 'jobTitle', type: 'text', label: 'contacts.f.jobTitle', placeholder: 'contacts.f.jobTitlePlaceholder' },
  { key: 'companyCode', type: 'text', label: 'contacts.f.companyCode', mono: true },
  { key: 'email', type: 'text', label: 'contacts.f.email', pattern: EMAIL_RE, patternMessage: 'contacts.err.email' },
  { key: 'phone', type: 'tel', label: 'contacts.f.phone' }, { key: 'mobile', type: 'tel', label: 'contacts.f.mobile' }, { key: 'fax', type: 'tel', label: 'contacts.f.fax' },
  { key: 'notes', type: 'textarea', label: 'contacts.add.notes', span: 'full' },
] }] };
const COMPANY: ViewDef = { entity: 'contact-company', type: 'form', sections: [{ id: 'c', columns: 2, fields: [
  { key: 'name', type: 'text', label: 'contacts.add.companyName', required: true, span: 'full' },
  { key: 'vat', type: 'text', label: 'contacts.f.vat', mono: true, placeholder: 'contacts.f.vatPlaceholder', pattern: /^\d{15}$/, patternMessage: 'contacts.err.vat' },
  { key: 'website', type: 'text', label: 'contacts.f.website', placeholder: 'contacts.f.websitePlaceholder' },
  { key: 'email', type: 'text', label: 'contacts.f.email', pattern: EMAIL_RE, patternMessage: 'contacts.err.email' },
  { key: 'phone', type: 'tel', label: 'contacts.f.phone' }, { key: 'mobile', type: 'tel', label: 'contacts.f.mobile' },
  { key: 'notes', type: 'textarea', label: 'contacts.add.notes', span: 'full' },
] }] };
const ADDRESS: ViewDef = { entity: 'contact-address', type: 'form', sections: [{ id: 'a', title: 'contacts.add.address', columns: 2, fields: [
  { key: 'street', type: 'text', label: 'contacts.addr.street' }, { key: 'neighborhood', type: 'text', label: 'contacts.addr.neighborhood' },
  { key: 'streetAr', type: 'text', label: 'contacts.addr.streetAr', rtl: true }, { key: 'buildingNumber', type: 'text', label: 'contacts.addr.building', mono: true },
  { key: 'city', type: 'text', label: 'contacts.addr.city' }, { key: 'cityAr', type: 'text', label: 'contacts.addr.cityAr', rtl: true },
  { key: 'region', type: 'text', label: 'contacts.addr.region' }, { key: 'zip', type: 'text', label: 'contacts.addr.zip', mono: true },
  { key: 'country', type: 'text', label: 'contacts.addr.country' }, { key: 'plotId', type: 'text', label: 'contacts.addr.plot', mono: true },
] }] };

/** "Create User / Child Company / Address" dialog opened by the Add buttons of the contact form. */
@Component({
  selector: 'erp-contact-add-dialog',
  imports: [DialogFrameComponent, MetadataFormComponent, ErrorBannerComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="(data.kind === 'company' ? 'contacts.add.titleCompany' : 'contacts.add.titleUser') | transloco">
      <div class="space-y-3">
        <erp-error-banner [text]="error()" />
        @if (data.kind === 'person') {
          <select class="erp-input" [attr.aria-label]="'contacts.add.type' | transloco" [value]="type()" (change)="type.set($any($event.target).value); error.set('')">
            <option value="contact">{{ 'contacts.add.typeUser' | transloco }}</option><option value="delivery">{{ 'contacts.type.delivery' | transloco }}</option>
            <option value="other">{{ 'contacts.type.other' | transloco }}</option><option value="private">{{ 'contacts.type.private' | transloco }}</option>
          </select>
        }
        @for (k of [type()]; track k) { <erp-metadata-form [view]="view()" [value]="seed()" /> }
      </div>
      <div footer class="contents">
        <button type="button" class="erp-btn-primary" (click)="save()">{{ 'common.save' | transloco }}</button>
        <button type="button" class="erp-btn-ghost" (click)="ref.close()">{{ 'common.discard' | transloco }}</button>
      </div>
    </erp-dialog-frame>`,
})
export class ContactAddDialogComponent {
  protected readonly data = inject<AddDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<AddDialogResult>>(DialogRef);
  private readonly i18n = inject(I18n);
  private readonly form = viewChild.required(MetadataFormComponent);

  protected readonly type = signal<'contact' | 'delivery' | 'other' | 'private'>('contact');
  protected readonly error = signal('');
  protected readonly seed = signal<Rec>({ country: 'Saudi Arabia' });
  protected readonly isAddress = computed(() => this.data.kind === 'person' && this.type() !== 'contact');
  protected readonly view = computed(() => (this.data.kind === 'company' ? COMPANY : this.isAddress() ? ADDRESS : PERSON));

  protected save(): void {
    const f = this.form();
    if (this.isAddress()) {
      const v = f.current() as Record<string, string>;
      if (!(v['street'] ?? '').trim() && !(v['city'] ?? '').trim()) return this.error.set(this.i18n.tr('contacts.add.err.address'));
      const address: ContactAddress = { id: `ad_${Date.now()}`, type: this.type() as ContactAddress['type'], street: v['street'] ?? '', city: v['city'] ?? '', region: v['region'] ?? '', zip: v['zip'] ?? '', country: v['country'] ?? '', neighborhood: v['neighborhood'] || undefined, streetAr: v['streetAr'] || undefined, cityAr: v['cityAr'] || undefined, buildingNumber: v['buildingNumber'] || undefined, plotId: v['plotId'] || undefined };
      return this.ref.close({ address });
    }
    if (this.data.isNew) return this.error.set(this.i18n.tr('contacts.add.err.saveFirst'));
    if (!f.validate()) return this.error.set(f.firstError());
    const v = f.current() as Record<string, string | null>;
    const p = this.data.parent;
    const s = (k: string) => (v[k] ?? '') as string;
    const contact = blankContact({
      kind: this.data.kind === 'company' ? 'company' : 'individual', name: s('name').trim(), parentId: p.id, isCustomer: p.isCustomer, isVendor: p.isVendor,
      title: s('title') || undefined, jobTitle: s('jobTitle') || undefined, companyCode: s('companyCode') || undefined, email: s('email'), phone: s('phone'), mobile: s('mobile'),
      fax: s('fax') || undefined, website: s('website'), vat: s('vat'), notes: s('notes'), addresses: [],
    }) as unknown as Contact;
    this.ref.close({ contact });
  }
}
