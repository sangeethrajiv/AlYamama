import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountingApi, DataChanges } from '@erp/web/api-client';
import { SearchService } from '@erp/web/core';
import { EmptyStateComponent, IconComponent, PageHeaderComponent, PagerComponent, PillComponent } from '@erp/web/ui';
import { toCsv } from '@erp/shared/utils';
import type { AuditLogEntry } from '@erp/shared/contracts';

const TYPES = ['Invoice', 'Vendor Bill', 'Payment', 'Journal Entry', 'Chart of Accounts', 'Lock Date', 'Inventory Adjustment'] as const;
const FIELD_LABELS = new Set(['state', 'amount_total', 'approvalStatus', 'period_lock_date', 'fiscalyear_lock_date', 'supplierInvoiceNumber', 'dateInvoice', 'dateDue', 'partner_id', 'partner', 'reconciliation', 'direct_bank_tx', 'cheque_bounced', 'auto_intercompany', 'save_bill', 'create_credit_note', 'create', 'update', 'note']);

@Component({
  selector: 'erp-audit-page',
  imports: [TranslocoPipe, PageHeaderComponent, IconComponent, PillComponent, EmptyStateComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="'admin.audit.title' | transloco" [subtitle]="'admin.audit.subtitle' | transloco">
        <ng-container actions><button type="button" class="erp-btn bg-slate-900 text-white hover:bg-slate-800" (click)="exportCsv()"><erp-icon name="download" [size]="14" />{{ 'admin.audit.export' | transloco }}</button></ng-container>
      </erp-page-header>
      <div class="flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-200 shadow-sm md:flex-row md:items-center">
        <div class="flex items-start gap-3"><erp-icon name="lock" [size]="18" class="mt-0.5 text-emerald-400" />
          <div><div class="flex items-center gap-2 text-xs font-bold text-white"><span>{{ 'admin.audit.banner' | transloco }}</span><span class="rounded bg-emerald-500/30 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">{{ 'admin.audit.retention' | transloco }}</span></div>
            <p class="mt-0.5 max-w-2xl text-[11px] text-slate-400">{{ 'admin.audit.bannerText' | transloco }}</p></div></div>
        <label class="flex items-center gap-2 text-xs"><erp-icon name="filter" [size]="14" class="text-slate-400" />
          <select class="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-slate-200" [value]="type()" (change)="type.set($any($event.target).value); page.set(1)" [attr.aria-label]="'admin.audit.filterType' | transloco">
            <option value="all">{{ 'admin.audit.allTypes' | transloco }}</option>@for (t of types; track t) { <option [value]="t">{{ t }}</option> }</select></label>
      </div>
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div class="overflow-x-auto">
        <table class="erp-table"><thead><tr><th>{{ 'admin.audit.col.time' | transloco }}</th><th>{{ 'admin.audit.col.user' | transloco }}</th><th>{{ 'admin.audit.col.record' | transloco }}</th><th>{{ 'admin.audit.col.field' | transloco }}</th><th>{{ 'admin.audit.col.old' | transloco }}</th><th>{{ 'admin.audit.col.new' | transloco }}</th><th>{{ 'admin.audit.col.notes' | transloco }}</th></tr></thead>
          <tbody>@for (l of pageRows(); track l.id) {
            <tr><td class="whitespace-nowrap font-mono text-slate-500">{{ l.timestamp }}</td>
              <td class="whitespace-nowrap font-semibold text-slate-800"><span class="inline-flex items-center gap-1"><erp-icon name="user" [size]="12" class="text-slate-400" />{{ l.user }}</span></td>
              <td class="whitespace-nowrap"><div class="font-bold text-slate-900">{{ l.recordName }}</div><erp-pill>{{ l.recordType }}</erp-pill></td>
              <td class="whitespace-nowrap font-medium text-slate-700">{{ fieldLabel(l.fieldName) }}</td>
              <td class="font-mono text-slate-500">{{ l.oldValue || '—' }}</td><td class="font-mono font-semibold text-slate-800">{{ l.newValue || '—' }}</td>
              <td class="max-w-md text-slate-500">{{ l.notes }}</td></tr>
          }</tbody></table>
        @if (rows().length === 0) { <erp-empty-state [title]="'admin.audit.empty' | transloco" icon="history" /> }
        <erp-pager [total]="rows().length" [pageSize]="25" [(page)]="page" />
      </div></div>
    </div>`,
})
export class AuditPage {
  private readonly api = inject(AccountingApi);
  private readonly changes = inject(DataChanges);
  private readonly search = inject(SearchService);
  protected readonly types = TYPES;
  protected readonly type = signal('all');
  protected readonly page = signal(1);
  private readonly logs = resource({ params: () => this.changes.revision(), loader: () => this.api.auditLogs() });
  protected readonly rows = computed<AuditLogEntry[]>(() => {
    const q = this.search.term();
    return (this.logs.value() ?? []).filter(l => (this.type() === 'all' || l.recordType === this.type()) && (!q || l.recordName.toLowerCase().includes(q) || l.user.toLowerCase().includes(q) || l.fieldName.toLowerCase().includes(q) || (l.notes ?? '').toLowerCase().includes(q)));
  });
  protected readonly pageRows = computed(() => this.rows().slice((this.page() - 1) * 25, this.page() * 25));
  protected fieldLabel(f: string): string { return f.startsWith('edit:') ? f.slice(5) : FIELD_LABELS.has(f) ? f.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : f; }
  protected exportCsv(): void {
    const text = toCsv([['Timestamp', 'User', 'Record type', 'Record', 'Field', 'Old value', 'New value', 'Notes'], ...this.rows().map(l => [l.timestamp, l.user, l.recordType, l.recordName, l.fieldName, l.oldValue, l.newValue, l.notes ?? ''])]);
    const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click(); URL.revokeObjectURL(url);
  }
}
