import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService } from '@erp/web/core';
import { ApiError } from '@erp/web/api-client';
import { DECIMAL_RE } from '@erp/web/metadata-forms';
import { AmountPipe, ErrorBannerComponent, IconComponent, PageHeaderComponent, ToastService, I18n } from '@erp/web/ui';
import { PERM, type Invoice, type Payment, type PaymentAllocation } from '@erp/shared/contracts';
import { abs, add, dec, gt, lt, min, sub, sum, type Decimal } from '@erp/shared/utils';
import { AccountingStore } from '../data/accounting.store';

/** Payment reconciliation wizard (match one payment to one invoice, with write-off) and bulk matching (one payment, many invoices). */
@Component({
  selector: 'erp-reconciliation-page',
  imports: [TranslocoPipe, PageHeaderComponent, ErrorBannerComponent, IconComponent, AmountPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="'accounting.recon.title' | transloco" [subtitle]="'accounting.recon.subtitle' | transloco" />
      <erp-error-banner [text]="error()" />

      @if (suggestions().length) {
        <div class="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-slate-50 p-4 shadow-sm">
          <div class="mb-2 flex items-center gap-2 text-xs font-bold text-emerald-900"><erp-icon name="check-circle-2" [size]="14" />{{ 'accounting.recon.suggested' | transloco: { n: suggestions().length } }}</div>
          <div class="space-y-2">
            @for (s of suggestions(); track s.invoice.id + s.payment.id) {
              <div class="flex flex-col items-start justify-between gap-3 rounded-lg border border-emerald-200/80 bg-white p-3 text-xs md:flex-row md:items-center">
                <div class="flex items-center gap-3"><span class="font-bold text-slate-800"><span class="font-mono text-emerald-700">{{ s.invoice.number }}</span> <span class="ms-2 font-normal text-slate-500">({{ s.invoice.partner }})</span></span><span class="font-mono font-semibold text-slate-600">{{ s.invoice.residual | erpAmount: s.invoice.currency }}</span></div>
                <span class="text-[11px] font-bold uppercase text-emerald-700">{{ 'accounting.recon.matches' | transloco }}</span>
                <div class="flex items-center gap-3"><span class="font-bold text-slate-800"><span class="font-mono text-slate-700">{{ s.payment.paymentNumber }}</span> <span class="ms-2 font-mono font-normal text-slate-500">{{ s.payment.amount | erpAmount: s.payment.currency }}</span></span>
                  <button type="button" class="rounded bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700" (click)="select(s.invoice.id, s.payment.id)">{{ 'accounting.recon.selectMatch' | transloco }}</button></div>
              </div>
            }
          </div>
        </div>
      }

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5">
          <div class="mb-3 flex items-center justify-between border-b border-slate-100 pb-2"><div><h3 class="text-xs font-bold uppercase tracking-wider text-slate-800">{{ 'accounting.recon.outstanding' | transloco }}</h3><p class="text-[11px] text-slate-400">{{ 'accounting.recon.selectInvoice' | transloco }}</p></div><span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600">{{ 'accounting.recon.openCount' | transloco: { n: openInvoices().length } }}</span></div>
          <div class="max-h-96 space-y-2 overflow-y-auto pe-1">
            @for (i of openInvoices(); track i.id) {
              <button type="button" (click)="invoiceId.set(i.id)" class="w-full rounded-lg border p-3 text-start transition" [class]="i.id === invoiceId() ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500' : 'border-slate-200 hover:bg-slate-50'">
                <div class="flex items-center justify-between"><span class="font-mono text-xs font-bold text-emerald-800">{{ i.number }}</span><span class="font-mono text-xs font-bold text-slate-900">{{ i.residual | erpAmount: i.currency }}</span></div>
                <div class="mt-0.5 text-[11px] text-slate-500">{{ i.partner }} · {{ 'accounting.recon.due' | transloco }} {{ i.dateDue }}</div></button>
            } @empty { <div class="py-8 text-center text-xs text-slate-400">{{ 'accounting.recon.allReconciled' | transloco }}</div> }
          </div>
        </section>

        <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800">{{ 'accounting.recon.balance' | transloco }}</h3>
          <dl class="space-y-2 text-xs"><div class="flex justify-between"><dt class="text-slate-500">{{ 'accounting.recon.invoice' | transloco }}</dt><dd class="font-mono font-bold">{{ invoiceAmount() | erpAmount }}</dd></div><div class="flex justify-between"><dt class="text-slate-500">{{ 'accounting.recon.payment' | transloco }}</dt><dd class="font-mono font-bold">{{ paymentAmount() | erpAmount }}</dd></div>
            <div class="flex justify-between border-t border-slate-200 pt-2"><dt class="font-bold">{{ 'accounting.recon.difference' | transloco }}</dt><dd class="font-mono font-extrabold" [class]="settled() ? 'text-emerald-600' : 'text-amber-600'">{{ remaining() | erpAmount }}</dd></div></dl>
          <p class="text-[11px] font-semibold" [class]="settled() ? 'text-emerald-700' : 'text-amber-700'">{{ (settled() ? 'accounting.recon.fullSettlement' : partial() ? 'accounting.recon.partial' : 'accounting.recon.overpay') | transloco: { amount: diff() } }}</p>
          <button type="button" class="w-full rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50" [disabled]="!selectedInvoice() || !selectedPayment() || !canRun()" (click)="execute()">{{ 'accounting.recon.execute' | transloco }}</button>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5">
          <div class="mb-3 flex items-center justify-between border-b border-slate-100 pb-2"><div><h3 class="text-xs font-bold uppercase tracking-wider text-slate-800">{{ 'accounting.recon.credits' | transloco }}</h3><p class="text-[11px] text-slate-400">{{ 'accounting.recon.selectPayment' | transloco }}</p></div><span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600">{{ 'accounting.recon.availableCount' | transloco: { n: available().length } }}</span></div>
          <div class="max-h-96 space-y-2 overflow-y-auto pe-1">
            @for (p of available(); track p.id) {
              <button type="button" (click)="paymentId.set(p.id)" class="w-full rounded-lg border p-3 text-start transition" [class]="p.id === paymentId() ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500' : 'border-slate-200 hover:bg-slate-50'">
                <div class="flex items-center justify-between"><span class="font-mono text-xs font-bold text-slate-700">{{ p.paymentNumber }}</span><span class="font-mono text-xs font-bold text-slate-900">{{ p.amount | erpAmount: p.currency }}</span></div>
                <div class="mt-0.5 text-[11px] text-slate-500">{{ p.partner }} · {{ p.paymentDate }}</div></button>
            } @empty { <div class="py-8 text-center text-xs text-slate-400">{{ 'accounting.recon.noPayments' | transloco }}</div> }
          </div>
        </section>
      </div>

      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 class="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">{{ 'accounting.recon.writeOffTitle' | transloco }}</h3>
        <div class="grid gap-4 text-xs sm:grid-cols-2">
          <label class="block"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.recon.writeOff' | transloco }}</span><input inputmode="decimal" class="erp-input text-end font-mono" [value]="writeOff()" (input)="writeOff.set($any($event.target).value)" (blur)="normWriteOff()" /></label>
          <label class="block"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.recon.writeOffAccount' | transloco }}</span>
            <select class="erp-input" [value]="writeOffAccount()" (change)="writeOffAccount.set($any($event.target).value)"><option>504000 - Bank Charges &amp; Transaction Fees</option><option>490000 - Realised FX Gain/Loss</option><option>505000 - Cash Rounding / Miscellaneous</option></select></label>
        </div>
      </section>

      <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-2">
          <div><h3 class="text-xs font-bold uppercase tracking-wider text-slate-800">{{ 'accounting.recon.bulkTitle' | transloco }}</h3><p class="text-[11px] text-slate-400">{{ 'accounting.recon.bulkSub' | transloco }}</p></div>
          <select class="erp-input w-auto min-w-64" [attr.aria-label]="'accounting.recon.bulkPayment' | transloco" [value]="bulkPaymentId()" (change)="resetBulk($any($event.target).value)">
            @if (available().length === 0) { <option value="">{{ 'accounting.recon.noPayments' | transloco }}</option> }
            @for (p of available(); track p.id) { <option [value]="p.id" [selected]="p.id === bulkPaymentId()">{{ p.paymentNumber }} · {{ p.partner }} · {{ p.amount | erpAmount: p.currency }}</option> }
          </select>
        </div>
        @if (bulkPayment(); as bp) {
          <div class="flex flex-wrap items-center gap-3 text-xs">
            <label class="flex items-center gap-1.5"><input type="checkbox" class="accent-emerald-600" [checked]="showAll()" (change)="showAll.set($any($event.target).checked)" />{{ 'accounting.recon.allCustomers' | transloco }}</label>
            <button type="button" class="erp-btn-ghost erp-btn-sm" (click)="autoAllocate()">{{ 'accounting.recon.autoAllocate' | transloco }}</button>
            <span class="ms-auto font-mono">{{ 'accounting.recon.allocated' | transloco }} <b>{{ allocated() | erpAmount }}</b> · {{ 'accounting.recon.left' | transloco }} <b [class]="over() ? 'text-rose-600' : 'text-slate-800'">{{ bulkRemaining() | erpAmount }}</b></span>
          </div>
          <div class="overflow-x-auto rounded-lg border border-slate-200">
            <table class="erp-table"><thead><tr><th>{{ 'accounting.invoice.list.number' | transloco }}</th><th>{{ 'accounting.invoice.list.customer' | transloco }}</th><th>{{ 'accounting.recon.due' | transloco }}</th><th class="text-end">{{ 'accounting.invoice.list.amountDue' | transloco }}</th><th class="text-end">{{ 'accounting.recon.apply' | transloco }}</th></tr></thead>
              <tbody>@for (i of candidates(); track i.id) {
                <tr><td class="font-mono font-bold text-emerald-800">{{ i.number }}</td><td>{{ i.partner }}</td><td class="whitespace-nowrap">{{ i.dateDue }}</td><td class="erp-num font-mono">{{ i.residual | erpAmount: i.currency }}</td>
                  <td class="erp-num"><input inputmode="decimal" class="erp-input erp-input-sm w-28 text-end font-mono" [value]="alloc()[i.id] ?? ''" placeholder="0.00" (change)="setAlloc(i, $any($event.target).value)" /></td></tr>
              } @empty { <tr><td colspan="5" class="py-6 text-center text-slate-400">{{ 'accounting.recon.noCandidates' | transloco }}</td></tr> }</tbody></table>
          </div>
          <div class="flex justify-end"><button type="button" class="erp-btn-primary" [disabled]="!canApply()" (click)="applyBulk()">{{ 'accounting.recon.applyBulk' | transloco }}</button></div>
          <span class="hidden">{{ bp.id }}</span>
        }
      </section>
    </div>`,
})
export class ReconciliationPage {
  private readonly store = inject(AccountingStore);
  private readonly perms = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);

  protected readonly error = signal('');
  protected readonly invoiceId = signal('');
  protected readonly paymentId = signal('');
  protected readonly writeOff = signal('0.00');
  protected readonly writeOffAccount = signal('505000 - Cash Rounding / Miscellaneous');
  protected readonly canRun = computed(() => this.perms.has(PERM.reconciliation.run));

  protected readonly openInvoices = computed(() => this.store.invoices().filter(i => i.state === 'open' || i.state === 'in_payment'));
  protected readonly available = computed(() => this.store.payments().filter(p => p.state === 'posted' && p.partnerType === 'customer'));
  protected readonly selectedInvoice = computed(() => this.openInvoices().find(i => i.id === this.invoiceId()) ?? this.openInvoices()[0]);
  protected readonly selectedPayment = computed(() => this.available().find(p => p.id === this.paymentId()) ?? this.available()[0]);
  protected readonly invoiceAmount = computed<Decimal>(() => this.selectedInvoice()?.residual ?? '0.00');
  protected readonly paymentAmount = computed<Decimal>(() => this.selectedPayment()?.amount ?? '0.00');
  protected readonly wo = computed<Decimal>(() => (DECIMAL_RE.test(this.writeOff()) ? this.writeOff() : '0.00'));
  protected readonly diff = computed<Decimal>(() => sub(this.invoiceAmount(), this.paymentAmount()));
  protected readonly remaining = computed<Decimal>(() => sub(this.diff(), this.wo()));
  protected readonly settled = computed(() => !gt(abs(this.remaining()), '0.01') && !gt(abs(this.remaining()), '0.009'));
  protected readonly partial = computed(() => gt(this.diff(), '0'));

  /** Rule-based suggestions: same partner or equal amounts. */
  protected readonly suggestions = computed(() => this.openInvoices().map(invoice => {
    const payment = this.available().find(p => p.partner.toLowerCase() === invoice.partner.toLowerCase() || !gt(abs(sub(p.amount, invoice.residual)), '0.01'));
    return payment ? { invoice, payment } : null;
  }).filter((x): x is { invoice: Invoice; payment: Payment } => !!x));

  protected select(inv: string, pay: string): void { this.invoiceId.set(inv); this.paymentId.set(pay); this.writeOff.set('0.00'); }
  protected normWriteOff(): void { if (DECIMAL_RE.test(this.writeOff())) this.writeOff.set(dec(this.writeOff())); }
  private fail(e: unknown): void { this.error.set(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric')); }

  protected async execute(): Promise<void> {
    this.error.set('');
    const i = this.selectedInvoice(); const p = this.selectedPayment();
    if (!i || !p) return this.error.set(this.i18n.tr('accounting.recon.err.select'));
    try { await this.store.api.reconcile(i.id, p.id, this.wo()); this.toast.success(this.i18n.tr('accounting.recon.done', { inv: i.number, pay: p.paymentNumber })); this.writeOff.set('0.00'); this.invoiceId.set(''); this.paymentId.set(''); } catch (e) { this.fail(e); }
  }

  // ---- bulk matching
  protected readonly bulkPaymentId = signal('');
  protected readonly showAll = signal(false);
  protected readonly alloc = signal<Record<string, Decimal>>({});
  protected readonly bulkPayment = computed(() => this.available().find(p => p.id === this.bulkPaymentId()) ?? this.available()[0]);
  protected readonly candidates = computed(() => {
    const open = this.store.invoices().filter(i => (i.state === 'open' || i.state === 'in_payment') && gt(i.residual, '0'));
    const bp = this.bulkPayment();
    return [...(bp && !this.showAll() ? open.filter(i => i.partner === bp.partner) : open)].sort((a, b) => a.dateDue.localeCompare(b.dateDue));
  });
  protected readonly allocated = computed<Decimal>(() => sum(Object.values(this.alloc())));
  protected readonly bulkRemaining = computed<Decimal>(() => sub(this.bulkPayment()?.amount ?? '0.00', this.allocated()));
  protected readonly over = computed(() => lt(this.bulkRemaining(), '-0.005'));
  protected readonly canApply = computed(() => this.canRun() && !!this.bulkPayment() && !this.over() && Object.values(this.alloc()).some(v => gt(v, '0')));

  protected resetBulk(id: string): void { this.bulkPaymentId.set(id); this.alloc.set({}); }
  protected setAlloc(i: Invoice, v: string): void { const n = DECIMAL_RE.test(v.trim()) ? dec(min(v.trim(), i.residual)) : '0.00'; this.alloc.update(a => ({ ...a, [i.id]: n })); }
  /** Oldest due date first until the payment is used up. */
  protected autoAllocate(): void {
    const bp = this.bulkPayment(); if (!bp) return;
    let left = bp.amount; const next: Record<string, Decimal> = {};
    for (const i of this.candidates()) { if (!gt(left, '0')) break; const amt = min(left, i.residual); next[i.id] = dec(amt); left = sub(left, amt); }
    this.alloc.set(next);
  }
  protected async applyBulk(): Promise<void> {
    const bp = this.bulkPayment(); if (!bp) return;
    const rows: PaymentAllocation[] = Object.entries(this.alloc()).filter(([, v]) => gt(v, '0')).map(([invoiceId, amount]) => ({ invoiceId, amount }));
    try { await this.store.api.bulkReconcile(bp.id, rows); this.toast.success(this.i18n.tr('accounting.recon.bulkDone', { n: rows.length })); this.alloc.set({}); this.bulkPaymentId.set(''); } catch (e) { this.fail(e); }
  }
}
void add;
