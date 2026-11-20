import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '@erp/web/api-client';
import { PermissionService } from '@erp/web/core';
import { DECIMAL_RE } from '@erp/web/metadata-forms';
import { AmountPipe, DatePipe, DialogFrameComponent, DialogService, EmptyStateComponent, ErrorBannerComponent, I18n, IconComponent, PageHeaderComponent, PillComponent, ToastService } from '@erp/web/ui';
import { PERM, type ChequeRecord } from '@erp/shared/contracts';
import { dec, gt, mul, sum } from '@erp/shared/utils';
import { AccountingStore } from '../data/accounting.store';

/** Direct bank transaction (a bank charge or a received amount) posted to the bank journal. */
@Component({
  selector: 'erp-direct-bank-tx-dialog',
  imports: [ReactiveFormsModule, TranslocoPipe, DialogFrameComponent, ErrorBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="'accounting.bank.directTitle' | transloco">
      <form [formGroup]="form" class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-xs" (ngSubmit)="save()">
        <erp-error-banner [text]="error()" />
        <label class="block"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.payment.journal' | transloco }}</span>
          <select formControlName="journalId" class="erp-input">@for (b of data.banks; track b.id) { <option [value]="b.id">{{ b.name }} ({{ b.code }})</option> }</select></label>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.bank.type' | transloco }}</span>
            <select formControlName="kind" class="erp-input"><option value="charge">{{ 'accounting.bank.charge' | transloco }}</option><option value="income">{{ 'accounting.bank.income' | transloco }}</option></select></label>
          <label class="block"><span class="mb-1 block font-bold text-slate-600">{{ 'common.amount' | transloco }}</span><input formControlName="amount" inputmode="decimal" class="erp-input text-end font-mono" /></label>
        </div>
        <label class="block"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.payment.memo' | transloco }}</span><input formControlName="memo" class="erp-input" /></label>
      </form>
      <div footer class="contents"><button type="button" class="erp-btn-ghost" (click)="ref.close()">{{ 'common.cancel' | transloco }}</button><button type="button" class="erp-btn-primary" (click)="save()">{{ 'common.save' | transloco }}</button></div>
    </erp-dialog-frame>`,
})
export class DirectBankTxDialogComponent {
  protected readonly data = inject<{ banks: { id: string; name: string; code: string }[] }>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly store = inject(AccountingStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18n);
  private readonly toast = inject(ToastService);
  protected readonly error = signal('');
  protected readonly form = this.fb.nonNullable.group({ journalId: this.data.banks[0]?.id ?? 'acc_101', kind: 'charge', amount: ['150.00', [Validators.required, Validators.pattern(DECIMAL_RE)]], memo: 'Monthly SARIE transfer maintenance fee' });
  protected async save(): Promise<void> {
    const v = this.form.getRawValue();
    if (!DECIMAL_RE.test(v.amount) || !gt(v.amount, '0')) return this.error.set(this.i18n.tr('accounting.bank.err.amount'));
    try { await this.store.api.recordDirectBankTransaction(v.journalId, dec(v.amount), v.kind === 'charge', v.memo); this.toast.success(this.i18n.tr('accounting.bank.recorded')); this.ref.close(true); }
    catch (e) { this.error.set(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric')); }
  }
}

@Component({
  selector: 'erp-banking-page',
  imports: [TranslocoPipe, PageHeaderComponent, IconComponent, AmountPipe, DatePipe, PillComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <erp-page-header [title]="'accounting.bank.title' | transloco" [subtitle]="'accounting.bank.subtitle' | transloco">
        <ng-container actions>@if (canWrite()) { <button type="button" class="erp-btn-primary" (click)="openDirect()"><erp-icon name="plus" [size]="16" />{{ 'accounting.bank.record' | transloco }}</button> }</ng-container>
      </erp-page-header>
      <div>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{{ 'accounting.bank.live' | transloco }} ({{ 'common.total' | transloco }}: {{ totalCash() | erpAmount }})</h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (b of banks(); track b.id) {
            <div class="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div><div class="mb-2 font-mono text-xs font-bold text-slate-400">{{ b.code }}</div><div class="line-clamp-1 text-xs font-bold text-slate-800">{{ b.name }}</div></div>
              <div class="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3"><span class="text-[11px] text-slate-400">{{ 'accounting.bank.available' | transloco }}</span><span class="font-mono text-base font-black text-slate-900">{{ b.balance | erpAmount: b.currency || 'SAR' }}</span></div>
            </div>
          }
        </div>
      </div>
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 bg-slate-50 p-4"><h3 class="text-xs font-bold uppercase tracking-wider text-slate-800">{{ 'accounting.bank.register' | transloco }}</h3><p class="text-[11px] text-slate-500">{{ 'accounting.bank.lifecycle' | transloco }}</p></div>
        <div class="overflow-x-auto">
          <table class="erp-table"><thead><tr><th>{{ 'accounting.bank.col.number' | transloco }}</th><th>{{ 'accounting.bank.col.date' | transloco }}</th><th>{{ 'accounting.bank.col.payee' | transloco }}</th><th>{{ 'accounting.bank.col.bank' | transloco }}</th><th class="text-end">{{ 'common.amount' | transloco }}</th><th class="text-center">{{ 'common.status' | transloco }}</th><th class="text-end">{{ 'accounting.bank.col.actions' | transloco }}</th></tr></thead>
            <tbody>@for (c of store.cheques(); track c.id) {
              <tr><td class="font-mono font-bold text-slate-800">{{ c.chequeNumber }}</td><td class="whitespace-nowrap">{{ c.chequeDate | erpDate }}</td><td class="font-semibold text-slate-900">{{ c.payeeName }}</td><td>{{ c.bankName }}</td>
                <td class="erp-num whitespace-nowrap font-mono font-bold text-slate-900">{{ c.amount | erpAmount: c.currency }}</td>
                <td class="whitespace-nowrap text-center"><erp-pill [tone]="tone(c)">{{ 'status.' + c.status | transloco }}</erp-pill>@if (c.bounceReason) { <div class="mx-auto mt-0.5 max-w-xs truncate text-[10px] text-rose-600" [title]="c.bounceReason">{{ c.bounceReason }}</div> }</td>
                <td class="whitespace-nowrap text-end"><div class="flex items-center justify-end gap-1.5">
                  @if (c.status === 'presented' && canWrite()) {
                    <button type="button" class="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-700" [title]="'accounting.bank.clearTitle' | transloco" (click)="clear(c)"><erp-icon name="check-circle-2" [size]="12" />{{ 'accounting.bank.clear' | transloco }}</button>
                    <button type="button" class="flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-rose-700" [title]="'accounting.bank.bounceTitle' | transloco" (click)="bounce(c)"><erp-icon name="alert-triangle" [size]="12" />{{ 'accounting.bank.bounce' | transloco }}</button>
                  }
                  @if (c.status === 'cleared') { <span class="font-mono text-[10px] font-semibold text-emerald-700">{{ 'accounting.bank.clearedOn' | transloco: { date: c.clearanceDate || '—' } }}</span> }
                  @if (c.status === 'bounced') { <span class="font-mono text-[10px] font-semibold text-rose-700">{{ 'accounting.bank.reversed' | transloco }}</span> }
                </div></td></tr>
            }</tbody></table>
          @if (store.cheques().length === 0) { <erp-empty-state [title]="'accounting.bank.noCheques' | transloco" icon="landmark" /> }
        </div>
      </div>
    </div>`,
})
export class BankingPage {
  protected readonly store = inject(AccountingStore);
  private readonly dialogs = inject(DialogService);
  private readonly perms = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);
  protected readonly canWrite = computed(() => this.perms.has(PERM.bank.write));
  protected readonly banks = computed(() => this.store.accounts().filter(a => a.type === 'Bank and Cash'));
  protected readonly totalCash = computed(() => sum(this.banks().map(a => (a.currency === 'USD' ? mul(a.balance, '3.75') : a.balance))));
  protected tone = (c: ChequeRecord) => ({ issued: 'slate', presented: 'blue', cleared: 'green', bounced: 'red' }[c.status] as 'slate' | 'blue' | 'green' | 'red');
  protected openDirect(): void { this.dialogs.open<DirectBankTxDialogComponent, { banks: { id: string; name: string; code: string }[] }>(DirectBankTxDialogComponent, { data: { banks: this.banks() }, kind: 'modal' }); }
  protected async clear(c: ChequeRecord): Promise<void> { await this.store.api.clearCheque(c.id); this.toast.success(this.i18n.tr('accounting.bank.cleared', { n: c.chequeNumber })); }
  protected async bounce(c: ChequeRecord): Promise<void> {
    const reason = await this.dialogs.prompt({ title: this.i18n.tr('accounting.bank.bounceTitle2', { n: c.chequeNumber }), message: this.i18n.tr('accounting.bank.bounceText'), confirmLabel: this.i18n.tr('accounting.bank.bounce'), danger: true, prompt: { label: this.i18n.tr('accounting.bank.bounceReason'), required: true } });
    if (!reason) return;
    await this.store.api.bounceCheque(c.id, reason);
    this.toast.info(this.i18n.tr('accounting.bank.bounced', { n: c.chequeNumber }));
  }
}
void dec;
