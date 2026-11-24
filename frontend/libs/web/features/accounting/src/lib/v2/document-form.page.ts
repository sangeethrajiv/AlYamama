import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PermissionService } from '@erp/web/core';
import { PERM } from '@erp/shared/contracts';
import { AccountingBackend } from '@erp/web/api-client';
import { MetadataFormComponent, type FieldDef, type Rec, type ViewDef } from '@erp/web/metadata-forms';
import { DialogService, DocumentActionBarComponent, ErrorBannerComponent, IconComponent, PillComponent, SelectComponent, ToastService, type ActionItem } from '@erp/web/ui';
import { FormsModule } from '@angular/forms';
import { isRefundType, isSaleType, kindOf, refundKindFor } from './kinds';
import { LinesEditorComponent, type LineColumn, type Row } from './lines-editor.component';
import { pillText, pillTone, toForm } from './resource-spec';
import { RecordExtrasComponent } from './record-extras.component';

const today = () => new Date().toISOString().slice(0, 10);
const n = (v: unknown) => Number(v) || 0;

/**
 * Invoice, vendor bill, credit note or refund (one DocKind). Header through the metadata form with searchable
 * dropdowns, lines through the lines editor. Posting, approval, payment and credit notes are actions on the document.
 * Route data: `{ kind }`; the `:id` param is `id` ('new' for a blank document).
 */
