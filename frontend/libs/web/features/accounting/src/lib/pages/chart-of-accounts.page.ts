import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SearchService } from '@erp/web/core';
import { AmountPipe, EmptyStateComponent, IconComponent, PageHeaderComponent, PillComponent } from '@erp/web/ui';
import { toCsv, lt } from '@erp/shared/utils';
import type { Account } from '@erp/shared/contracts';
import { AccountingStore } from '../data/accounting.store';
import { downloadCsv } from '../models/download';

const GROUPS = ['all', 'asset', 'liability', 'equity', 'income', 'expense'] as const;
const TONE: Record<Account['internalGroup'], 'blue' | 'amber' | 'slate' | 'green' | 'red'> = { asset: 'slate', liability: 'amber', equity: 'slate', income: 'green', expense: 'red' };

@Component({
  selector: 'erp-chart-of-accounts-page',
  imports: [TranslocoPipe, PageHeaderComponent, IconComponent, PillComponent, AmountPipe, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="'accounting.coa.title' | transloco" [subtitle]="'accounting.coa.subtitle' | transloco">
        <ng-container actions>
          <button type="button" class="erp-btn-ghost" disabled [title]="'accounting.coa.notAvailable' | transloco"><erp-icon name="upload" [size]="14" />{{ 'accounting.coa.import' | transloco }}</button>
          <button type="button" class="erp-btn-primary" disabled [title]="'accounting.coa.notAvailable' | transloco"><erp-icon name="plus" [size]="15" />{{ 'accounting.coa.newAccount' | transloco }}</button>
        </ng-container>
      </erp-page-header>

      <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        @for (g of groups; track g) {
          <button type="button" (click)="group.set(g)" class="whitespace-nowrap rounded-lg px-3 py-1.5 font-bold transition"
            [class]="group() === g ? 'bg-emerald-700 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'">{{ 'accounting.coa.group.' + g | transloco }}</button>
        }
      </div>

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="erp-table">
            <thead><tr>
              <th>{{ 'accounting.coa.col.code' | transloco }}</th><th>{{ 'accounting.coa.col.name' | transloco }}</th><th>{{ 'accounting.coa.col.type' | transloco }}</th><th>{{ 'accounting.coa.col.group' | transloco }}</th>
              <th class="text-center">{{ 'accounting.coa.col.reconcile' | transloco }}</th><th class="text-center">{{ 'accounting.coa.col.active' | transloco }}</th><th class="text-end">{{ 'accounting.coa.col.balance' | transloco }}</th><th class="text-end">{{ 'common.actions' | transloco }}</th>
            </tr></thead>
            <tbody>
              @for (a of rows(); track a.id) {
                <tr>
                  <td class="whitespace-nowrap font-mono font-bold text-emerald-800">{{ a.code }}</td>
                  <td class="font-semibold text-slate-900"><div>{{ a.name }}</div>@if (a.currency) { <span class="font-mono text-[10px] text-slate-400">{{ 'accounting.coa.currency' | transloco }}: {{ a.currency }}</span> }</td>
                  <td>{{ a.type }}</td>
                  <td><erp-pill [tone]="tone(a)">{{ 'accounting.coa.group.' + a.internalGroup | transloco }}</erp-pill></td>
                  <td class="text-center"><erp-icon [name]="a.reconcile ? 'check' : 'x'" [size]="16" [class]="a.reconcile ? 'text-emerald-600' : 'text-slate-300'" /></td>
                  <td class="text-center"><span class="inline-block h-2 w-2 rounded-full" [class]="a.active ? 'bg-emerald-500' : 'bg-slate-300'" [title]="(a.active ? 'common.active' : 'common.archived') | transloco"></span></td>
                  <td class="whitespace-nowrap text-end font-mono font-bold" [class]="neg(a) ? 'text-rose-700' : 'text-slate-900'">{{ a.balance | erpAmount: a.currency || 'SAR' }}</td>
                  <td class="whitespace-nowrap text-end"><button type="button" class="ms-auto rounded px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50" [title]="'accounting.coa.drill' | transloco" (click)="ledger(a)">{{ 'accounting.coa.ledger' | transloco }}</button></td>
                </tr>
              }
            </tbody>
          </table>
          @if (rows().length === 0) { <erp-empty-state [title]="'common.noResults' | transloco" /> }
        </div>
        <div class="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-500">
          <div>{{ 'accounting.coa.showing' | transloco: { n: rows().length, total: store.accounts().length } }}</div>
          <button type="button" class="font-semibold hover:text-emerald-700" (click)="exportCsv()">{{ 'accounting.coa.export' | transloco }}</button>
        </div>
      </div>
    </div>`,
})
export class ChartOfAccountsPage {
  protected readonly store = inject(AccountingStore);
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);
  protected readonly groups = GROUPS;
  protected readonly group = signal<(typeof GROUPS)[number]>('all');

  protected readonly rows = computed(() => {
    const q = this.search.term();
    return this.store.accounts().filter(a => (this.group() === 'all' || a.internalGroup === this.group()) && (!q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)));
  });
  protected tone = (a: Account) => TONE[a.internalGroup];
  protected neg = (a: Account) => lt(a.balance, '0');
  protected ledger(a: Account): void { void this.router.navigate(['/reports'], { queryParams: { account: a.code } }); }
  protected exportCsv(): void {
    downloadCsv('chart-of-accounts.csv', toCsv([['Code', 'Name', 'Type', 'Group', 'Reconcile', 'Active', 'Balance', 'Currency'], ...this.rows().map(a => [a.code, a.name, a.type, a.internalGroup, a.reconcile, a.active, a.balance, a.currency ?? 'SAR'])]));
  }
}
