import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PermissionService } from '@erp/web/core';
import { PERM } from '@erp/shared/contracts';
import { AccountingBackend } from '@erp/web/api-client';
import { EmptyStateComponent, ErrorBannerComponent, IconComponent, PageHeaderComponent, PagerComponent, PillComponent, SearchBoxComponent } from '@erp/web/ui';
import { kindOf, isSaleType } from './kinds';
import type { Row } from './lines-editor.component';
import { pillText, pillTone } from './resource-spec';

/** List of invoices, bills, credit notes or refunds (one DocKind). Route data: `{ kind }`. */
@Component({
  selector: 'erp-document-list-page',
  imports: [RouterLink, PageHeaderComponent, SearchBoxComponent, IconComponent, EmptyStateComponent, PagerComponent, PillComponent, ErrorBannerComponent],
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
    <div class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="erp-table w-full">
        <thead><tr>
          <th>Number</th><th>{{ sale() ? 'Customer' : 'Vendor' }}</th><th>{{ sale() ? 'Invoice Date' : 'Bill Date' }}</th><th>Due Date</th><th>Reference</th>
          <th class="text-end">Total</th><th class="text-end">Amount Due</th><th>Payment</th>@if (!sale()) { <th>Approval</th> }<th>Status</th>
        </tr></thead>
        <tbody>
          @for (r of rows(); track r['id']) {
            <tr class="cursor-pointer" tabindex="0" (click)="open(r)" (keydown.enter)="open(r)">
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

  constructor() {
    effect(() => {
      const k = this.k(); const q = this.search(); const state = this.state(); const payment = this.payment(); const page = this.page(); this.ab.companyKey();
      untracked(() => { clearTimeout(this.timer); this.timer = setTimeout(() => void this.load(k.query, q, state, payment, page), q ? 250 : 0); });
    });
    effect(() => { this.kind(); this.search(); this.state(); this.payment(); untracked(() => this.page.set(1)); });
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
