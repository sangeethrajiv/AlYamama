import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CompanyContext, PermissionService, SearchService } from '@erp/web/core';
import { AmountPipe, DatePipe, DialogService, EmptyStateComponent, IconComponent, MoneyPipe, PageHeaderComponent, PagerComponent, PillComponent, TabsComponent, I18n } from '@erp/web/ui';
import { PERM, type AnalyticItem, type JournalEntry, type JournalLine } from '@erp/shared/contracts';
import { lt, sum } from '@erp/shared/utils';
import { AnalyticItemDialogComponent, JournalItemDialogComponent, type JournalItemData } from '../components/journal-inspect-dialogs.component';
import { JournalEntryDialogComponent, type JournalEntryDialogData } from '../components/journal-entry-dialog.component';
import { AccountingStore } from '../data/accounting.store';

/** Journal & analytic operations: entries, atomic journal items and analytic cost items. */
@Component({
  selector: 'erp-journal-entries-page',
  imports: [TranslocoPipe, PageHeaderComponent, TabsComponent, IconComponent, PillComponent, AmountPipe, MoneyPipe, DatePipe, EmptyStateComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="'accounting.journal.pageTitle' | transloco" [subtitle]="'accounting.journal.pageSubtitle' | transloco" [eyebrow]="company.active()?.name ?? ''">
        <ng-container actions>
          @if (tab() === 'entries' && canPost()) { <button type="button" class="erp-btn-primary" (click)="openEntry()"><erp-icon name="plus" [size]="15" />{{ 'accounting.journal.create' | transloco }}</button> }
          @if (tab() === 'analytics') { <button type="button" class="erp-btn-primary" (click)="openAnalytic()"><erp-icon name="plus" [size]="15" />{{ 'accounting.analytic.new' | transloco }}</button> }
        </ng-container>
      </erp-page-header>
      <erp-tabs [tabs]="tabs()" [(active)]="tab" />

      @switch (tab()) {
        @case ('entries') {
          <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div class="overflow-x-auto">
            <table class="erp-table"><thead><tr><th>{{ 'common.date' | transloco }}</th><th>{{ 'accounting.journal.number' | transloco }}</th><th>{{ 'accounting.journal.journal' | transloco }}</th><th>{{ 'accounting.journal.reference' | transloco }}</th><th>{{ 'accounting.journal.partner' | transloco }}</th>
              <th class="text-end">{{ 'accounting.journal.totalDebit' | transloco }}</th><th class="text-end">{{ 'accounting.journal.totalCredit' | transloco }}</th><th class="text-center">{{ 'common.status' | transloco }}</th><th class="text-end">{{ 'common.actions' | transloco }}</th></tr></thead>
              <tbody>
                @for (e of entryPage(); track e.id) {
                  <tr class="cursor-pointer" tabindex="0" (click)="openEntry(e)" (keydown.enter)="openEntry(e)">
                    <td class="whitespace-nowrap">{{ e.entryDate | erpDate }}</td><td class="whitespace-nowrap font-bold text-slate-800">{{ e.entryNumber }}@if (e.isReversed) { <erp-pill tone="red">{{ 'accounting.journal.reversedTag' | transloco }}</erp-pill> }</td>
                    <td class="whitespace-nowrap">{{ e.journalName }}</td><td class="font-mono text-slate-500">{{ e.reference || '-' }}</td><td class="font-medium">{{ partner(e) }}</td>
                    <td class="erp-num font-mono font-semibold text-slate-900">{{ debit(e) | erpAmount }}</td><td class="erp-num font-mono font-semibold text-slate-900">{{ credit(e) | erpAmount }}</td>
                    <td class="text-center"><erp-pill [tone]="e.state === 'posted' ? 'green' : 'amber'">{{ 'status.' + e.state | transloco }}</erp-pill></td>
                    <td class="text-end" (click)="$event.stopPropagation()"><button type="button" class="erp-btn-ghost erp-btn-sm" (click)="openEntry(e)">{{ 'accounting.journal.viewForm' | transloco }}</button></td>
                  </tr>
                }
              </tbody></table>
            @if (entries().length === 0) { <erp-empty-state [title]="'common.noResults' | transloco" /> }
            <erp-pager [total]="entries().length" [pageSize]="25" [(page)]="entryPageNo" />
          </div></div>
        }
        @case ('items') {
          <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center gap-3 border-b border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><span class="font-semibold text-slate-700">{{ 'accounting.journal.itemsLedger' | transloco }}</span><span class="text-slate-400">|</span><span>{{ 'accounting.journal.showingLines' | transloco: { n: items().length } }}</span></div>
            <div class="overflow-x-auto"><table class="erp-table"><thead><tr>
              <th>{{ 'common.date' | transloco }}</th><th>{{ 'accounting.journal.col.entry' | transloco }}</th><th>{{ 'accounting.journal.journal' | transloco }}</th><th>{{ 'accounting.journal.label' | transloco }}</th><th>{{ 'accounting.journal.reference' | transloco }}</th><th>{{ 'accounting.journal.partner' | transloco }}</th>
              <th>{{ 'accounting.journal.account' | transloco }}</th><th>{{ 'accounting.journal.analytic' | transloco }}</th><th>{{ 'accounting.journal.matching' | transloco }}</th><th class="text-end">{{ 'accounting.journal.debit' | transloco }}</th><th class="text-end">{{ 'accounting.journal.credit' | transloco }}</th><th>{{ 'accounting.journal.due' | transloco }}</th></tr></thead>
              <tbody>@for (it of itemPage(); track it.line.id + it.entry.id) {
                <tr class="cursor-pointer" (click)="openItem(it)"><td class="whitespace-nowrap">{{ it.entry.entryDate | erpDate }}</td><td class="whitespace-nowrap font-semibold">{{ it.entry.entryNumber }}</td><td class="whitespace-nowrap">{{ it.entry.journalName }}</td>
                  <td class="max-w-[200px] truncate font-medium text-slate-900">{{ it.line.label || '-' }}</td><td class="whitespace-nowrap font-mono">{{ it.entry.reference || '-' }}</td><td class="whitespace-nowrap">{{ it.line.partner || '-' }}</td>
                  <td class="whitespace-nowrap"><span class="font-semibold text-slate-800">{{ it.line.accountCode }}</span> {{ it.line.accountName }}</td><td class="max-w-[150px] truncate">{{ it.line.analyticAccountName || '-' }}</td><td class="font-mono text-slate-400">{{ it.line.matchingNumber }}</td>
                  <td class="erp-num whitespace-nowrap font-mono font-semibold">{{ it.line.debit | erpAmount }}</td><td class="erp-num whitespace-nowrap font-mono font-semibold">{{ it.line.credit | erpAmount }}</td><td class="whitespace-nowrap">{{ (it.line.dueDate || it.entry.entryDate) | erpDate }}</td></tr>
              }</tbody></table>
              @if (items().length === 0) { <erp-empty-state [title]="'common.noResults' | transloco" /> }
              <erp-pager [total]="items().length" [pageSize]="25" [(page)]="itemPageNo" /></div>
          </div>
        }
        @case ('analytics') {
          <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center gap-3 border-b border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><span class="font-semibold text-slate-700">{{ 'accounting.analytic.entries' | transloco }}</span><span class="text-slate-400">|</span><span>{{ 'accounting.journal.showingLines' | transloco: { n: analytic().length } }}</span></div>
            <div class="overflow-x-auto"><table class="erp-table"><thead><tr><th>{{ 'common.date' | transloco }}</th><th>{{ 'accounting.analytic.ref' | transloco }}</th><th>{{ 'accounting.analytic.description' | transloco }}</th><th>{{ 'accounting.journal.analytic' | transloco }}</th><th>{{ 'accounting.journal.company' | transloco }}</th><th class="text-end">{{ 'accounting.analytic.quantity' | transloco }}</th><th class="text-end">{{ 'common.amount' | transloco }}</th></tr></thead>
              <tbody>@for (a of analytic(); track a.id) {
                <tr class="cursor-pointer" (click)="openAnalytic(a)"><td class="whitespace-nowrap">{{ a.date | erpDate }}</td><td class="whitespace-nowrap font-mono font-medium">{{ a.reference }}</td><td class="font-semibold text-slate-900">{{ a.description }}</td><td class="font-medium text-slate-800">{{ a.analyticAccountName }}</td><td class="whitespace-nowrap">{{ a.companyName }}</td>
                  <td class="erp-num font-mono">{{ a.quantity | erpMoney }}</td><td class="erp-num whitespace-nowrap font-mono font-bold" [class]="neg(a.amount) ? 'text-rose-600' : 'text-emerald-600'">{{ a.amount | erpAmount }}</td></tr>
              }</tbody></table>
              @if (analytic().length === 0) { <erp-empty-state [title]="'common.noResults' | transloco" /> }</div>
          </div>
        }
      }
    </div>`,
})
export class JournalEntriesPage {
  protected readonly store = inject(AccountingStore);
  protected readonly company = inject(CompanyContext);
  private readonly search = inject(SearchService);
  private readonly dialogs = inject(DialogService);
  private readonly perms = inject(PermissionService);
  private readonly i18n = inject(I18n);

  protected readonly tab = signal('entries');
  protected readonly entryPageNo = signal(1);
  protected readonly itemPageNo = signal(1);
  protected readonly canPost = computed(() => this.perms.has(PERM.journalEntry.post));

  protected readonly entries = computed(() => {
    const q = this.search.term();
    return this.store.journalEntries().filter(e => !q || e.entryNumber.toLowerCase().includes(q) || (e.reference ?? '').toLowerCase().includes(q) || e.journalName.toLowerCase().includes(q)
      || e.lines.some(l => l.accountName.toLowerCase().includes(q) || l.accountCode.includes(q) || (l.label ?? '').toLowerCase().includes(q) || (l.partner ?? '').toLowerCase().includes(q)));
  });
  protected readonly entryPage = computed(() => this.entries().slice((this.entryPageNo() - 1) * 25, this.entryPageNo() * 25));
  protected readonly items = computed(() => {
    const q = this.search.term();
    return this.store.journalEntries().flatMap(entry => entry.lines.map(line => ({ line, entry }))).filter(i => !q || i.line.label.toLowerCase().includes(q) || (i.line.partner ?? '').toLowerCase().includes(q)
      || i.line.accountName.toLowerCase().includes(q) || i.line.accountCode.includes(q) || (i.entry.reference ?? '').toLowerCase().includes(q) || i.entry.entryNumber.toLowerCase().includes(q));
  });
  protected readonly itemPage = computed(() => this.items().slice((this.itemPageNo() - 1) * 25, this.itemPageNo() * 25));
  protected readonly analytic = computed(() => {
    const q = this.search.term();
    return this.store.analyticItems().filter(i => !q || i.description.toLowerCase().includes(q) || i.reference.toLowerCase().includes(q) || i.analyticAccountName.toLowerCase().includes(q) || (i.partner ?? '').toLowerCase().includes(q));
  });
  protected readonly tabs = computed(() => [
    { id: 'entries', label: this.i18n.tr('accounting.journal.tab.entries'), count: this.entries().length },
    { id: 'items', label: this.i18n.tr('accounting.journal.tab.items'), count: this.items().length },
    { id: 'analytics', label: this.i18n.tr('accounting.journal.tab.analytics'), count: this.analytic().length },
  ]);

  protected partner = (e: JournalEntry) => e.lines.find(l => l.partner)?.partner || '-';
  protected debit = (e: JournalEntry) => sum(e.lines.map(l => l.debit));
  protected credit = (e: JournalEntry) => sum(e.lines.map(l => l.credit));
  protected neg = (v: string) => lt(v, '0');

  protected openEntry(entry?: JournalEntry): void { this.dialogs.open<JournalEntryDialogComponent, JournalEntryDialogData>(JournalEntryDialogComponent, { data: { entry }, kind: 'modal-wide' }); }
  protected openItem(i: { line: JournalLine; entry: JournalEntry }): void { this.dialogs.open<JournalItemDialogComponent, JournalItemData>(JournalItemDialogComponent, { data: i, kind: 'modal-wide' }); }
  protected openAnalytic(item?: AnalyticItem): void { this.dialogs.open<AnalyticItemDialogComponent, { item?: AnalyticItem }>(AnalyticItemDialogComponent, { data: { item }, kind: 'modal-wide' }); }
}
