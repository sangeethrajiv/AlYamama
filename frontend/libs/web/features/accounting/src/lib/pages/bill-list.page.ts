import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService, SearchService } from '@erp/web/core';
import { AmountPipe, DatePipe, DialogService, EmptyStateComponent, IconComponent, MoneyBarComponent, MoneyPipe, PageHeaderComponent, PagerComponent, StatusBadgeComponent, ToastService, type MoneySegment, I18n } from '@erp/web/ui';
import { ApiError } from '@erp/web/api-client';
import { PERM, type Bill } from '@erp/shared/contracts';
import { gt, sum, todayIso } from '@erp/shared/utils';
import { PaymentDialogComponent, type PaymentDialogData } from '../components/payment-dialog.component';
import { AccountingStore } from '../data/accounting.store';

@Component({
  selector: 'erp-bill-list-page',
  imports: [TranslocoPipe, PageHeaderComponent, MoneyBarComponent, IconComponent, AmountPipe, MoneyPipe, DatePipe, StatusBadgeComponent, EmptyStateComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="'accounting.bill.list.title' | transloco" [subtitle]="'accounting.bill.list.subtitle' | transloco">
        <ng-container actions>@if (canWrite()) { <button type="button" class="erp-btn-primary" (click)="create()"><erp-icon name="plus" [size]="16" />{{ 'accounting.bill.list.create' | transloco }}</button> }</ng-container>
      </erp-page-header>
      <erp-money-bar [segments]="segments()" [(selected)]="statusFilter" currency="SAR" />
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="erp-table">
            <thead><tr><th>{{ 'accounting.bill.list.number' | transloco }}</th><th>{{ 'accounting.bill.list.supplierRef' | transloco }}</th><th>{{ 'accounting.bill.list.billDate' | transloco }}</th><th>{{ 'accounting.bill.list.vendor' | transloco }}</th><th>{{ 'accounting.invoice.list.dueDate' | transloco }}</th>
              <th class="text-end">{{ 'accounting.bill.list.tax' | transloco }}</th><th class="text-end">{{ 'accounting.invoice.list.total' | transloco }}</th><th class="text-end">{{ 'accounting.invoice.list.amountDue' | transloco }}</th><th class="text-center">{{ 'common.status' | transloco }}</th><th class="text-center">{{ 'accounting.bill.list.workflow' | transloco }}</th><th class="text-end">{{ 'common.actions' | transloco }}</th></tr></thead>
            <tbody>
              @for (b of pageRows(); track b.id) {
                <tr class="cursor-pointer" tabindex="0" (click)="open(b)" (keydown.enter)="open(b)">
                  <td class="whitespace-nowrap font-mono font-bold text-emerald-800">{{ b.number }}@if (b.interCompanyOrigin) { <div class="font-sans text-[10px] font-normal text-emerald-600">IC: {{ b.interCompanyOrigin }}</div> }</td>
                  <td class="font-mono text-slate-500">{{ b.supplierInvoiceNumber }}</td><td class="whitespace-nowrap">{{ b.dateBill | erpDate }}</td>
                  <td class="font-semibold text-slate-800">{{ b.vendor }}</td>
                  <td class="whitespace-nowrap"><span [class]="overdue(b) ? 'flex items-center gap-1 font-bold text-rose-600' : 'text-slate-600'">@if (overdue(b)) { <erp-icon name="alert-triangle" [size]="12" /> }{{ b.dateDue | erpDate }}</span></td>
                  <td class="erp-num font-mono">{{ b.amountTax | erpMoney }}</td>
                  <td class="erp-num whitespace-nowrap font-mono font-bold text-slate-900">{{ b.amountTotal | erpAmount: b.currency }}</td>
                  <td class="erp-num whitespace-nowrap font-mono font-bold" [class]="gt(b.residual) ? 'text-amber-700' : 'text-slate-400'">{{ b.residual | erpAmount: b.currency }}</td>
                  <td class="text-center"><erp-status-badge [state]="b.state" /></td>
                  <td class="text-center" (click)="$event.stopPropagation()">
                    @switch (b.approvalStatus) {
                      @case ('approved') { <span class="flex items-center justify-center gap-1 text-[10px] font-semibold text-emerald-700"><erp-icon name="check-circle" [size]="12" />{{ 'status.approved' | transloco }}</span> }
                      @case ('pending_manager') {
                        <div class="flex items-center justify-center gap-1"><span class="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">{{ 'status.pending_manager' | transloco }}</span>
                          @if (canL1()) { <button type="button" class="rounded p-1 text-emerald-600 hover:bg-emerald-50" [title]="'accounting.bill.list.approve' | transloco" (click)="approve(b)"><erp-icon name="check-circle" [size]="15" /></button><button type="button" class="rounded p-1 text-rose-600 hover:bg-rose-50" [title]="'accounting.bill.list.reject' | transloco" (click)="reject(b)"><erp-icon name="x-circle" [size]="15" /></button> }</div>
                      }
                      @case ('pending_director') {
                        <div class="flex items-center justify-center gap-1"><span class="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">{{ 'status.pending_director' | transloco }}</span>
                          @if (canL2()) { <button type="button" class="rounded p-1 text-emerald-600 hover:bg-emerald-50" [title]="'accounting.bill.list.approve' | transloco" (click)="approve(b)"><erp-icon name="check-circle" [size]="15" /></button><button type="button" class="rounded p-1 text-rose-600 hover:bg-rose-50" [title]="'accounting.bill.list.reject' | transloco" (click)="reject(b)"><erp-icon name="x-circle" [size]="15" /></button> }</div>
                      }
                      @case ('rejected') { <span class="flex items-center justify-center gap-1 text-[10px] font-semibold text-rose-700" [title]="b.approvalRejectReason ?? ''"><erp-icon name="x-circle" [size]="12" />{{ 'status.rejected' | transloco }}</span> }
                    }
                  </td>
                  <td class="whitespace-nowrap text-end" (click)="$event.stopPropagation()">
                    @if ((b.state === 'open' || b.state === 'in_payment') && canWrite()) { <button type="button" class="h-7 rounded-md bg-amber-600 px-3 text-[11px] font-bold text-white transition hover:bg-amber-700" (click)="pay(b)">{{ 'accounting.bill.list.pay' | transloco }}</button> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (rows().length === 0) { <erp-empty-state [title]="'accounting.bill.list.empty' | transloco" icon="receipt" /> }
        </div>
        <erp-pager [total]="rows().length" [pageSize]="25" [(page)]="page" />
      </div>
    </div>`,
})
export class BillListPage {
  protected readonly store = inject(AccountingStore);
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);
  private readonly perms = inject(PermissionService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);
  protected readonly statusFilter = signal('all');
  protected readonly page = signal(1);
  protected readonly today = todayIso();
  protected readonly canWrite = computed(() => this.perms.has(PERM.bill.write));
  protected readonly canL1 = computed(() => this.perms.has(PERM.bill.approveL1));
  protected readonly canL2 = computed(() => this.perms.has(PERM.bill.approveL2));
  protected gt = (v: string) => gt(v, '0');
  protected overdue = (b: Bill) => b.state !== 'paid' && b.state !== 'cancel' && b.dateDue < this.today;

  protected readonly segments = computed<MoneySegment[]>(() => {
    const all = this.store.bills();
    const draft = all.filter(b => b.state === 'draft'); const open = all.filter(b => b.state === 'open' || b.state === 'in_payment');
    const over = all.filter(b => this.overdue(b)); const paid = all.filter(b => b.state === 'paid');
    return [
      { id: 'draft', label: this.i18n.tr('accounting.bill.seg.draft'), count: draft.length, amount: sum(draft.map(b => b.amountTotal)), color: 'blue' },
      { id: 'open', label: this.i18n.tr('accounting.bill.seg.open'), count: open.length, amount: sum(open.map(b => b.residual)), color: 'orange' },
      { id: 'overdue', label: this.i18n.tr('accounting.bill.seg.overdue'), count: over.length, amount: sum(over.map(b => b.residual)), color: 'red' },
      { id: 'paid', label: this.i18n.tr('accounting.bill.seg.paid'), count: paid.length, amount: sum(paid.map(b => b.amountTotal)), color: 'green' },
    ];
  });
  protected readonly rows = computed(() => {
    const q = this.search.term(); const s = this.statusFilter();
    return this.store.bills().filter(b => !(s === 'draft' && b.state !== 'draft') && !(s === 'open' && b.state !== 'open' && b.state !== 'in_payment') && !(s === 'overdue' && !this.overdue(b)) && !(s === 'paid' && b.state !== 'paid')
      && (!q || b.number.toLowerCase().includes(q) || b.vendor.toLowerCase().includes(q) || b.supplierInvoiceNumber.toLowerCase().includes(q)));
  });
  protected readonly pageRows = computed(() => this.rows().slice((this.page() - 1) * 25, this.page() * 25));

  protected create(): void { void this.router.navigate(['/accounting/bills/new']); }
  protected open(b: Bill): void { void this.router.navigate(['/accounting/bills', b.id]); }
  protected pay(b: Bill): void { this.dialogs.open<PaymentDialogComponent, PaymentDialogData>(PaymentDialogComponent, { data: { bill: b }, kind: 'modal' }); }
  private fail(e: unknown): void { this.toast.error(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric')); }
  protected async approve(b: Bill): Promise<void> { try { await this.store.api.approveBill(b.id); this.toast.success(this.i18n.tr('accounting.bill.approved', { n: b.number })); } catch (e) { this.fail(e); } }
  protected async reject(b: Bill): Promise<void> {
    const reason = await this.dialogs.prompt({ title: this.i18n.tr('accounting.bill.rejectTitle', { n: b.number }), message: this.i18n.tr('accounting.bill.rejectText'), confirmLabel: this.i18n.tr('accounting.bill.list.reject'), danger: true, prompt: { label: this.i18n.tr('accounting.bill.rejectReason'), required: true } });
    if (!reason) return;
    try { await this.store.api.rejectBill(b.id, reason); this.toast.info(this.i18n.tr('accounting.bill.rejected', { n: b.number })); } catch (e) { this.fail(e); }
  }
}
