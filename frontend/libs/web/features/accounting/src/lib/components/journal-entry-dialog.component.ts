import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '@erp/web/api-client';
import { CompanyContext, PermissionService } from '@erp/web/core';
import { DialogFrameComponent, DialogService, ErrorBannerComponent, IconComponent, MoneyPipe, TabsComponent, ToastService, I18n } from '@erp/web/ui';
import { DECIMAL_RE } from '@erp/web/metadata-forms';
import { PERM, type JournalEntry, type JournalLine } from '@erp/shared/contracts';
import { dec, eq, gt, sub, sum, todayIso } from '@erp/shared/utils';
import { startWith } from 'rxjs';
import { AccountingStore } from '../data/accounting.store';

export interface JournalEntryDialogData { entry?: JournalEntry }

export const JOURNALS = ['Miscellaneous Operations (SAR)', 'Stock Journal (SAR)', 'Cash Invoices (SAR)', 'Customer Invoices (SAR)', 'Vendor Bills (SAR)', 'Bank (SAR)'];

/** Journal entry form: balanced debit/credit lines, saved as draft or posted. A posted entry is immutable; reverse it to correct it. */
@Component({
  selector: 'erp-journal-entry-dialog',
  imports: [ReactiveFormsModule, TranslocoPipe, DialogFrameComponent, ErrorBannerComponent, TabsComponent, IconComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="entry?.entryNumber ?? ('accounting.journal.new' | transloco)" [subtitle]="company.active()?.name ?? ''">
      <form [formGroup]="form" class="space-y-4" (ngSubmit)="save(false)">
        <erp-error-banner [text]="error()" />
        <section class="relative rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          @if (entry) {
            <div class="absolute end-5 top-5 rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <div class="font-bold leading-tight">{{ entry.reconciledEntriesCount ?? 0 }}</div><div class="text-[10px] font-normal text-slate-500">{{ 'accounting.journal.reconciled' | transloco }}</div>
            </div>
          }
          <div class="mb-5 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
            <div class="space-y-3">
              <label class="grid grid-cols-3 items-center"><span class="text-xs font-bold text-slate-700">{{ 'common.date' | transloco }}</span><input type="date" formControlName="entryDate" class="erp-input col-span-2" /></label>
              <label class="grid grid-cols-3 items-center"><span class="text-xs font-bold text-slate-700">{{ 'accounting.journal.reference' | transloco }}</span><input formControlName="reference" class="erp-input col-span-2 font-mono" placeholder="Flame/OUT/00382" /></label>
            </div>
            <div class="space-y-3">
              <label class="grid grid-cols-3 items-center"><span class="text-xs font-bold text-slate-700">{{ 'accounting.journal.journal' | transloco }}</span>
                <select formControlName="journalName" class="erp-input col-span-2">@for (j of journals; track j) { <option [value]="j">{{ j }}</option> }</select></label>
              <div class="grid grid-cols-3 items-center"><span class="text-xs font-bold text-slate-700">{{ 'accounting.journal.company' | transloco }}</span><span class="col-span-2 py-1.5 text-xs font-semibold text-slate-800">{{ company.active()?.name }}</span></div>
            </div>
          </div>

          <erp-tabs [tabs]="tabs()" [(active)]="tab" class="mb-3 block" />
          @if (tab() === 'items') {
            <div class="overflow-x-auto rounded-lg border border-slate-200">
              <table class="erp-table" formArrayName="lines">
                <thead><tr><th>{{ 'accounting.journal.account' | transloco }}</th><th>{{ 'accounting.journal.partner' | transloco }}</th><th>{{ 'accounting.journal.label' | transloco }}</th><th>{{ 'accounting.journal.analytic' | transloco }}</th>
                  <th class="text-end">{{ 'accounting.journal.debit' | transloco }}</th><th class="text-end">{{ 'accounting.journal.credit' | transloco }}</th><th>{{ 'accounting.journal.taxes' | transloco }}</th><th>{{ 'accounting.journal.due' | transloco }}</th><th class="w-8"></th></tr></thead>
                <tbody>
                  @for (l of lines.controls; track l; let i = $index) {
                    <tr [formGroupName]="i">
                      <td class="!px-1.5 !py-1 min-w-[200px]"><select formControlName="accountId" class="erp-input erp-input-sm">@for (a of store.accounts(); track a.id) { <option [value]="a.id">{{ a.code }} {{ a.name }}</option> }</select></td>
                      <td class="!px-1.5 !py-1"><input formControlName="partner" class="erp-input erp-input-sm" /></td>
                      <td class="!px-1.5 !py-1"><input formControlName="label" class="erp-input erp-input-sm" /></td>
                      <td class="!px-1.5 !py-1 min-w-[160px]"><select formControlName="analyticAccountId" class="erp-input erp-input-sm"><option value=""></option>@for (a of store.analyticAccounts(); track a.id) { <option [value]="a.id">{{ a.code }}</option> }</select></td>
                      <td class="!px-1.5 !py-1"><input formControlName="debit" inputmode="decimal" class="erp-input erp-input-sm w-28 text-end font-mono" (blur)="norm(i, 'debit')" /></td>
                      <td class="!px-1.5 !py-1"><input formControlName="credit" inputmode="decimal" class="erp-input erp-input-sm w-28 text-end font-mono" (blur)="norm(i, 'credit')" /></td>
                      <td class="!px-1.5 !py-1"><input formControlName="taxesApplied" class="erp-input erp-input-sm w-24" /></td>
                      <td class="!px-1.5 !py-1"><input type="date" formControlName="dueDate" class="erp-input erp-input-sm" /></td>
                      <td class="!px-1 !py-1">@if (!readonly && lines.length > 1) { <button type="button" class="p-1 text-rose-500 hover:text-rose-700" [attr.aria-label]="'metadata.remove' | transloco" (click)="removeLine(i)"><erp-icon name="trash" [size]="14" /></button> }</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="bg-slate-50 font-bold">
                    <td colspan="4" class="!px-3">@if (!readonly) { <button type="button" class="text-xs font-bold text-emerald-700 hover:underline" (click)="addLine()">+ {{ 'accounting.journal.addLine' | transloco }}</button> }</td>
                    <td class="erp-num font-mono">{{ totals().debit | erpMoney }}</td><td class="erp-num font-mono">{{ totals().credit | erpMoney }}</td>
                    <td colspan="3" class="!px-3 text-xs" [class]="balanced() ? 'text-emerald-700' : 'text-rose-600'">
                      <span class="inline-flex items-center gap-1"><erp-icon [name]="balanced() ? 'check-circle-2' : 'alert-triangle'" [size]="13" />{{ (balanced() ? 'accounting.journal.balanced' : 'accounting.journal.unbalanced') | transloco }}@if (!balanced() && totals().diff !== '0.00') { ({{ totals().diff | erpMoney }}) }</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          } @else {
            <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'accounting.journal.internalNote' | transloco }}</span><textarea formControlName="internalNote" rows="4" class="erp-input"></textarea></label>
          }
        </section>
      </form>
      <div footer class="contents">
        @if (canReverse()) { <button type="button" class="erp-btn-danger me-auto" (click)="reverse()"><erp-icon name="undo" [size]="13" />{{ 'accounting.journal.reverse' | transloco }}</button> }
        <button type="button" class="erp-btn-ghost" (click)="ref.close()">{{ (readonly ? 'common.close' : 'common.discard') | transloco }}</button>
        @if (!readonly) {
          <button type="button" class="erp-btn-ghost" [disabled]="busy()" (click)="save(false)">{{ 'accounting.journal.saveDraft' | transloco }}</button>
          <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="save(true)">{{ 'accounting.journal.post' | transloco }}</button>
        }
      </div>
    </erp-dialog-frame>`,
})
export class JournalEntryDialogComponent {
  protected readonly data = inject<JournalEntryDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<unknown>>(DialogRef);
  protected readonly store = inject(AccountingStore);
  protected readonly company = inject(CompanyContext);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18n);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly perms = inject(PermissionService);

  protected readonly entry = this.data.entry;
  protected readonly readonly = !!this.entry && this.entry.state === 'posted' || !this.perms.has(PERM.journalEntry.post);
  protected readonly journals = JOURNALS;
  protected readonly tab = signal('items');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly tabs = computed(() => [{ id: 'items', label: this.i18n.tr('accounting.journal.items') }, { id: 'other', label: this.i18n.tr('accounting.journal.other') }]);

  private line(l?: Partial<JournalLine>) {
    return this.fb.nonNullable.group({
      id: l?.id ?? `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, accountId: l?.accountId ?? this.store.accounts()[0]?.id ?? '',
      partner: l?.partner ?? '', label: l?.label ?? '', analyticAccountId: l?.analyticAccountId ?? '',
      debit: [l?.debit ?? '0.00', [Validators.pattern(DECIMAL_RE)]], credit: [l?.credit ?? '0.00', [Validators.pattern(DECIMAL_RE)]],
      taxesApplied: l?.taxesApplied ?? '', dueDate: l?.dueDate ?? '',
    });
  }

  protected readonly form = this.fb.nonNullable.group({
    entryDate: this.entry?.entryDate ?? todayIso(), reference: this.entry?.reference ?? '', journalName: this.entry?.journalName ?? JOURNALS[0],
    internalNote: this.entry?.internalNote ?? this.entry?.narration ?? '',
    lines: this.fb.array((this.entry?.lines.length ? this.entry.lines : [{}, {}]).map(l => this.line(l))),
  });
  protected get lines(): FormArray { return this.form.controls.lines; }

  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });
  protected readonly totals = computed(() => {
    this.value();
    const rows = this.lines.getRawValue() as { debit: string; credit: string }[];
    const debit = sum(rows.map(r => (DECIMAL_RE.test(r.debit) ? r.debit : '0')));
    const credit = sum(rows.map(r => (DECIMAL_RE.test(r.credit) ? r.credit : '0')));
    return { debit, credit, diff: sub(debit, credit) };
  });
  protected readonly balanced = computed(() => eq(this.totals().debit, this.totals().credit) && gt(this.totals().debit, '0'));
  protected readonly canReverse = () => !!this.entry && this.entry.state === 'posted' && !this.entry.isReversed && this.perms.has(PERM.journalEntry.reverse);

  protected addLine(): void { this.lines.push(this.line({ dueDate: this.form.controls.entryDate.value })); }
  protected removeLine(i: number): void { this.lines.removeAt(i); }
  protected norm(i: number, key: 'debit' | 'credit'): void {
    const c = this.lines.at(i).get(key);
    if (c && DECIMAL_RE.test(String(c.value))) c.setValue(dec(String(c.value)), { emitEvent: false });
  }

  protected async save(post: boolean): Promise<void> {
    this.error.set('');
    if (this.lines.invalid) return this.error.set(this.i18n.tr('metadata.invalidNumber'));
    if (!this.balanced()) return this.error.set(this.i18n.tr('accounting.journal.err.unbalanced'));
    const v = this.form.getRawValue();
    const acc = (id: string) => this.store.accounts().find(a => a.id === id);
    const ana = (id: string) => this.store.analyticAccounts().find(a => a.id === id);
    const lines: JournalLine[] = (v.lines as Record<string, string>[]).map(r => ({
      id: r['id'], accountId: r['accountId'], accountCode: acc(r['accountId'])?.code ?? '', accountName: acc(r['accountId'])?.name ?? '', partner: r['partner'] || undefined, label: r['label'],
      analyticAccountId: r['analyticAccountId'] || undefined, analyticAccountName: ana(r['analyticAccountId'])?.name, debit: dec(r['debit']), credit: dec(r['credit']),
      taxesApplied: r['taxesApplied'] || undefined, dueDate: r['dueDate'] || undefined, currency: 'SAR', amountCurrency: '0.00',
    }));
    const n = this.store.journalEntries().length + 1;
    const je: JournalEntry = {
      id: this.entry?.id ?? '', entryNumber: this.entry?.entryNumber ?? `STJ/${new Date().getFullYear()}/${String(n).padStart(4, '0')}`, companyId: this.company.activeId(),
      entryDate: v.entryDate, journalId: 'j_stock', journalName: v.journalName, reference: v.reference, lines, state: post ? 'posted' : (this.entry?.state ?? 'draft'),
      internalNote: v.internalNote, reconciledEntriesCount: this.entry?.reconciledEntriesCount ?? 0,
    };
    this.busy.set(true);
    try {
      const saved = await this.store.api.saveJournalEntry(je);
      this.toast.success(this.i18n.tr(post ? 'accounting.journal.posted' : 'accounting.journal.savedDraft', { n: saved.entryNumber }));
      this.ref.close(saved);
    } catch (e) { this.error.set(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric')); }
    finally { this.busy.set(false); }
  }

  protected async reverse(): Promise<void> {
    if (!this.entry || !(await this.dialogs.confirm({ title: this.i18n.tr('accounting.journal.reverseTitle', { n: this.entry.entryNumber }), message: this.i18n.tr('accounting.journal.reverseText'), confirmLabel: this.i18n.tr('accounting.journal.reverse'), danger: true }))) return;
    try {
      const rev = await this.store.api.reverseJournalEntry(this.entry.id);
      this.toast.success(this.i18n.tr('accounting.journal.reversed', { n: rev.entryNumber }));
      this.ref.close(rev);
    } catch (e) { this.error.set(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric')); }
  }
}
