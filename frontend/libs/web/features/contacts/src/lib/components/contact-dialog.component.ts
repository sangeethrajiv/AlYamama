import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '@erp/web/api-client';
import { MetadataFormComponent, type Rec } from '@erp/web/metadata-forms';
import { gt, sub, sum, type Decimal } from '@erp/shared/utils';
import { AvatarComponent, DialogFrameComponent, DialogService, ErrorBannerComponent, IconComponent, KpiComponent, MoneyPipe, PillComponent, StatusBadgeComponent, TabsComponent, DatePipe, I18n } from '@erp/web/ui';
import type { Contact, ContactAddress } from '@erp/shared/contracts';
import { ContactsStore } from '../data/contacts.store';
import { CONTACT_VIEW, blankContact } from '../views/contact.view';
import { ContactAddDialogComponent, type AddDialogData, type AddDialogResult } from './contact-add-dialog.component';

export interface ContactDialogData { contact?: Contact; readOnly: boolean }

const norm = (n: string) => n.toLowerCase().replace(/\(.*?\)/g, '').replace(/\b(co|company|ltd|limited|llc|est|inc|trading|the)\b\.?/g, '').replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
const isOpen = (s: string) => s === 'open' || s === 'in_payment';

/** Create / edit a contact of the directory: profile, tax identity, contacts & addresses, child companies, documents, notes. */
@Component({
  selector: 'erp-contact-dialog',
  imports: [TranslocoPipe, DialogFrameComponent, MetadataFormComponent, ErrorBannerComponent, TabsComponent, AvatarComponent, PillComponent, KpiComponent, IconComponent, MoneyPipe, DatePipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="isNew ? ('contacts.dir.newUser' | transloco) : (live().name || ('contacts.dir.user' | transloco))">
      <div class="space-y-4">
        <erp-error-banner [text]="error()" />
        @if (!active()) { <erp-pill tone="red">{{ 'common.archived' | transloco }}</erp-pill> }
        <erp-metadata-form [view]="view" [value]="seed" [readonly]="data.readOnly" [lookups]="lookups()" />

        <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <erp-tabs [tabs]="tabs()" [(active)]="tab" class="block bg-slate-50/70 px-2" />
          <div class="min-h-[140px] space-y-3 p-3 sm:p-4">
            @switch (tab()) {
              @case ('contacts') {
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-extrabold uppercase tracking-wide text-slate-800">{{ 'contacts.dir.contactsAddresses' | transloco }}</h3>
                  @if (!data.readOnly) { <button type="button" class="erp-btn-ghost erp-btn-sm" (click)="openAdd('person')"><erp-icon name="plus" [size]="12" />{{ 'contacts.dir.add' | transloco }}</button> }
                </div>
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  @for (p of people(); track p.id) {
                    <div class="flex gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5">
                      <erp-avatar [name]="p.name" [src]="p.image" [size]="38" [round]="true" />
                      <div class="min-w-0 text-xs"><div class="truncate font-bold text-slate-900">{{ p.title ? p.title + ' ' : '' }}{{ p.name }}</div>
                        @if (p.jobTitle) { <div class="truncate text-slate-500">{{ p.jobTitle }}</div> }
                        @if (p.email) { <div class="flex items-center gap-1 truncate text-emerald-700"><erp-icon name="mail" [size]="11" />{{ p.email }}</div> }
                        @if (p.mobile || p.phone) { <div class="flex items-center gap-1 font-mono text-slate-600"><erp-icon name="phone" [size]="11" />{{ p.mobile || p.phone }}</div> }</div>
                    </div>
                  }
                  @for (a of extra(); track a.id) {
                    <div class="relative rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-xs">
                      <erp-pill>{{ 'contacts.type.' + a.type | transloco }}</erp-pill>
                      <div class="mt-1 leading-snug text-slate-700">{{ addressLine(a) || '—' }}</div>
                      @if (!data.readOnly) { <button type="button" (click)="removeAddress(a.id)" [attr.aria-label]="'contacts.dir.removeAddress' | transloco" class="absolute end-2 top-2 text-slate-400 hover:text-rose-600"><erp-icon name="trash" [size]="13" /></button> }
                    </div>
                  }
                </div>
              }
              @case ('children') {
                @if (parentName()) { <p class="text-xs text-slate-600">{{ 'contacts.dir.belongsTo' | transloco }} <span class="font-bold">{{ parentName() }}</span>.</p> }
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-extrabold uppercase tracking-wide text-slate-800">{{ 'contacts.dir.childCompanies' | transloco }}</h3>
                  @if (!data.readOnly && live().kind === 'company') { <button type="button" class="erp-btn-ghost erp-btn-sm" (click)="openAdd('company')"><erp-icon name="plus" [size]="12" />{{ 'contacts.dir.add' | transloco }}</button> }
                </div>
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  @for (p of children(); track p.id) {
                    <div class="flex gap-2.5 rounded-lg border border-slate-200 p-2.5"><erp-avatar [name]="p.name" [src]="p.image" [size]="38" />
                      <div class="min-w-0 text-xs"><div class="truncate font-bold text-slate-900">{{ p.name }}</div><div class="truncate text-slate-500">{{ p.email || p.phone || '—' }}</div><div class="font-mono text-slate-400">{{ p.vat }}</div></div></div>
                  }
                </div>
                @if (live().kind === 'individual') { <p class="text-xs text-slate-400">{{ 'contacts.dir.childOnlyCompany' | transloco }}</p> }
              }
              @case ('invoices') {
                @if (isNew) { <p class="text-xs text-slate-500">{{ 'contacts.dir.saveFirst' | transloco }}</p> }
                @else {
                  @if (live().isCustomer && live().isVendor) {
                    <div class="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border px-3 py-2 text-xs" [class]="gt(receivable(), payable()) ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : gt(payable(), receivable()) ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'">
                      <span>{{ 'contacts.dir.theyOwe' | transloco }} <b class="font-mono">{{ receivable() | erpMoney }}</b></span>
                      <span>{{ 'contacts.dir.youOwe' | transloco }} <b class="font-mono">{{ payable() | erpMoney }}</b></span>
                      <span class="font-extrabold">{{ 'contacts.dir.net' | transloco }}: <span class="font-mono">{{ netAbs() | erpMoney }}</span></span>
                    </div>
                  }
                  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <erp-kpi [label]="'contacts.dir.kpi.invoices' | transloco" [value]="myInvoices().length" />
                    <erp-kpi [label]="'contacts.dir.kpi.invoiced' | transloco" [value]="billed() | erpMoney" />
                    <erp-kpi [label]="'contacts.dir.kpi.due' | transloco" [value]="receivable() | erpMoney" [tone]="gt(receivable(), '0') ? 'amber' : null" />
                    @if (live().isVendor) { <erp-kpi [label]="'contacts.dir.kpi.payable' | transloco" [value]="payable() | erpMoney" /> }
                  </div>
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-extrabold uppercase tracking-wide text-slate-800">{{ 'contacts.dir.customerInvoices' | transloco }}</h3>
                    <div class="flex gap-2">
                      @if (live().isVendor) { <button type="button" class="erp-btn-ghost erp-btn-sm" (click)="newBill()"><erp-icon name="receipt" [size]="13" />{{ 'contacts.dir.newBill' | transloco }}</button> }
                      <button type="button" class="erp-btn-primary erp-btn-sm" (click)="newInvoice()"><erp-icon name="file-text" [size]="13" />{{ 'contacts.dir.newInvoice' | transloco }}</button>
                    </div>
                  </div>
                  @if (myInvoices().length === 0) { <p class="text-xs text-slate-500">{{ 'contacts.dir.noInvoices' | transloco }}</p> }
                  @else {
                    <div class="overflow-x-auto rounded-lg border border-slate-200">
                      <table class="erp-table"><thead><tr><th>{{ 'contacts.dir.col.number' | transloco }}</th><th>{{ 'contacts.dir.col.type' | transloco }}</th><th>{{ 'common.date' | transloco }}</th><th>{{ 'contacts.dir.col.due' | transloco }}</th><th class="text-end">{{ 'common.total' | transloco }}</th><th class="text-end">{{ 'contacts.dir.kpi.due' | transloco }}</th><th>{{ 'common.status' | transloco }}</th></tr></thead>
                        <tbody>@for (i of myInvoices(); track i.id) {
                          <tr class="cursor-pointer" (click)="openInvoice(i.id)"><td class="font-bold text-emerald-700">{{ i.number }}</td><td class="capitalize">{{ i.category || 'credit' }}</td><td class="font-mono">{{ i.dateInvoice | erpDate }}</td><td class="font-mono">{{ i.dateDue | erpDate }}</td><td class="erp-num font-mono">{{ i.amountTotal | erpMoney }}</td><td class="erp-num font-mono">{{ gt(i.residual, '0') ? (i.residual | erpMoney) : '—' }}</td><td><erp-status-badge [state]="i.state" /></td></tr>
                        }</tbody></table>
                    </div>
                  }
                  @if (live().isVendor && myBills().length) {
                    <h3 class="pt-2 text-xs font-extrabold uppercase tracking-wide text-slate-800">{{ 'contacts.dir.vendorBills' | transloco }}</h3>
                    <ul class="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3 text-xs">
                      @for (b of myBills(); track b.id) { <li class="flex items-center justify-between gap-3 py-2"><span class="font-bold">{{ b.number }}</span><span class="font-mono text-slate-500">{{ b.dateBill | erpDate }}</span><erp-status-badge [state]="b.state" /><span class="font-mono">{{ b.amountTotal | erpMoney }}</span></li> }
                    </ul>
                  }
                }
              }
              @case ('notes') {
                <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'contacts.dir.notes' | transloco }}</span>
                  <textarea rows="8" class="erp-input resize-y" [disabled]="data.readOnly" [value]="notes()" (input)="notes.set($any($event.target).value)" [placeholder]="'contacts.dir.notesPlaceholder' | transloco"></textarea>
                  <span class="mt-1 block text-[10px] text-slate-400">{{ 'contacts.dir.notesHint' | transloco }}</span></label>
              }
            }
          </div>
        </section>
      </div>
      <div footer class="contents">
        @if (!isNew && !data.readOnly) {
          <button type="button" [class]="active() ? 'erp-btn-danger' : 'erp-btn-ghost'" (click)="toggleArchive()">{{ (active() ? 'contacts.dir.archive' : 'contacts.dir.restore') | transloco }}</button>
        }
        <button type="button" class="erp-btn-ghost" (click)="ref.close()">{{ (data.readOnly ? 'common.close' : 'common.cancel') | transloco }}</button>
        @if (!data.readOnly) { <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="save()">{{ 'contacts.dir.saveUser' | transloco }}</button> }
      </div>
    </erp-dialog-frame>`,
})
export class ContactDialogComponent {
  protected readonly data = inject<ContactDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<unknown>>(DialogRef);
  private readonly store = inject(ContactsStore);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  private readonly form = viewChild.required(MetadataFormComponent);

  protected readonly view = CONTACT_VIEW;
  protected readonly isNew = !this.data.contact;
  private readonly original = this.data.contact;
  protected readonly seed: Rec = { ...(this.original ?? blankContact({ isCustomer: true })), tagsText: (this.original?.tags ?? []).join(', ') } as unknown as Rec;

  protected readonly tab = signal('contacts');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly active = signal(this.original?.active ?? true);
  protected readonly notes = signal(this.original?.notes ?? '');
  protected readonly addresses = signal<ContactAddress[]>(this.original?.addresses ?? []);

  protected readonly live = computed(() => this.form().state() as unknown as Contact);
  protected readonly id = this.original?.id ?? '';
  protected readonly extra = computed(() => this.addresses().filter(a => a.type !== 'invoice'));
  protected readonly people = computed(() => this.store.contacts().filter(p => p.parentId === this.id && p.kind === 'individual'));
  protected readonly children = computed(() => this.store.contacts().filter(p => p.parentId === this.id && p.kind === 'company'));
  protected readonly parentName = computed(() => this.store.contacts().find(p => p.id === this.live().parentId)?.name);
  protected readonly lookups = computed(() => ({ companyContacts: this.store.contacts().filter(p => p.kind === 'company' && p.id !== this.id).map(p => ({ value: p.id, label: p.name })) }));

  private same(n: string): boolean { return n.trim().toLowerCase() === (this.original?.name ?? '').trim().toLowerCase(); }
  protected readonly myInvoices = computed(() => this.store.activity().invoices.filter(i => this.same(i.partner)));
  protected readonly myBills = computed(() => this.store.activity().bills.filter(b => this.same(b.vendor)));
  protected readonly receivable = computed<Decimal>(() => sum(this.myInvoices().filter(i => isOpen(i.state)).map(i => i.residual)));
  protected readonly payable = computed<Decimal>(() => sum(this.myBills().filter(b => isOpen(b.state)).map(b => b.residual)));
  protected readonly billed = computed<Decimal>(() => sum(this.myInvoices().filter(i => i.state !== 'cancel' && i.state !== 'draft' && i.category !== 'proforma').map(i => i.amountTotal)));
  protected readonly netAbs = computed<Decimal>(() => (gt(this.receivable(), this.payable()) ? sub(this.receivable(), this.payable()) : sub(this.payable(), this.receivable())));
  protected readonly tabs = computed(() => [
    { id: 'contacts', label: this.i18n.tr('contacts.dir.tab.contacts') }, { id: 'children', label: this.i18n.tr('contacts.dir.tab.children') },
    { id: 'invoices', label: this.i18n.tr(this.live().isCustomer && this.live().isVendor ? 'contacts.dir.tab.invoicesBills' : 'contacts.dir.tab.invoices') },
    { id: 'notes', label: this.i18n.tr('contacts.dir.tab.notes') },
  ]);
  protected readonly gt = gt;

  protected addressLine(a: ContactAddress): string {
    return [a.street, a.neighborhood, [a.city, a.zip].filter(Boolean).join(' '), a.region, a.country].filter(Boolean).join(', ');
  }
  protected removeAddress(id: string): void { this.addresses.update(l => l.filter(a => a.id !== id)); }

  protected async openAdd(kind: 'person' | 'company'): Promise<void> {
    const parent = { ...(this.original ?? (blankContact() as unknown as Contact)), ...(this.form().current() as unknown as Contact), id: this.id };
    const ref = this.dialogs.open<ContactAddDialogComponent, AddDialogData, AddDialogResult>(ContactAddDialogComponent, { data: { kind, parent, isNew: this.isNew }, kind: 'modal-wide' });
    const res = await firstValueFrom(ref.closed, { defaultValue: undefined });
    if (!res) return;
    if ('address' in res) this.addresses.update(l => [...l, res.address]);
    else await this.store.saveContact(res.contact);
  }

  protected newInvoice(): void { this.ref.close(); void this.router.navigate(['/accounting/invoices/new'], { queryParams: { partner: this.original?.name } }); }
  protected newBill(): void { this.ref.close(); void this.router.navigate(['/accounting/bills/new']); }
  protected openInvoice(id: string): void { this.ref.close(); void this.router.navigate(['/accounting/invoices', id]); }

  private validate(c: Contact): string {
    if (!c.isCustomer && !c.isVendor && !c.isEmployee && !c.isLogin && !c.otherKind && c.kind === 'company') return this.i18n.tr('contacts.err.role');
    return '';
  }

  protected async save(): Promise<void> {
    this.error.set('');
    const f = this.form();
    if (!f.validate()) return this.error.set(f.firstError());
    const rec = f.current() as Record<string, unknown>;
    const { tagsText, ...rest } = rec;
    const c = {
      ...(this.original ?? {}), ...rest, name: String(rest['name']).trim(), notes: this.notes(), addresses: this.addresses(), active: this.active(),
      tags: String(tagsText ?? '').split(',').map(x => x.trim()).filter(Boolean), otherKind: (rest['otherKind'] as Contact['otherKind']) || undefined,
      parentId: (rest['parentId'] as string) || undefined, title: (rest['title'] as string) || undefined,
    } as unknown as Contact;
    const e = this.validate(c);
    if (e) return this.error.set(e);
    // Documents link to a contact by exact name, so near-duplicates split the history: confirm first
    const nameChanged = !this.original || this.original.name.trim() !== c.name;
    const n = norm(c.name);
    const sim = nameChanged && n.length >= 4 ? this.store.contacts().find(o => { if (o.id === c.id || !o.active) return false; const m = norm(o.name); return m.length >= 4 && (m.includes(n) || n.includes(m)); }) : undefined;
    if (sim && !(await this.dialogs.confirm({ title: this.i18n.tr('contacts.dir.similarTitle'), message: this.i18n.tr('contacts.dir.similarText', { name: sim.name }), confirmLabel: this.i18n.tr('contacts.dir.saveSeparate') }))) return;
    this.busy.set(true);
    try { await this.store.saveContact(c); this.ref.close(true); }
    catch (err) { this.error.set(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : this.i18n.tr('common.errorGeneric')); }
    finally { this.busy.set(false); }
  }

  protected async toggleArchive(): Promise<void> {
    if (this.active() && !(await this.dialogs.confirm({ title: this.i18n.tr('contacts.dir.archiveTitle'), message: this.i18n.tr('contacts.dir.archiveText'), confirmLabel: this.i18n.tr('contacts.dir.archive'), danger: true }))) return;
    await this.store.archiveContact(this.id, !this.active());
    this.ref.close(true);
  }
}
