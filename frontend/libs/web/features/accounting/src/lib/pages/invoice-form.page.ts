import { ChangeDetectionStrategy, Component, computed, effect, inject, input, resource, signal, untracked, viewChildren } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError, CatalogApi, ContactsApi, SystemApi } from '@erp/web/api-client';
import { CompanyContext, PermissionService, type HasUnsavedChanges } from '@erp/web/core';
import { MetadataFormComponent, type Option, type Rec } from '@erp/web/metadata-forms';
import { AmountPipe, ChatterComponent, DialogService, DocumentActionBarComponent, ErrorBannerComponent, IconComponent, MoneyPipe, StatusBadgeComponent, TabsComponent, ToastService, type ActionItem, I18n } from '@erp/web/ui';
import { PERM, type CreditNoteOptions, type Invoice, type InvoiceCategory, type InvoiceLine, type InvoiceVehicle, type Payment } from '@erp/shared/contracts';
import { dec, div, gt, max, mul, sub, sum, toNumber, todayIso, type Decimal } from '@erp/shared/utils';
import { InvoiceLinesEditorComponent } from '../components/invoice-lines-editor.component';
import { InvoiceNextStepsComponent } from '../components/invoice-next-steps.component';
import { InvoicePdfDialogComponent, type PdfDialogData } from '../components/invoice-pdf-dialog.component';
import { PaymentDialogComponent, type PaymentDialogData } from '../components/payment-dialog.component';
import { AccountingStore } from '../data/accounting.store';
import { CATEGORY_LABEL_KEY, blankLine, totalsOf } from '../models/invoice-math';
import { PROFORMA_INVOICE_VIEW, PROGRESSIVE_INVOICE_VIEW, STANDARD_INVOICE_VIEW, VEHICLES_VIEW } from '../views/invoice.views';

const HEADER_KEYS = [
  'partner', 'customerVat', 'customerAddress', 'contactPerson', 'project', 'paymentTerms', 'showDiscount', 'vendorProjectName', 'prNumber', 'poNumber', 'invoiceDateWithTime',
  'dateInvoice', 'dateDue', 'salesperson', 'equipmentGroupTask', 'sourceDocument', 'salesTeam', 'currency', 'currencyRate', 'companySeal', 'showOutFromStock', 'isProgressive',
  'isSubscriptionInvoice', 'noOfSubscriptionItems', 'subscriptionFrequency', 'subscriptionType', 'subscriptionStartDate', 'subscriptionEndDate', 'subscriptionAlertDate',
  'billingEmail', 'advPercentage', 'poName', 'poDescription', 'contractAmount', 'linkedInvoice',
] as const;
const TERMS: Record<InvoiceCategory, string> = { cash: 'Immediate Payment', credit: '15 Days Net', proforma: 'Advance / Proforma', progressive: '30 Days Net' };

