import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PermissionService } from '@erp/web/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PERM, type ResCompany } from '@erp/shared/contracts';
import { AvatarComponent, CardComponent, EmptyStateComponent, IconComponent, TabsComponent, I18n } from '@erp/web/ui';
import { ContactsStore } from '../data/contacts.store';
import { ID_SCHEMES } from '../models/company-options';

/** One company (res.company), read only, laid out like the Odoo company form. */
@Component({
  selector: 'erp-company-detail-page',
  imports: [TranslocoPipe, RouterLink, AvatarComponent, CardComponent, EmptyStateComponent, IconComponent, TabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (company(); as c) {
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <nav class="flex min-w-0 items-center gap-1 text-xs" [attr.aria-label]="'common.breadcrumb' | transloco">
            <a routerLink="/contacts/directory/other" class="font-bold text-emerald-700 hover:underline">{{ 'contacts.co.title' | transloco }}</a>
            <erp-icon name="chevron-right" [size]="12" [flip]="true" class="shrink-0 text-slate-400" /><span class="truncate font-bold text-slate-700">{{ c.name }}</span>
          </nav>
          <div class="flex items-center gap-1 text-xs text-slate-500">
            <span class="tabular-nums">{{ pos() >= 0 ? pos() + 1 + ' / ' + ids().length : '' }}</span>
            <button type="button" [attr.aria-label]="'contacts.co.prev' | transloco" [attr.title]="'contacts.co.prev' | transloco" [disabled]="pos() <= 0" (click)="go(ids()[pos() - 1])" class="erp-btn-ghost erp-btn-sm"><erp-icon name="chevron-left" [size]="14" [flip]="true" /></button>
            <button type="button" [attr.aria-label]="'contacts.co.next' | transloco" [attr.title]="'contacts.co.next' | transloco" [disabled]="pos() < 0 || pos() >= ids().length - 1" (click)="go(ids()[pos() + 1])" class="erp-btn-ghost erp-btn-sm"><erp-icon name="chevron-right" [size]="14" [flip]="true" /></button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <erp-avatar [name]="c.name" [src]="c.logo ?? undefined" [size]="64" />
          <h1 class="min-w-0 flex-1 truncate font-display text-2xl font-extrabold tracking-tight text-slate-900">{{ c.name }}</h1>
          @if (canWrite()) { <button type="button" class="erp-btn-primary" (click)="edit()"><erp-icon name="pencil" [size]="14" />{{ 'common.edit' | transloco }}</button> }
        </div>

        <erp-tabs [tabs]="tabs()" [(active)]="tab" />

        @switch (tab()) {
          @case ('general') {
        <div class="grid gap-x-12 gap-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:grid-cols-2">
          <dl class="grid grid-cols-[170px_1fr] content-start items-start gap-x-4 gap-y-3 text-xs leading-5">
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.partner' | transloco }}</dt><dd>{{ c.partner_name }}</dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.zatca' | transloco }}</dt><dd>{{ c.l10n_sa_registered_name || '—' }}</dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.address' | transloco }}</dt>
            <dd>@for (l of addressLines(); track $index) { <div>{{ l }}</div> } @empty { <span class="text-slate-300">—</span> }</dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.parent' | transloco }}</dt>
            <dd>@if (c.parent_id) { <a [routerLink]="['/contacts/companies', c.parent_id]" class="text-emerald-700 hover:underline">{{ c.parent_name }}</a> } @else { <span class="text-slate-300">—</span> }</dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.currency' | transloco }}</dt><dd>{{ c.currency_name || '—' }}</dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.division' | transloco }}</dt><dd>{{ c.division || '—' }}</dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.representation' | transloco }}</dt><dd>{{ c.company_representation || '—' }}</dd>
          </dl>

          <dl class="grid grid-cols-[170px_1fr] content-start items-start gap-x-4 gap-y-3 text-xs leading-5">
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.website' | transloco }}</dt>
            <dd class="min-w-0 break-words">@if (c.website) { <a [href]="c.website" target="_blank" rel="noopener" class="text-emerald-700 hover:underline">{{ c.website }}</a> } @else { <span class="text-slate-300">—</span> }</dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.phone' | transloco }}</dt><dd>{{ c.phone || '—' }}</dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.email' | transloco }}</dt><dd class="min-w-0 break-words">{{ c.email || '—' }}</dd>
            @if (isSaudi()) {
              <dt class="font-bold text-slate-700">{{ 'contacts.co.f.idScheme' | transloco }}</dt><dd>{{ schemeName() || '—' }}</dd>
              @if (c.l10n_sa_additional_identification_scheme !== 'TIN') {
                <dt class="font-bold text-slate-700">{{ 'contacts.co.f.idNumber' | transloco }}</dt><dd>{{ c.l10n_sa_additional_identification_number || '—' }}</dd>
              }
            }
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.vat' | transloco }}</dt><dd>{{ c.vat || '—' }}</dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.registry' | transloco }}</dt><dd>{{ c.company_registry || '—' }}</dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.bankDetails' | transloco }}</dt><dd><input type="checkbox" class="mt-1 accent-emerald-600" disabled [checked]="!!c.bank_details_sale_quote" /></dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.cashInvoice' | transloco }}</dt><dd><input type="checkbox" class="mt-1 accent-emerald-600" disabled [checked]="!!c.cash_invoice" /></dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.creditInvoice' | transloco }}</dt><dd><input type="checkbox" class="mt-1 accent-emerald-600" disabled [checked]="!!c.credit_invoice" /></dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.seal' | transloco }}</dt>
            <dd>@if (c.company_seal) { <img [src]="c.company_seal" alt="" class="max-h-44 max-w-full rounded-lg border border-slate-200 bg-white object-contain" /> } @else { <span class="text-slate-300">—</span> }</dd>
          </dl>
        </div>

          }
          @case ('report') {
        <div class="grid gap-x-12 gap-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:grid-cols-2">
          <dl class="grid grid-cols-[170px_1fr] content-start items-start gap-x-4 gap-y-3 text-xs leading-5 lg:col-span-2">
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.header' | transloco }}</dt>
            <dd>@if (c.company_header_boxed) { <img [src]="c.company_header_boxed" alt="" class="max-h-44 max-w-full rounded-lg border border-slate-200 bg-white object-contain" /> } @else { <span class="text-slate-300">—</span> }</dd>
            <dt class="font-bold text-slate-700">{{ 'contacts.co.f.footer' | transloco }}</dt>
            <dd>@if (c.company_footer_boxed) { <img [src]="c.company_footer_boxed" alt="" class="max-h-44 max-w-full rounded-lg border border-slate-200 bg-white object-contain" /> } @else { <span class="text-slate-300">—</span> }</dd>
          </dl>
        </div>
          }
          @case ('intercompany') {
            <div class="rounded-xl border border-slate-200 bg-white p-5">
              <dl class="grid max-w-3xl grid-cols-[170px_1fr] content-start items-start gap-x-4 gap-y-3 text-xs leading-5">
                <dt class="font-bold text-slate-700">{{ 'contacts.co.f.dueFrom' | transloco }}</dt><dd>{{ c.due_from_account_name || (c.due_from_account_id ? '#' + c.due_from_account_id : '—') }}</dd>
                <dt class="font-bold text-slate-700">{{ 'contacts.co.f.dueTo' | transloco }}</dt><dd>{{ c.due_to_account_name || (c.due_to_account_id ? '#' + c.due_to_account_id : '—') }}</dd>
                <dt class="font-bold text-slate-700">{{ 'contacts.co.f.dueJournal' | transloco }}</dt><dd>{{ c.due_fromto_payment_journal_name || (c.due_fromto_payment_journal_id ? '#' + c.due_fromto_payment_journal_id : '—') }}</dd>
              </dl>
            </div>
          }
        }
      </div>
    } @else if (failed()) {
      <erp-card><erp-empty-state [title]="'contacts.co.notFound' | transloco" icon="building" /></erp-card>
    }`,
})
export class CompanyDetailPage {
  private readonly store = inject(ContactsStore);
  private readonly i18n = inject(I18n);
  private readonly router = inject(Router);
  private readonly perms = inject(PermissionService);
  protected readonly canWrite = computed(() => this.perms.has(PERM.contact.write));

  /** Route param. */
  readonly id = input.required<string>();

  protected readonly company = signal<ResCompany | null>(null);
  protected readonly failed = signal(false);
  protected readonly tab = signal('general');
  /** Every company in list order (name), for the previous / next buttons. */
  protected readonly ids = signal<number[]>([]);
  protected readonly pos = computed(() => this.ids().indexOf(Number(this.id())));
  protected readonly tabs = computed(() => [{ id: 'general', label: this.i18n.tr('contacts.co.tab.general') }, { id: 'report', label: this.i18n.tr('contacts.co.tab.report') }, { id: 'intercompany', label: this.i18n.tr('contacts.co.tab.intercompany') }]);

  protected readonly isSaudi = computed(() => this.company()?.country_code === 'SA');
  protected readonly schemeName = computed(() => ID_SCHEMES[this.company()?.l10n_sa_additional_identification_scheme ?? ''] ?? '');
  /** Address lines as Odoo prints them; the Saudi building number and plot only apply to Saudi addresses. */
  protected readonly addressLines = computed(() => {
    const c = this.company();
    if (!c) return [];
    const cityLine = [c.city, c.state_name, c.zip].filter(Boolean).join(' ');
    const sa = this.isSaudi();
    return [c.street, c.street2, cityLine, c.country_name, sa ? c.l10n_sa_edi_building_number : '', sa ? c.l10n_sa_edi_plot_identification : ''].filter((l): l is string => !!l);
  });
  protected edit(): void {
    void this.router.navigate(['/contacts/companies', this.id(), 'edit']);
  }

  protected go(id: number | undefined): void {
    if (id !== undefined) void this.router.navigate(['/contacts/companies', id]);
  }

  constructor() {
    void this.store.companyList().then(list => this.ids.set([...list].sort((a, b) => a.name.localeCompare(b.name)).map(c => c.id)), () => this.ids.set([]));
    effect(() => {
      const id = Number(this.id());
      this.company.set(null);
      this.failed.set(false);
      void this.store.company(id).then(c => this.company.set(c), () => this.failed.set(true));
    });
  }
}
