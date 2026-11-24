import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountingBackend } from '@erp/web/api-client';
import { ErrorBannerComponent, PageHeaderComponent, SelectComponent } from '@erp/web/ui';
import type { Row } from './lines-editor.component';

interface Col { key: string; label: string; right?: boolean; mono?: boolean }
interface Table { title?: string; columns: Col[]; rows: Row[]; totals?: Row }

/** Which filters each report takes, and its title. The list of reports comes from the backend; this is the presentation. */
const REPORTS: { key: string; name: string; filters: ('range' | 'asOf' | 'moves' | 'account' | 'partner' | 'journal' | 'kind')[]; help: string }[] = [
  { key: 'trial-balance', name: 'Trial Balance', filters: ['range', 'moves'], help: 'Opening, period movement and closing balance per account.' },
  { key: 'general-ledger', name: 'General Ledger', filters: ['range', 'moves', 'account', 'journal'], help: 'Every posted line per account with a running balance.' },
  { key: 'partner-ledger', name: 'Partner Ledger', filters: ['range', 'moves', 'kind'], help: 'Receivable and payable balances per partner.' },
  { key: 'aged-receivable', name: 'Aged Receivable', filters: ['asOf'], help: 'What customers owe, by how late it is.' },
  { key: 'aged-payable', name: 'Aged Payable', filters: ['asOf'], help: 'What you owe vendors, by how late it is.' },
  { key: 'profit-loss', name: 'Profit and Loss', filters: ['range', 'moves'], help: 'Income less expenses for the period.' },
  { key: 'balance-sheet', name: 'Balance Sheet', filters: ['asOf', 'moves'], help: 'Assets, liabilities and equity at a date.' },
  { key: 'tax-report', name: 'Tax Report', filters: ['range', 'moves'], help: 'Output and input tax with their bases.' },
  { key: 'journal-summary', name: 'Journals Audit', filters: ['range', 'moves', 'journal'], help: 'Debit and credit totals per journal.' },
];

const A = (k = 'amount'): Col => ({ key: k, label: 'Amount', right: true, mono: true });

