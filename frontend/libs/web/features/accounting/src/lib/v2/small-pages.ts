import { ChangeDetectionStrategy, Component, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountingBackend } from '@erp/web/api-client';
import { MetadataFormComponent, type FieldDef, type Rec, type ViewDef } from '@erp/web/metadata-forms';
import { ErrorBannerComponent, PageHeaderComponent, ToastService } from '@erp/web/ui';
import type { Row } from './lines-editor.component';
import { toBody, toForm } from './resource-spec';

const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------------------------- settings
/** Configuration > Settings: lock dates, financial year end and the company's default accounts and taxes. */
@Component({
  selector: 'erp-accounting-settings-page',
  imports: [PageHeaderComponent, MetadataFormComponent, ErrorBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-page-header title="Accounting Settings" subtitle="Lock dates and defaults for the current company." />
    <erp-error-banner [text]="error()" />
    @if (ready()) {
      <div class="mx-auto max-w-4xl space-y-4">
        <erp-metadata-form [view]="view" [value]="value()" />
        <div class="flex justify-end"><button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="save()">Save</button></div>
      </div>
    }`,
})
export class AccountingSettingsPage {
  private readonly ab = inject(AccountingBackend);
  private readonly toast = inject(ToastService);
  private readonly meta = viewChild(MetadataFormComponent);
  protected readonly value = signal<Row>({});
  protected readonly ready = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  private readonly fields: FieldDef[] = [
    { key: 'period_lock_date', type: 'date', label: 'Lock Date for Non-Advisers', hint: 'No entry can be added or changed on or before this date.' },
    { key: 'fiscalyear_lock_date', type: 'date', label: 'Lock Date for All Users', hint: 'Applies to everyone, advisers included.' },
    { key: 'fiscalyear_last_day', type: 'number', label: 'Last Day of the Financial Year', min: 1, max: 31 },
    { key: 'fiscalyear_last_month', type: 'number', label: 'Last Month of the Financial Year', min: 1, max: 12 },
    { key: 'account_receivable_id', type: 'many2one', label: 'Default Receivable Account', search: this.ab.lookup('accounts') },
    { key: 'account_payable_id', type: 'many2one', label: 'Default Payable Account', search: this.ab.lookup('accounts') },
    { key: 'income_account_id', type: 'many2one', label: 'Default Income Account', search: this.ab.lookup('accounts') },
    { key: 'expense_account_id', type: 'many2one', label: 'Default Expense Account', search: this.ab.lookup('accounts') },
    { key: 'currency_exchange_journal_id', type: 'many2one', label: 'Exchange Difference Journal', hint: 'Foreign-currency gains and losses are posted here (its debit account for a loss, its credit account for a gain).', search: this.ab.lookup('journals', { type: 'general' }) },
    { key: 'tax_cash_basis_journal_id', type: 'many2one', label: 'Cash Basis Tax Journal', hint: 'Receives the entry that moves a cash-basis tax when it is paid.', search: this.ab.lookup('journals', { type: 'general' }) },
    { key: 'default_sale_tax_id', type: 'many2one', label: 'Default Sales Tax', search: this.ab.lookup('taxes', { type_tax_use: 'sale' }) },
    { key: 'default_purchase_tax_id', type: 'many2one', label: 'Default Purchase Tax', search: this.ab.lookup('taxes', { type_tax_use: 'purchase' }) },
  ];
  protected readonly view: ViewDef = { entity: 'settings', type: 'form', sections: [{ id: 'main', columns: 2, fields: this.fields }] };

  constructor() { void this.load(); }
  private async load(): Promise<void> {
    try { this.value.set(toForm(await this.ab.get<Row>('/accounting/settings'))); this.ready.set(true); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not load the settings.'); }
  }
  protected async save(): Promise<void> {
    const rec = { ...this.value(), ...(this.meta()?.current() ?? {}) };
    this.busy.set(true); this.error.set('');
    try { await this.ab.update('/accounting/settings', toBody(rec, this.fields)); this.toast.success('Settings saved'); await this.load(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not save.'); }
    finally { this.busy.set(false); }
  }
}

// ---------------------------------------------------------------------------------------------- tax adjustment
/** Accounting > Tax Adjustments: a posted entry that moves an amount onto a tax account and tags it with the tax. */
@Component({
  selector: 'erp-tax-adjustment-page',
  imports: [PageHeaderComponent, MetadataFormComponent, ErrorBannerComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-page-header title="Tax Adjustments" subtitle="Correct a tax amount. The entry is posted and shows in the Tax Report." />
    <erp-error-banner [text]="error()" />
    <div class="mx-auto max-w-4xl space-y-4">
      <erp-metadata-form [view]="view" [value]="value" />
      <div class="flex items-center justify-end gap-3">
        @if (done(); as d) { <a class="text-xs font-bold text-emerald-700 hover:underline" [routerLink]="['/accounting/journal-entries', d.id]">Posted {{ d.name }}</a> }
        <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="post()">Validate</button>
      </div>
    </div>`,
})
export class TaxAdjustmentPage {
  private readonly ab = inject(AccountingBackend);
  private readonly toast = inject(ToastService);
  private readonly meta = viewChild(MetadataFormComponent);
  protected readonly value: Rec = { date: today(), amount: '' };
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly done = signal<{ id: number; name: string } | null>(null);
  protected readonly view: ViewDef = { entity: 'tax-adjustment', type: 'form', sections: [{ id: 'main', columns: 2, fields: [
    { key: 'date', type: 'date', label: 'Date', required: true },
    { key: 'journal_id', type: 'many2one', label: 'Journal', search: this.ab.lookup('journals', { type: 'general' }) },
    { key: 'tax_id', type: 'many2one', label: 'Tax', required: true, search: this.ab.lookup('taxes') },
    { key: 'amount', type: 'money', label: 'Amount (negative to reduce)', required: true },
    { key: 'account_id', type: 'many2one', label: 'Tax Account', required: true, search: this.ab.lookup('accounts') },
    { key: 'counterpart_account_id', type: 'many2one', label: 'Counterpart Account', required: true, search: this.ab.lookup('accounts') },
    { key: 'reason', type: 'text', label: 'Reason', span: 'full' },
  ] }] };

  protected async post(): Promise<void> {
    const m = this.meta();
    if (m && !m.validate()) { this.error.set(m.firstError() || 'Please complete the required fields.'); return; }
    const v = m?.current() ?? {};
    this.busy.set(true); this.error.set('');
    try {
      const r = await this.ab.create<Row>('/accounting/moves/tax-adjustment', {
        date: v['date'], journal_id: v['journal_id'] || undefined, tax_id: v['tax_id'], account_id: v['account_id'], counterpart_account_id: v['counterpart_account_id'], amount: v['amount'], reason: v['reason'] || undefined,
      });
      this.done.set({ id: r['id'] as number, name: String(r['name']) }); this.toast.success('Tax adjustment posted');
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not post the adjustment.'); }
    finally { this.busy.set(false); }
  }
}

// ---------------------------------------------------------------------------------------------- generate asset entries
/** Accounting > Generate Assets Entries: posts every depreciation line that is due. */
@Component({
  selector: 'erp-generate-assets-page',
  imports: [PageHeaderComponent, ErrorBannerComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-page-header title="Generate Assets Entries" subtitle="Posts the depreciation of every running asset up to the date below." />
    <erp-error-banner [text]="error()" />
    <div class="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label class="text-[11px] font-bold text-slate-600">Generate entries up to<input type="date" class="erp-input mt-1" [value]="upTo()" (input)="upTo.set($any($event.target).value)" /></label>
      <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="run()">{{ busy() ? 'Working…' : 'Generate entries' }}</button>
    </div>
    @if (result(); as r) {
      <div class="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p class="font-bold">{{ r.posted_count }} entr{{ r.posted_count === 1 ? 'y' : 'ies' }} posted up to {{ r.up_to }}.</p>
        @if (r.entries.length) {
          <table class="erp-table mt-3 w-full"><thead><tr><th>Entry</th><th>Asset</th><th class="text-end">Amount</th></tr></thead>
            <tbody>@for (e of r.entries; track e['move_id']) { <tr><td class="font-mono font-bold"><a class="text-emerald-700 hover:underline" [routerLink]="['/accounting/journal-entries', e['move_id']]">{{ e['name'] }}</a></td><td><a class="hover:underline" [routerLink]="['/accounting/assets', e['asset_id']]">#{{ e['asset_id'] }}</a></td><td class="text-end font-mono">{{ e['amount'] }}</td></tr> }</tbody></table>
        } @else { <p class="mt-1 text-xs text-slate-500">Nothing is due. Draft assets must be confirmed first.</p> }
      </div>
    }`,
})
export class GenerateAssetsPage {
  private readonly ab = inject(AccountingBackend);
  private readonly toast = inject(ToastService);
  protected readonly upTo = signal(today());
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<{ posted_count: number; up_to: string; entries: Row[] } | null>(null);

  protected async run(): Promise<void> {
    this.busy.set(true); this.error.set('');
    try { const r = await this.ab.action<{ posted_count: number; up_to: string; entries: Row[] }>('/accounting/assets/generate-entries', { date: this.upTo() }); this.result.set(r); this.toast.success(`${r.posted_count} entries posted`); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not generate the entries.'); }
    finally { this.busy.set(false); }
  }
}

// ---------------------------------------------------------------------------------------------- external app
/** Menu entries whose data belongs to another app (asset rental, payment providers). Route data: `{ title, app }`. */
@Component({
  selector: 'erp-external-app-page',
  imports: [PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-page-header [title]="title()" />
    <div class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      <p class="font-bold text-slate-700">Provided by the {{ app() }} app</p>
      <p class="mt-1">This screen comes from another module that is not part of the accounting build. Its journal entries and invoices will appear in accounting once that app is connected.</p>
    </div>`,
})
export class ExternalAppPage {
  readonly title = input.required<string>();
  readonly app = input<string>('external');
}
