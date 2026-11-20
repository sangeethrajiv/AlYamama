import { ChangeDetectionStrategy, Component, computed, effect, inject, input, resource, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountingApi, ApiError, CatalogApi, ContactsApi, SystemApi } from '@erp/web/api-client';
import { CompanyContext, PermissionService, type HasUnsavedChanges } from '@erp/web/core';
import { MetadataFormComponent, type Option, type Rec } from '@erp/web/metadata-forms';
import { AmountPipe, ChatterComponent, DialogService, ErrorBannerComponent, IconComponent, StatusBadgeComponent, ToastService, I18n } from '@erp/web/ui';
import { PERM, type Bill, type InvoiceLine, type Payment } from '@erp/shared/contracts';
import { dec, gt, gte, todayIso, type Decimal } from '@erp/shared/utils';
import { InvoiceLinesEditorComponent } from '../components/invoice-lines-editor.component';
import { PaymentDialogComponent, type PaymentDialogData } from '../components/payment-dialog.component';
import { AccountingStore } from '../data/accounting.store';
import { blankLine, totalsOf } from '../models/invoice-math';
import { BILL_VIEW } from '../views/bill.view';

/** Vendor bill form: duplicate detection, approval thresholds (level 1 / level 2) and disbursement. */
@Component({
  selector: 'erp-bill-form-page',
  imports: [RouterLink, TranslocoPipe, MetadataFormComponent, InvoiceLinesEditorComponent, ChatterComponent, ErrorBannerComponent, IconComponent, StatusBadgeComponent, AmountPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ready()) {
      <div class="mx-auto max-w-5xl space-y-5 pb-20">
        <div>
          <nav class="mb-1 flex items-center gap-1 text-xs"><a routerLink="/accounting/bills" class="font-bold text-emerald-700 hover:underline">{{ 'accounting.bill.list.title' | transloco }}</a><erp-icon name="chevron-right" [size]="12" [flip]="true" class="text-slate-400" /></nav>
          <div class="flex flex-wrap items-center gap-2.5"><h1 class="font-display text-xl font-black tracking-tight text-slate-800">{{ bill() ? ('accounting.bill.title' | transloco) + ': ' + bill()!.number : ('accounting.bill.new' | transloco) }}</h1><erp-status-badge [state]="bill()?.state ?? 'draft'" />
            @if (bill()) { <erp-status-badge [state]="bill()!.approvalStatus" /> }</div>
          <p class="text-xs text-slate-500">{{ 'accounting.bill.subtitle' | transloco }}</p>
        </div>
        <erp-error-banner [text]="error()" />
        @if (isDuplicate()) {
          <div role="alert" class="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"><erp-icon name="alert-triangle" [size]="15" class="mt-0.5 shrink-0" />{{ 'accounting.bill.duplicate' | transloco: { vendor: header()['vendor'], ref: header()['supplierInvoiceNumber'] } }}</div>
        }
        @if (bill()?.approvalStatus === 'rejected' && bill()?.approvalRejectReason) { <div class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"><b>{{ 'accounting.bill.rejectedBecause' | transloco }}</b> {{ bill()!.approvalRejectReason }}</div> }
        @if (bill()?.interCompanyOrigin) { <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{{ 'accounting.bill.interCompany' | transloco }}: <b class="font-mono">{{ bill()!.interCompanyOrigin }}</b></div> }

        <erp-metadata-form [view]="view" [value]="seed()" [readonly]="!isDraft()" [lookups]="lookups()" layout="split" (valueChange)="onHeader($event)" />
        <div class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="border-b border-slate-200 pb-2 text-xs font-bold text-emerald-800">{{ 'accounting.bill.lines' | transloco }}</div>
          <erp-invoice-lines-editor [lines]="lines()" [editable]="isDraft()" [products]="[]" [analytic]="store.analyticAccounts()" (linesChange)="lines.set($event); dirty = true" />
          <div class="flex items-center gap-2 text-xs"><span class="font-medium text-slate-500">{{ 'accounting.invoice.attachments' | transloco }}</span><b class="font-mono">{{ attachments() }}</b>@if (isDraft()) { <button type="button" class="erp-btn-ghost erp-btn-sm" (click)="attachments.set(attachments() + 1)"><erp-icon name="plus" [size]="12" /></button> }</div>
        </div>
        <div class="ms-auto w-full max-w-xs space-y-1.5 rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-sm">
          <div class="flex justify-between"><span class="text-slate-500">{{ 'accounting.invoice.totals.untaxed' | transloco }}</span><b class="font-mono">{{ totals().untaxed | erpAmount }}</b></div>
          <div class="flex justify-between"><span class="text-slate-500">{{ 'accounting.invoice.totals.tax' | transloco }}</span><b class="font-mono">{{ totals().tax | erpAmount }}</b></div>
          <div class="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-slate-900"><span>{{ 'common.total' | transloco }}</span><span class="font-mono text-emerald-700">{{ totals().total | erpAmount }}</span></div>
          @if (isDraft() && approvalHint()) { <div class="pt-1 text-[10px] text-amber-700">{{ approvalHint() | transloco }}</div> }
        </div>
        @if (bill(); as b) { <erp-chatter recordType="Vendor Bill" [recordId]="b.id" [recordName]="b.number" [logs]="store.auditLogs()" [readonly]="!canNote()" (noteAdded)="postNote($event)" /> }
      </div>
      <div class="no-print fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur lg:ps-72">
        <button type="button" class="erp-btn-ghost" (click)="close()">{{ 'common.close' | transloco }}</button>
        @if (bill() && (bill()!.state === 'open' || bill()!.state === 'in_payment') && canWrite()) { <button type="button" class="erp-btn-primary" (click)="pay()">{{ 'accounting.bill.pay' | transloco }}</button> }
        @if (isDraft() && canWrite()) {
          <button type="button" class="erp-btn-ghost" [disabled]="busy()" (click)="save(false)">{{ 'accounting.invoice.saveDraft' | transloco }}</button>
          <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="save(true)">{{ 'accounting.bill.confirm' | transloco }}</button>
        }
      </div>
    } @else { <p class="py-10 text-center text-sm text-slate-400">{{ 'common.loading' | transloco }}</p> }`,
})
export class BillFormPage implements HasUnsavedChanges {
  protected readonly store = inject(AccountingStore);
  private readonly router = inject(Router);
  private readonly company = inject(CompanyContext);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionService);
  private readonly i18n = inject(I18n);
  private readonly accounting = inject(AccountingApi);
  private readonly contactsApi = inject(ContactsApi);
  private readonly systemApi = inject(SystemApi);
  private readonly form = viewChild(MetadataFormComponent);
  readonly id = input<string | undefined>(undefined);

  protected readonly view = BILL_VIEW;
  private readonly vendors = resource({ loader: () => this.contactsApi.directory() });
  private readonly currencies = resource({ loader: () => this.systemApi.currencies() });
  private readonly fiscal = resource({ params: () => this.company.activeId(), loader: ({ params }) => this.accounting.fiscalConfig(params) });
  protected readonly lookups = computed<Record<string, Option[]>>(() => ({
    vendors: (this.vendors.value() ?? []).filter(c => c.active && c.isVendor).map(c => ({ value: c.id, label: c.name })),
    currencies: (this.currencies.value() ?? []).map(c => ({ value: c.currency, label: `${c.currency} - ${c.name}` })),
  }));

  protected readonly bill = computed<Bill | undefined>(() => (this.id() ? this.store.billById(this.id() as string) : undefined));
  protected readonly seed = signal<Rec>({});
  protected readonly header = signal<Rec>({});
  protected readonly lines = signal<InvoiceLine[]>([]);
  protected readonly attachments = signal(1);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected dirty = false;
  private leaving = false;
  private loadedFor = '';
  private readonly loadedKey = signal('');
  protected readonly ready = computed(() => this.store.loaded() && this.loadedKey() !== '' && this.loadedKey() === (this.id() ?? 'new'));
  protected readonly isDraft = computed(() => !this.bill() || this.bill()?.state === 'draft');
  protected readonly canWrite = computed(() => this.perms.has(PERM.bill.write));
  protected readonly canNote = computed(() => this.perms.has(PERM.audit.note));
  protected readonly totals = computed(() => totalsOf(this.lines()));
  protected readonly isDuplicate = computed(() => {
    const v = String(this.header()['vendor'] ?? '').trim().toLowerCase();
    const r = String(this.header()['supplierInvoiceNumber'] ?? '').trim().toLowerCase();
    return !!v && !!r && this.store.bills().some(b => b.id !== this.bill()?.id && b.vendor.trim().toLowerCase() === v && b.supplierInvoiceNumber.trim().toLowerCase() === r);
  });
  /** Approval thresholds come from the company's fiscal settings (levels 1 and 2). */
  private approval(total: Decimal): Bill['approvalStatus'] {
    const f = this.fiscal.value();
    const l1 = f?.thresholdLevel1 ?? '50000.00';
    const l2 = f?.thresholdLevel2 ?? '200000.00';
    return gte(total, l2) ? 'pending_director' : gte(total, l1) ? 'pending_manager' : 'approved';
  }
  protected readonly approvalHint = computed(() => { const a = this.approval(this.totals().total); return a === 'pending_director' ? 'accounting.bill.needsDirector' : a === 'pending_manager' ? 'accounting.bill.needsManager' : ''; });

  constructor() {
    effect(() => {
      const key = this.id() ?? 'new';
      if (!this.store.loaded() || this.currencies.value() === undefined || this.vendors.value() === undefined) return;
      untracked(() => {
        if (this.id() && !this.bill()) return;
        if (this.loadedFor === key) return;
        this.init(key);
      });
    });
  }

  hasUnsavedChanges(): boolean { return !this.leaving && this.dirty; }

  private init(key: string): void {
    const b = this.bill();
    const today = todayIso();
    const base: Rec = b ? { ...(b as unknown as Rec) } : { vendor: '', vendorVat: '', supplierInvoiceNumber: '', dateBill: today, dateDue: today, paymentTerms: 'On Completion', currency: 'SAR' };
    this.seed.set(base);
    this.header.set(base);
    this.lines.set(b ? structuredClone(b.lines) : [blankLine()]);
    this.attachments.set(b?.attachmentsCount ?? 1);
    this.dirty = false;
    this.leaving = false;
    this.error.set('');
    this.loadedFor = key;
    this.loadedKey.set(key);
  }

  protected onHeader(rec: Rec): void {
    const prev = this.header();
    this.dirty = true;
    this.header.set(rec);
    if (rec['vendor'] !== prev['vendor'] && this.isDraft()) {
      const c = (this.vendors.value() ?? []).find(x => x.name === rec['vendor']);
      if (c?.vat) this.form()?.patchValue({ vendorVat: c.vat });
    }
  }

  protected async save(post: boolean): Promise<void> {
    this.error.set('');
    const f = this.form();
    if (f && !f.validate()) return this.error.set(f.firstError());
    const h = { ...this.header(), ...(f?.current() ?? {}) };
    const t = this.totals();
    if (!String(h['vendor'] ?? '').trim() || !String(h['supplierInvoiceNumber'] ?? '').trim() || !gt(t.total, '0')) return this.error.set(this.i18n.tr('accounting.bill.err.required'));
    const b = this.bill();
    const out: Bill = {
      ...(b ?? ({} as Bill)), id: b?.id ?? `bill_${Date.now()}`, number: b?.number ?? `BILL/2026/${1000 + Math.floor(Math.random() * 9000)}`, supplierInvoiceNumber: String(h['supplierInvoiceNumber']),
      companyId: b?.companyId ?? this.company.activeId(), vendor: String(h['vendor']).trim(), vendorVat: (h['vendorVat'] as string) || undefined, dateBill: String(h['dateBill']), dateDue: String(h['dateDue'] ?? h['dateBill']),
      paymentTerms: String(h['paymentTerms']), journalId: 'jour_purchase', currency: String(h['currency'] ?? 'SAR'), currencyRate: '1.000000', lines: this.lines(), amountUntaxed: t.untaxed, amountTax: t.tax, amountTotal: t.total,
      residual: b && b.state !== 'draft' ? b.residual : dec(t.total), state: post ? 'open' : (b?.state ?? 'draft'), approvalStatus: this.approval(t.total), type: b?.type ?? 'in_invoice', attachmentsCount: this.attachments(),
    };
    this.busy.set(true);
    try {
      const saved = await this.accounting.saveBill(out, { post });
      this.dirty = false;
      this.leaving = true;
      this.toast.success(this.i18n.tr('accounting.bill.saved', { n: saved.number }));
      void this.router.navigate(['/accounting/bills']);
    } catch (e) { this.error.set(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric')); }
    finally { this.busy.set(false); }
  }
  protected pay(): void { const b = this.bill(); if (b) this.dialogs.open<PaymentDialogComponent, PaymentDialogData, Payment>(PaymentDialogComponent, { data: { bill: b }, kind: 'modal' }); }
  protected async postNote(text: string): Promise<void> { const b = this.bill(); if (b) await this.accounting.postNote('Vendor Bill', b.id, b.number, text); }
  protected close(): void { this.leaving = !this.dirty; void this.router.navigate(['/accounting/bills']); }
}
void CatalogApi;
