import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PermissionService } from '@erp/web/core';
import { PERM } from '@erp/shared/contracts';
import { AccountingBackend } from '@erp/web/api-client';
import { FormsModule } from '@angular/forms';
import { EmptyStateComponent, ErrorBannerComponent, IconComponent, PageHeaderComponent, PagerComponent, PillComponent, SearchBoxComponent, SelectComponent, ToastService } from '@erp/web/ui';
import { kindOf, isSaleType } from './kinds';
import type { Row } from './lines-editor.component';
import { pillText, pillTone } from './resource-spec';

/** List of invoices, bills, credit notes or refunds (one DocKind). Route data: `{ kind }`. */
@Component({
  selector: 'erp-document-list-page',
  imports: [FormsModule, SelectComponent, RouterLink, PageHeaderComponent, SearchBoxComponent, IconComponent, EmptyStateComponent, PagerComponent, PillComponent, ErrorBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-page-header [title]="k().title" [subtitle]="subtitle()">
      <ng-container actions>
        <erp-search-box [(value)]="search" placeholder="Search number, partner, reference…" />
        <select class="erp-input !w-auto" aria-label="Status" (change)="state.set($any($event.target).value)">
          <option value="">Status: all</option><option value="draft">Draft</option><option value="posted">Posted</option><option value="cancel">Cancelled</option>
        </select>
        <select class="erp-input !w-auto" aria-label="Payment" (change)="payment.set($any($event.target).value)">
          <option value="">Payment: all</option><option value="not_paid">Not paid</option><option value="partial">Partially paid</option><option value="paid">Paid</option>
        </select>
        @if (!k().noNew && canWrite()) { <a class="erp-btn-primary" [routerLink]="['/accounting', k().path, 'new']"><erp-icon name="plus" [size]="15" />New</a> }
      </ng-container>
    </erp-page-header>
    <erp-error-banner [text]="error()" />
    @if (picked().length) {
      <div class="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
        <div class="flex flex-wrap items-center gap-3 text-xs">
          <span><b>{{ picked().length }}</b> selected · due <b class="font-mono">{{ dueTotal() }}</b></span>
          @if (payBlock(); as why) { <span class="text-amber-700">{{ why }}</span> }
          @else if (canPay() && !payOpen()) { <button type="button" class="erp-btn-primary erp-btn-sm" (click)="openPay()">Register Payment</button> }
          <button type="button" class="erp-btn-ghost erp-btn-sm" (click)="selected.set(emptySet)">Clear</button>
        </div>
        @if (payOpen()) {
          <div class="mt-3 grid gap-3 sm:grid-cols-4">
            <label class="block text-[11px] font-bold text-slate-600">Journal<erp-select class="mt-1" [ngModel]="payJournal()" (ngModelChange)="payJournal.set($event)" [search]="payJournals" [labelHint]="payJournalLabel()" placeholder="Bank or cash journal" /></label>
            <label class="block text-[11px] font-bold text-slate-600">Amount<input class="erp-input mt-1 text-end font-mono" [value]="payAmount()" (input)="payAmount.set($any($event.target).value)" /></label>
            <label class="block text-[11px] font-bold text-slate-600">Payment Date<input type="date" class="erp-input mt-1" [value]="payDate()" (input)="payDate.set($any($event.target).value)" /></label>
            <label class="block text-[11px] font-bold text-slate-600">Memo<input class="erp-input mt-1" [value]="payMemo()" (input)="payMemo.set($any($event.target).value)" /></label>
            <p class="text-[11px] text-slate-500 sm:col-span-4">One payment for all selected documents. The oldest due date is paid first; an amount smaller than the total leaves the last ones open, a bigger one leaves a credit.</p>
            <div class="flex gap-2 sm:col-span-4"><button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="registerPayment()">{{ busy() ? 'Working…' : 'Validate payment' }}</button><button type="button" class="erp-btn-ghost" (click)="payOpen.set(false)">Back</button></div>
          </div>
        }
      </div>
    }
    <div class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="erp-table w-full">
        <thead><tr>
          <th class="w-8"><input type="checkbox" class="accent-emerald-600" aria-label="Select all payable" [checked]="allPicked()" (change)="toggleAll()" /></th>
          <th>Number</th><th>{{ sale() ? 'Customer' : 'Vendor' }}</th><th>{{ sale() ? 'Invoice Date' : 'Bill Date' }}</th><th>Due Date</th><th>Reference</th>
          <th class="text-end">Total</th><th class="text-end">Amount Due</th><th>Payment</th>@if (!sale()) { <th>Approval</th> }<th>Status</th>
        </tr></thead>
        <tbody>
          @for (r of rows(); track r['id']) {
            <tr class="cursor-pointer" tabindex="0" [class.bg-emerald-50]="selected().has(num(r['id']))" (click)="open(r)" (keydown.enter)="open(r)">
              <td (click)="$event.stopPropagation()">@if (payable(r)) { <input type="checkbox" class="accent-emerald-600" [checked]="selected().has(num(r['id']))" (change)="toggle(num(r['id']))" [attr.aria-label]="'Select ' + r['name']" /> }</td>
              <td class="font-bold text-slate-900 font-mono">{{ r['name'] === '/' ? 'Draft' : r['name'] }}</td>
              <td>{{ name(r['partner_id']) }}</td><td>{{ r['invoice_date'] ?? r['date'] }}</td><td>{{ r['invoice_date_due'] ?? '' }}</td><td>{{ r['ref'] ?? '' }}</td>
              <td class="text-end font-mono">{{ r['amount_total'] }}</td><td class="text-end font-mono">{{ r['amount_residual'] }}</td>
              <td><erp-pill [tone]="tone(str(r['payment_state']))">{{ pretty(str(r['payment_state'])) }}</erp-pill></td>
              @if (!sale()) { <td>@if (r['request_status'] !== 'not_required') { <erp-pill [tone]="tone(str(r['request_status']))">{{ pretty(str(r['request_status'])) }}</erp-pill> }</td> }
              <td><erp-pill [tone]="tone(str(r['state']))">{{ pretty(str(r['state'])) }}</erp-pill></td>
            </tr>
          }
        </tbody>
      </table>
      @if (!loading() && rows().length === 0) { <erp-empty-state title="No documents yet" /> }
      <erp-pager [total]="total()" [pageSize]="pageSize" [(page)]="page" />
    </div>`,
})
export class DocumentListPage {
  private readonly ab = inject(AccountingBackend);
  private readonly router = inject(Router);
  private readonly perms = inject(PermissionService);

  readonly kind = input.required<string>();
  protected readonly k = computed(() => kindOf(this.kind()));
  protected readonly sale = computed(() => isSaleType(this.k().moveType));
  protected readonly canWrite = computed(() => this.perms.has(this.sale() ? PERM.invoice.write : PERM.bill.write));
  protected readonly subtitle = computed(() => (this.k().noNew ? 'Filtered view of vendor bills by approval status.' : ''));
  protected readonly rows = signal<Row[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly state = signal('');
  protected readonly payment = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = 25;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly toast = inject(ToastService);

  // ---- batch payment: tick several unpaid documents of one partner and pay them with one payment
  protected readonly emptySet = new Set<number>();
  protected readonly selected = signal<Set<number>>(new Set());
  protected readonly picked = computed(() => this.rows().filter(r => this.selected().has(Number(r['id']))));
  protected readonly payOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly payJournal = signal<number | null>(null);
  protected readonly payJournalLabel = signal('');
  protected readonly payAmount = signal('');
  protected readonly payDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly payMemo = signal('');
  protected readonly payJournals = this.ab.lookup('journals', { type: 'bank,cash' });
  protected readonly canPay = computed(() => this.perms.has(PERM.payment.write));
  protected readonly dueTotal = computed(() => this.picked().reduce((t, r) => t + Number(r['amount_residual']), 0).toFixed(2));
  /** Why the selection cannot be paid together, or empty. */
  protected readonly payBlock = computed(() => {
    const p = this.picked();
    if (new Set(p.map(r => (r['partner_id'] as { id: number } | null)?.id)).size > 1) return 'Pick documents of one partner to pay them together.';
    if (new Set(p.map(r => r['move_type'])).size > 1) return 'Do not mix invoices with credit notes.';
    return '';
  });
  protected readonly allPicked = computed(() => { const ok = this.rows().filter(r => this.payable(r)); return ok.length > 0 && ok.every(r => this.selected().has(Number(r['id']))); });
  protected num = Number;
  protected payable = (r: Row) => r['state'] === 'posted' && Number(r['amount_residual']) > 0 && ['out_invoice', 'in_invoice'].includes(String(r['move_type']));
  protected toggle(id: number): void { this.selected.update(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  protected toggleAll(): void { this.selected.set(this.allPicked() ? new Set() : new Set(this.rows().filter(r => this.payable(r)).map(r => Number(r['id'])))); }
  protected async openPay(): Promise<void> {
    this.payAmount.set(this.dueTotal()); this.payMemo.set(this.picked().map(r => r['name']).join(', ').slice(0, 120));
    if (!this.payJournal()) {
      const j = (await this.ab.list<Row>('/accounting/journals', { type: 'bank,cash', limit: 1 })).records[0];
      if (j) { this.payJournal.set(j['id'] as number); this.payJournalLabel.set(`${j['code']} ${j['name']}`); }
    }
    this.payOpen.set(true);
  }
  protected async registerPayment(): Promise<void> {
    if (!this.payJournal()) { this.error.set('Choose a bank or cash journal.'); return; }
    this.busy.set(true); this.error.set('');
    try {
      await this.ab.create('/accounting/payments?post=1', { invoice_ids: this.picked().map(r => Number(r['id'])), journal_id: this.payJournal(), amount: this.payAmount() || null, payment_date: this.payDate(), communication: this.payMemo() });
      this.toast.success(`One payment registered for ${this.picked().length} documents`);
      this.payOpen.set(false); this.selected.set(new Set());
      await this.load(this.k().query, this.search(), this.state(), this.payment(), this.page());
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not register the payment.'); }
    finally { this.busy.set(false); }
  }

  constructor() {
    effect(() => {
      const k = this.k(); const q = this.search(); const state = this.state(); const payment = this.payment(); const page = this.page(); this.ab.companyKey();
      untracked(() => { clearTimeout(this.timer); this.timer = setTimeout(() => void this.load(k.query, q, state, payment, page), q ? 250 : 0); });
    });
    effect(() => { this.kind(); this.search(); this.state(); this.payment(); untracked(() => { this.page.set(1); this.selected.set(new Set()); this.payOpen.set(false); }); });
  }

  private async load(query: Record<string, string>, q: string, state: string, payment: string, page: number): Promise<void> {
    this.loading.set(true);
    try {
      const d = await this.ab.list('/accounting/moves', { ...query, q: q || undefined, state: state || undefined, payment_state: payment || undefined, page, limit: this.pageSize });
      this.rows.set(d.records); this.total.set(d.total); this.error.set('');
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not load the list.'); }
    finally { this.loading.set(false); }
  }

  protected tone = pillTone;
  protected pretty = pillText;
  protected str = (v: unknown) => String(v ?? '');
  protected name = (v: unknown) => (v && typeof v === 'object' ? String((v as { name?: string }).name ?? '') : '');
  protected open(r: Row): void { void this.router.navigate(['/accounting', this.k().path, r['id']]); }
}
