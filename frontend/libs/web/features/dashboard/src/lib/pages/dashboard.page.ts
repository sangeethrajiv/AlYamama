import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountingApi, DataChanges } from '@erp/web/api-client';
import { AuthService } from '@erp/web/core';
import { AmountPipe, I18n, IconComponent, StatusBadgeComponent, DatePipe } from '@erp/web/ui';
import { div, gt, mul, sub, sum, toNumber, todayIso, type Decimal } from '@erp/shared/utils';

interface Kpi { label: string; value: string; note: string; link: string; tone?: string; amount?: boolean }

/** Dashboard: role-based KPIs (owner view vs accountant work queue), receivables/payables, recent billing and bank balances. */
@Component({
  selector: 'erp-dashboard-page',
  imports: [TranslocoPipe, IconComponent, AmountPipe, StatusBadgeComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-800 to-slate-900 p-6 text-white shadow-sm md:flex-row md:items-center">
        <div>
          <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-300">{{ 'dashboard.eyebrow' | transloco }}</div>
          <h1 class="mt-1 font-display text-2xl font-black tracking-tight">{{ 'dashboard.title' | transloco }}</h1>
          <p class="mt-1 max-w-xl text-xs text-emerald-100/80">{{ 'dashboard.subtitle' | transloco }}</p>
        </div>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-extrabold text-slate-800">{{ (view() === 'owner' ? 'dashboard.ownerView' : 'dashboard.accountantView') | transloco }}</h2>
          <div class="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold" role="tablist">
            @for (v of views; track v) { <button type="button" role="tab" [attr.aria-selected]="view() === v" (click)="view.set(v)" class="rounded-md px-3 py-1 transition" [class]="view() === v ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'">{{ 'dashboard.' + v | transloco }}</button> }
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          @for (k of kpis(); track k.label) {
            <button type="button" (click)="go(k.link)" class="rounded-xl border border-slate-200 bg-white p-5 text-start shadow-sm transition hover:border-emerald-300">
              <div class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{{ k.label }}</div>
              <div class="font-mono text-2xl font-black" [class]="k.tone || 'text-slate-900'">{{ k.amount ? (k.value | erpAmount) : k.value }}</div>
              <div class="mt-2 text-[11px] text-slate-500">{{ k.note }}</div>
            </button>
          }
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" (click)="go('/accounting/banking')" class="rounded-xl border border-slate-200 bg-white p-5 text-start shadow-sm transition hover:border-emerald-300">
          <div class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{{ 'dashboard.cashBalances' | transloco }}</div><div class="font-mono text-2xl font-black text-slate-900">{{ totalCash() | erpAmount }}</div>
          <div class="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><erp-icon name="check-circle-2" [size]="13" />{{ 'dashboard.acrossJournals' | transloco: { n: banks().length } }}</div></button>
        <button type="button" (click)="go('/accounting/invoices')" class="rounded-xl border border-slate-200 bg-white p-5 text-start shadow-sm transition hover:border-slate-300">
          <div class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{{ 'dashboard.receivables' | transloco }}</div><div class="font-mono text-2xl font-black text-slate-900">{{ totalReceivables() | erpAmount }}</div>
          <div class="mt-2 text-[11px] text-slate-500">{{ 'dashboard.unpaid' | transloco: { n: openInvoices().length } }}@if (overdueInvoices().length) { <span class="ms-1 font-bold text-rose-600">• {{ 'dashboard.overdueCount' | transloco: { n: overdueInvoices().length } }}</span> }</div></button>
        <button type="button" (click)="go('/accounting/bills')" class="rounded-xl border border-slate-200 bg-white p-5 text-start shadow-sm transition hover:border-amber-300">
          <div class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{{ 'dashboard.payables' | transloco }}</div><div class="font-mono text-2xl font-black text-slate-900">{{ totalPayables() | erpAmount }}</div>
          <div class="mt-2 text-[11px] text-slate-500">{{ 'dashboard.unpaidBills' | transloco: { n: openBills().length } }}@if (pendingApproval().length) { <span class="ms-1 font-bold text-amber-700">• {{ 'dashboard.toApprove' | transloco: { n: pendingApproval().length } }}</span> }</div></button>
        <button type="button" (click)="go('/reports')" class="rounded-xl border border-slate-200 bg-white p-5 text-start shadow-sm transition hover:border-slate-300">
          <div class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{{ 'dashboard.workingCapital' | transloco }}</div><div class="font-mono text-2xl font-black text-emerald-800">{{ workingCapital() | erpAmount }}</div>
          <div class="mt-2 text-[11px] font-semibold text-slate-700">{{ (gt(workingCapital(), '0') ? 'dashboard.recExceedPay' : 'dashboard.payExceedRec') | transloco }}</div></button>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3"><div><h3 class="text-sm font-extrabold text-slate-800">{{ 'dashboard.recentTitle' | transloco }}</h3><p class="text-xs text-slate-400">{{ 'dashboard.recentSub' | transloco }}</p></div><button type="button" class="text-xs font-bold text-emerald-600 hover:text-emerald-700" (click)="go('/accounting/invoices')">{{ 'dashboard.viewAll' | transloco }}</button></div>
          <div class="overflow-x-auto"><table class="w-full text-start text-xs"><thead><tr class="border-b border-slate-100 font-bold text-slate-400"><th class="pb-2 text-start">{{ 'dashboard.col.invoice' | transloco }}</th><th class="pb-2 text-start">{{ 'dashboard.col.customer' | transloco }}</th><th class="pb-2 text-start">{{ 'dashboard.col.due' | transloco }}</th><th class="pb-2 text-end">{{ 'dashboard.col.amount' | transloco }}</th><th class="pb-2 text-center">{{ 'common.status' | transloco }}</th></tr></thead>
            <tbody class="divide-y divide-slate-50">@for (i of recent(); track i.id) { <tr class="cursor-pointer transition-colors hover:bg-slate-50" (click)="openInvoice(i.id)"><td class="py-2.5 font-mono font-bold text-emerald-800">{{ i.number }}</td><td class="py-2.5 font-semibold text-slate-800">{{ i.partner }}</td><td class="py-2.5 font-mono text-slate-500">{{ i.dateDue | erpDate }}</td><td class="py-2.5 text-end font-mono font-bold text-slate-900">{{ i.residual | erpAmount: i.currency }}</td><td class="py-2.5 text-center"><erp-status-badge [state]="i.state" /></td></tr> }</tbody></table></div>
        </div>
        <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3"><div><h3 class="text-sm font-extrabold text-slate-800">{{ 'dashboard.bankTitle' | transloco }}</h3><p class="text-xs text-slate-400">{{ 'dashboard.bankSub' | transloco }}</p></div><button type="button" class="text-xs font-bold text-emerald-600 hover:text-emerald-700" (click)="go('/accounting/banking')">{{ 'dashboard.banking' | transloco }}</button></div>
          <div class="space-y-3">@for (b of banks(); track b.id) { <div class="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs hover:bg-slate-50"><div><div class="font-bold text-slate-800">{{ b.name }}</div><div class="font-mono text-[10px] text-slate-400">{{ b.code }}</div></div><div class="font-mono font-bold text-slate-900">{{ b.balance | erpAmount: b.currency || 'SAR' }}</div></div> }</div>
          <div class="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500"><span>{{ 'dashboard.bankRecon' | transloco }}</span><span class="flex items-center gap-1 font-bold text-emerald-700"><erp-icon name="check-circle-2" [size]="13" />{{ 'dashboard.upToDate' | transloco }}</span></div>
        </div>
      </div>
    </div>`,
})
export class DashboardPage {
  private readonly api = inject(AccountingApi);
  private readonly changes = inject(DataChanges);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);

  protected readonly views = ['owner', 'accountant'] as const;
  protected readonly view = signal<'owner' | 'accountant'>('accountant');
  protected readonly gt = gt;
  private readonly data = resource({
    params: () => this.changes.revision(),
    loader: async () => { const [invoices, bills, payments, accounts] = await Promise.all([this.api.invoices(), this.api.bills(), this.api.payments(), this.api.accounts()]); return { invoices, bills, payments, accounts }; },
  });

  constructor() {
    // Owners (Finance Director) start on the money picture; everyone else on the work queue. Follows role switches.
    effect(() => { const r = this.auth.role(); untracked(() => this.view.set(r === 'Finance Director' ? 'owner' : 'accountant')); });
  }

  private readonly invoices = computed(() => this.data.value()?.invoices ?? []);
  private readonly bills = computed(() => this.data.value()?.bills ?? []);
  protected readonly openInvoices = computed(() => this.invoices().filter(i => i.state === 'open' || i.state === 'in_payment'));
  protected readonly overdueInvoices = computed(() => this.invoices().filter(i => i.state !== 'paid' && i.state !== 'cancel' && i.dateDue < todayIso()));
  protected readonly openBills = computed(() => this.bills().filter(b => b.state === 'open' || b.state === 'in_payment'));
  protected readonly pendingApproval = computed(() => this.bills().filter(b => b.approvalStatus === 'pending_manager' || b.approvalStatus === 'pending_director'));
  protected readonly banks = computed(() => (this.data.value()?.accounts ?? []).filter(a => a.type === 'Bank and Cash'));
  protected readonly totalReceivables = computed<Decimal>(() => sum(this.openInvoices().map(i => i.residual)));
  protected readonly totalPayables = computed<Decimal>(() => sum(this.openBills().map(b => b.residual)));
  protected readonly totalCash = computed<Decimal>(() => sum(this.banks().map(a => (a.currency === 'USD' ? mul(a.balance, '3.75') : a.balance))));
  protected readonly workingCapital = computed<Decimal>(() => sub(this.totalReceivables(), this.totalPayables()));
  protected readonly recent = computed(() => this.invoices().slice(0, 4));

  protected readonly kpis = computed<Kpi[]>(() => {
    const t = (k: string, p?: Record<string, unknown>) => this.i18n.tr(k, p);
    if (this.view() === 'owner') {
      const booked = this.invoices().filter(i => i.state !== 'draft' && i.state !== 'cancel' && (i.category || 'credit') !== 'proforma');
      const revenue = sum(booked.map(i => mul(i.amountUntaxed, i.currencyRate || '1')));
      const expenses = sum(this.bills().filter(b => b.state !== 'draft' && b.state !== 'cancel').map(b => mul(b.amountUntaxed, b.currencyRate || '1')));
      const profit = sub(revenue, expenses);
      const margin = gt(revenue, '0') ? `${(toNumber(div(mul(profit, '100'), revenue, 4))).toFixed(1)}%` : '—';
      return [
        { label: t('dashboard.kpi.revenue'), value: revenue, amount: true, note: t('dashboard.kpi.revenueNote', { n: booked.length }), link: '/reports' },
        { label: t('dashboard.kpi.expenses'), value: expenses, amount: true, note: t('dashboard.kpi.expensesNote'), link: '/accounting/bills' },
        { label: t('dashboard.kpi.profit'), value: profit, amount: true, note: gt(revenue, '0') ? t('dashboard.kpi.margin', { pct: margin }) : '—', link: '/reports', tone: gt('0', profit) ? 'text-rose-600' : 'text-emerald-700' },
        { label: t('dashboard.kpi.cash'), value: this.totalCash(), amount: true, note: t('dashboard.kpi.cashNote'), link: '/accounting/banking' },
      ];
    }
    const pendingRec = (this.data.value()?.payments ?? []).filter(p => p.state === 'posted' && p.partnerType === 'customer').length;
    const overdueAmount = sum(this.overdueInvoices().map(i => i.residual));
    return [
      { label: t('dashboard.kpi.pendingPayments'), value: String(this.openInvoices().length + this.openBills().length), note: t('dashboard.kpi.pendingNote', { inv: this.openInvoices().length, bills: this.openBills().length }), link: '/accounting/payments' },
      { label: t('dashboard.kpi.awaitingRecon'), value: String(pendingRec), note: t('dashboard.kpi.awaitingNote'), link: '/accounting/reconciliation', tone: pendingRec ? 'text-amber-600' : undefined },
      { label: t('dashboard.kpi.billsToApprove'), value: String(this.pendingApproval().length), note: t('dashboard.kpi.billsNote'), link: '/accounting/bills' },
      { label: t('dashboard.kpi.overdue'), value: String(this.overdueInvoices().length), note: t('dashboard.kpi.overdueNote', { amount: overdueAmount }), link: '/accounting/invoices', tone: this.overdueInvoices().length ? 'text-rose-600' : undefined },
    ];
  });

  protected go(link: string): void { void this.router.navigateByUrl(link); }
  protected openInvoice(id: string): void { void this.router.navigate(['/accounting/invoices', id]); }
}
