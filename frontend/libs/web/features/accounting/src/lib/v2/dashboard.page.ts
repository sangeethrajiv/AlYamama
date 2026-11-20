import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AccountingBackend, type Rec } from '@erp/web/api-client';
import { ErrorBannerComponent, PageHeaderComponent } from '@erp/web/ui';

/** Accounting overview: one card per journal with what needs attention (Odoo's accounting dashboard). */
@Component({
  selector: 'erp-accounting-dashboard-page',
  imports: [RouterLink, NgTemplateOutlet, PageHeaderComponent, ErrorBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-page-header title="Accounting Overview" subtitle="Journals of the current company and what needs your attention." />
    <erp-error-banner [text]="error()" />
    <div class="grid gap-4 lg:grid-cols-2">
      @for (c of cards(); track c['journal_id']) {
        <section class="rounded-xl border border-slate-200 border-s-4 bg-white p-4 shadow-sm" [class]="accent(c)">
          <div class="flex items-start justify-between">
            <div><h2 class="font-display text-base font-extrabold text-slate-800">{{ c['name'] }}</h2><p class="text-xs capitalize text-slate-400">{{ label(c) }}</p></div>
            <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{{ c['code'] }}</span>
          </div>
          @switch (c['type']) {
            @case ('sale') {
              <div class="mt-3 flex flex-wrap gap-2">
                <a class="erp-btn-primary erp-btn-sm" [routerLink]="['/accounting', newPath(c), 'new']">New {{ c['invoice_category'] === 'proforma' ? 'Proforma' : 'Invoice' }}</a>
                <a class="erp-btn-ghost erp-btn-sm" [routerLink]="['/accounting', listPath(c)]">Open</a>
              </div>
              <dl class="mt-3 space-y-1 text-xs">
                <div class="flex justify-between"><dt class="text-slate-500">Invoices to validate</dt><dd class="font-mono font-bold">{{ c['draft'] }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Unpaid invoices ({{ c['unpaid'] }})</dt><dd class="font-mono font-bold">{{ money(c['unpaid_amount']) }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Late ({{ c['late'] }})</dt><dd class="font-mono font-bold" [class]="num(c['late']) ? 'text-rose-600' : ''">{{ money(c['late_amount']) }}</dd></div>
              </dl>
            }
            @case ('purchase') {
              <div class="mt-3 flex flex-wrap gap-2">
                <a class="erp-btn-primary erp-btn-sm" routerLink="/accounting/vendor-bills/new">New Bill</a>
                <a class="erp-btn-ghost erp-btn-sm" routerLink="/accounting/vendor-bills">Open</a>
              </div>
              <dl class="mt-3 space-y-1 text-xs">
                <div class="flex justify-between"><dt class="text-slate-500">Bills to validate</dt><dd class="font-mono font-bold">{{ c['draft'] }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Waiting for approval</dt><dd class="font-mono font-bold">{{ c['to_approve'] }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Bills to pay ({{ c['unpaid'] }})</dt><dd class="font-mono font-bold">{{ money(c['unpaid_amount']) }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Late ({{ c['late'] }})</dt><dd class="font-mono font-bold" [class]="num(c['late']) ? 'text-rose-600' : ''">{{ money(c['late_amount']) }}</dd></div>
              </dl>
            }
            @case ('bank') { <ng-container [ngTemplateOutlet]="liquid" [ngTemplateOutletContext]="{ c: c }" /> }
            @case ('cash') { <ng-container [ngTemplateOutlet]="liquid" [ngTemplateOutletContext]="{ c: c }" /> }
            @default {
              <dl class="mt-3 space-y-1 text-xs"><div class="flex justify-between"><dt class="text-slate-500">Draft entries</dt><dd class="font-mono font-bold">{{ c['draft'] }}</dd></div></dl>
              <div class="mt-3"><a class="erp-btn-ghost erp-btn-sm" routerLink="/accounting/journal-entries">Journal entries</a></div>
            }
          }
        </section>
      }
    </div>
    <ng-template #liquid let-c="c">
      <div class="mt-3 flex flex-wrap gap-2">
        <a class="erp-btn-primary erp-btn-sm" routerLink="/accounting/bank-statements/new">New Statement</a>
        <a class="erp-btn-ghost erp-btn-sm" routerLink="/accounting/reconciliation">Reconcile</a>
      </div>
      <dl class="mt-3 space-y-1 text-xs">
        <div class="flex justify-between"><dt class="text-slate-500">Balance in General Ledger</dt><dd class="font-mono font-bold">{{ money(c['gl_balance']) }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Latest Statement</dt><dd class="font-mono font-bold">{{ c['last_statement'] === null ? '—' : money(c['last_statement']) }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Transactions to reconcile</dt><dd class="font-mono font-bold">{{ c['to_reconcile'] }}</dd></div>
      </dl>
    </ng-template>`,
})
export class AccountingDashboardPage {
  private readonly ab = inject(AccountingBackend);
  protected readonly cards = signal<Rec[]>([]);
  protected readonly error = signal('');

  constructor() {
    effect(() => { this.ab.companyKey(); untracked(() => void this.load()); });
  }
  private async load(): Promise<void> {
    try { this.cards.set(await this.ab.get<Rec[]>('/accounting/dashboard')); this.error.set(''); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not load the overview.'); }
  }
  protected num = (v: unknown) => Number(v) || 0;
  protected money = (v: unknown) => (Number(v) || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  protected label = (c: Rec) => ({ sale: 'Sale', purchase: 'Purchase', bank: 'Bank', cash: 'Cash', general: 'Miscellaneous' }[String(c['type'])] ?? String(c['type']));
  protected accent = (c: Rec) => ({ sale: 'border-s-emerald-500', purchase: 'border-s-violet-500', bank: 'border-s-sky-500', cash: 'border-s-amber-500' }[String(c['type'])] ?? 'border-s-slate-300');
  protected newPath = (c: Rec) => ({ cash: 'cash-invoices', proforma: 'proforma-invoices' }[String(c['invoice_category'])] ?? 'customer-invoices');
  protected listPath = (c: Rec) => this.newPath(c);
}
