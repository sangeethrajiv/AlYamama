import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountingBackend } from '@erp/web/api-client';
import { DialogService, DocumentActionBarComponent, EmptyStateComponent, ErrorBannerComponent, IconComponent, MultiSelectComponent, PageHeaderComponent, PagerComponent, PillComponent, SelectComponent, ToastService, type ActionItem, type SelectOption } from '@erp/web/ui';
import { LinesEditorComponent, type LineColumn, type Row } from './lines-editor.component';
import { pillText, pillTone } from './resource-spec';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Bank statements. No `id` -> the list. `new` -> create a statement with its lines. A number -> the statement, where each
 * line is reconciled with open invoices/bills (with an optional write-off) or booked straight to an account.
 */
@Component({
  selector: 'erp-bank-statements-page',
  imports: [FormsModule, RouterLink, PageHeaderComponent, PagerComponent, EmptyStateComponent, ErrorBannerComponent, PillComponent, IconComponent, SelectComponent, MultiSelectComponent, LinesEditorComponent, DocumentActionBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!id()) {
      <erp-page-header title="Bank Statements" subtitle="Statements entered for your bank and cash journals.">
        <ng-container actions>
          <button type="button" class="erp-btn-ghost" (click)="importOpen.set(!importOpen())"><erp-icon name="upload" [size]="15" />Import</button>
          <a class="erp-btn-primary" routerLink="/accounting/bank-statements/new"><erp-icon name="plus" [size]="15" />New</a>
        </ng-container>
      </erp-page-header>
      <erp-error-banner [text]="error()" />
      @if (importOpen()) {
        <section class="mt-3 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:grid-cols-3">
          <label class="block text-[11px] font-bold text-slate-600">Journal<erp-select class="mt-1" [ngModel]="impJournal()" (ngModelChange)="impJournal.set($event)" [search]="journals" placeholder="Bank or cash journal" /></label>
          <label class="block text-[11px] font-bold text-slate-600 sm:col-span-2">Statement file (CSV or OFX)<input type="file" accept=".csv,.ofx,.qfx,.txt" class="erp-input mt-1" (change)="pickFile($event)" /></label>
          <p class="text-xs text-slate-500 sm:col-span-3">CSV: a header row with a <b>date</b> column and an <b>amount</b> column (or <b>debit</b> and <b>credit</b>); optional <b>description</b>, <b>reference</b>, <b>partner</b>, <b>balance</b>. A file imported twice adds nothing new.</p>
          <div class="sm:col-span-3"><button type="button" class="erp-btn-primary" [disabled]="busy() || !impContent()" (click)="runImport()">{{ busy() ? 'Importing…' : 'Import statement' }}</button>@if (impName()) { <span class="ms-3 text-xs text-slate-500">{{ impName() }}</span> }</div>
        </section>
      }
      <div class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table class="erp-table w-full">
          <thead><tr><th>Statement</th><th>Date</th><th>Journal</th><th class="text-end">Starting Balance</th><th class="text-end">Ending Balance</th><th class="text-end">Lines</th><th class="text-end">To Reconcile</th><th>Status</th></tr></thead>
          <tbody>
            @for (s of list(); track s['id']) {
              <tr class="cursor-pointer" tabindex="0" (click)="open(s['id'])" (keydown.enter)="open(s['id'])">
                <td class="font-bold text-slate-900">{{ s['name'] }}</td><td>{{ str(s['date']).slice(0, 10) }}</td><td>{{ nameOf(s['journal_id']) }}</td>
                <td class="text-end font-mono">{{ fmt(s['balance_start']) }}</td><td class="text-end font-mono">{{ fmt(s['balance_end']) }}</td><td class="text-end">{{ s['line_count'] }}</td><td class="text-end">{{ s['unreconciled'] }}</td>
                <td><erp-pill [tone]="tone(str(s['state']))">{{ pretty(str(s['state'])) }}</erp-pill></td>
              </tr>
            }
          </tbody>
        </table>
        @if (!loading() && list().length === 0) { <erp-empty-state title="No bank statements yet" /> }
        <erp-pager [total]="total()" [pageSize]="25" [(page)]="page" />
      </div>
    } @else {
      <div class="mx-auto max-w-6xl space-y-4 pb-10">
        <div>
          <nav class="mb-1 flex items-center gap-1 text-xs"><a routerLink="/accounting/bank-statements" class="font-bold text-emerald-700 hover:underline">Bank Statements</a><erp-icon name="chevron-right" [size]="12" [flip]="true" class="text-slate-400" /></nav>
          <div class="flex items-center gap-2.5"><h1 class="font-display text-xl font-black tracking-tight text-slate-800">{{ isNew() ? 'New Bank Statement' : str(st()['name']) }}</h1>
            @if (!isNew()) { <erp-pill [tone]="tone(str(st()['state']))">{{ pretty(str(st()['state'])) }}</erp-pill> }</div>
        </div>
        <erp-error-banner [text]="error()" />
        <erp-document-action-bar [items]="actions()" />

        <section class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-5">
          <label class="block text-[11px] font-bold text-slate-600">Journal<erp-select class="mt-1" [ngModel]="hJournal()" (ngModelChange)="hJournal.set($event)" [search]="journals" [labelHint]="hJournalLabel()" [disabled]="!isNew()" placeholder="Bank or cash journal" /></label>
          <label class="block text-[11px] font-bold text-slate-600">Name<input class="erp-input mt-1" [value]="hName()" [disabled]="!isNew()" (input)="hName.set($any($event.target).value)" placeholder="Optional" /></label>
          <label class="block text-[11px] font-bold text-slate-600">Date<input type="date" class="erp-input mt-1" [value]="hDate()" [disabled]="!isNew()" (input)="hDate.set($any($event.target).value)" /></label>
          <label class="block text-[11px] font-bold text-slate-600">Starting Balance<input class="erp-input mt-1 text-end font-mono" [value]="hStart()" [disabled]="!isNew()" (input)="hStart.set($any($event.target).value)" /></label>
          <label class="block text-[11px] font-bold text-slate-600">Ending Balance (bank)<input class="erp-input mt-1 text-end font-mono" [value]="hEnd()" [disabled]="!isNew()" (input)="hEnd.set($any($event.target).value)" /></label>
        </section>

        @if (isNew()) {
          <section class="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <h3 class="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Transactions</h3>
            <erp-lines-editor [columns]="lineColumns" [rows]="newLines()" [newRow]="blankLine" (rowsChange)="newLines.set($event)" />
          </section>
          <div class="flex justify-end gap-2"><a class="erp-btn-ghost" routerLink="/accounting/bank-statements">Close</a><button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="create()">Create statement</button></div>
        } @else {
          <section class="flex flex-wrap gap-6 rounded-xl border border-slate-200 bg-white p-4 text-xs">
            <span>Starting <b class="font-mono">{{ fmt(st()['balance_start']) }}</b></span><span>Computed ending <b class="font-mono">{{ fmt(st()['balance_end']) }}</b></span>
            <span>Ending (bank) <b class="font-mono">{{ fmt(st()['balance_end_real']) }}</b></span>
            <span>Difference <b class="font-mono" [class]="num(st()['difference']) === 0 ? 'text-emerald-700' : 'text-rose-600'">{{ fmt(st()['difference']) }}</b></span>
          </section>
          <section class="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <h3 class="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Transactions</h3>
            <table class="erp-table w-full">
              <thead><tr><th>Date</th><th>Label</th><th>Partner</th><th class="text-end">Amount</th><th>Status</th><th></th></tr></thead>
              <tbody>
                @for (l of lines(); track l['id']) {
                  <tr>
                    <td>{{ str(l['date']).slice(0, 10) }}</td><td>{{ l['name'] }}</td><td>{{ nameOf(l['partner_id']) }}</td><td class="text-end font-mono" [class]="num(l['amount']) < 0 ? 'text-rose-600' : 'text-emerald-700'">{{ fmt(l['amount']) }}</td>
                    <td><erp-pill [tone]="l['reconciled'] ? 'green' : 'amber'">{{ l['reconciled'] ? 'reconciled' : 'to reconcile' }}</erp-pill></td>
                    <td class="text-end">
                      @if (st()['state'] === 'open') {
                        @if (l['reconciled']) { <button type="button" class="rounded px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50" [disabled]="busy()" (click)="unbook(l)">Unreconcile</button> }
                        @else {
                          <button type="button" class="rounded px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50" (click)="startRec(l)">Reconcile</button>
                          <button type="button" class="rounded px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100" [disabled]="busy()" (click)="removeLine(l)">Delete</button>
                        }
                      }
                    </td>
                  </tr>
                  @if (recLine()?.['id'] === l['id']) {
                    <tr><td colspan="6" class="bg-emerald-50/50 !p-3">
                      <div class="grid gap-3 sm:grid-cols-2">
                        <label class="block text-[11px] font-bold text-slate-600">Match open items<erp-multi-select class="mt-1" [ngModel]="matchIds()" (ngModelChange)="matchIds.set($event)" [search]="openItems()" placeholder="Search open invoices, bills, payments…" /></label>
                        <label class="block text-[11px] font-bold text-slate-600">…or book to account<erp-select class="mt-1" [ngModel]="bookAccount()" (ngModelChange)="bookAccount.set($event)" [search]="accounts" placeholder="Account" /></label>
                        <label class="block text-[11px] font-bold text-slate-600">Write-off account (for any difference)<erp-select class="mt-1" [ngModel]="woAccount()" (ngModelChange)="woAccount.set($event)" [search]="accounts" placeholder="None" /></label>
                        <label class="block text-[11px] font-bold text-slate-600">Write-off label<input class="erp-input mt-1" [value]="woLabel()" (input)="woLabel.set($any($event.target).value)" /></label>
                      </div>
                      <div class="mt-3 flex gap-2"><button type="button" class="erp-btn-primary erp-btn-sm" [disabled]="busy()" (click)="reconcileLine()">Validate</button><button type="button" class="erp-btn-ghost erp-btn-sm" (click)="recLine.set(null)">Back</button></div>
                    </td></tr>
                  }
                }
              </tbody>
            </table>
            @if (st()['state'] === 'open') {
              <div class="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-5">
                <input type="date" class="erp-input" [value]="addDate()" (input)="addDate.set($any($event.target).value)" aria-label="Date" />
                <input class="erp-input sm:col-span-2" placeholder="Label" [value]="addName()" (input)="addName.set($any($event.target).value)" />
                <input class="erp-input text-end font-mono" placeholder="Amount (+in / −out)" [value]="addAmount()" (input)="addAmount.set($any($event.target).value)" />
                <button type="button" class="erp-btn-ghost" [disabled]="busy()" (click)="addLine()">Add transaction</button>
              </div>
            }
          </section>
        }
      </div>
    }`,
})
export class BankStatementsPage {
  private readonly ab = inject(AccountingBackend);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(DialogService);

  /** Absent for the list, `new` or a statement id. */
  readonly id = input<string | undefined>(undefined);
  protected readonly isNew = computed(() => this.id() === 'new');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);

  // import
  protected readonly importOpen = signal(false);
  protected readonly impJournal = signal<number | null>(null);
  protected readonly impName = signal('');
  protected readonly impContent = signal('');

  // list
  protected readonly list = signal<Row[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);

  // header (new statement)
  protected readonly journals = this.ab.lookup('journals', { type: 'bank,cash' });
  protected readonly accounts = this.ab.lookup('accounts');
  protected readonly hJournal = signal<number | null>(null);
  protected readonly hJournalLabel = signal('');
  protected readonly hName = signal('');
  protected readonly hDate = signal(today());
  protected readonly hStart = signal('0');
  protected readonly hEnd = signal('0');
  protected readonly newLines = signal<Row[]>([{ date: today(), name: '', amount: '' }]);
  protected readonly blankLine = (): Row => ({ date: today(), name: '', amount: '' });
  protected readonly lineColumns: LineColumn[] = [
    { key: 'date', label: 'Date', type: 'date', width: 'w-36' },
    { key: 'name', label: 'Label', type: 'text' },
    { key: 'partner_id', label: 'Partner', type: 'm2o', width: 'w-60', search: this.ab.lookup('partners') },
    { key: 'amount', label: 'Amount (+in / −out)', type: 'number', width: 'w-40', right: true },
  ];

  // detail
  protected readonly st = signal<Row>({});
  protected readonly lines = computed(() => (this.st()['lines'] as Row[]) ?? []);
  protected readonly recLine = signal<Row | null>(null);
  protected readonly matchIds = signal<(string | number | boolean | null)[]>([]);
  protected readonly bookAccount = signal<number | null>(null);
  protected readonly woAccount = signal<number | null>(null);
  protected readonly woLabel = signal('Write-Off');
  protected readonly addDate = signal(today());
  protected readonly addName = signal('');
  protected readonly addAmount = signal('');

  protected readonly actions = computed<ActionItem[]>(() => {
    if (this.isNew() || !this.st()['id']) return [];
    const open = this.st()['state'] === 'open';
    return [
      ...(open ? [{ id: 'confirm', label: 'Validate Statement', kind: 'primary' as const, disabled: this.busy(), run: () => void this.statementAction('confirm', 'Statement confirmed') }] : [{ id: 'reopen', label: 'Reopen', disabled: this.busy(), run: () => void this.statementAction('reopen', 'Statement reopened') }]),
      ...(open ? [{ id: 'delete', label: 'Delete', kind: 'danger' as const, disabled: this.busy(), run: () => void this.remove() }] : []),
    ];
  });
  protected tone = pillTone;
  protected pretty = pillText;
  protected str = (v: unknown) => String(v ?? '');
  protected num = (v: unknown) => Number(v) || 0;
  protected fmt = (v: unknown) => (Number(v) || 0).toFixed(2);
  protected nameOf = (v: unknown) => (v && typeof v === 'object' ? String((v as { name?: string }).name ?? '') : '');

  constructor() {
    effect(() => { const id = this.id(); const page = this.page(); this.ab.companyKey(); untracked(() => void this.load(id, page)); });
  }

  private async load(id: string | undefined, page: number): Promise<void> {
    this.loading.set(true); this.error.set(''); this.recLine.set(null);
    try {
      if (!id) { const d = await this.ab.list('/accounting/bank-statements', { page, limit: 25 }); this.list.set(d.records); this.total.set(d.total); }
      else if (id === 'new') await this.prepareNew();
      else this.st.set(await this.ab.get(`/accounting/bank-statements/${id}`));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not load.'); }
    finally { this.loading.set(false); }
  }

  private async prepareNew(): Promise<void> {
    const j = (await this.ab.list<Row>('/accounting/journals', { type: 'bank', limit: 1 })).records[0];
    if (j && !this.hJournal()) { this.hJournal.set(j['id'] as number); this.hJournalLabel.set(`${j['code']} ${j['name']}`); }
  }

  protected async pickFile(ev: Event): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return;
    this.impName.set(file.name); this.impContent.set(await file.text());
  }
  protected async runImport(): Promise<void> {
    if (!this.impJournal()) { this.error.set('Choose the bank or cash journal the file belongs to.'); return; }
    this.busy.set(true); this.error.set('');
    try {
      const r = await this.ab.create<{ statement_id: number; imported: number; skipped: number }>('/accounting/bank-statements/import', { journal_id: this.impJournal(), filename: this.impName(), content: this.impContent() });
      this.toast.success(`${r.imported} transactions imported${r.skipped ? `, ${r.skipped} already there` : ''}`);
      this.importOpen.set(false); this.impContent.set(''); this.impName.set('');
      await this.router.navigate(['/accounting', 'bank-statements', r.statement_id]);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not import the file.'); }
    finally { this.busy.set(false); }
  }

  protected open(id: unknown): void { void this.router.navigate(['/accounting', 'bank-statements', id]); }

  protected async create(): Promise<void> {
    if (!this.hJournal()) { this.error.set('Choose the bank or cash journal.'); return; }
    const lines = this.newLines().filter(l => l['name'] && Number(l['amount'])).map(l => ({ date: l['date'], name: l['name'], amount: l['amount'], partner_id: l['partner_id'] || null }));
    this.busy.set(true); this.error.set('');
    try {
      const s = await this.ab.create<Row>('/accounting/bank-statements', { journal_id: this.hJournal(), name: this.hName() || undefined, date: this.hDate(), balance_start: this.hStart() || '0', balance_end_real: this.hEnd() || '0', lines });
      this.toast.success('Statement created');
      await this.router.navigate(['/accounting', 'bank-statements', s['id']]);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not create the statement.'); }
    finally { this.busy.set(false); }
  }

  // ---- reconcile a line
  protected startRec(l: Row): void {
    this.recLine.set(l); this.matchIds.set([]); this.bookAccount.set(null); this.woAccount.set(null); this.woLabel.set('Write-Off');
  }
  /** Open items the line can settle: same direction as the line, for its partner when it has one. */
  protected openItems = computed(() => {
    const l = this.recLine();
    return async (q: string): Promise<SelectOption[]> => {
      if (!l) return [];
      const partner = l['partner_id'] && typeof l['partner_id'] === 'object' ? (l['partner_id'] as { id: number }).id : undefined;
      const d = await this.ab.list('/accounting/move-lines', { unreconciled_only: 1, partner_id: partner, limit: 100 });
      const inbound = Number(l['amount']) > 0;
      const term = q.trim().toLowerCase();
      return d.records
        .filter(r => (inbound ? Number(r['amount_residual']) > 0 : Number(r['amount_residual']) < 0))
        .map(r => ({ value: r['id'] as number, label: `${r['move_name']} · ${r['partner_name'] ?? 'no partner'} · open ${r['amount_residual']}` }))
        .filter(o => !term || o.label.toLowerCase().includes(term));
    };
  });

  protected async reconcileLine(): Promise<void> {
    const l = this.recLine(); if (!l) return;
    const ids = this.matchIds() as number[];
    if (!ids.length && !this.bookAccount()) { this.error.set('Pick the items to match, or an account to book the line to.'); return; }
    this.busy.set(true); this.error.set('');
    try {
      await this.ab.action(`/accounting/bank-statement-lines/${l['id']}/reconcile`, {
        move_line_ids: ids.length ? ids : undefined, account_id: ids.length ? undefined : this.bookAccount(),
        writeoff: this.woAccount() ? { account_id: this.woAccount(), name: this.woLabel() } : undefined,
      });
      this.toast.success('Line reconciled'); this.recLine.set(null);
      this.st.set(await this.ab.get(`/accounting/bank-statements/${this.id()}`));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not reconcile the line.'); }
    finally { this.busy.set(false); }
  }

  protected async unbook(l: Row): Promise<void> {
    await this.step(() => this.ab.action(`/accounting/bank-statement-lines/${l['id']}/unreconcile`), 'Line unreconciled');
  }
  protected async removeLine(l: Row): Promise<void> {
    await this.step(() => this.ab.remove(`/accounting/bank-statement-lines/${l['id']}`), 'Line deleted');
  }
  protected async addLine(): Promise<void> {
    if (!this.addName().trim() || !Number(this.addAmount())) { this.error.set('Enter a label and a non-zero amount.'); return; }
    await this.step(() => this.ab.action(`/accounting/bank-statements/${this.id()}/lines`, { date: this.addDate(), name: this.addName(), amount: this.addAmount() }), 'Transaction added');
    this.addName.set(''); this.addAmount.set('');
  }
  protected async statementAction(action: 'confirm' | 'reopen', done: string): Promise<void> {
    await this.step(() => this.ab.action(`/accounting/bank-statements/${this.id()}/${action}`), done);
  }
  protected async remove(): Promise<void> {
    if (!(await this.dialogs.confirm({ title: 'Delete', message: 'Delete this statement?', confirmLabel: 'Delete', danger: true }))) return;
    try { await this.ab.remove(`/accounting/bank-statements/${this.id()}`); this.toast.success('Deleted'); await this.router.navigate(['/accounting', 'bank-statements']); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not delete.'); }
  }
  private async step(fn: () => Promise<unknown>, done: string): Promise<void> {
    this.busy.set(true); this.error.set('');
    try { await fn(); this.toast.success(done); this.st.set(await this.ab.get(`/accounting/bank-statements/${this.id()}`)); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'The action failed.'); }
    finally { this.busy.set(false); }
  }
}
