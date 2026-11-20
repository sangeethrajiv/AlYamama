import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService, SearchService } from '@erp/web/core';
import { AmountPipe, DatePipe, DialogService, EmptyStateComponent, PageHeaderComponent, PagerComponent, PillComponent, SegmentedComponent, I18n } from '@erp/web/ui';
import { PERM, type Payment } from '@erp/shared/contracts';
import { sum } from '@erp/shared/utils';
import { PaymentDialogComponent, type PaymentDialogData } from '../components/payment-dialog.component';
import { AccountingStore } from '../data/accounting.store';

@Component({
  selector: 'erp-payments-page',
  imports: [TranslocoPipe, PageHeaderComponent, SegmentedComponent, AmountPipe, DatePipe, PillComponent, EmptyStateComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="'accounting.payment.list.title' | transloco" [subtitle]="'accounting.payment.list.subtitle' | transloco">
        <ng-container actions>
          @if (canWrite()) {
            <button type="button" class="erp-btn-primary" (click)="open('customer')">{{ 'accounting.payment.list.receive' | transloco }}</button>
            <button type="button" class="erp-btn bg-amber-600 text-white hover:bg-amber-700" (click)="open('supplier')">{{ 'accounting.payment.list.paySupplier' | transloco }}</button>
          }
        </ng-container>
      </erp-page-header>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">{{ 'accounting.payment.list.collections' | transloco }}</div><div class="font-mono text-lg font-bold text-emerald-700">{{ receipts() | erpAmount }}</div><div class="mt-1 text-[11px] text-slate-500">{{ 'accounting.payment.list.collectionsNote' | transloco }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">{{ 'accounting.payment.list.payouts' | transloco }}</div><div class="font-mono text-lg font-bold text-amber-700">{{ payouts() | erpAmount }}</div><div class="mt-1 text-[11px] text-slate-500">{{ 'accounting.payment.list.payoutsNote' | transloco }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">{{ 'accounting.payment.list.vouchers' | transloco }}</div><div class="font-mono text-lg font-bold text-slate-800">{{ store.payments().length }}</div><div class="mt-1 text-[11px] text-slate-500">{{ 'accounting.payment.list.vouchersNote' | transloco }}</div></div>
      </div>
      <erp-segmented [options]="types()" [(value)]="type" />
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div class="overflow-x-auto">
        <table class="erp-table"><thead><tr><th>{{ 'accounting.payment.list.number' | transloco }}</th><th>{{ 'common.date' | transloco }}</th><th>{{ 'accounting.payment.list.partner' | transloco }}</th><th>{{ 'accounting.payment.list.journal' | transloco }}</th><th>{{ 'accounting.payment.list.method' | transloco }}</th><th>{{ 'accounting.payment.memo' | transloco }}</th><th class="text-end">{{ 'common.amount' | transloco }}</th><th class="text-center">{{ 'common.status' | transloco }}</th></tr></thead>
          <tbody>@for (p of pageRows(); track p.id) {
            <tr><td class="whitespace-nowrap font-mono font-bold text-slate-800">{{ p.paymentNumber }}</td><td class="whitespace-nowrap">{{ p.paymentDate | erpDate }}</td>
              <td class="font-semibold text-slate-800">{{ p.partner }}<div class="text-[10px] font-normal text-slate-400">{{ 'accounting.payment.list.' + p.partnerType | transloco }}</div></td>
              <td>{{ p.journalName }}</td><td>{{ p.paymentMethod }}@if (p.chequeNumber) { <div class="font-mono text-[10px] text-slate-400">#{{ p.chequeNumber }}</div> }</td><td class="max-w-[220px] truncate text-slate-500" [title]="p.memo">{{ p.memo }}</td>
              <td class="erp-num whitespace-nowrap font-mono font-bold" [class]="p.partnerType === 'customer' ? 'text-emerald-700' : 'text-amber-700'">{{ p.partnerType === 'customer' ? '+' : '−' }}{{ p.amount | erpAmount: p.currency }}</td>
              <td class="text-center"><erp-pill [tone]="p.state === 'cancelled' ? 'red' : p.state === 'reconciled' ? 'blue' : 'green'">{{ 'status.' + p.state | transloco }}</erp-pill></td></tr>
          }</tbody></table>
        @if (rows().length === 0) { <erp-empty-state [title]="'common.noResults' | transloco" icon="credit-card" /> }
        <erp-pager [total]="rows().length" [pageSize]="25" [(page)]="page" />
      </div></div>
    </div>`,
})
export class PaymentsPage {
  protected readonly store = inject(AccountingStore);
  private readonly search = inject(SearchService);
  private readonly dialogs = inject(DialogService);
  private readonly perms = inject(PermissionService);
  protected readonly type = signal('all');
  protected readonly page = signal(1);
  protected readonly canWrite = computed(() => this.perms.has(PERM.payment.write));
  protected readonly receipts = computed(() => sum(this.store.payments().filter(p => p.partnerType === 'customer').map(p => p.amountBaseCurrency)));
  protected readonly payouts = computed(() => sum(this.store.payments().filter(p => p.partnerType === 'supplier').map(p => p.amountBaseCurrency)));
  private readonly i18n = inject(I18n);
  protected readonly types = computed(() => [{ id: 'all', label: this.i18n.tr('accounting.payment.list.all') }, { id: 'customer', label: this.i18n.tr('accounting.payment.list.customers') }, { id: 'supplier', label: this.i18n.tr('accounting.payment.list.vendors') }]);
  protected readonly rows = computed(() => {
    const q = this.search.term();
    return this.store.payments().filter(p => (this.type() === 'all' || p.partnerType === this.type()) && (!q || p.paymentNumber.toLowerCase().includes(q) || p.partner.toLowerCase().includes(q) || p.memo.toLowerCase().includes(q)));
  });
  protected readonly pageRows = computed(() => this.rows().slice((this.page() - 1) * 25, this.page() * 25));
  protected open(type: 'customer' | 'supplier'): void { this.dialogs.open<PaymentDialogComponent, PaymentDialogData, Payment>(PaymentDialogComponent, { data: { type }, kind: 'modal' }); }
}
void PillComponent;
