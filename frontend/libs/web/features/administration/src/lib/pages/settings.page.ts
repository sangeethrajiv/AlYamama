import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountingApi, ApiError, DataChanges, IdentityApi, SystemApi } from '@erp/web/api-client';
import { CompanyContext, PermissionService } from '@erp/web/core';
import { AmountPipe, DatePipe, DialogFrameComponent, DialogService, ErrorBannerComponent, I18n, IconComponent, MoneyPipe, PageHeaderComponent, PillComponent, SegmentedComponent, ToastService } from '@erp/web/ui';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { PERM, type FiscalPeriodConfig } from '@erp/shared/contracts';

/** Close-period wizard: every checklist item must be confirmed before the lock date advances. */
@Component({
  selector: 'erp-close-period-dialog',
  imports: [TranslocoPipe, DialogFrameComponent, ErrorBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="'admin.settings.wizard.title' | transloco" [subtitle]="'admin.settings.wizard.subtitle' | transloco">
      <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-xs">
        <erp-error-banner [text]="error()" />
        <label class="block"><span class="mb-1 block font-bold text-slate-600">{{ 'admin.settings.wizard.newDate' | transloco }}</span><input type="date" class="erp-input" [value]="date()" (input)="date.set($any($event.target).value)" /><span class="mt-1 block text-[10px] text-slate-400">{{ 'admin.settings.wizard.current' | transloco: { date: data.current } }}</span></label>
        <fieldset class="space-y-1.5"><legend class="mb-1 font-bold text-slate-600">{{ 'admin.settings.wizard.checklist' | transloco }}</legend>
          @for (c of checks; track c) { <label class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><input type="checkbox" class="accent-emerald-600" [checked]="done().has(c)" (change)="toggle(c)" /><span class="font-medium text-slate-800">{{ 'admin.settings.wizard.check.' + c | transloco }}</span></label> }
        </fieldset>
      </div>
      <div footer class="contents"><button type="button" class="erp-btn-ghost" (click)="ref.close()">{{ 'common.cancel' | transloco }}</button><button type="button" class="erp-btn-primary" [disabled]="done().size < checks.length" (click)="run()">{{ 'admin.settings.wizard.execute' | transloco }}</button></div>
    </erp-dialog-frame>`,
})
export class ClosePeriodDialogComponent {
  protected readonly data = inject<{ companyId: FiscalPeriodConfig['companyId']; current: string }>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly api = inject(AccountingApi);
  private readonly i18n = inject(I18n);
  protected readonly checks = ['entriesPosted', 'unreconciled', 'tbBalanced', 'retainedEarnings'];
  protected readonly done = signal<ReadonlySet<string>>(new Set(this.checks));
  protected readonly date = signal(this.data.current);
  protected readonly error = signal('');
  protected toggle(c: string): void { const n = new Set(this.done()); if (n.has(c)) n.delete(c); else n.add(c); this.done.set(n); }
  protected async run(): Promise<void> {
    if (this.done().size < this.checks.length) return this.error.set(this.i18n.tr('admin.settings.wizard.err.checklist'));
    try { await this.api.advanceLockDate(this.data.companyId, this.date(), this.date()); this.ref.close(true); }
    catch (e) { this.error.set(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric')); }
  }
}

@Component({
  selector: 'erp-settings-page',
  imports: [TranslocoPipe, PageHeaderComponent, SegmentedComponent, IconComponent, PillComponent, AmountPipe, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="'admin.settings.title' | transloco" [subtitle]="'admin.settings.subtitle' | transloco" />
      <erp-segmented [options]="tabs()" [(value)]="tab" />
      @switch (tab()) {
        @case ('periods') {
          <div class="space-y-6 rounded-xl border border-slate-200 bg-white p-6 text-xs shadow-sm">
            <div class="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
              <div><h2 class="text-base font-extrabold text-slate-900">{{ 'admin.settings.periods.title' | transloco }}</h2><p class="text-slate-500">{{ 'admin.settings.periods.entity' | transloco }} <strong class="text-slate-800">{{ company.active()?.name }}</strong></p></div>
              <button type="button" class="erp-btn-primary" [disabled]="!canAdvance()" [title]="canAdvance() ? '' : ('admin.settings.periods.denied' | transloco)" (click)="openWizard()">{{ 'admin.settings.periods.update' | transloco }}</button>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4"><div class="mb-1 font-bold text-slate-500">{{ 'admin.settings.periods.fiscalYear' | transloco }}</div><div class="my-1 font-mono text-xl font-black text-slate-900">{{ year() }}</div><p class="text-[11px] text-slate-500">{{ 'admin.settings.periods.fiscalYearText' | transloco }}</p></div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4"><div class="mb-1 font-bold text-slate-500">{{ 'admin.settings.periods.active' | transloco }}</div><div class="my-1 flex items-center gap-2 text-xl font-black text-slate-900"><span>{{ quarter() }}</span><erp-pill tone="green">{{ 'admin.settings.periods.open' | transloco }}</erp-pill></div><p class="text-[11px] text-slate-500">{{ 'admin.settings.periods.activeText' | transloco }}</p></div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4"><div class="mb-1 font-bold text-slate-500">{{ 'admin.settings.periods.closing' | transloco }}</div><div class="my-1 font-mono text-xl font-black text-slate-900">{{ fiscal.value()?.periodLockDate }}</div><p class="text-[11px] text-slate-500">{{ 'admin.settings.periods.closingText' | transloco }}</p></div>
            </div>
            <div class="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><erp-icon name="check-circle-2" [size]="16" class="mt-0.5 text-emerald-600" /><div><div class="font-bold text-slate-800">{{ 'admin.settings.periods.controls' | transloco }}</div><p class="mt-0.5 text-slate-600">{{ 'admin.settings.periods.controlsText' | transloco }}</p></div></div>
          </div>
        }
        @case ('companies') {
          <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div><h2 class="text-base font-extrabold text-slate-900">{{ 'admin.settings.companies.title' | transloco }}</h2><p class="text-xs text-slate-500">{{ 'admin.settings.companies.subtitle' | transloco }}</p></div>
            <div class="grid gap-3 md:grid-cols-2">
              @for (c of company.companies(); track c.id) {
                <div class="rounded-xl border p-4 text-xs" [class]="c.id === company.activeId() ? 'border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500' : 'border-slate-200'">
                  <div class="flex items-center justify-between"><span class="text-sm font-extrabold text-slate-900">{{ c.name }}</span><span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{{ c.code }}</span></div>
                  <div class="text-slate-500">{{ c.legalName }}</div>
                  <div class="mt-2 grid grid-cols-2 gap-1 text-slate-600"><div>{{ 'admin.settings.companies.cr' | transloco }} <strong>{{ c.crNumber }}</strong></div><div>{{ 'admin.settings.companies.tax' | transloco }} <strong>{{ c.vatNumber }}</strong></div><div>{{ 'admin.settings.companies.currency' | transloco }} <strong>{{ c.baseCurrency }}</strong></div><div>{{ 'admin.settings.companies.sync' | transloco }} <strong class="text-emerald-700">{{ 'admin.settings.companies.enabled' | transloco }}</strong></div></div>
                </div>
              }
            </div></div>
        }
        @case ('currencies') {
          <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex items-start justify-between gap-3"><div><h2 class="text-base font-extrabold text-slate-900">{{ 'admin.settings.currencies.title' | transloco }}</h2><p class="text-xs text-slate-500">{{ 'admin.settings.currencies.subtitle' | transloco }}</p></div>
              <button type="button" class="erp-btn-ghost" disabled [title]="'admin.settings.currencies.fetchNote' | transloco">{{ 'admin.settings.currencies.fetch' | transloco }}</button></div>
            <div class="overflow-x-auto rounded-lg border border-slate-200"><table class="erp-table"><thead><tr><th>{{ 'admin.settings.currencies.code' | transloco }}</th><th>{{ 'admin.settings.currencies.name' | transloco }}</th><th>{{ 'admin.settings.currencies.symbol' | transloco }}</th><th class="text-end">{{ 'admin.settings.currencies.rate' | transloco }}</th><th>{{ 'admin.settings.currencies.effective' | transloco }}</th><th class="text-center">{{ 'common.status' | transloco }}</th></tr></thead>
              <tbody>@for (c of currencies.value() ?? []; track c.currency) { <tr><td class="font-mono font-bold text-emerald-800">{{ c.currency }}</td><td class="font-semibold text-slate-800">{{ c.name }}</td><td class="font-mono">{{ c.symbol }}</td><td class="erp-num font-mono">1 {{ c.currency }} = {{ c.rateToBase | erpMoney: 4 }} SAR</td><td class="font-mono text-slate-500">{{ c.lastUpdated | erpDate }}</td><td class="text-center"><erp-pill [tone]="c.active ? 'green' : 'slate'">{{ (c.active ? 'common.active' : 'common.archived') | transloco }}</erp-pill></td></tr> }</tbody></table></div>
          </div>
        }
        @case ('thresholds') {
          <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div><h2 class="text-base font-extrabold text-slate-900">{{ 'admin.settings.limits.title' | transloco }}</h2><p class="text-xs text-slate-500">{{ 'admin.settings.limits.subtitle' | transloco }}</p></div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4"><div class="mb-1 text-xs font-bold text-slate-500">{{ 'admin.settings.limits.manager' | transloco }}</div><div class="font-mono text-xl font-black text-slate-900">{{ fiscal.value()?.thresholdLevel1 | erpAmount }}</div><p class="mt-1 text-[11px] text-slate-500">{{ 'admin.settings.limits.managerText' | transloco: { amount: fiscal.value()?.thresholdLevel1 } }}</p></div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4"><div class="mb-1 text-xs font-bold text-slate-500">{{ 'admin.settings.limits.director' | transloco }}</div><div class="font-mono text-xl font-black text-slate-900">{{ fiscal.value()?.thresholdLevel2 | erpAmount }}</div><p class="mt-1 text-[11px] text-slate-500">{{ 'admin.settings.limits.directorText' | transloco: { amount: fiscal.value()?.thresholdLevel2 } }}</p></div>
            </div></div>
        }
        @case ('migration') {
          <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div><h2 class="text-base font-extrabold text-slate-900">{{ 'admin.settings.opening.title' | transloco }}</h2><p class="text-xs text-slate-500">{{ 'admin.settings.opening.subtitle' | transloco }}</p></div>
            <div class="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div class="flex items-center gap-3"><erp-icon name="check-circle-2" [size]="20" class="text-emerald-600" /><div><div class="text-sm font-bold text-emerald-900">{{ 'admin.settings.opening.reconciled' | transloco }}</div><div class="text-xs text-emerald-800">{{ 'admin.settings.opening.cutoff' | transloco }}</div></div></div><erp-pill tone="green">{{ 'admin.settings.opening.completed' | transloco }}</erp-pill></div>
          </div>
        }
      }
    </div>`,
})
export class SettingsPage {
  protected readonly company = inject(CompanyContext);
  private readonly api = inject(AccountingApi);
  private readonly system = inject(SystemApi);
  private readonly identity = inject(IdentityApi);
  private readonly changes = inject(DataChanges);
  private readonly dialogs = inject(DialogService);
  private readonly perms = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);

  protected readonly tab = signal('periods');
  protected readonly fiscal = resource({ params: () => ({ id: this.company.activeId(), rev: this.changes.revision() }), loader: ({ params }) => this.api.fiscalConfig(params.id) });
  protected readonly currencies = resource({ loader: () => this.system.currencies() });
  protected readonly canAdvance = computed(() => this.perms.has(PERM.settings.lockDate));
  protected readonly year = computed(() => `${this.i18n.tr('admin.settings.periods.year')} ${new Date().getFullYear()}`);
  protected readonly quarter = computed(() => `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`);
  protected readonly tabs = computed(() => ['periods', 'companies', 'currencies', 'thresholds', 'migration'].map(id => ({ id, label: this.i18n.tr('admin.settings.tab.' + id) })));

  protected async openWizard(): Promise<void> {
    const cfg = this.fiscal.value();
    if (!cfg) return;
    const ref = this.dialogs.open<ClosePeriodDialogComponent, { companyId: FiscalPeriodConfig['companyId']; current: string }, boolean>(ClosePeriodDialogComponent, { data: { companyId: cfg.companyId, current: cfg.periodLockDate }, kind: 'modal' });
    ref.closed.subscribe(ok => ok && this.toast.success(this.i18n.tr('admin.settings.wizard.done')));
  }
}
void IdentityApi;