/** Turns one report response into plain tables, so a single template can show all of them. */
function toTables(key: string, d: Row): Table[] {
  const rows = (v: unknown) => (v as Row[]) ?? [];
  const t = (v: unknown) => (v as Row) ?? {};
  switch (key) {
    case 'trial-balance':
      return [{ columns: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Account' }, { key: 'initial', label: 'Initial Balance', right: true, mono: true }, { key: 'debit', label: 'Debit', right: true, mono: true }, { key: 'credit', label: 'Credit', right: true, mono: true }, { key: 'ending', label: 'Ending Balance', right: true, mono: true }], rows: rows(d['lines']), totals: { name: 'Total', ...t(d['totals']) } }];
    case 'general-ledger':
      return rows(d['accounts']).map(a => ({
        title: `${a['code']} ${a['name']}  ·  initial ${a['initial']}  ·  ending ${a['ending']}`,
        columns: [{ key: 'date', label: 'Date' }, { key: 'move', label: 'Entry', mono: true }, { key: 'journal', label: 'Journal' }, { key: 'partner', label: 'Partner' }, { key: 'label', label: 'Label' }, { key: 'debit', label: 'Debit', right: true, mono: true }, { key: 'credit', label: 'Credit', right: true, mono: true }, { key: 'balance', label: 'Balance', right: true, mono: true }],
        rows: rows(a['lines']).map(l => ({ ...l, date: String(l['date']).slice(0, 10) })), totals: { label: 'Total', debit: a['debit'], credit: a['credit'], balance: a['ending'] },
      }));
    case 'partner-ledger':
      return [{ columns: [{ key: 'name', label: 'Partner' }, { key: 'initial', label: 'Initial', right: true, mono: true }, { key: 'debit', label: 'Debit', right: true, mono: true }, { key: 'credit', label: 'Credit', right: true, mono: true }, { key: 'ending', label: 'Balance', right: true, mono: true }], rows: rows(d['partners']) }];
    case 'aged-receivable': case 'aged-payable': {
      const cols: Col[] = [{ key: 'name', label: 'Partner' }, ...['not_due', '1-30', '31-60', '61-90', '91-120', 'older'].map(b => ({ key: b, label: b === 'not_due' ? 'Not Due' : b === 'older' ? 'Older' : b + ' days', right: true, mono: true })), { key: 'total', label: 'Total', right: true, mono: true }];
      return [{ columns: cols, rows: rows(d['partners']), totals: { name: 'Total', ...t(d['totals']) } }];
    }
    case 'profit-loss':
      return [
        { title: `Income  ·  ${d['total_income']}`, columns: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Account' }, A()], rows: rows(d['income']) },
        { title: `Expenses  ·  ${d['total_expense']}`, columns: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Account' }, A()], rows: rows(d['expense']) },
        { title: 'Result', columns: [{ key: 'name', label: '' }, A()], rows: [{ name: 'Net Profit', amount: d['net_profit'] }] },
      ];
    case 'balance-sheet':
      return [
        { title: `Assets  ·  ${d['total_assets']}`, columns: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Account' }, A()], rows: rows(d['assets']) },
        { title: `Liabilities  ·  ${d['total_liabilities']}`, columns: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Account' }, A()], rows: rows(d['liabilities']) },
        { title: `Equity  ·  ${d['total_equity']}`, columns: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Account' }, A()], rows: [...rows(d['equity']), { code: '', name: 'Unallocated Earnings', amount: d['unallocated_earnings'] }] },
        { title: 'Check', columns: [{ key: 'name', label: '' }, A()], rows: [{ name: 'Total Liabilities and Equity', amount: d['total_liabilities_and_equity'] }] },
      ];
    case 'tax-report': {
      const cols: Col[] = [{ key: 'name', label: 'Tax' }, { key: 'rate', label: 'Rate %', right: true, mono: true }, { key: 'base', label: 'Base', right: true, mono: true }, { key: 'tax', label: 'Tax', right: true, mono: true }];
      return [
        { title: `Sales (output tax)  ·  ${d['output_tax']}`, columns: cols, rows: rows(d['sales']) },
        { title: `Purchases (input tax)  ·  ${d['input_tax']}`, columns: cols, rows: rows(d['purchases']) },
        { title: 'Result', columns: [{ key: 'name', label: '' }, A()], rows: [{ name: 'Net tax payable', amount: d['net_tax_payable'] }] },
      ];
    }
    case 'journal-summary':
      return [{ columns: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Journal' }, { key: 'type', label: 'Type' }, { key: 'moves', label: 'Entries', right: true }, { key: 'debit', label: 'Debit', right: true, mono: true }, { key: 'credit', label: 'Credit', right: true, mono: true }], rows: rows(d['journals']) }];
    default: return [];
  }
}

const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-01-01`; };
const today = () => new Date().toISOString().slice(0, 10);

/** Accounting reports. Route data: `{ report }` picks the one shown; the menu links one entry per report. */
@Component({
  selector: 'erp-accounting-reports-page',
  imports: [FormsModule, PageHeaderComponent, SelectComponent, ErrorBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-page-header [title]="meta().name" [subtitle]="meta().help">
      <button actions type="button" class="erp-btn-ghost no-print" (click)="print()">Print</button>
    </erp-page-header>
    <div class="no-print flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <label class="text-[11px] font-bold text-slate-600">Report<select class="erp-input mt-1" [value]="report()" (change)="go($any($event.target).value)">@for (r of reports; track r.key) { <option [value]="r.key">{{ r.name }}</option> }</select></label>
      @if (has('range')) { <label class="text-[11px] font-bold text-slate-600">From<input type="date" class="erp-input mt-1" [value]="from()" (input)="from.set($any($event.target).value)" /></label> }
      @if (has('range') || has('asOf')) { <label class="text-[11px] font-bold text-slate-600">{{ has('asOf') ? 'As of' : 'To' }}<input type="date" class="erp-input mt-1" [value]="to()" (input)="to.set($any($event.target).value)" /></label> }
      @if (has('moves')) { <label class="text-[11px] font-bold text-slate-600">Entries<select class="erp-input mt-1" [value]="moves()" (change)="moves.set($any($event.target).value)"><option value="posted">All posted entries</option><option value="all">All entries (incl. draft)</option></select></label> }
      @if (has('kind')) { <label class="text-[11px] font-bold text-slate-600">Partners<select class="erp-input mt-1" [value]="kind()" (change)="kind.set($any($event.target).value)"><option value="both">Receivable and payable</option><option value="receivable">Customers</option><option value="payable">Vendors</option></select></label> }
      @if (has('account')) { <label class="w-56 text-[11px] font-bold text-slate-600">Account<erp-select class="mt-1" [ngModel]="account()" (ngModelChange)="account.set($event)" [search]="accounts" placeholder="All accounts" /></label> }
      @if (has('journal')) { <label class="w-56 text-[11px] font-bold text-slate-600">Journal<erp-select class="mt-1" [ngModel]="journal()" (ngModelChange)="journal.set($event)" [search]="journals" placeholder="All journals" /></label> }
      <button type="button" class="erp-btn-primary" [disabled]="loading()" (click)="run()">{{ loading() ? 'Running…' : 'Run report' }}</button>
    </div>
    <erp-error-banner [text]="error()" />
    <div class="mt-3 space-y-4">
      @for (t of tables(); track $index) {
        <section class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          @if (t.title) { <h3 class="border-b border-slate-100 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">{{ t.title }}</h3> }
          <table class="erp-table w-full">
            <thead><tr>@for (c of t.columns; track c.key) { <th [class.text-end]="c.right">{{ c.label }}</th> }</tr></thead>
            <tbody>
              @for (r of t.rows; track $index) { <tr>@for (c of t.columns; track c.key) { <td [class.text-end]="c.right" [class.font-mono]="c.mono">{{ r[c.key] ?? '' }}</td> }</tr> }
              @empty { <tr><td [attr.colspan]="t.columns.length" class="py-4 text-center text-xs text-slate-400">Nothing to show for these filters.</td></tr> }
              @if (t.totals; as tot) { <tr class="bg-slate-50 font-bold">@for (c of t.columns; track c.key) { <td [class.text-end]="c.right" [class.font-mono]="c.mono">{{ tot[c.key] ?? '' }}</td> }</tr> }
            </tbody>
          </table>
        </section>
      } @empty { @if (ran() && !loading()) { <p class="text-sm text-slate-500">Nothing to show for these filters.</p> } }
    </div>`,
})
export class AccountingReportsPage {
  private readonly ab = inject(AccountingBackend);
  private readonly router = inject(Router);

  readonly report = input<string>('trial-balance');
  protected readonly reports = REPORTS;
  protected readonly meta = computed(() => REPORTS.find(r => r.key === this.report()) ?? REPORTS[0]);
  protected readonly accounts = this.ab.lookup('accounts');
  protected readonly journals = this.ab.lookup('journals');
  protected readonly from = signal(monthStart());
  protected readonly to = signal(today());
  protected readonly moves = signal('posted');
  protected readonly kind = signal('both');
  protected readonly account = signal<number | null>(null);
  protected readonly journal = signal<number | null>(null);
  protected readonly tables = signal<Table[]>([]);
  protected readonly loading = signal(false);
  protected readonly ran = signal(false);
  protected readonly error = signal('');

  constructor() { effect(() => { this.report(); this.ab.companyKey(); untracked(() => void this.run()); }); }

  protected has = (f: 'range' | 'asOf' | 'moves' | 'account' | 'partner' | 'journal' | 'kind') => this.meta().filters.includes(f);
  protected go(key: string): void { void this.router.navigate(['/accounting', 'report', key]); }
  protected print(): void { window.print(); }

  protected async run(): Promise<void> {
    const m = this.meta();
    this.loading.set(true); this.error.set('');
    try {
      const d = await this.ab.get<Row>(`/accounting/reports/${m.key}`, {
        date_from: this.has('range') ? this.from() : undefined, date_to: this.has('range') || this.has('asOf') ? this.to() : undefined,
        target_move: this.has('moves') ? this.moves() : undefined, kind: this.has('kind') ? this.kind() : undefined,
        account_id: this.has('account') ? this.account() ?? undefined : undefined, journal_id: this.has('journal') ? this.journal() ?? undefined : undefined,
      });
      this.tables.set(toTables(m.key, d)); this.ran.set(true);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not run the report.'); }
    finally { this.loading.set(false); }
  }
}
