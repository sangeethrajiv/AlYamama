import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService, SearchService } from '@erp/web/core';
import { AmountPipe, DatePipe, DialogService, EmptyStateComponent, IconComponent, MoneyBarComponent, PageHeaderComponent, PagerComponent, StatusBadgeComponent, ToastService, type MoneySegment, I18n } from '@erp/web/ui';
import { ApiError } from '@erp/web/api-client';
import { PERM, type Invoice, type InvoiceCategory } from '@erp/shared/contracts';
import { gt, lt, mul, sum, todayIso } from '@erp/shared/utils';
import { PaymentDialogComponent, type PaymentDialogData } from '../components/payment-dialog.component';
import { AccountingStore } from '../data/accounting.store';
import { CATEGORY_LABEL_KEY } from '../models/invoice-math';
import { downloadCsv } from '../models/download';
import { toCsv } from '@erp/shared/utils';

const CATS: (InvoiceCategory | 'all')[] = ['all', 'cash', 'credit', 'proforma', 'progressive'];
const catOf = (i: Invoice): InvoiceCategory => i.category || 'credit';

@Component({
  selector: 'erp-invoice-list-page',
  imports: [TranslocoPipe, PageHeaderComponent, MoneyBarComponent, IconComponent, AmountPipe, DatePipe, StatusBadgeComponent, EmptyStateComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="'accounting.invoice.list.title' | transloco" [subtitle]="'accounting.invoice.list.subtitle' | transloco">
        <ng-container actions>
          @if (canWrite()) { <button type="button" class="erp-btn-primary" (click)="create()"><erp-icon name="plus" [size]="16" />{{ createLabel() }}</button> }
        </ng-container>
      </erp-page-header>

      <div class="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-slate-100 p-1 text-xs font-bold">
        @for (c of cats; track c) {
          <button type="button" (click)="selectCategory(c)" class="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 transition"
            [class]="category() === c ? (c === 'cash' ? 'bg-emerald-600 text-white shadow-sm' : c === 'progressive' ? 'bg-amber-600 text-white shadow-sm' : c === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-600 text-white shadow-sm') : 'text-slate-600 hover:text-slate-900'">
            <span>{{ (c === 'all' ? 'accounting.invoice.list.all' : typeKey(c) + 's') | transloco }}</span>
            <span class="rounded-full px-1.5 font-mono text-[10px]" [class]="category() === c && c !== 'all' ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-700'">{{ count(c) }}</span>
          </button>
        }
      </div>

      <erp-money-bar [segments]="segments()" [(selected)]="statusFilter" currency="SAR" />

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="erp-table">
            <thead><tr><th>{{ 'accounting.invoice.list.number' | transloco }}</th><th>{{ 'accounting.invoice.list.type' | transloco }}</th><th>{{ 'accounting.invoice.list.customer' | transloco }}</th><th>{{ 'accounting.invoice.list.dueDate' | transloco }}</th>
              <th class="text-end">{{ 'accounting.invoice.list.total' | transloco }}</th><th class="text-end">{{ 'accounting.invoice.list.amountDue' | transloco }}</th><th class="text-center">{{ 'common.status' | transloco }}</th><th class="text-center">{{ 'accounting.invoice.list.approval' | transloco }}</th><th class="text-end">{{ 'common.actions' | transloco }}</th></tr></thead>
            <tbody>
              @for (inv of pageRows(); track inv.id) {
                <tr class="group cursor-pointer" tabindex="0" (click)="open(inv)" (keydown.enter)="open(inv)">
                  <td class="whitespace-nowrap font-mono font-bold text-emerald-800">
                    <div class="flex items-center gap-1.5"><span>{{ inv.number }}</span>@if (inv.attachmentsCount > 0) { <span class="text-[10px] font-normal text-slate-400">📎{{ inv.attachmentsCount }}</span> }@if (inv.type === 'out_refund') { <span class="rounded bg-slate-100 px-1 font-sans text-[9px] text-slate-700">{{ 'accounting.invoice.list.creditNote' | transloco }}</span> }</div>
                    <div class="font-sans text-[10px] font-normal text-slate-400">{{ inv.dateInvoice | erpDate }}{{ inv.reference ? ' · ' + ('accounting.invoice.list.ref' | transloco) + ': ' + inv.reference : '' }}</div>
                  </td>
                  <td class="whitespace-nowrap"><span class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold" [class]="catClass(inv)">{{ typeKey(cat(inv)) | transloco }}@if (cat(inv) === 'progressive' && inv.progressPercentage) { {{ inv.progressPercentage }}% }</span></td>
                  <td class="w-[170px] max-w-[170px] font-semibold text-slate-800"><div class="whitespace-normal break-words leading-snug" [title]="inv.partner">{{ inv.partner }}</div>@if (inv.interCompanyBillRef) { <div class="whitespace-normal break-all font-mono text-[10px] text-emerald-600">IC: {{ inv.interCompanyBillRef }}</div> }</td>
                  <td class="whitespace-nowrap"><span [class]="overdue(inv) ? 'flex items-center gap-1 font-bold text-rose-600' : 'text-slate-600'">@if (overdue(inv)) { <erp-icon name="alert-triangle" [size]="12" /> }{{ inv.dateDue | erpDate }}</span></td>
                  <td class="whitespace-nowrap text-end font-mono font-bold text-slate-900">{{ inv.amountTotal | erpAmount: inv.currency }}@if (inv.currency !== 'SAR') { <div class="text-[10px] font-normal text-slate-400">≈ {{ base(inv) | erpAmount }}</div> }</td>
                  <td class="whitespace-nowrap text-end font-mono font-bold" [class]="gt(inv.residual) ? 'text-amber-700' : 'text-slate-400'">{{ inv.residual | erpAmount: inv.currency }}</td>
                  <td class="whitespace-nowrap text-center"><erp-status-badge [state]="inv.state" /></td>
                  <td class="whitespace-nowrap text-center">
                    @if (inv.approvalStatus === 'approved') { <span class="flex items-center justify-center gap-1 text-[10px] font-semibold text-emerald-700"><erp-icon name="check-circle" [size]="12" />{{ 'status.approved' | transloco }}</span> }
                    @else if (inv.approvalStatus === 'pending_director' || inv.approvalStatus === 'pending_manager') { <span class="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">{{ 'status.' + inv.approvalStatus | transloco }}</span> }
                    @else if (inv.approvalStatus === 'rejected') { <span class="flex items-center justify-center gap-1 text-[10px] font-semibold text-rose-700"><erp-icon name="x-circle" [size]="12" />{{ 'status.rejected' | transloco }}</span> }
                  </td>
                  <td class="whitespace-nowrap text-end" (click)="$event.stopPropagation()">
                    <div class="flex items-center justify-end gap-1">
                      <div class="flex w-12 justify-end">
                        @if (inv.state === 'draft' && canValidate() && inv.category !== 'proforma') { <button type="button" class="h-7 w-full rounded-md bg-emerald-600 text-[11px] font-bold text-white transition hover:bg-emerald-700" [title]="'accounting.invoice.list.postTitle' | transloco" (click)="post(inv)">{{ 'accounting.invoice.list.post' | transloco }}</button> }
                        @else if ((inv.state === 'open' || inv.state === 'in_payment') && canWrite()) { <button type="button" class="h-7 w-full rounded-md bg-slate-700 text-[11px] font-bold text-white transition hover:bg-slate-800" [title]="'accounting.invoice.list.payTitle' | transloco" (click)="pay(inv)">{{ 'accounting.invoice.list.pay' | transloco }}</button> }
                      </div>
                      <div class="flex w-7 justify-center">
                        @if ((inv.state === 'draft' || inv.state === 'open') && canCancel()) { <button type="button" class="grid h-7 w-7 place-items-center rounded-md text-rose-500 transition hover:bg-rose-50" [attr.aria-label]="'accounting.invoice.act.cancel' | transloco" (click)="cancel(inv)"><erp-icon name="x-circle" [size]="15" /></button> }
                      </div>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (rows().length === 0) { <erp-empty-state [title]="'accounting.invoice.list.empty' | transloco" [text]="'accounting.invoice.list.emptyHint' | transloco" icon="file-text" /> }
        </div>
        <erp-pager [total]="rows().length" [pageSize]="25" [(page)]="page" />
        <div class="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-500 sm:flex-row">
          <div>{{ 'accounting.invoice.list.showing' | transloco: { n: rows().length, total: store.invoices().length } }}</div>
          <div class="flex items-center gap-3"><span>{{ 'accounting.invoice.list.flow' | transloco }}</span><button type="button" class="font-semibold hover:text-emerald-700" (click)="exportCsv()">{{ 'accounting.invoice.list.export' | transloco }}</button></div>
        </div>
      </div>
    </div>`,
})
export class InvoiceListPage {
  protected readonly store = inject(AccountingStore);
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);
  private readonly perms = inject(PermissionService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);

  /** `?category=cash|credit|proforma|progressive` (the sidebar sub-menu links here). */
  readonly categoryParam = input<string | undefined>(undefined, { alias: 'category' });
  protected readonly cats = CATS;
  protected readonly statusFilter = signal('all');
  protected readonly page = signal(1);
  protected readonly category = computed<InvoiceCategory | 'all'>(() => (CATS.includes(this.categoryParam() as never) ? (this.categoryParam() as InvoiceCategory) : 'all'));
  protected readonly typeKey = (c: InvoiceCategory | 'all') => CATEGORY_LABEL_KEY[c] ?? '';
  protected readonly canWrite = computed(() => this.perms.has(PERM.invoice.write));
  protected readonly canValidate = computed(() => this.perms.has(PERM.invoice.validate));
  protected readonly canCancel = computed(() => this.perms.has(PERM.invoice.cancel));
  protected readonly today = todayIso();
  protected cat = catOf;
  protected gt = (v: string) => gt(v, '0');
  protected readonly createLabel = computed(() => (this.category() === 'all' ? this.i18n.tr('accounting.invoice.list.create') : this.i18n.tr('accounting.invoice.list.createTyped', { type: this.i18n.tr(CATEGORY_LABEL_KEY[this.category() as InvoiceCategory]) })));

  protected count(c: InvoiceCategory | 'all'): number { return c === 'all' ? this.store.invoices().length : this.store.invoices().filter(i => catOf(i) === c).length; }
  protected overdue = (i: Invoice) => i.state !== 'paid' && i.state !== 'cancel' && i.dateDue < this.today;
  protected base = (i: Invoice) => mul(i.amountTotal, i.currencyRate);
  protected catClass(i: Invoice): string { return { cash: 'bg-emerald-100 text-emerald-800', credit: 'bg-slate-100 text-slate-800', proforma: 'bg-slate-100 text-slate-800', progressive: 'bg-amber-100 text-amber-800' }[catOf(i)]; }

  protected readonly segments = computed<MoneySegment[]>(() => {
    const all = this.store.invoices();
    const draft = all.filter(i => i.state === 'draft');
    const open = all.filter(i => i.state === 'open' || i.state === 'in_payment');
    const over = all.filter(i => this.overdue(i));
    const paid = all.filter(i => i.state === 'paid');
    return [
      { id: 'draft', label: this.i18n.tr('accounting.invoice.seg.draft'), count: draft.length, amount: sum(draft.map(i => i.amountTotal)), color: 'blue' },
      { id: 'open', label: this.i18n.tr('accounting.invoice.seg.open'), count: open.length, amount: sum(open.map(i => i.residual)), color: 'orange' },
      { id: 'overdue', label: this.i18n.tr('accounting.invoice.seg.overdue'), count: over.length, amount: sum(over.map(i => i.residual)), color: 'red' },
      { id: 'paid', label: this.i18n.tr('accounting.invoice.seg.paid'), count: paid.length, amount: sum(paid.map(i => i.amountTotal)), color: 'green' },
    ];
  });

  protected readonly rows = computed(() => {
    const q = this.search.term();
    const s = this.statusFilter();
    return this.store.invoices().filter(i =>
      (this.category() === 'all' || catOf(i) === this.category()) &&
      !(s === 'draft' && i.state !== 'draft') && !(s === 'open' && i.state !== 'open' && i.state !== 'in_payment') && !(s === 'overdue' && !this.overdue(i)) && !(s === 'paid' && i.state !== 'paid') &&
      (!q || i.number.toLowerCase().includes(q) || i.partner.toLowerCase().includes(q) || (i.reference ?? '').toLowerCase().includes(q)));
  });
  protected readonly pageRows = computed(() => this.rows().slice((this.page() - 1) * 25, this.page() * 25));

  protected selectCategory(c: InvoiceCategory | 'all'): void { this.page.set(1); void this.router.navigate([], { queryParams: { category: c === 'all' ? null : c }, queryParamsHandling: 'merge' }); }
  protected create(): void { void this.router.navigate(['/accounting/invoices/new'], { queryParams: this.category() === 'all' ? {} : { category: this.category() } }); }
  protected open(i: Invoice): void { void this.router.navigate(['/accounting/invoices', i.id]); }
  protected pay(i: Invoice): void { this.dialogs.open<PaymentDialogComponent, PaymentDialogData>(PaymentDialogComponent, { data: { invoice: i }, kind: 'modal' }); }
  protected async post(i: Invoice): Promise<void> { await this.run(() => this.store.api.postInvoice(i.id), 'accounting.invoice.posted', i.number); }
  protected async cancel(i: Invoice): Promise<void> {
    if (!(await this.dialogs.confirm({ title: this.i18n.tr('accounting.invoice.cancelTitle', { n: i.number }), message: this.i18n.tr('accounting.invoice.cancelText'), confirmLabel: this.i18n.tr('accounting.invoice.act.cancel'), danger: true }))) return;
    await this.run(() => this.store.api.cancelInvoice(i.id), 'accounting.invoice.cancelled', i.number);
  }
  private async run(fn: () => Promise<unknown>, okKey: string, n: string): Promise<void> {
    try { await fn(); this.toast.success(this.i18n.tr(okKey, { n })); } catch (e) { this.toast.error(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric')); }
  }
  protected exportCsv(): void {
    downloadCsv('customer-invoices.csv', toCsv([['Number', 'Type', 'Customer', 'Date', 'Due', 'Currency', 'Total', 'Amount due', 'State'], ...this.rows().map(i => [i.number, catOf(i), i.partner, i.dateInvoice, i.dateDue, i.currency, i.amountTotal, i.residual, i.state])]));
  }
}
void lt;
