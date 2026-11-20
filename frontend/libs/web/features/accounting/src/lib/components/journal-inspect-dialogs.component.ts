import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { CompanyContext } from '@erp/web/core';
import { DECIMAL_RE } from '@erp/web/metadata-forms';
import { DialogFrameComponent, DatePipe, ErrorBannerComponent, MoneyPipe, PillComponent, I18n } from '@erp/web/ui';
import type { AnalyticItem, JournalEntry, JournalLine } from '@erp/shared/contracts';
import { dec, todayIso } from '@erp/shared/utils';
import { AccountingStore } from '../data/accounting.store';

export interface JournalItemData { line: JournalLine; entry: JournalEntry }

/** Read-only inspection of one journal item (a single ledger line). */
@Component({
  selector: 'erp-journal-item-dialog',
  imports: [TranslocoPipe, DialogFrameComponent, MoneyPipe, DatePipe, PillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="data.line.label || data.entry.entryNumber" [subtitle]="data.entry.entryNumber">
      <dl class="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white p-4 text-xs">
        @for (r of rows(); track r[0]) { <div><dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">{{ r[0] | transloco }}</dt><dd class="mt-0.5 font-medium text-slate-800" [class.font-mono]="r[2]">{{ r[1] || '—' }}</dd></div> }
        <div><dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">{{ 'accounting.journal.debit' | transloco }}</dt><dd class="mt-0.5 font-mono font-bold">{{ data.line.debit | erpMoney }} SR</dd></div>
        <div><dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">{{ 'accounting.journal.credit' | transloco }}</dt><dd class="mt-0.5 font-mono font-bold">{{ data.line.credit | erpMoney }} SR</dd></div>
        <div><dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">{{ 'common.status' | transloco }}</dt><dd class="mt-0.5"><erp-pill [tone]="data.entry.state === 'posted' ? 'green' : 'amber'">{{ 'status.' + data.entry.state | transloco }}</erp-pill></dd></div>
        <div><dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">{{ 'common.date' | transloco }}</dt><dd class="mt-0.5">{{ data.entry.entryDate | erpDate }}</dd></div>
      </dl>
    </erp-dialog-frame>`,
})
export class JournalItemDialogComponent {
  protected readonly data = inject<JournalItemData>(DIALOG_DATA);
  protected rows(): [string, string | undefined, boolean?][] {
    const { line: l, entry: e } = this.data;
    return [['accounting.journal.col.entry', e.entryNumber], ['accounting.journal.journal', e.journalName], ['accounting.journal.reference', e.reference, true],
      ['accounting.journal.partner', l.partner], ['accounting.journal.account', `${l.accountCode} ${l.accountName}`], ['accounting.journal.analytic', l.analyticAccountName],
      ['accounting.journal.matching', l.matchingNumber, true], ['accounting.journal.taxes', l.taxesApplied], ['accounting.journal.due', l.dueDate || e.entryDate], ['accounting.journal.quantity', l.quantity]];
  }
}

/** Analytic (cost centre) item: view or create. */
@Component({
  selector: 'erp-analytic-item-dialog',
  imports: [ReactiveFormsModule, TranslocoPipe, DialogFrameComponent, ErrorBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="(data.item ? 'accounting.analytic.title' : 'accounting.analytic.new') | transloco">
      <form [formGroup]="form" class="space-y-3 rounded-xl border border-slate-200 bg-white p-4" (ngSubmit)="save()">
        <erp-error-banner [text]="error()" />
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'common.date' | transloco }}</span><input type="date" formControlName="date" class="erp-input" /></label>
          <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'accounting.analytic.ref' | transloco }}</span><input formControlName="reference" class="erp-input font-mono" /></label>
          <label class="block sm:col-span-2"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'accounting.analytic.description' | transloco }}</span><input formControlName="description" class="erp-input" /></label>
          <label class="block sm:col-span-2"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'accounting.journal.analytic' | transloco }}</span>
            <select formControlName="analyticAccountId" class="erp-input">@for (a of store.analyticAccounts(); track a.id) { <option [value]="a.id">{{ a.code }} — {{ a.name }}</option> }</select></label>
          <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'accounting.analytic.quantity' | transloco }}</span><input formControlName="quantity" inputmode="decimal" class="erp-input text-end font-mono" /></label>
          <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'common.amount' | transloco }}</span><input formControlName="amount" inputmode="decimal" class="erp-input text-end font-mono" /></label>
          <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'accounting.analytic.financialAccount' | transloco }}</span><input formControlName="financialAccount" class="erp-input" /></label>
          <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'accounting.analytic.journalItem' | transloco }}</span><input formControlName="journalItem" class="erp-input font-mono" /></label>
          <label class="block sm:col-span-2"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'accounting.journal.partner' | transloco }}</span><input formControlName="partner" class="erp-input" /></label>
        </div>
      </form>
      <div footer class="contents">
        <button type="button" class="erp-btn-ghost" (click)="ref.close()">{{ 'common.close' | transloco }}</button>
        <button type="button" class="erp-btn-primary" (click)="save()">{{ 'common.save' | transloco }}</button>
      </div>
    </erp-dialog-frame>`,
})
export class AnalyticItemDialogComponent {
  protected readonly data = inject<{ item?: AnalyticItem }>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<AnalyticItem>>(DialogRef);
  protected readonly store = inject(AccountingStore);
  private readonly company = inject(CompanyContext);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18n);
  protected readonly error = signal('');
  private readonly it = this.data.item;
  protected readonly form = this.fb.nonNullable.group({
    date: this.it?.date ?? todayIso(), reference: this.it?.reference ?? `REF-${1000 + Math.floor(Math.random() * 9000)}`, description: [this.it?.description ?? '', Validators.required],
    analyticAccountId: this.it?.analyticAccountId ?? this.store.analyticAccounts()[0]?.id ?? '', quantity: [this.it?.quantity ?? '1.00', [Validators.pattern(DECIMAL_RE)]],
    amount: [this.it?.amount ?? '0.00', [Validators.pattern(DECIMAL_RE)]], financialAccount: this.it?.financialAccount ?? '', journalItem: this.it?.journalItem ?? '', partner: this.it?.partner ?? '',
  });

  protected async save(): Promise<void> {
    if (this.form.invalid) return this.error.set(this.i18n.tr('metadata.required'));
    const v = this.form.getRawValue();
    const ana = this.store.analyticAccounts().find(a => a.id === v.analyticAccountId);
    const item: AnalyticItem = { ...this.it, id: this.it?.id ?? '', date: v.date, reference: v.reference, description: v.description, analyticAccountId: v.analyticAccountId,
      analyticAccountName: ana?.name ?? '', companyName: this.company.active()?.legalName ?? '', quantity: dec(v.quantity), amount: dec(v.amount), financialAccount: v.financialAccount || undefined,
      journalItem: v.journalItem || undefined, partner: v.partner || undefined };
    this.ref.close(await this.store.api.saveAnalyticItem(item));
  }
}
void MoneyPipe;
