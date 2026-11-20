import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountingApi, DataChanges } from '@erp/web/api-client';
import { AmountPipe, EmptyStateComponent, I18n, IconComponent, MoneyPipe, PageHeaderComponent, SegmentedComponent } from '@erp/web/ui';
import type { Account, Invoice, JournalEntry } from '@erp/shared/contracts';
import { abs, add, daysBetween, gt, max, mul, sub, sum, todayIso, toCsv, type Decimal } from '@erp/shared/utils';

type ReportId = 'pnl' | 'balance_sheet' | 'trial_balance' | 'aged_ar' | 'gl';
const REPORTS: ReportId[] = ['pnl', 'balance_sheet', 'trial_balance', 'aged_ar', 'gl'];

interface Data { accounts: Account[]; invoices: Invoice[]; entries: JournalEntry[]; analytic: { id: string; code: string; name: string }[] }

@Component({
  selector: 'erp-reports-page',
  imports: [TranslocoPipe, PageHeaderComponent, SegmentedComponent, IconComponent, AmountPipe, MoneyPipe, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="'reports.title' | transloco" [subtitle]="'reports.subtitle' | transloco">
        <ng-container actions>
          <button type="button" class="erp-btn-ghost" (click)="print()"><erp-icon name="printer" [size]="14" />{{ 'reports.print' | transloco }}</button>
          <button type="button" class="erp-btn bg-emerald-700 text-white hover:bg-emerald-800" (click)="exportCsv()"><erp-icon name="download" [size]="14" />{{ 'reports.export' | transloco }}</button>
        </ng-container>
      </erp-page-header>
      <div class="no-print flex flex-wrap items-center justify-between gap-2">
        <erp-segmented [options]="tabs()" [(value)]="report" />
        <label class="flex items-center gap-2 text-xs"><span class="font-semibold text-slate-500">{{ 'reports.costCentre' | transloco }}:</span>
          <select class="erp-input w-auto py-1" [value]="costCentre()" (change)="costCentre.set($any($event.target).value)"><option value="all">{{ 'reports.allCostCentres' | transloco }}</option>@for (a of data.value()?.analytic ?? []; track a.id) { <option [value]="a.id">{{ a.code }} - {{ a.name }}</option> }</select></label>
      </div>

      @if (data.value(); as d) {
        @switch (report()) {
          @case ('pnl') {
            <div class="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div><h2 class="text-base font-extrabold text-slate-900">{{ 'reports.pnl.title' | transloco }}</h2><p class="text-[11px] text-slate-500">{{ 'reports.pnl.subtitle' | transloco }}</p></div>
              <div class="grid gap-6 md:grid-cols-2">
                <section><h3 class="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ 'reports.pnl.income' | transloco }}</h3>
                  <ul class="divide-y divide-slate-100 text-xs">@for (a of income(); track a.id) { <li class="flex justify-between py-1.5"><span><span class="font-mono text-slate-400">{{ a.code }}</span> {{ a.name }}</span><span class="font-mono font-bold text-slate-900">{{ abs(a.balance) | erpMoney }}</span></li> }</ul>
                  <div class="mt-2 flex justify-between border-t border-slate-300 pt-2 text-sm font-extrabold"><span>{{ 'reports.pnl.totalIncome' | transloco }}</span><span class="font-mono text-emerald-700">{{ totalIncome() | erpAmount }}</span></div></section>
                <section><h3 class="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ 'reports.pnl.expenses' | transloco }}</h3>
                  <ul class="divide-y divide-slate-100 text-xs">@for (a of expense(); track a.id) { <li class="flex justify-between py-1.5"><span><span class="font-mono text-slate-400">{{ a.code }}</span> {{ a.name }}</span><span class="font-mono font-bold text-slate-900">{{ abs(a.balance) | erpMoney }}</span></li> }</ul>
                  <div class="mt-2 flex justify-between border-t border-slate-300 pt-2 text-sm font-extrabold"><span>{{ 'reports.pnl.totalExpenses' | transloco }}</span><span class="font-mono text-rose-700">{{ totalExpenses() | erpAmount }}</span></div></section>
              </div>
              <div class="flex items-center justify-between rounded-xl p-4 text-white" [class]="netPositive() ? 'bg-emerald-700' : 'bg-rose-700'"><div class="text-[11px] font-bold uppercase tracking-wider opacity-80">{{ (netPositive() ? 'reports.pnl.netProfit' : 'reports.pnl.netLoss') | transloco }}</div><div class="font-mono text-xl font-black">{{ netProfit() | erpAmount }}</div></div>
            </div>
          }
          @case ('balance_sheet') {
            <div class="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="text-base font-extrabold text-slate-900">{{ 'reports.bs.title' | transloco }}</h2>
                <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" [class]="bsBalanced() ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"><erp-icon [name]="bsBalanced() ? 'check-circle-2' : 'alert-triangle'" [size]="14" />{{ (bsBalanced() ? 'reports.bs.balanced' : 'reports.bs.variance') | transloco }}</span></div>
              <div class="grid gap-6 md:grid-cols-2">
                <section><h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ 'reports.bs.assets' | transloco }}</h3>
                  <ul class="divide-y divide-slate-100 text-xs">@for (a of assets(); track a.id) { <li class="flex justify-between py-1.5"><span><span class="font-mono text-slate-400">{{ a.code }}</span> {{ a.name }}</span><span class="font-mono font-bold text-slate-900">{{ a.balance | erpMoney }}</span></li> }</ul>
                  <div class="mt-2 flex justify-between border-t border-slate-300 pt-2 text-sm font-extrabold"><span>{{ 'reports.bs.totalAssets' | transloco }}</span><span class="font-mono">{{ totalAssets() | erpAmount }}</span></div></section>
                <section class="space-y-3"><div><h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ 'reports.bs.liabilities' | transloco }}</h3>
                    <ul class="divide-y divide-slate-100 text-xs">@for (a of liabilities(); track a.id) { <li class="flex justify-between py-1.5"><span><span class="font-mono text-slate-400">{{ a.code }}</span> {{ a.name }}</span><span class="font-mono font-bold text-slate-900">{{ abs(a.balance) | erpMoney }}</span></li> }</ul></div>
                  <div><h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ 'reports.bs.equity' | transloco }}</h3>
                    <ul class="divide-y divide-slate-100 text-xs">@for (a of equity(); track a.id) { <li class="flex justify-between py-1.5"><span><span class="font-mono text-slate-400">{{ a.code }}</span> {{ a.name }}</span><span class="font-mono font-bold text-slate-900">{{ abs(a.balance) | erpMoney }}</span></li> }
                      <li class="flex justify-between py-1.5"><span>{{ 'reports.bs.currentProfit' | transloco }}</span><span class="font-mono font-bold text-slate-900">{{ netProfit() | erpMoney }}</span></li></ul></div>
                  <div class="flex justify-between border-t border-slate-300 pt-2 text-sm font-extrabold"><span>{{ 'reports.bs.totalLiabEquity' | transloco }}</span><span class="font-mono">{{ totalLiabEquity() | erpAmount }}</span></div></section>
              </div>
            </div>
          }
          @case ('trial_balance') {
            <div class="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-base font-extrabold text-slate-900">{{ 'reports.tb.title' | transloco }}</h2><p class="text-[11px] text-slate-500">{{ 'reports.tb.subtitle' | transloco }}</p></div>
                <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" [class]="tbVariance() === '0.00' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"><erp-icon [name]="tbVariance() === '0.00' ? 'check-circle-2' : 'alert-triangle'" [size]="14" />{{ tbVariance() === '0.00' ? ('reports.tb.balanced' | transloco) : ('reports.tb.variance' | transloco: { amount: tbVariance() }) }}</span></div>
              <div class="overflow-x-auto rounded-lg border border-slate-200"><table class="erp-table"><thead><tr><th>{{ 'reports.tb.account' | transloco }}</th><th class="text-end">{{ 'reports.tb.openDebit' | transloco }}</th><th class="text-end">{{ 'reports.tb.openCredit' | transloco }}</th><th class="text-end">{{ 'reports.tb.periodDebit' | transloco }}</th><th class="text-end">{{ 'reports.tb.periodCredit' | transloco }}</th><th class="text-end">{{ 'reports.tb.closeDebit' | transloco }}</th><th class="text-end">{{ 'reports.tb.closeCredit' | transloco }}</th></tr></thead>
                <tbody class="font-mono">@for (r of tbRows(); track r.account.id) { <tr><td class="font-sans"><span class="font-bold text-emerald-800">{{ r.account.code }}</span> {{ r.account.name }}</td><td class="erp-num">{{ r.od | erpMoney }}</td><td class="erp-num">{{ r.oc | erpMoney }}</td><td class="erp-num">{{ r.pd | erpMoney }}</td><td class="erp-num">{{ r.pc | erpMoney }}</td><td class="erp-num font-bold">{{ r.cd | erpMoney }}</td><td class="erp-num font-bold">{{ r.cc | erpMoney }}</td></tr> }</tbody>
                <tfoot><tr class="bg-slate-50 font-extrabold"><td colspan="5" class="font-sans">{{ 'reports.tb.check' | transloco }}</td><td class="erp-num font-mono text-emerald-800">{{ tbDebit() | erpMoney }}</td><td class="erp-num font-mono text-emerald-800">{{ tbCredit() | erpMoney }}</td></tr></tfoot></table></div>
              <p class="text-[10px] text-slate-400">{{ 'reports.tb.note' | transloco }}</p>
            </div>
          }
          @case ('aged_ar') {
            <div class="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div><h2 class="text-base font-extrabold text-slate-900">{{ 'reports.aged.title' | transloco }}</h2><p class="text-[11px] text-slate-500">{{ 'reports.aged.subtitle' | transloco }}</p></div>
              <div class="overflow-x-auto rounded-lg border border-slate-200"><table class="erp-table"><thead><tr><th>{{ 'reports.aged.customer' | transloco }}</th><th class="text-end">{{ 'reports.aged.current' | transloco }}</th><th class="text-end">1–30</th><th class="text-end">31–60</th><th class="text-end">61–90</th><th class="text-end">90+</th><th class="text-end font-black">{{ 'reports.aged.total' | transloco }}</th></tr></thead>
                <tbody class="font-mono">@for (r of aged(); track r.invoice.id) { <tr><td class="font-sans"><div class="font-bold text-slate-900">{{ r.invoice.partner }}</div><div class="font-mono text-[11px] text-slate-400">{{ r.invoice.number }} · {{ 'reports.aged.due' | transloco }} {{ r.invoice.dateDue }}</div></td><td class="erp-num">{{ r.b[0] | erpMoney }}</td><td class="erp-num">{{ r.b[1] | erpMoney }}</td><td class="erp-num">{{ r.b[2] | erpMoney }}</td><td class="erp-num">{{ r.b[3] | erpMoney }}</td><td class="erp-num">{{ r.b[4] | erpMoney }}</td><td class="erp-num font-black">{{ r.invoice.residual | erpMoney }}</td></tr> }</tbody>
                <tfoot><tr class="bg-slate-50 font-extrabold"><td class="font-sans">{{ 'reports.aged.totals' | transloco }}</td>@for (t of agedTotals(); track $index) { <td class="erp-num font-mono">{{ t | erpMoney }}</td> }</tr></tfoot></table></div>
              @if (aged().length === 0) { <erp-empty-state [title]="'reports.aged.empty' | transloco" /> }
            </div>
          }
          @case ('gl') {
            <div class="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div class="flex flex-wrap items-end justify-between gap-3"><div><h2 class="text-base font-extrabold text-slate-900">{{ 'reports.gl.title' | transloco }}</h2><p class="text-[11px] text-slate-400">{{ 'reports.gl.subtitle' | transloco }}</p></div>
                <select class="erp-input w-auto min-w-64" [attr.aria-label]="'reports.gl.account' | transloco" [value]="glCode()" (change)="glCodeLocal.set($any($event.target).value)">@for (a of d.accounts; track a.id) { <option [value]="a.code" [selected]="a.code === glCode()">{{ a.code }} - {{ a.name }}</option> }</select></div>
              @if (glAccount(); as acc) {
                <div class="flex items-center justify-between rounded-lg bg-slate-50 p-3"><div><div class="text-sm font-extrabold text-slate-900">{{ acc.code }} {{ acc.name }}</div><div class="text-[11px] text-slate-500">{{ 'reports.gl.group' | transloco }}: {{ acc.internalGroup }} • {{ 'reports.gl.type' | transloco }}: {{ acc.type }}</div></div><div class="text-end"><div class="text-[10px] font-bold uppercase text-slate-400">{{ 'reports.gl.balance' | transloco }}</div><div class="font-mono text-base font-bold text-slate-900">{{ acc.balance | erpAmount: acc.currency || 'SAR' }}</div></div></div>
              }
              <div class="overflow-x-auto rounded-lg border border-slate-200"><table class="erp-table"><thead><tr><th>{{ 'common.date' | transloco }}</th><th>{{ 'reports.gl.entry' | transloco }}</th><th>{{ 'reports.gl.partner' | transloco }}</th><th>{{ 'reports.gl.label' | transloco }}</th><th class="text-end">{{ 'reports.gl.debit' | transloco }}</th><th class="text-end">{{ 'reports.gl.credit' | transloco }}</th><th class="text-end">{{ 'reports.gl.running' | transloco }}</th></tr></thead>
                <tbody class="font-mono">@for (l of glLines(); track $index) { <tr><td class="whitespace-nowrap">{{ l.date }}</td><td class="font-bold">{{ l.entryNumber }}</td><td class="font-sans">{{ l.partner }}</td><td class="font-sans">{{ l.label }}</td><td class="erp-num">{{ l.debit | erpMoney }}</td><td class="erp-num">{{ l.credit | erpMoney }}</td><td class="erp-num font-bold">{{ l.running | erpMoney }}</td></tr> }</tbody></table>
                @if (glLines().length === 0) { <erp-empty-state [title]="'reports.gl.empty' | transloco" /> }</div>
            </div>
          }
        }
      } @else { <p class="py-10 text-center text-sm text-slate-400">{{ 'common.loading' | transloco }}</p> }
    </div>`,
})
export class ReportsPage {
  private readonly api = inject(AccountingApi);
  private readonly changes = inject(DataChanges);
  private readonly i18n = inject(I18n);

  /** `?account=<code>` opens the general ledger on that account (drill-down from the chart of accounts). */
  readonly accountParam = input<string | undefined>(undefined, { alias: 'account' });
  protected readonly report = signal<string>('pnl');
  protected readonly costCentre = signal('all');
  protected readonly glCodeLocal = signal('');
  protected readonly abs = (v: Decimal) => abs(v);

  protected readonly data = resource<Data, number>({
    params: () => this.changes.revision(),
    loader: async () => {
      const [accounts, invoices, entries, analytic] = await Promise.all([this.api.accounts(), this.api.invoices(), this.api.journalEntries(), this.api.analyticAccounts()]);
      return { accounts, invoices, entries, analytic: analytic.map(a => ({ id: a.id, code: a.code, name: a.name })) };
    },
  });
  protected readonly tabs = computed(() => REPORTS.map(id => ({ id, label: this.i18n.tr('reports.tab.' + id) })));

  constructor() { /* the drill-down param selects the GL tab once */ queueMicrotask(() => { if (this.accountParam()) this.report.set('gl'); }); }

  private grp = (g: Account['internalGroup']) => (this.data.value()?.accounts ?? []).filter(a => a.internalGroup === g);
  protected readonly income = computed(() => this.grp('income'));
  protected readonly expense = computed(() => this.grp('expense'));
  protected readonly assets = computed(() => this.grp('asset'));
  protected readonly liabilities = computed(() => this.grp('liability'));
  protected readonly equity = computed(() => this.grp('equity'));
  protected readonly totalIncome = computed<Decimal>(() => sum(this.income().map(a => abs(a.balance))));
  protected readonly totalExpenses = computed<Decimal>(() => sum(this.expense().map(a => abs(a.balance))));
  protected readonly netProfit = computed<Decimal>(() => sub(this.totalIncome(), this.totalExpenses()));
  protected readonly netPositive = computed(() => !gt('0', this.netProfit()));
  protected readonly totalAssets = computed<Decimal>(() => sum(this.assets().map(a => a.balance)));
  protected readonly totalLiabEquity = computed<Decimal>(() => add(add(sum(this.liabilities().map(a => abs(a.balance))), sum(this.equity().map(a => abs(a.balance)))), this.netProfit()));
  protected readonly bsBalanced = computed(() => !gt(abs(sub(this.totalAssets(), this.totalLiabEquity())), '1.00'));

  /** Opening/period split is the prototype's indicative 80/20; closing balances are the account balances. */
  protected readonly tbRows = computed(() => (this.data.value()?.accounts ?? []).map(a => {
    const debitNormal = a.internalGroup === 'asset' || a.internalGroup === 'expense';
    const bal = debitNormal ? a.balance : abs(a.balance);
    const open = max('0.00', mul(bal, '0.8'));
    const per = max('0.00', mul(bal, '0.2'));
    return { account: a, od: debitNormal ? open : '0.00', oc: debitNormal ? '0.00' : open, pd: debitNormal ? per : '0.00', pc: debitNormal ? '0.00' : per, cd: debitNormal ? a.balance : '0.00', cc: debitNormal ? '0.00' : abs(a.balance) };
  }));
  protected readonly tbDebit = computed<Decimal>(() => sum(this.tbRows().map(r => r.cd)));
  protected readonly tbCredit = computed<Decimal>(() => sum(this.tbRows().map(r => r.cc)));
  protected readonly tbVariance = computed<Decimal>(() => abs(sub(this.tbDebit(), this.tbCredit())));

  protected readonly aged = computed(() => (this.data.value()?.invoices ?? []).filter(i => i.state !== 'paid' && i.state !== 'cancel').map(invoice => {
    const days = daysBetween(invoice.dateDue, todayIso());
    const idx = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
    return { invoice, b: [0, 1, 2, 3, 4].map(i => (i === idx ? invoice.residual : '0.00')) };
  }));
  protected readonly agedTotals = computed(() => [0, 1, 2, 3, 4].map(i => sum(this.aged().map(r => r.b[i]))).concat([sum(this.aged().map(r => r.invoice.residual))]));

  protected readonly glCode = computed(() => this.glCodeLocal() || this.accountParam() || '101000');
  protected readonly glAccount = computed(() => { const a = this.data.value()?.accounts ?? []; return a.find(x => x.code === this.glCode()) ?? a[0]; });
  protected readonly glLines = computed(() => {
    const acc = this.glAccount();
    if (!acc) return [];
    let running: Decimal = '0.00';
    return (this.data.value()?.entries ?? []).flatMap(e => e.lines.filter(l => l.accountCode === acc.code && (this.costCentre() === 'all' || l.analyticAccountId === this.costCentre()))
      .map(l => ({ entryNumber: e.entryNumber, date: e.entryDate, label: l.label, debit: l.debit, credit: l.credit, partner: l.partner || '—' })))
      .map(l => { running = add(running, sub(l.debit, l.credit)); return { ...l, running }; });
  });

  protected print(): void { window.print(); }
  protected exportCsv(): void {
    const rows: unknown[][] = this.report() === 'trial_balance'
      ? [['Account', 'Closing debit', 'Closing credit'], ...this.tbRows().map(r => [`${r.account.code} ${r.account.name}`, r.cd, r.cc])]
      : this.report() === 'aged_ar' ? [['Customer', 'Invoice', 'Due', 'Outstanding'], ...this.aged().map(r => [r.invoice.partner, r.invoice.number, r.invoice.dateDue, r.invoice.residual])]
      : this.report() === 'gl' ? [['Date', 'Entry', 'Partner', 'Label', 'Debit', 'Credit', 'Running'], ...this.glLines().map(l => [l.date, l.entryNumber, l.partner, l.label, l.debit, l.credit, l.running])]
      : [['Account', 'Group', 'Balance'], ...(this.data.value()?.accounts ?? []).filter(a => (this.report() === 'pnl' ? ['income', 'expense'] : ['asset', 'liability', 'equity']).includes(a.internalGroup)).map(a => [`${a.code} ${a.name}`, a.internalGroup, a.balance])];
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${this.report()}.csv`; a.click(); URL.revokeObjectURL(url);
  }
}