/** Customer invoice form (cash, credit, proforma and progressive). Header via metadata, lines via a purpose-built editor. */
@Component({
  selector: 'erp-invoice-form-page',
  imports: [RouterLink, TranslocoPipe, MetadataFormComponent, InvoiceLinesEditorComponent, InvoiceNextStepsComponent, ChatterComponent, DocumentActionBarComponent, ErrorBannerComponent, IconComponent, StatusBadgeComponent, TabsComponent, AmountPipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ready()) {
      <div class="mx-auto max-w-5xl space-y-5 pb-20">
        <div class="flex items-start justify-between gap-3">
          <div>
            <nav class="mb-1 flex items-center gap-1 text-xs"><a routerLink="/accounting/invoices" class="font-bold text-emerald-700 hover:underline">{{ 'accounting.invoice.list.title' | transloco }}</a><erp-icon name="chevron-right" [size]="12" [flip]="true" class="text-slate-400" /></nav>
            <div class="flex flex-wrap items-center gap-2.5">
              <h1 class="font-display text-xl font-black tracking-tight text-slate-800">{{ title() }}</h1>
              <erp-status-badge [state]="inv()?.state ?? 'draft'" />
            </div>
            <p class="text-xs text-slate-500">{{ 'accounting.invoice.subtitle' | transloco }}</p>
          </div>
        </div>
        <erp-error-banner [text]="error()" />

        <erp-document-action-bar [items]="actionItems()" />

        @if (showNextSteps()) {
          <erp-invoice-next-steps [invoice]="inv()!" [hideCreditNote]="category() === 'progressive'" [customer]="customerSnapshot()"
            (registerPayment)="registerPayment()" (creditNote)="createCreditNote($event)" (submitZatca)="submitZatca()" />
        }

        @if (showTypePicker()) {
          <div class="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{{ 'accounting.invoice.selectType' | transloco }}</div>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              @for (c of categories; track c) {
                <button type="button" [disabled]="!isDraft()" (click)="setCategory(c)" class="flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-bold transition disabled:opacity-60"
                  [class]="category() === c ? (c === 'cash' ? 'border-emerald-600 bg-emerald-600 text-white' : c === 'progressive' ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-600 bg-slate-600 text-white') : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'">{{ typeKey(c) | transloco }}</button>
              }
            </div>
          </div>
        }

        @switch (category()) {
          @case ('progressive') {
            <div class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="flex items-center justify-between"><div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ 'accounting.invoice.sec.progressivePo' | transloco }}</div>
                <ol class="flex items-center gap-2 text-[11px] font-semibold">@for (s of ['draft', 'approved']; track s; let i = $index) { <li class="flex items-center gap-2"><span class="rounded-full px-2.5 py-1 capitalize" [class]="progressiveStatus() === s ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'">{{ 'status.' + s | transloco }}</span>@if (i === 0) { <span class="text-slate-300">→</span> }</li> }</ol></div>
              <erp-metadata-form [view]="views.progressive" [value]="seed()" [readonly]="!isDraft() || progressiveStatus() === 'approved'" [lookups]="lookups()" (valueChange)="onHeader($event)" />
              <div class="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
                <div><div class="text-[10px] font-bold uppercase text-slate-400">{{ 'accounting.invoice.linkedInvoices' | transloco }}</div><div class="font-mono font-bold text-slate-900">{{ linked().length }}</div></div>
                <div><div class="text-[10px] font-bold uppercase text-slate-400">{{ 'accounting.invoice.billed' | transloco }}</div><div class="font-mono font-bold text-slate-900">{{ billed() | erpMoney }}</div></div>
                <div><div class="text-[10px] font-bold uppercase text-slate-400">{{ 'accounting.invoice.balance' | transloco }}</div><div class="font-mono font-bold" [class]="balanceNegative() ? 'text-rose-600' : 'text-slate-800'">{{ balance() | erpMoney }}</div></div>
              </div>
            </div>
          }
          @case ('proforma') {
            <div class="space-y-3">
              <div class="flex items-center justify-end"><ol class="flex items-center gap-2 text-[11px] font-semibold">@for (s of ['pending', 'invoiced']; track s; let i = $index) { <li class="flex items-center gap-2"><span class="rounded-full px-2.5 py-1" [class]="(inv()?.linkedInvoice ? 'invoiced' : 'pending') === s ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'">{{ 'accounting.invoice.proformaStatus.' + s | transloco }}</span>@if (i === 0) { <span class="text-slate-300">→</span> }</li> }</ol></div>
              <erp-metadata-form [view]="views.proforma" [value]="seed()" [readonly]="!isDraft()" [lookups]="lookups()" (valueChange)="onHeader($event)" />
              <div class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="border-b border-slate-200 pb-2 text-xs font-bold text-emerald-800">{{ 'accounting.invoice.proformaLines' | transloco }}</div>
                <erp-invoice-lines-editor mode="proforma" [lines]="lines()" [editable]="isDraft()" [products]="products()" [analytic]="store.analyticAccounts()" [stock]="stock()" (linesChange)="lines.set($event)" />
              </div>
            </div>
          }
          @default {
            <erp-metadata-form [view]="views.standard" [value]="seed()" [readonly]="!isDraft()" [lookups]="lookups()" layout="split" (valueChange)="onHeader($event)" />
            <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <erp-tabs [tabs]="tabs()" [(active)]="tab" />
              @switch (tab()) {
                @case ('lines') { <erp-invoice-lines-editor [lines]="lines()" [editable]="isDraft()" [products]="products()" [analytic]="store.analyticAccounts()" [stock]="stock()" (linesChange)="lines.set($event)" /> }
                @case ('other') {
                  <dl class="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
                    <div><dt class="block font-medium text-slate-500">{{ 'accounting.invoice.other.journal' | transloco }}</dt><dd class="font-bold text-slate-800">{{ category() === 'cash' ? 'Cash Invoices (Cash)' : 'Customer Invoices (Sale)' }}</dd></div>
                    <div><dt class="block font-medium text-slate-500">{{ 'accounting.invoice.other.account' | transloco }}</dt><dd class="font-bold text-slate-800">479100 Revenue (Product Sales &amp; Service)</dd></div>
                    <div><dt class="block font-medium text-slate-500">{{ 'accounting.invoice.other.fiscalPosition' | transloco }}</dt><dd class="text-slate-700">Saudi Arabia National Tax (15%)</dd></div>
                    <div><dt class="block font-medium text-slate-500">{{ 'accounting.invoice.other.zatcaState' | transloco }}</dt><dd class="font-semibold" [class]="inv()?.zatca ? 'text-emerald-700' : 'text-amber-700'">{{ inv()?.zatca ? ('accounting.invoice.other.cleared' | transloco: { n: inv()?.zatca?.chainIndex }) : ('accounting.next.notSubmitted' | transloco) }}</dd></div>
                    <div class="col-span-2 flex items-center gap-2"><dt class="font-medium text-slate-500">{{ 'accounting.invoice.attachments' | transloco }}</dt><dd class="font-mono font-bold">{{ attachments() }}</dd>@if (isDraft()) { <button type="button" class="erp-btn-ghost erp-btn-sm" (click)="attachments.set(attachments() + 1)"><erp-icon name="plus" [size]="12" /></button> }</div>
                  </dl>
                }
                @case ('vehicles') { @for (k of [vehiclesKey()]; track k) { <erp-metadata-form [view]="views.vehicles" [value]="vehiclesSeed()" [readonly]="!isDraft()" (valueChange)="onVehicles($event)" /> } }
              }
            </div>
          }
        }

        <div class="ms-auto w-full max-w-xs space-y-1.5 rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-sm">
          <div class="flex justify-between"><span class="text-slate-500">{{ 'accounting.invoice.totals.untaxed' | transloco }}</span><b class="font-mono">{{ totals().untaxed | erpAmount: currency() }}</b></div>
          @if (category() !== 'progressive') { <div class="flex justify-between"><span class="text-slate-500">{{ 'accounting.invoice.totals.tax' | transloco }}</span><b class="font-mono">{{ totals().tax | erpAmount: currency() }}</b></div> }
          <div class="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-slate-900"><span>{{ 'common.total' | transloco }}</span><span class="font-mono text-emerald-700">{{ totals().total | erpAmount: currency() }}</span></div>
          @if (currency() !== 'SAR') { <div class="text-end text-[10px] text-slate-400">≈ {{ inBase() | erpAmount }}</div> }
        </div>

        @if (inv() && inv()!.state !== 'draft') {
          <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between"><span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ 'accounting.invoice.payments.title' | transloco }}</span>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-bold" [class]="isSettled() ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'">{{ (isSettled() ? 'accounting.invoice.payments.settled' : 'accounting.invoice.payments.open') | transloco }}</span></div>
            <div class="flex justify-between text-xs"><span>{{ 'accounting.invoice.payments.settledAmount' | transloco }} <b class="font-mono text-slate-800">{{ settled() | erpAmount: inv()!.currency }}</b></span><span>{{ 'accounting.next.amountDue' | transloco }} <b class="font-mono text-slate-800">{{ inv()!.residual | erpAmount: inv()!.currency }}</b></span></div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" [attr.aria-valuenow]="settledPct()" aria-valuemin="0" aria-valuemax="100"><div class="h-full bg-emerald-500 transition-all" [style.width.%]="settledPct()"></div></div>
            @if (invPayments().length === 0) { <p class="text-xs text-slate-400">{{ 'accounting.invoice.payments.none' | transloco }}</p> }
            @else {
              <ul class="divide-y divide-slate-100 text-xs">
                @for (p of invPayments(); track p.id) {
                  <li class="flex items-center justify-between gap-3 py-2"><span><b class="font-mono">{{ p.paymentNumber }}</b> <span class="text-slate-400">· {{ p.paymentDate }} · {{ p.journalName }}</span></span>
                    <span class="flex items-center gap-2"><b class="font-mono">{{ appliedTo(p) | erpAmount: inv()!.currency }}</b>
                      @if (canWrite()) { <button type="button" class="rounded px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50" (click)="unreconcile(p)">{{ 'accounting.invoice.payments.unreconcile' | transloco }}</button> }</span></li>
                }
              </ul>
            }
          </section>
        }

        @if (inv(); as i) { <erp-chatter recordType="Invoice" [recordId]="i.id" [recordName]="i.number" [logs]="store.auditLogs()" [readonly]="!canNote()" (noteAdded)="postNote($event)" /> }
      </div>

      <div class="no-print fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur lg:ps-72">
        <button type="button" class="erp-btn-ghost" (click)="close()">{{ 'common.close' | transloco }}</button>
        @if (isDraft() && canWrite() && inv()?.state !== 'cancel') {
          <button type="button" class="erp-btn-ghost" [disabled]="busy()" (click)="save(false)">{{ (category() === 'proforma' ? 'common.save' : 'accounting.invoice.saveDraft') | transloco }}</button>
          @if (category() !== 'proforma' && category() !== 'progressive' && canValidate()) { <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="save(true)">{{ 'accounting.invoice.validate' | transloco }}</button> }
        }
      </div>
    } @else {
      <p class="py-10 text-center text-sm text-slate-400">{{ 'common.loading' | transloco }}</p>
    }`,
})
export class InvoiceFormPage implements HasUnsavedChanges {
  protected readonly store = inject(AccountingStore);
  private readonly router = inject(Router);
  private readonly company = inject(CompanyContext);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionService);
  private readonly i18n = inject(I18n);
  private readonly contactsApi = inject(ContactsApi);
  private readonly systemApi = inject(SystemApi);
  private readonly catalog = inject(CatalogApi);
  private readonly forms = viewChildren(MetadataFormComponent);

  /** Route param (`invoices/:id`); absent on `invoices/new`. */
  readonly id = input<string | undefined>(undefined);
  /** Query params for `invoices/new`. */
  readonly categoryParam = input<string | undefined>(undefined, { alias: 'category' });
  readonly partnerParam = input<string | undefined>(undefined, { alias: 'partner' });

  protected readonly views = { standard: STANDARD_INVOICE_VIEW, proforma: PROFORMA_INVOICE_VIEW, progressive: PROGRESSIVE_INVOICE_VIEW, vehicles: VEHICLES_VIEW };
  protected readonly categories: InvoiceCategory[] = ['cash', 'credit', 'proforma', 'progressive'];
  protected readonly typeKey = (c: InvoiceCategory) => CATEGORY_LABEL_KEY[c];

  private readonly customers = resource({ loader: () => this.contactsApi.directory() });
  private readonly currencies = resource({ loader: () => this.systemApi.currencies() });
  private readonly catalogRes = resource({ loader: async () => ({ products: await this.catalog.products(), stock: await this.catalog.stockBySku() }) });
  protected readonly products = computed(() => this.catalogRes.value()?.products ?? []);
  protected readonly stock = computed(() => this.catalogRes.value()?.stock ?? {});
  protected readonly lookups = computed<Record<string, Option[]>>(() => ({
    customers: (this.customers.value() ?? []).filter(c => c.active && c.isCustomer).map(c => ({ value: c.id, label: c.name })),
    currencies: (this.currencies.value() ?? []).map(c => ({ value: c.currency, label: `${c.currency} - ${c.name}` })),
  }));

  // ---- document state
  protected readonly inv = computed<Invoice | undefined>(() => (this.id() ? this.store.invoiceById(this.id() as string) : undefined));
  protected readonly category = signal<InvoiceCategory>('credit');
  protected readonly seed = signal<Rec>({});
  protected readonly header = signal<Rec>({});
  protected readonly lines = signal<InvoiceLine[]>([]);
  protected readonly vehicles = signal<InvoiceVehicle[]>([]);
  protected readonly vehiclesSeed = signal<Rec>({ vehicles: [] });
  protected readonly vehiclesKey = signal(0);
  protected readonly attachments = signal(1);
  protected readonly tab = signal('lines');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  private dirty = false;
  private loadedFor = '';
  private leaving = false;

  private readonly loadedKey = signal('');
  private readonly currentKey = computed(() => `${this.id() ?? 'new'}|${this.categoryParam() ?? ''}|${this.partnerParam() ?? ''}`);
  protected readonly ready = computed(() => this.store.loaded() && this.loadedKey() === this.currentKey());

  protected readonly isDraft = computed(() => !this.inv() || this.inv()?.state === 'draft');
  protected readonly showTypePicker = computed(() => !this.inv() && !this.categoryParam());
  protected readonly canWrite = computed(() => this.perms.has(PERM.invoice.write));
  protected readonly canValidate = computed(() => this.perms.has(PERM.invoice.validate));
  protected readonly canNote = computed(() => this.perms.has(PERM.audit.note));
  protected readonly typeLabel = computed(() => this.i18n.tr(CATEGORY_LABEL_KEY[this.category()]));
  protected readonly title = computed(() => {
    const i = this.inv();
    return i ? `${this.typeLabel()}: ${i.number}` : this.showTypePicker() ? this.i18n.tr('accounting.invoice.newCustomerInvoice') : this.i18n.tr('accounting.invoice.newTyped', { type: this.typeLabel() });
  });
  protected readonly tabs = computed(() => [
    { id: 'lines', label: this.i18n.tr('accounting.invoice.tab.lines') }, { id: 'other', label: this.i18n.tr('accounting.invoice.tab.other') },
    { id: 'vehicles', label: this.i18n.tr('accounting.invoice.tab.vehicles'), count: this.vehicles().length },
  ]);

  protected readonly currency = computed(() => String(this.header()['currency'] ?? 'SAR'));
  protected readonly isProgressive = computed(() => this.category() === 'progressive');
  protected readonly poTotal = computed<Decimal>(() => String(this.header()['contractAmount'] ?? '0.00') || '0.00');
  protected readonly totals = computed(() => {
    if (this.isProgressive()) { const p = dec(/^-?\d+(\.\d+)?$/.test(this.poTotal()) ? this.poTotal() : '0'); return { withoutDiscount: p, discount: '0.00', untaxed: p, tax: '0.00', total: p }; }
    return totalsOf(this.lines());
  });
  protected readonly inBase = computed(() => mul(this.totals().total, String(this.header()['currencyRate'] ?? '1')));
  protected readonly progressiveStatus = computed(() => this.inv()?.progressiveStatus ?? 'draft');
  protected readonly linked = computed(() => { const i = this.inv(); return i ? this.store.invoices().filter(x => x.id !== i.id && x.sourceDocument === i.number && x.state !== 'cancel') : []; });
  protected readonly billed = computed<Decimal>(() => sum([...this.linked().map(i => i.amountTotal), this.inv()?.previouslyBilled ?? '0']));
  protected readonly balance = computed<Decimal>(() => sub(this.poTotal() || '0', this.billed()));
  protected readonly balanceNegative = computed(() => gt('0', this.balance()));

  protected readonly invPayments = computed(() => { const i = this.inv(); return i ? this.store.payments().filter(p => p.matchedInvoiceIds?.includes(i.id)) : []; });
  protected readonly settled = computed(() => { const i = this.inv(); return i ? max('0.00', sub(i.amountTotal, i.residual)) : '0.00'; });
  protected readonly settledPct = computed(() => { const i = this.inv(); return i && gt(i.amountTotal, '0') ? Math.min(100, toNumber(div(mul(this.settled(), '100'), i.amountTotal, 4))) : 0; });
  protected readonly isSettled = computed(() => !!this.inv() && !gt(this.inv()?.residual ?? '0', '0'));
  protected readonly showNextSteps = computed(() => { const i = this.inv(); return !!i && this.category() !== 'proforma' && ['open', 'in_payment', 'paid'].includes(i.state) && i.type !== 'out_refund' && this.canWrite(); });
  protected readonly customerSnapshot = computed(() => ({ name: String(this.header()['partner'] ?? ''), vat: String(this.header()['customerVat'] ?? ''), address: String(this.header()['customerAddress'] ?? '') }));

  protected readonly actionItems = computed<ActionItem[]>(() => {
    const i = this.inv();
    if (i?.state === 'cancel' || !this.canWrite()) return [];
    const cancel: ActionItem = { id: 'cancel', label: this.i18n.tr('accounting.invoice.act.cancel'), kind: 'danger', run: () => void this.cancelInvoice() };
    const source = i?.sourceProformaId ? this.store.invoiceById(i.sourceProformaId) : undefined;
    if (this.category() === 'proforma') {
      if (!i) return [];
      const invoiced = !!i.linkedInvoice;
      return [...(invoiced ? [] : [{ id: 'renew', label: this.i18n.tr('accounting.invoice.act.renew'), kind: 'primary' as const, run: () => void this.renew() }]), { id: 'print', label: this.i18n.tr('accounting.invoice.act.printProforma'), run: () => this.print(i, true) }, ...(invoiced ? [] : [cancel])];
    }
    if (this.category() === 'progressive') {
      const validated = !!i && i.state !== 'draft';
      return [...(validated || !this.canValidate() ? [] : [{ id: 'validate', label: this.i18n.tr('accounting.invoice.validate'), kind: 'primary' as const, run: () => void this.save(true, true) }]),
        { id: 'preview', label: this.i18n.tr('accounting.invoice.act.preview'), run: i ? () => this.print(i) : undefined, title: i ? undefined : this.i18n.tr('accounting.invoice.act.saveFirst') }, cancel];
    }
    if (source) return [...(i?.state === 'draft' && this.canValidate() ? [{ id: 'validate', label: this.i18n.tr('accounting.invoice.validate'), kind: 'primary' as const, run: () => void this.save(true) }] : []), { id: 'print', label: this.i18n.tr('accounting.invoice.act.printProforma'), run: () => this.print(source, true) }, cancel];
    return [];
  });

  constructor() {
    effect(() => {
      // Re-initialise whenever a different document (or a brand-new one) is opened
      const key = this.currentKey();
      if (!this.store.loaded() || this.currencies.value() === undefined || this.customers.value() === undefined) return;
      untracked(() => {
        const live = this.inv();
        if (this.id() && !live) return;
        if (this.loadedFor === key && this.id()) { this.refreshFromStore(); return; }
        if (this.loadedFor === key) return;
        this.initialise(key);
      });
    });
  }

  hasUnsavedChanges(): boolean { return !this.leaving && this.dirty; }

  // ------------------------------------------------------------------ initialisation
  private initialise(key: string): void {
    const i = this.inv();
    const requested = (this.categoryParam() as InvoiceCategory | undefined) ?? 'credit';
    const cat: InvoiceCategory = i?.category ?? (this.categories.includes(requested) ? requested : 'credit');
    const today = todayIso();
    const customer = !i && this.partnerParam() ? (this.customers.value() ?? []).find(c => c.name === this.partnerParam()) : undefined;
    this.category.set(cat);
    const base: Rec = i ? { ...(i as unknown as Rec) } : {
      partner: this.partnerParam() ?? '', customerVat: customer?.vat ?? '', customerAddress: customer ? this.addressOf(customer) : '', paymentTerms: TERMS[cat], dateInvoice: today, dateDue: today, currency: 'SAR', currencyRate: '1.000000',
      showDiscount: false, companySeal: true, showOutFromStock: false, isProgressive: cat === 'progressive', isSubscriptionInvoice: false, noOfSubscriptionItems: 0, subscriptionFrequency: 'One Year', subscriptionType: 'Vehicle Subscription',
      poNumber: '', prNumber: '', advPercentage: '0.00', contractAmount: '0.00', poName: '', poDescription: '', salesperson: '', project: '', contactPerson: '',
    };
    if (i) { base['poName'] = i.poName ?? i.reference ?? ''; base['contractAmount'] = i.contractAmount ?? '0.00'; }
    this.seed.set(base);
    this.header.set(base);
    this.lines.set(i ? structuredClone(i.lines) : [blankLine(cat === 'proforma' ? { subscriptionType: 'Vehicle Subscription', subscriptions: 1, frequency: 'One Year' } : {})]);
    this.vehicles.set(i?.vehicles ? structuredClone(i.vehicles) : []);
    this.vehiclesSeed.set({ vehicles: structuredClone(i?.vehicles ?? []) });
    this.vehiclesKey.update(v => v + 1);
    this.attachments.set(i?.attachmentsCount ?? 1);
    this.error.set('');
    this.dirty = false;
    this.leaving = false;
    this.loadedFor = key;
    this.loadedKey.set(key);
  }

  /** The record changed behind us (payment registered, posted, reconciled): refresh what the server owns. */
  private refreshFromStore(): void {
    const i = this.inv();
    if (!i) return;
    if (this.isDraft() && this.dirty) return;
    this.seed.set({ ...(i as unknown as Rec), poName: i.poName ?? i.reference ?? '', contractAmount: i.contractAmount ?? '0.00' });
    if (!this.dirty) { this.lines.set(structuredClone(i.lines)); this.header.set(this.seed()); }
  }

  private addressOf(c: { addresses: { type: string; street: string; city: string; zip: string; region: string; country: string }[] }): string {
    const a = c.addresses.find(x => x.type === 'invoice') || c.addresses[0];
    return a ? [a.street, [a.city, a.zip].filter(Boolean).join(' '), a.region, a.country].filter(Boolean).join('\n') : '';
  }

  // ------------------------------------------------------------------ editing
  protected setCategory(c: InvoiceCategory): void {
    if (!this.isDraft()) return;
    this.category.set(c);
    this.dirty = true;
    const patch: Rec = { paymentTerms: TERMS[c], isProgressive: c === 'progressive' };
    if (c === 'cash') patch['dateDue'] = this.header()['dateInvoice'];
    this.seed.set({ ...this.header(), ...patch });
    this.header.set(this.seed());
    this.lines.set(this.lines().map(l => l));
  }

  protected onHeader(rec: Rec): void {
    const prev = this.header();
    this.dirty = true;
    this.error.set('');
    this.header.set(rec);
    const form = this.forms()[0];
    if (rec['partner'] !== prev['partner'] && this.isDraft()) {
      const c = (this.customers.value() ?? []).find(x => x.name === rec['partner']);
      if (c) form?.patchValue({ ...(c.vat ? { customerVat: c.vat } : {}), ...(this.addressOf(c) ? { customerAddress: this.addressOf(c) } : {}) });
    }
    if (rec['currency'] !== prev['currency']) {
      const m = (this.currencies.value() ?? []).find(c => c.currency === rec['currency']);
      if (m) form?.patchValue({ currencyRate: m.rateToBase });
    }
  }
  protected onVehicles(rec: Rec): void { this.dirty = true; this.vehicles.set((rec['vehicles'] as InvoiceVehicle[]) ?? []); }

  // ------------------------------------------------------------------ build + save
  private build(post: boolean, approve: boolean): Invoice | null {
    const form = this.forms()[0];
    if (form && !form.validate()) { this.error.set(form.firstError()); return null; }
    const h = { ...this.header(), ...(form?.current() ?? {}) };
    const cat = this.category();
    const i = this.inv();
    const partner = String(h['partner'] ?? '').trim();
    if (cat === 'progressive') {
      if (!partner || !String(h['poName'] ?? '').trim() || !gt(this.poTotal() || '0', '0')) { this.error.set(this.i18n.tr('accounting.invoice.err.progressive')); return null; }
    } else if (!partner || !gt(this.totals().total, '0')) { this.error.set(this.i18n.tr('accounting.invoice.err.lines')); return null; }
    const po = dec(this.poTotal() || '0');
    const saveLines: InvoiceLine[] = cat === 'progressive'
      ? [{ id: i?.lines[0]?.id || 'ln_po', product: 'PO', description: String(h['poName']), quantity: '1.0000', unitPrice: po, taxRate: '0.0000', taxesApplied: 'No tax', discount: '0.00', subtotal: po, taxAmount: '0.00', total: po }]
      : this.lines();
    const tot = this.totals();
    const stamp = 1000 + Math.floor(Math.random() * 9000);
    const prefix = { cash: 'CSH', proforma: 'PRO', progressive: 'PRG', credit: 'INV' }[cat];
    const g = (k: string) => (h[k] === null || h[k] === undefined ? undefined : h[k]);
    const out: Invoice = {
      ...(i ?? ({} as Invoice)),
      id: i?.id ?? `inv_${Date.now()}`, number: i?.number ?? `${prefix}/2026/${stamp}`, companyId: i?.companyId ?? this.company.activeId(), partner,
      customerAddress: g('customerAddress') as string | undefined, customerVat: g('customerVat') as string | undefined, project: g('project') as string | undefined, contactPerson: g('contactPerson') as string | undefined,
      paymentTerms: String(h['paymentTerms'] ?? TERMS[cat]), showDiscount: !!h['showDiscount'], vendorProjectName: g('vendorProjectName') as string | undefined, prNumber: g('prNumber') as string | undefined, poNumber: g('poNumber') as string | undefined,
      isSubscriptionInvoice: !!h['isSubscriptionInvoice'], noOfSubscriptionItems: Number(h['noOfSubscriptionItems'] ?? 0), subscriptionFrequency: g('subscriptionFrequency') as string | undefined, subscriptionType: g('subscriptionType') as string | undefined,
      subscriptionStartDate: g('subscriptionStartDate') as string | undefined, subscriptionEndDate: g('subscriptionEndDate') as string | undefined, subscriptionAlertDate: g('subscriptionAlertDate') as string | undefined,
      billingEmail: cat === 'proforma' ? (g('billingEmail') as string | undefined) : i?.billingEmail, advPercentage: cat === 'proforma' ? dec(String(h['advPercentage'] ?? '0')) : i?.advPercentage,
      invoiceDateWithTime: g('invoiceDateWithTime') as string | undefined, dateInvoice: String(h['dateInvoice'] ?? todayIso()), dateDue: String(h['dateDue'] ?? h['dateInvoice'] ?? todayIso()),
      salesperson: g('salesperson') as string | undefined, equipmentGroupTask: g('equipmentGroupTask') as string | undefined, sourceDocument: g('sourceDocument') as string | undefined, companySeal: !!h['companySeal'],
      showOutFromStock: !!h['showOutFromStock'], isProgressive: cat === 'progressive' || !!h['isProgressive'], salesTeam: g('salesTeam') as string | undefined, currency: String(h['currency'] ?? 'SAR'), currencyRate: String(h['currencyRate'] ?? '1.000000'),
      journalId: cat === 'cash' ? 'jour_cash' : 'jour_sale', reference: String(h['sourceDocument'] || h['poNumber'] || '') || undefined, lines: saveLines,
      amountWithoutDiscount: cat === 'progressive' ? po : tot.withoutDiscount, discountTotal: cat === 'progressive' ? '0.00' : tot.discount, amountUntaxed: tot.untaxed, amountTax: tot.tax, amountTotal: tot.total,
      residual: post ? tot.total : (i?.residual ?? tot.total), poName: cat === 'progressive' ? String(h['poName']) : i?.poName, poDescription: cat === 'progressive' ? (g('poDescription') as string | undefined) : i?.poDescription,
      contractAmount: cat === 'progressive' ? po : i?.contractAmount, progressiveStatus: cat === 'progressive' ? (approve ? 'approved' : this.progressiveStatus()) : i?.progressiveStatus,
      state: post ? 'open' : (i?.state ?? 'draft'), category: cat, approvalStatus: 'approved', type: 'out_invoice', attachmentsCount: this.attachments(), vehicles: this.vehicles(),
    };
    return out;
  }

  protected async save(post: boolean, approve = false): Promise<void> {
    this.error.set('');
    const out = this.build(post, approve);
    if (!out) return;
    this.busy.set(true);
    try {
      const saved = await this.store.api.saveInvoice(out, { post });
      this.dirty = false;
      this.toast.success(this.i18n.tr(post ? 'accounting.invoice.posted' : 'accounting.invoice.saved', { n: saved.number }));
      // Stay on the document: it now shows as Open with its next steps (or reload the draft by id)
      if (!this.id()) { this.leaving = true; await this.router.navigate(['/accounting/invoices', saved.id], { replaceUrl: true }); }
      else { this.loadedFor = ''; this.initialise(`${saved.id}|${this.categoryParam() ?? ''}|${this.partnerParam() ?? ''}`); }
    } catch (e) { this.error.set(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric')); }
    finally { this.busy.set(false); }
  }

  // ------------------------------------------------------------------ document actions
  private async guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try { return await fn(); } catch (e) { this.error.set(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric')); return undefined; }
  }
  protected async cancelInvoice(): Promise<void> {
    const i = this.inv();
    if (!i || !(await this.dialogs.confirm({ title: this.i18n.tr('accounting.invoice.cancelTitle', { n: i.number }), message: this.i18n.tr('accounting.invoice.cancelText'), confirmLabel: this.i18n.tr('accounting.invoice.act.cancel'), danger: true }))) return;
    if (await this.guard(() => this.store.api.cancelInvoice(i.id))) { this.toast.success(this.i18n.tr('accounting.invoice.cancelled', { n: i.number })); void this.close(); }
  }
  protected async renew(): Promise<void> {
    const i = this.inv();
    const copy = i && (await this.guard(() => this.store.api.renewProforma(i.id)));
    if (copy) { this.leaving = true; void this.router.navigate(['/accounting/invoices', copy.id], { queryParams: { category: 'credit' } }); }
  }
  protected registerPayment(): void { const i = this.inv(); if (i) this.dialogs.open<PaymentDialogComponent, PaymentDialogData, Payment>(PaymentDialogComponent, { data: { invoice: i }, kind: 'modal' }); }
  protected async createCreditNote(opts: CreditNoteOptions): Promise<void> {
    const i = this.inv();
    const res = i && (await this.guard(() => this.store.api.createCreditNote(i.id, opts)));
    if (!res) return;
    this.toast.success(this.i18n.tr('accounting.invoice.creditNoteIssued', { n: res.creditNote.number }));
    if (res.redraft) { this.leaving = true; void this.router.navigate(['/accounting/invoices', res.redraft.id]); }
  }
  protected async submitZatca(): Promise<void> { const i = this.inv(); if (i && (await this.guard(() => this.store.api.submitZatca(i.id)))) this.toast.success(this.i18n.tr('accounting.invoice.zatcaCleared')); }
  protected async unreconcile(p: Payment): Promise<void> {
    const i = this.inv();
    if (!i || !(await this.dialogs.confirm({ title: this.i18n.tr('accounting.invoice.payments.unreconcileTitle', { n: p.paymentNumber }), message: this.i18n.tr('accounting.invoice.payments.unreconcileText'), confirmLabel: this.i18n.tr('accounting.invoice.payments.unreconcile'), danger: true }))) return;
    await this.guard(() => this.store.api.unreconcile(i.id, p.id));
  }
  protected appliedTo = (p: Payment): Decimal => { const i = this.inv(); return p.allocations?.find(a => a.invoiceId === i?.id)?.amount ?? (i && gt(p.amount, i.amountTotal) ? i.amountTotal : p.amount); };
  protected print(i: Invoice, autoPrint = false): void { this.dialogs.open<InvoicePdfDialogComponent, PdfDialogData>(InvoicePdfDialogComponent, { data: { invoice: i, autoPrint }, kind: 'modal-wide' }); }
  protected async postNote(text: string): Promise<void> { const i = this.inv(); if (i) await this.store.api.postNote('Invoice', i.id, i.number, text); }
  protected close(): void { this.leaving = this.leaving || !this.dirty; void this.router.navigate(['/accounting/invoices']); }
}
