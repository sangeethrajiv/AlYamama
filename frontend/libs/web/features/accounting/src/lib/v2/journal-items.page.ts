import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingBackend } from '@erp/web/api-client';
import { EmptyStateComponent, ErrorBannerComponent, PageHeaderComponent, PagerComponent, PillComponent, SelectComponent, ToastService } from '@erp/web/ui';
import type { Row } from './lines-editor.component';

/**
 * Journal Items (every posted line) and Reconciliation (the same list showing only open receivable/payable items):
 * tick the items that settle each other and reconcile them, or unreconcile ticked ones. Route data: `{ mode }`.
 */
@Component({
  selector: 'erp-journal-items-page',
  imports: [FormsModule, PageHeaderComponent, SelectComponent, PagerComponent, EmptyStateComponent, ErrorBannerComponent, PillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-page-header [title]="mode() === 'reconcile' ? 'Reconciliation' : 'Journal Items'"
      [subtitle]="mode() === 'reconcile' ? 'Open items that can still be matched. Tick items that settle each other, then Reconcile.' : 'Every posted journal item.'" />
    <div class="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-5">
      <label class="block text-[11px] font-bold text-slate-600">Account<erp-select class="mt-1" [ngModel]="accountId()" (ngModelChange)="accountId.set($event)" [search]="accounts" placeholder="All accounts" /></label>
      <label class="block text-[11px] font-bold text-slate-600">Partner<erp-select class="mt-1" [ngModel]="partnerId()" (ngModelChange)="partnerId.set($event)" [search]="partners" placeholder="All partners" /></label>
      <label class="block text-[11px] font-bold text-slate-600">From<input type="date" class="erp-input mt-1" [value]="from()" (input)="from.set($any($event.target).value)" /></label>
      <label class="block text-[11px] font-bold text-slate-600">To<input type="date" class="erp-input mt-1" [value]="to()" (input)="to.set($any($event.target).value)" /></label>
      @if (mode() === 'items') {
        <label class="block text-[11px] font-bold text-slate-600">Reconciliation<select class="erp-input mt-1" (change)="rec.set($any($event.target).value)"><option value="">All</option><option value="false">Open</option><option value="true">Reconciled</option></select></label>
      }
    </div>
    <erp-error-banner [text]="error()" />
    <div class="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs">
      <span><b>{{ selected().size }}</b> selected</span><span>Debit <b class="font-mono">{{ selDebit() }}</b></span><span>Credit <b class="font-mono">{{ selCredit() }}</b></span>
      <span>Balance <b class="font-mono" [class]="selBalance() === '0.00' ? 'text-emerald-700' : 'text-rose-600'">{{ selBalance() }}</b></span>
      <span class="ms-auto flex gap-2">
        <button type="button" class="erp-btn-primary erp-btn-sm" [disabled]="selected().size < 2 || busy()" (click)="reconcile()">Reconcile</button>
        <button type="button" class="erp-btn-ghost erp-btn-sm" [disabled]="!selected().size || busy()" (click)="unreconcile()">Unreconcile</button>
      </span>
    </div>
    <div class="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="erp-table w-full">
        <thead><tr><th class="w-8"></th><th>Date</th><th>Entry</th><th>Account</th><th>Partner</th><th>Label</th><th class="text-end">Debit</th><th class="text-end">Credit</th><th class="text-end">Open</th><th>Matching</th></tr></thead>
        <tbody>
          @for (r of rows(); track r['id']) {
            <tr [class.bg-emerald-50]="selected().has(num(r['id']))">
              <td><input type="checkbox" class="accent-emerald-600" [checked]="selected().has(num(r['id']))" (change)="toggle(num(r['id']))" [attr.aria-label]="'Select ' + r['move_name']" /></td>
              <td>{{ str(r['date']).slice(0, 10) }}</td><td class="font-mono font-bold">{{ r['move_name'] }}</td><td class="font-mono">{{ r['account_code'] }}</td><td>{{ r['partner_name'] ?? '' }}</td><td>{{ r['name'] ?? '' }}</td>
              <td class="text-end font-mono">{{ r['debit'] }}</td><td class="text-end font-mono">{{ r['credit'] }}</td><td class="text-end font-mono">{{ r['amount_residual'] }}</td>
              <td>@if (r['full_reconcile_id']) { <erp-pill tone="green">A{{ r['full_reconcile_id'] }}</erp-pill> }</td>
            </tr>
          }
        </tbody>
      </table>
      @if (!loading() && rows().length === 0) { <erp-empty-state title="No journal items" /> }
      <erp-pager [total]="total()" [pageSize]="pageSize" [(page)]="page" />
    </div>`,
})
export class JournalItemsPage {
  private readonly ab = inject(AccountingBackend);
  private readonly toast = inject(ToastService);

  readonly mode = input<'items' | 'reconcile'>('items');
  protected readonly accounts = this.ab.lookup('accounts');
  protected readonly partners = this.ab.lookup('partners');
  protected readonly accountId = signal<number | null>(null);
  protected readonly partnerId = signal<number | null>(null);
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly rec = signal('');
  protected readonly rows = signal<Row[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = 50;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly selected = signal<Set<number>>(new Set());

  private readonly picked = computed(() => this.rows().filter(r => this.selected().has(Number(r['id']))));
  protected readonly selDebit = computed(() => this.picked().reduce((t, r) => t + Number(r['debit']), 0).toFixed(2));
  protected readonly selCredit = computed(() => this.picked().reduce((t, r) => t + Number(r['credit']), 0).toFixed(2));
  protected readonly selBalance = computed(() => (Number(this.selDebit()) - Number(this.selCredit())).toFixed(2));
  protected num = Number;
  protected str = (v: unknown) => String(v ?? '');

  constructor() {
    effect(() => {
      this.ab.companyKey();
      const q = { mode: this.mode(), account: this.accountId(), partner: this.partnerId(), from: this.from(), to: this.to(), rec: this.rec(), page: this.page() };
      untracked(() => void this.load(q));
    });
    effect(() => { this.mode(); this.accountId(); this.partnerId(); this.from(); this.to(); this.rec(); untracked(() => { this.page.set(1); this.selected.set(new Set()); }); });
  }

  private async load(q: { mode: string; account: number | null; partner: number | null; from: string; to: string; rec: string; page: number }): Promise<void> {
    this.loading.set(true);
    try {
      const d = await this.ab.list('/accounting/move-lines', {
        account_id: q.account ?? undefined, partner_id: q.partner ?? undefined, date_from: q.from || undefined, date_to: q.to || undefined,
        unreconciled_only: q.mode === 'reconcile' ? 1 : undefined, reconciled: q.mode === 'items' ? q.rec || undefined : undefined, page: q.page, limit: this.pageSize,
      });
      this.rows.set(d.records); this.total.set(d.total); this.error.set('');
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not load the items.'); }
    finally { this.loading.set(false); }
  }

  protected toggle(id: number): void { this.selected.update(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  protected async reconcile(): Promise<void> { await this.run('/accounting/move-lines/reconcile', 'Reconciled'); }
  protected async unreconcile(): Promise<void> { await this.run('/accounting/move-lines/unreconcile', 'Unreconciled'); }
  private async run(path: string, done: string): Promise<void> {
    this.busy.set(true); this.error.set('');
    try {
      await this.ab.action(path, { line_ids: [...this.selected()] });
      this.toast.success(done); this.selected.set(new Set());
      await this.load({ mode: this.mode(), account: this.accountId(), partner: this.partnerId(), from: this.from(), to: this.to(), rec: this.rec(), page: this.page() });
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'The action failed.'); }
    finally { this.busy.set(false); }
  }
}