@Component({
  selector: 'erp-document-form-page',
  imports: [RouterLink, FormsModule, MetadataFormComponent, LinesEditorComponent, DocumentActionBarComponent, ErrorBannerComponent, IconComponent, PillComponent, SelectComponent, RecordExtrasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-6xl space-y-4 pb-24">
      <div>
        <nav class="mb-1 flex items-center gap-1 text-xs"><a [routerLink]="['/accounting', k().path]" class="font-bold text-emerald-700 hover:underline">{{ k().title }}</a><erp-icon name="chevron-right" [size]="12" [flip]="true" class="text-slate-400" /></nav>
        <div class="flex flex-wrap items-center gap-2.5">
          <h1 class="font-display text-xl font-black tracking-tight text-slate-800">{{ heading() }}</h1>
          @if (!isNew()) {
            <erp-pill [tone]="tone(str(doc()['state']))">{{ pretty(str(doc()['state'])) }}</erp-pill>
            @if (doc()['state'] === 'posted') { <erp-pill [tone]="tone(str(doc()['payment_state']))">{{ pretty(str(doc()['payment_state'])) }}</erp-pill> }
            @if (doc()['request_status'] && doc()['request_status'] !== 'not_required') { <erp-pill [tone]="tone(str(doc()['request_status']))">{{ pretty(str(doc()['request_status'])) }}</erp-pill> }
            @if (category() !== 'credit' && isSale()) { <erp-pill tone="blue">{{ category() }}</erp-pill> }
          }
        </div>
        @if (doc()['reject_reason']) { <p class="mt-1 text-xs text-rose-600">Rejected: {{ doc()['reject_reason'] }}</p> }
      </div>
      <erp-error-banner [text]="error()" />
      <erp-document-action-bar [items]="items()" />

      @if (panel() === 'reject') {
        <div class="flex flex-wrap items-end gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <label class="block flex-1 text-[11px] font-bold text-slate-600">Reason for rejection<input class="erp-input mt-1" [value]="reason()" (input)="reason.set($any($event.target).value)" /></label>
          <button type="button" class="erp-btn-primary" (click)="reject()">Reject bill</button><button type="button" class="erp-btn-ghost" (click)="panel.set('')">Back</button>
        </div>
      }
      @if (panel() === 'pay') {
        <div class="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 sm:grid-cols-4">
          <label class="block text-[11px] font-bold text-slate-600">Journal<erp-select class="mt-1" [(ngModel)]="payJournal" [search]="payJournals" [labelHint]="payJournalLabel()" placeholder="Bank or cash journal" /></label>
          <label class="block text-[11px] font-bold text-slate-600">Amount<input class="erp-input mt-1 text-end font-mono" [value]="payAmount()" (input)="payAmount.set($any($event.target).value)" /></label>
          <label class="block text-[11px] font-bold text-slate-600">Payment Date<input type="date" class="erp-input mt-1" [value]="payDate()" (input)="payDate.set($any($event.target).value)" /></label>
          <label class="block text-[11px] font-bold text-slate-600">Memo<input class="erp-input mt-1" [value]="payMemo()" (input)="payMemo.set($any($event.target).value)" /></label>
          <div class="flex gap-2 sm:col-span-4"><button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="registerPayment()">Validate payment</button><button type="button" class="erp-btn-ghost" (click)="panel.set('')">Back</button></div>
        </div>
      }
      @if (panel() === 'progress') {
        <div class="flex flex-wrap items-end gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
          <label class="block text-[11px] font-bold text-slate-600">Billed to date (%)<input class="erp-input mt-1 w-32 text-end font-mono" [value]="progressPct()" (input)="progressPct.set($any($event.target).value)" /></label>
          <label class="block text-[11px] font-bold text-slate-600">Retainage (%)<input class="erp-input mt-1 w-32 text-end font-mono" [value]="retainPct()" (input)="retainPct.set($any($event.target).value)" /></label>
          <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="nextProgressive()">Create invoice</button><button type="button" class="erp-btn-ghost" (click)="panel.set('')">Back</button>
        </div>
      }

      @if (ready()) {
        <erp-metadata-form [view]="view()" [value]="form()" [readonly]="locked()" layout="split" (valueChange)="onHeader($event)" />
        <section class="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <h3 class="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Invoice Lines</h3>
          <erp-lines-editor [columns]="columns()" [rows]="lines()" [readonly]="locked()" [newRow]="newLine" (rowsChange)="setLines($event)" />
        </section>
        <div class="ms-auto w-full max-w-xs space-y-1.5 rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-sm">
          <div class="flex justify-between"><span class="text-slate-500">Untaxed Amount</span><b class="font-mono">{{ figures().untaxed }}</b></div>
          <div class="flex justify-between"><span class="text-slate-500">Taxes</span><b class="font-mono">{{ figures().tax }}</b></div>
          <div class="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-slate-900"><span>Total</span><span class="font-mono text-emerald-700">{{ figures().total }}</span></div>
          @if (doc()['state'] === 'posted') { <div class="flex justify-between text-sm font-bold"><span>Amount Due</span><span class="font-mono" [class]="num(doc()['amount_residual']) > 0 ? 'text-rose-600' : 'text-emerald-700'">{{ str(doc()['amount_residual']) }}</span></div> }
        </div>

        @if (settled().length) {
          <section class="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <h3 class="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Reconciled With</h3>
            <table class="erp-table w-full">
              <thead><tr><th>Entry</th><th>Payment</th><th>Journal</th><th>Date</th><th class="text-end">Amount</th><th></th></tr></thead>
              <tbody>
                @for (s of settled(); track s['reconcile_id']) {
                  <tr>
                    <td class="font-mono font-bold">{{ s['move_name'] }}</td><td>{{ s['payment_name'] ?? '' }}</td><td>{{ s['journal_name'] }}</td><td>{{ str(s['date']).slice(0, 10) }}</td>
                    <td class="text-end font-mono">{{ s['amount'] }}</td>
                    <td class="text-end"><button type="button" class="rounded px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50" [disabled]="busy()" (click)="unreconcile(s)">Unreconcile</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }
      }

      @if (credits().length && canPay()) {
        <section class="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <h3 class="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Outstanding {{ creditWord() }}</h3>
          <p class="text-[11px] text-slate-500">Payments and credit notes of this partner that are not matched yet. Add one to settle this {{ isSale() ? 'invoice' : 'bill' }}.</p>
          <table class="erp-table w-full">
            <thead><tr><th>Entry</th><th>Date</th><th>Label</th><th class="text-end">Open</th><th></th></tr></thead>
            <tbody>
              @for (c of credits(); track c['id']) {
                <tr><td class="font-mono font-bold">{{ c['move_name'] }}</td><td>{{ str(c['date']).slice(0, 10) }}</td><td>{{ c['name'] ?? '' }}</td><td class="text-end font-mono">{{ abs(c['amount_residual']) }}</td>
                  <td class="text-end"><button type="button" class="erp-btn-primary erp-btn-sm" [disabled]="busy()" (click)="addCredit(c)">Add</button></td></tr>
              }
            </tbody>
          </table>
        </section>
      }

      @if (doc()['state'] === 'posted' && entryLines().length) {
        <section class="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <h3 class="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Journal Items · {{ str(doc()['name']) }}</h3>
          <div class="overflow-x-auto"><table class="erp-table w-full">
            <thead><tr><th>Account</th><th>Partner</th><th>Label</th><th class="text-end">Debit</th><th class="text-end">Credit</th><th class="text-end">Open</th><th>Matching</th></tr></thead>
            <tbody>
              @for (l of entryLines(); track l['id']) {
                <tr><td class="font-mono">{{ nameOf(l['account_id']) }}</td><td>{{ nameOf(l['partner_id']) }}</td><td>{{ l['name'] ?? '' }}</td>
                  <td class="text-end font-mono">{{ money(l['debit']) }}</td><td class="text-end font-mono">{{ money(l['credit']) }}</td>
                  <td class="text-end font-mono">{{ l['exclude_from_invoice_tab'] && !l['tax_line_id'] ? money(l['amount_residual']) : '' }}</td>
                  <td>@if (l['full_reconcile_id']) { <erp-pill tone="green">A{{ l['full_reconcile_id'] }}</erp-pill> } @else if (l['exclude_from_invoice_tab'] && !l['tax_line_id'] && num(l['amount_residual']) !== num(l['balance'])) { <erp-pill tone="amber">partial</erp-pill> }</td></tr>
              }
            </tbody>
            <tfoot><tr class="bg-slate-50 font-bold"><td colspan="3">Total</td><td class="text-end font-mono">{{ sumOf('debit') }}</td><td class="text-end font-mono">{{ sumOf('credit') }}</td><td colspan="2"></td></tr></tfoot>
          </table></div>
        </section>
      }

      @if (!isNew() && ready()) { <erp-record-extras model="account.move" [recordId]="docId()" [canWrite]="canWrite()" /> }

      @if (!locked() && ready()) {
        <div class="no-print fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur lg:ps-72">
          <button type="button" class="erp-btn-ghost" (click)="back()">Close</button>
          <button type="button" class="erp-btn-ghost" [disabled]="busy()" (click)="save()">{{ isNew() ? 'Save as draft' : 'Save' }}</button>
          @if (category() !== 'proforma' && canPost()) { <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="validate()">{{ isSale() ? 'Validate' : 'Post' }}</button> }
        </div>
      }
    </div>`,
})
export class DocumentFormPage {
  private readonly ab = inject(AccountingBackend);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly perms = inject(PermissionService);

  readonly kind = input.required<string>();
  /** Route param. Absent (`undefined`) on the `/new` route, because component input binding resets inputs the route lacks. */
  readonly id = input<string | undefined>(undefined);
  protected readonly k = computed(() => kindOf(this.kind()));
  protected readonly isSale = computed(() => isSaleType(this.k().moveType));
  protected readonly isNew = computed(() => !this.id() || this.id() === 'new');

  protected readonly doc = signal<Row>({});
  protected readonly form = signal<Row>({});
  private readonly draft = signal<Row>({});
  protected readonly lines = signal<Row[]>([]);
  protected readonly dirtyLines = signal(false);
  protected readonly settled = signal<Row[]>([]);
  /** Every line of the saved entry (the Journal Items table) and the open credits that could settle this document. */
  protected readonly entryLines = signal<Row[]>([]);
  protected readonly credits = signal<Row[]>([]);
  private ownLineIds: number[] = [];
  protected readonly ready = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly panel = signal<'' | 'pay' | 'reject' | 'progress'>('');
  protected readonly reason = signal('');
  private readonly meta = viewChild(MetadataFormComponent);
  /** Company defaults used to pre-fill a new line: income/expense account and default tax. */
  private defaults: { account: number | null; tax: number | null } = { account: null, tax: null };

  // payment panel
  protected payJournal: number | null = null;
  protected readonly payJournalLabel = signal('');
  protected readonly payAmount = signal('');
  protected readonly payDate = signal(today());
  protected readonly payMemo = signal('');
  protected readonly payJournals = this.ab.lookup('journals', { type: 'bank,cash' });
  // progressive panel
  protected readonly progressPct = signal('');
  protected readonly retainPct = signal('');

  // who may do what (UI only; the stub backend does not enforce roles yet)
  private readonly writePerm = computed(() => (this.isSale() ? PERM.invoice.write : PERM.bill.write));
  protected readonly canWrite = computed(() => this.perms.has(this.writePerm()));
  private readonly ok = (p: string) => this.perms.has(p as never);
  protected readonly canPay = computed(() => this.perms.has(PERM.payment.write));
  protected readonly canPost = computed(() => this.perms.has(this.isSale() ? PERM.invoice.validate : PERM.bill.write));
  protected readonly docId = computed(() => Number(this.id()) || 0);

  protected readonly category = computed(() => String(this.doc()['invoice_category'] ?? this.k().category ?? 'credit'));
  protected readonly locked = computed(() => (!this.isNew() && this.doc()['state'] !== 'draft') || !this.canWrite());
  protected readonly heading = computed(() => {
    if (this.isNew()) return `New ${this.k().singular}`;
    const name = String(this.doc()['name'] ?? '');
    return name && name !== '/' ? name : `Draft ${this.k().singular}`;
  });
  protected readonly untaxed = computed(() => this.lines().reduce((t, r) => t + n(r['quantity']) * n(r['price_unit']) * (1 - n(r['discount']) / 100), 0).toFixed(2));
  /** Tax and total of the document as it is on screen: the saved ones when nothing was touched, otherwise a server preview. */
  protected readonly preview = signal<Row | null>(null);
  protected readonly figures = computed(() => {
    const showSaved = !this.isNew() && (this.locked() || !this.dirtyLines());
    const src = showSaved ? this.doc() : this.preview();
    return { untaxed: src ? String(src['amount_untaxed'] ?? this.untaxed()) : this.untaxed(), tax: src ? String(src['amount_tax'] ?? '') : '…', total: src ? String(src['amount_total'] ?? '') : '…' };
  });
  private previewTimer: ReturnType<typeof setTimeout> | undefined;

  protected tone = pillTone;
  protected pretty = pillText;
  protected str = (v: unknown) => String(v ?? '');
  protected num = n;
  protected abs = (v: unknown) => Math.abs(n(v)).toFixed(2);
  protected money = (v: unknown) => n(v).toFixed(2);
  protected nameOf = (v: unknown) => (v && typeof v === 'object' ? String((v as { name?: string }).name ?? '') : '');
  protected sumOf = (k: string) => this.entryLines().reduce((t, l) => t + n(l[k]), 0).toFixed(2);
  protected readonly creditWord = computed(() => (this.isSale() ? (isRefundType(this.k().moveType) ? 'debits' : 'credits') : (isRefundType(this.k().moveType) ? 'credits' : 'debits')));

  protected readonly view = computed<ViewDef>(() => ({ entity: 'document', type: 'form', sections: [
    { id: 'left', column: 1, columns: 1, fields: this.leftFields() }, { id: 'right', column: 2, columns: 1, fields: this.rightFields() },
    { id: 'foot', column: 1, columns: 1, fields: [{ key: 'narration', type: 'textarea', label: 'Terms and Conditions', span: 'full' }] },
  ] }));

  private readonly leftFields = computed<FieldDef[]>(() => {
    const sale = this.isSale();
    const f: FieldDef[] = [
      { key: 'partner_id', type: 'many2one', label: sale ? 'Customer' : 'Vendor', required: true, search: this.ab.lookup('partners') },
      { key: 'journal_id', type: 'many2one', label: 'Journal', required: true, emptyOption: false, search: this.ab.lookup('journals', { type: sale ? 'sale' : 'purchase' }) },
    ];
    if (this.kind() === 'customer-invoices') f.push({ key: 'invoice_category', type: 'select', label: 'Invoice Type', emptyOption: false, options: [{ value: 'credit', label: 'Credit' }, { value: 'cash', label: 'Cash' }, { value: 'proforma', label: 'Proforma' }] });
    f.push({ key: 'invoice_payment_term_id', type: 'many2one', label: 'Payment Terms', search: this.ab.lookup('paymentTerms') });
    f.push({ key: 'ref', type: 'text', label: sale ? 'Reference' : 'Vendor Reference' });
    f.push({ key: 'invoice_origin', type: 'text', label: 'Source Document' });
    if (this.k().category === 'progressive') {
      f.push({ key: 'contract_amount', type: 'money', label: 'Contract Amount' });
      f.push({ key: 'progress_percentage', type: 'money', label: 'Billed to Date (%)', places: 2 });
    }
    return f;
  });
  private readonly rightFields = computed<FieldDef[]>(() => {
    const sale = this.isSale();
    const f: FieldDef[] = [
      { key: 'invoice_date', type: 'date', label: sale ? 'Invoice Date' : 'Bill Date' },
      { key: 'invoice_date_due', type: 'date', label: 'Due Date', hint: 'Left empty, it follows the payment terms.' },
      { key: 'date', type: 'date', label: 'Accounting Date', required: true },
      { key: 'currency_id', type: 'many2one', label: 'Currency', search: this.ab.lookup('currencies') },
      { key: 'fiscal_position_id', type: 'many2one', label: 'Fiscal Position', search: this.ab.lookup('fiscalPositions') },
      { key: 'po_number', type: 'text', label: 'PO Number' },
    ];
    if (sale) { f.push({ key: 'client_order_ref', type: 'text', label: 'Customer Reference' }); f.push({ key: 'incoterm_id', type: 'many2one', label: 'Incoterm', search: this.ab.lookup('incoterms') }); }
    else f.push({ key: 'pr_number', type: 'text', label: 'PR Number' });
    return f;
  });

  protected readonly columns = computed<LineColumn[]>(() => {
    const sale = this.isSale();
    return [
      { key: 'product_id', label: 'Product', type: 'm2o', width: 'w-56', search: this.ab.lookup('products'), onPick: (row, o) => this.pickProduct(row, o) },
      { key: 'name', label: 'Description', type: 'text' },
      { key: 'account_id', label: 'Account', type: 'm2o', width: 'w-56', search: this.ab.lookup('accounts') },
      { key: 'analytic_account_id', label: 'Analytic Account', type: 'm2o', width: 'w-48', search: this.ab.lookup('analyticAccounts') },
      { key: 'quantity', label: 'Quantity', type: 'number', width: 'w-24', right: true },
      { key: 'price_unit', label: 'Unit Price', type: 'number', width: 'w-28', right: true },
      { key: 'discount', label: 'Disc. %', type: 'number', width: 'w-20', right: true },
      { key: 'tax_ids', label: 'Taxes', type: 'm2m', width: 'w-48', search: this.ab.lookup('taxes', { type_tax_use: sale ? 'sale' : 'purchase' }) },
      { key: 'subtotal', label: 'Subtotal', type: 'readonly', width: 'w-28', right: true },
    ];
  });
  protected readonly newLine = (): Row => ({ quantity: '1', price_unit: '0', discount: '0', account_id: this.defaults.account, tax_ids: this.defaults.tax ? [this.defaults.tax] : [], subtotal: '0.00' });

  protected readonly items = computed<ActionItem[]>(() => {
    if (this.isNew() || !this.ready()) return [];
    const d = this.doc(); const state = String(d['state']); const status = String(d['request_status']);
    const b = this.busy(); const out: ActionItem[] = [];
    const sale = this.isSale();
    if (state === 'draft') {
      if (this.canWrite() && category(d) === 'proforma' && sale) out.push({ id: 'convert', label: 'Convert to Tax Invoice', kind: 'primary', disabled: b, run: () => void this.convertProforma() });
      if (this.canWrite() && !sale && !isRefundType(this.k().moveType)) {
        if (['not_required', 'rejected'].includes(status)) out.push({ id: 'submit', label: 'Send for Approval', disabled: b, run: () => void this.approval('submit-approval', 'Sent for approval') });
        if (status === 'to_approve' && this.ok(PERM.bill.approveL1)) {
          out.push({ id: 'approve', label: 'Approve', kind: 'primary', disabled: b, run: () => void this.approval('approve', 'Approved', { post: false }) });
          out.push({ id: 'approve-post', label: 'Approve and Post', disabled: b, run: () => void this.approval('approve', 'Approved and posted', { post: true }) });
          out.push({ id: 'reject', label: 'Reject', disabled: b, run: () => { this.reason.set(''); this.panel.set('reject'); } });
        }
        if (status === 'rejected') out.push({ id: 'reset-approval', label: 'Reset Approval', disabled: b, run: () => void this.approval('reset-approval', 'Approval reset') });
      }
      if (this.canWrite()) out.push({ id: 'delete', label: 'Delete', kind: 'danger', disabled: b, run: () => void this.remove() });
    }
    const cancelPerm = sale ? PERM.invoice.cancel : PERM.bill.write;
    if (state === 'posted') {
      if (n(d['amount_residual']) > 0 && this.ok(PERM.payment.write)) out.push({ id: 'pay', label: 'Register Payment', kind: 'primary', disabled: b, run: () => void this.openPay() });
      if (this.ok(sale ? PERM.invoice.creditNote : PERM.bill.write)) out.push({ id: 'refund', label: sale ? 'Add Credit Note' : 'Add Refund', disabled: b, run: () => void this.refund() });
      if (d['is_progressive'] && this.canWrite()) out.push({ id: 'progress', label: 'Next Progressive Invoice', disabled: b, run: () => { this.progressPct.set(''); this.retainPct.set(''); this.panel.set('progress'); } });
      if (this.ok(cancelPerm)) out.push({ id: 'draft', label: 'Reset to Draft', disabled: b, run: () => void this.stateAction('draft', 'Set to draft') });
      if (this.ok(cancelPerm)) out.push({ id: 'cancel', label: 'Cancel', kind: 'danger', disabled: b, run: () => void this.stateAction('cancel', 'Cancelled', 'Cancel this document?') });
    }
    if (state === 'cancel' && this.ok(cancelPerm)) out.push({ id: 'draft', label: 'Reset to Draft', disabled: b, run: () => void this.stateAction('draft', 'Set to draft') });
    return out;
  });

  constructor() {
    effect(() => { this.kind(); const id = this.id() || 'new'; untracked(() => void this.load(id)); });
    // keep the tax and total in step with the lines while the document is editable
    effect(() => {
      const rows = this.lines(); const ready = this.ready(); const locked = this.locked(); const currency = this.draft()['currency_id'] ?? null;
      untracked(() => {
        clearTimeout(this.previewTimer);
        if (!ready || locked) return;
        this.previewTimer = setTimeout(() => void this.loadPreview(rows, currency as number | null), 300);
      });
    });
  }

  // ------------------------------------------------------------------ loading
  private async load(id: string): Promise<void> {
    this.ready.set(false); this.error.set(''); this.panel.set('');
    try {
      if (!this.defaults.account && !this.defaults.tax) await this.loadDefaults();
      if (id === 'new') await this.loadBlank(); else await this.loadDoc(id);
      this.ready.set(true);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not open the document.'); }
  }

  private async loadDefaults(): Promise<void> {
    try {
      const s = await this.ab.get<Row>('/accounting/settings');
      this.defaults = this.isSale()
        ? { account: (s['income_account_id'] as number) ?? null, tax: (s['default_sale_tax_id'] as number) ?? null }
        : { account: (s['expense_account_id'] as number) ?? null, tax: (s['default_purchase_tax_id'] as number) ?? null };
    } catch { /* the form still works without defaults */ }
  }

  private async loadBlank(): Promise<void> {
    const sale = this.isSale(); const kind = this.k();
    const q: Record<string, string> = { type: sale ? 'sale' : 'purchase', limit: '1' };
    if (kind.category === 'cash' || kind.category === 'proforma') q['invoice_category'] = kind.category;
    let j = (await this.ab.list<Row>('/accounting/journals', q)).records[0];
    if (!j && q['invoice_category']) j = (await this.ab.list<Row>('/accounting/journals', { type: q['type'], limit: '1' })).records[0];
    const rec: Row = {
      move_type: kind.moveType, date: today(), invoice_date: today(), invoice_category: kind.category ?? 'credit',
      is_progressive: kind.category === 'progressive',
      journal_id: j?.['id'] ?? null, journal_id_label: j ? `${j['code']} ${j['name']}` : '',
    };
    this.doc.set(rec); this.form.set(rec); this.draft.set(rec); this.settled.set([]); this.dirtyLines.set(false);
    this.lines.set([this.newLine()]);
  }

  private async loadDoc(id: string): Promise<void> {
    const raw = await this.ab.get<Row>(`/accounting/moves/${id}`);
    const rec = toForm(raw, ['lines']);
    this.doc.set(rec); this.form.set(rec); this.draft.set(rec);
    this.settled.set((raw['reconciled_items'] as Row[]) ?? []);
    const all = (raw['lines'] as Row[]) ?? [];
    this.entryLines.set(all.filter(l => !l['display_type']));
    await this.loadCredits(raw, all);
    const productLines = ((raw['lines'] as Row[]) ?? []).filter(l => !l['tax_line_id'] && !l['exclude_from_invoice_tab'] && !l['display_type']);
    this.lines.set(productLines.map(l => {
      const acc = l['account_id'] as { id: number; name: string } | null;
      const row: Row = { account_id: acc?.id ?? null, account_id_label: acc?.name ?? '', product_id: l['product_id'] ?? null, name: l['name'] ?? '', quantity: String(l['quantity'] ?? 1), price_unit: String(l['price_unit'] ?? 0),
        discount: String(l['discount'] ?? 0), tax_ids: (l['tax_ids'] as number[]) ?? [], analytic_account_id: l['analytic_account_id'] ?? null, product_uom_id: l['product_uom_id'] ?? null };
      return { ...row, subtotal: this.subtotalOf(row) };
    }));
    this.dirtyLines.set(false);
  }

  private async loadPreview(rows: Row[], currency: number | null): Promise<void> {
    try {
      const lines = rows.map(l => ({ quantity: l['quantity'] || '1', price_unit: l['price_unit'] || '0', discount: l['discount'] || '0', tax_ids: l['tax_ids'] ?? [] }));
      this.preview.set(await this.ab.create<Row>('/accounting/moves/preview', { currency_id: currency, lines }));
    } catch { this.preview.set(null); }
  }

  /** The partner's unmatched payments / credit notes of the opposite side, offered as "Outstanding credits". */
  private async loadCredits(raw: Row, all: Row[]): Promise<void> {
    this.credits.set([]); this.ownLineIds = [];
    const partner = (raw['partner_id'] as { id: number } | null)?.id;
    const own = all.filter(l => l['exclude_from_invoice_tab'] && !l['tax_line_id'] && n(l['amount_residual']) !== 0);
    if (raw['state'] !== 'posted' || !partner || !own.length) return;
    this.ownLineIds = own.map(l => Number(l['id']));
    const mySide = Math.sign(own.reduce((t, l) => t + n(l['amount_residual']), 0));
    try {
      const d = await this.ab.list('/accounting/move-lines', { unreconciled_only: 1, partner_id: partner, account_type: this.isSale() ? 'receivable' : 'payable', exclude_move: raw['id'] as number, limit: 100 });
      this.credits.set(d.records.filter(r => Math.sign(n(r['amount_residual'])) === -mySide));
    } catch { /* the block is optional */ }
  }
  protected async addCredit(c: Row): Promise<void> {
    this.busy.set(true); this.error.set('');
    try { await this.ab.action('/accounting/move-lines/reconcile', { line_ids: [...this.ownLineIds, Number(c['id'])] }); this.toast.success('Matched'); await this.loadDoc(this.id() as string); }
    catch (e) { this.error.set(msg(e, 'Could not match it.')); } finally { this.busy.set(false); }
  }

  // ------------------------------------------------------------------ lines
  private subtotalOf(r: Row): string { return (n(r['quantity']) * n(r['price_unit']) * (1 - n(r['discount']) / 100)).toFixed(2); }
  protected setLines(rows: Row[]): void { this.lines.set(rows.map(r => ({ ...r, subtotal: this.subtotalOf(r) }))); this.dirtyLines.set(true); }
  private pickProduct(row: Row, o: { data?: unknown } | null): Row {
    if (!o) return {};
    const d = (o.data ?? {}) as Row;
    return {
      name: String(d['name'] ?? ''), price_unit: String(this.isSale() ? d['price_sale'] ?? 0 : d['price_cost'] ?? 0), product_uom_id: d['uom_id'] ?? null,
      quantity: row['quantity'] || '1', account_id: row['account_id'] ?? this.defaults.account,
      tax_ids: (row['tax_ids'] as number[] | undefined)?.length ? row['tax_ids'] : (this.defaults.tax ? [this.defaults.tax] : []),
    };
  }
  protected onHeader(v: Rec): void { this.draft.set({ ...this.draft(), ...v }); }

  // ------------------------------------------------------------------ save / actions
  private body(): Row {
    const h = { ...this.doc(), ...(this.meta()?.current() ?? {}) } as Row;
    const pick = ['move_type', 'date', 'journal_id', 'partner_id', 'ref', 'narration', 'currency_id', 'invoice_date', 'invoice_date_due', 'invoice_origin', 'invoice_payment_term_id', 'fiscal_position_id',
      'po_number', 'pr_number', 'client_order_ref', 'incoterm_id', 'invoice_category', 'is_progressive', 'contract_amount', 'progress_percentage'];
    const body: Row = {};
    for (const key of pick) if (key in h) body[key] = h[key] === '' ? null : h[key];
    body['move_type'] = this.k().moveType;
    body['lines'] = this.lines().map(l => ({
      account_id: l['account_id'], name: l['name'] || null, product_id: l['product_id'] || null, product_uom_id: l['product_uom_id'] || null, quantity: l['quantity'] || '1',
      price_unit: l['price_unit'] || '0', discount: l['discount'] || '0', tax_ids: l['tax_ids'] ?? [], analytic_account_id: l['analytic_account_id'] || null,
    }));
    return body;
  }

  /** Saves the draft; returns its id. */
  private async persist(): Promise<number | null> {
    const meta = this.meta();
    if (meta && !meta.validate()) { this.error.set(meta.firstError() || 'Please complete the required fields.'); return null; }
    if (this.lines().some(l => !l['account_id'])) { this.error.set('Every line needs an account.'); return null; }
    const body = this.body();
    if (this.isNew()) {
      const created = await this.ab.create<Row>('/accounting/moves', body);
      return created['id'] as number;
    }
    await this.ab.update(`/accounting/moves/${this.id()}`, body);
    return Number(this.id());
  }

  protected async save(): Promise<void> {
    this.busy.set(true); this.error.set('');
    try {
      const id = await this.persist();
      if (id === null) return;
      this.toast.success(`${this.k().singular} saved`);
      if (this.isNew()) await this.router.navigate(['/accounting', this.k().path, id]); else await this.loadDoc(String(id));
    } catch (e) { this.error.set(msg(e, 'Could not save.')); }
    finally { this.busy.set(false); }
  }

  protected async validate(): Promise<void> {
    this.busy.set(true); this.error.set('');
    try {
      const id = await this.persist();
      if (id === null) return;
      const posted = await this.ab.action<Row>(`/accounting/moves/${id}/post`);
      this.toast.success(`Posted ${posted['name']}`);
      if (this.isNew()) await this.router.navigate(['/accounting', this.k().path, id]); else await this.loadDoc(String(id));
    } catch (e) { this.error.set(msg(e, 'Could not post.')); }
    finally { this.busy.set(false); }
  }

  protected async stateAction(action: 'draft' | 'cancel', done: string, confirm?: string): Promise<void> {
    if (confirm && !(await this.dialogs.confirm({ title: 'Confirm', message: confirm, confirmLabel: 'Yes', danger: true }))) return;
    await this.act(`/accounting/moves/${this.id()}/${action}`, undefined, done);
  }
  protected async approval(action: string, done: string, body?: Row): Promise<void> { await this.act(`/accounting/moves/${this.id()}/${action}`, body, done); }
  protected async reject(): Promise<void> {
    if (!this.reason().trim()) { this.error.set('A reason is required.'); return; }
    await this.act(`/accounting/moves/${this.id()}/reject`, { reason: this.reason() }, 'Rejected');
  }
  private async act(path: string, body: Row | undefined, done: string): Promise<void> {
    this.busy.set(true); this.error.set('');
    try { await this.ab.action(path, body); this.panel.set(''); this.toast.success(done); await this.loadDoc(String(this.id())); }
    catch (e) { this.error.set(msg(e, 'The action failed.')); }
    finally { this.busy.set(false); }
  }

  protected async convertProforma(): Promise<void> {
    this.busy.set(true); this.error.set('');
    try {
      const r = await this.ab.action<Row>(`/accounting/moves/${this.id()}/convert-proforma`, { post: false });
      this.toast.success('Converted to a tax invoice (draft)');
      await this.router.navigate(['/accounting', 'customer-invoices', r['id']]);
    } catch (e) { this.error.set(msg(e, 'Could not convert.')); } finally { this.busy.set(false); }
  }

  protected async refund(): Promise<void> {
    this.busy.set(true); this.error.set('');
    try {
      const r = await this.ab.action<Row>(`/accounting/moves/${this.id()}/reverse`, { post: false });
      this.toast.success(this.isSale() ? 'Credit note created (draft)' : 'Refund created (draft)');
      await this.router.navigate(['/accounting', refundKindFor(this.k().moveType), r['id']]);
    } catch (e) { this.error.set(msg(e, 'Could not create it.')); } finally { this.busy.set(false); }
  }

  protected async nextProgressive(): Promise<void> {
    if (!n(this.progressPct())) { this.error.set('Enter the percentage billed to date.'); return; }
    this.busy.set(true); this.error.set('');
    try {
      const r = await this.ab.action<Row>(`/accounting/moves/${this.id()}/progressive-next`, { progress_percentage: this.progressPct(), retainage_percentage: this.retainPct() || undefined });
      this.toast.success('Progressive invoice created (draft)');
      await this.router.navigate(['/accounting', this.k().path, r['id']]);
    } catch (e) { this.error.set(msg(e, 'Could not create the invoice.')); } finally { this.busy.set(false); }
  }

  protected async remove(): Promise<void> {
    if (!(await this.dialogs.confirm({ title: 'Delete', message: 'Delete this draft?', confirmLabel: 'Delete', danger: true }))) return;
    try { await this.ab.remove(`/accounting/moves/${this.id()}`); this.toast.success('Deleted'); await this.back(); }
    catch (e) { this.error.set(msg(e, 'Could not delete.')); }
  }

  // ------------------------------------------------------------------ payment
  protected async openPay(): Promise<void> {
    this.payAmount.set(String(this.doc()['amount_residual'] ?? ''));
    this.payDate.set(today()); this.payMemo.set(String(this.doc()['name'] ?? ''));
    if (!this.payJournal) {
      const j = (await this.ab.list<Row>('/accounting/journals', { type: 'bank,cash', limit: 1 })).records[0];
      if (j) { this.payJournal = j['id'] as number; this.payJournalLabel.set(`${j['code']} ${j['name']}`); }
    }
    this.panel.set('pay');
  }
  protected async registerPayment(): Promise<void> {
    if (!this.payJournal) { this.error.set('Choose a bank or cash journal.'); return; }
    this.busy.set(true); this.error.set('');
    try {
      await this.ab.create('/accounting/payments?post=1', { invoice_ids: [Number(this.id())], journal_id: this.payJournal, amount: this.payAmount(), payment_date: this.payDate(), communication: this.payMemo() });
      this.panel.set(''); this.toast.success('Payment registered and reconciled'); await this.loadDoc(String(this.id()));
    } catch (e) { this.error.set(msg(e, 'Could not register the payment.')); } finally { this.busy.set(false); }
  }
  protected async unreconcile(s: Row): Promise<void> {
    this.busy.set(true); this.error.set('');
    try { await this.ab.action('/accounting/move-lines/unreconcile', { line_ids: [s['line_id']] }); this.toast.success('Unreconciled'); await this.loadDoc(String(this.id())); }
    catch (e) { this.error.set(msg(e, 'Could not unreconcile.')); } finally { this.busy.set(false); }
  }

  protected back(): Promise<boolean> { return this.router.navigate(['/accounting', this.k().path]); }
}

const category = (d: Row) => String(d['invoice_category'] ?? 'credit');
const msg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
