import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService } from '@erp/web/core';
import { MetadataViewComponent } from '@erp/web/metadata-forms';
import { AvatarComponent, CardComponent, DialogService, EmptyStateComponent, IconComponent, PillComponent, ToastService, I18n } from '@erp/web/ui';
import { PERM, type ResPartner } from '@erp/shared/contracts';
import { ContactsStore } from '../data/contacts.store';
import { lookupOptions, nameOf } from '../models/options';
import { PARTNER_VIEW } from '../views/partner.view';

/** Contact view: one read-only card per section, plus Edit / Archive / Restore / Delete actions. */
@Component({
  selector: 'erp-master-detail-page',
  imports: [NgTemplateOutlet, TranslocoPipe, RouterLink, MetadataViewComponent, AvatarComponent, CardComponent, EmptyStateComponent, IconComponent, PillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <nav class="flex items-center gap-1 text-xs min-w-0">
        <a routerLink="/contacts/master" class="font-bold text-emerald-700 hover:underline">{{ 'contacts.cm.title' | transloco }}</a>
        <erp-icon name="chevron-right" [size]="12" [flip]="true" class="shrink-0 text-slate-400" /><span class="truncate font-bold text-slate-700">{{ c() ? (c()!.display_name || c()!.name) : ('contacts.cm.notFound' | transloco) }}</span>
      </nav>
      @if (c(); as p) {
        <div class="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <erp-avatar [name]="p.name" [size]="56" [round]="!p.is_company" />
          <div class="min-w-0 flex-1">
            <h1 class="truncate font-display text-xl font-extrabold tracking-tight text-slate-900">{{ p.display_name }}</h1>
            <div class="truncate text-xs text-slate-500">{{ headline(p) || ('contacts.cm.contactNo' | transloco: { id: p.id }) }}</div>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <erp-pill [tone]="p.active ? 'green' : 'slate'">{{ (p.active ? 'common.active' : 'common.archived') | transloco }}</erp-pill>
              <erp-pill [tone]="p.is_company ? 'blue' : 'slate'">{{ (p.is_company ? 'contacts.cm.kind.company' : 'contacts.cm.kind.individual') | transloco }}</erp-pill>
              @if (p.type !== 'contact') { <erp-pill tone="amber">{{ 'contacts.type.' + p.type | transloco }}</erp-pill> }
              @if (p.customer) { <erp-pill tone="green">{{ 'contacts.role.customer' | transloco }}</erp-pill> }
              @if (p.supplier) { <erp-pill tone="amber">{{ 'contacts.cm.f.supplier' | transloco }}</erp-pill> }
              @if (p.employee) { <erp-pill tone="blue">{{ 'contacts.role.employee' | transloco }}</erp-pill> }
            </div>
          </div>
          @if (canWrite()) {
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="erp-btn-primary" (click)="edit()"><erp-icon name="pencil" [size]="14" />{{ 'common.edit' | transloco }}</button>
              @if (p.active) { <button type="button" class="erp-btn-ghost" (click)="archive()"><erp-icon name="archive" [size]="13" />{{ 'contacts.cm.act.archive' | transloco }}</button> }
              @else { <button type="button" class="erp-btn-ghost" (click)="restore()"><erp-icon name="archive-restore" [size]="13" />{{ 'contacts.cm.act.restore' | transloco }}</button> }
              <button type="button" class="erp-btn-danger" (click)="remove()"><erp-icon name="trash" [size]="13" />{{ 'common.delete' | transloco }}</button>
            </div>
          }
        </div>
        @if (!p.active) { <div role="status" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{{ (canWrite() ? 'contacts.cm.archivedBannerRestore' : 'contacts.cm.archivedBanner') | transloco }}</div> }

        <div class="grid items-start gap-3 lg:grid-cols-2">
          <div class="min-w-0 space-y-3"><erp-metadata-view [view]="view" [value]="record()" [lookups]="options()" [only]="['general', 'address', 'business']" /></div>
          <div class="min-w-0 space-y-3">
            <erp-metadata-view [view]="view" [value]="record()" [lookups]="options()" [only]="['contact', 'zatca', 'additional']" />
            <erp-card [title]="('contacts.cm.child.companies' | transloco) + ' (' + companies().length + ')'" [dense]="true">
              <ng-container [ngTemplateOutlet]="list" [ngTemplateOutletContext]="{ rows: companies(), empty: 'contacts.cm.child.noCompanies' }" />
            </erp-card>
            <erp-card [title]="('contacts.cm.child.contacts' | transloco) + ' (' + people().length + ')'" [dense]="true">
              <ng-container [ngTemplateOutlet]="list" [ngTemplateOutletContext]="{ rows: people(), empty: 'contacts.cm.child.noContacts' }" />
            </erp-card>
          </div>
        </div>
        <ng-template #list let-rows="rows" let-empty="empty">
          @if (rows.length === 0) { <div class="py-4 text-center text-xs text-slate-400">{{ empty | transloco }}</div> }
          @else {
            <ul class="divide-y divide-slate-100">
              @for (ch of rows; track ch.id) {
                <li><a [routerLink]="['/contacts/master', ch.id]" class="flex w-full items-center gap-2.5 rounded-lg px-1 py-2 text-start hover:bg-emerald-50/40" [class.opacity-60]="!ch.active">
                  <erp-avatar [name]="ch.name" [size]="28" [round]="!ch.is_company" />
                  <span class="min-w-0 flex-1"><span class="block truncate text-xs font-bold text-slate-900">{{ ch.name }}</span><span class="block truncate text-[11px] text-slate-500">{{ sub(ch) }}</span></span>
                  @if (ch.type !== 'contact') { <erp-pill tone="amber">{{ 'contacts.type.' + ch.type | transloco }}</erp-pill> }
                  @if (!ch.active) { <erp-pill>{{ 'common.archived' | transloco }}</erp-pill> }
                </a></li>
              }
            </ul>
          }
        </ng-template>
      } @else {
        <div class="rounded-xl border border-slate-200 bg-white"><erp-empty-state [title]="'contacts.cm.notFound' | transloco" [text]="'contacts.cm.notFoundHint' | transloco"><a routerLink="/contacts/master" class="erp-btn-ghost mt-3">{{ 'contacts.cm.backToContacts' | transloco }}</a></erp-empty-state></div>
      }
    </div>`,
})
export class MasterDetailPage {
  private readonly store = inject(ContactsStore);
  private readonly router = inject(Router);
  private readonly perms = inject(PermissionService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);

  readonly id = input.required<string>();
  protected readonly view = PARTNER_VIEW;
  protected readonly canWrite = computed(() => this.perms.has(PERM.contact.write));
  protected readonly c = computed(() => this.store.partners().find(p => p.id === Number(this.id())));
  protected readonly record = computed(() => (this.c() ?? {}) as unknown as Record<string, unknown>);
  protected readonly options = computed(() => {
    const l = this.store.lookups();
    const parents = this.store.partners().filter(p => p.is_company).map(p => ({ value: p.id, label: p.display_name }));
    return { ...lookupOptions(l), parents, states: l.states.map(s => ({ value: s.id, label: s.name, group: s.country_id })) };
  });
  private readonly kids = computed(() => this.store.partners().filter(x => x.parent_id === Number(this.id())).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)));
  protected readonly companies = computed(() => this.kids().filter(x => x.is_company));
  protected readonly people = computed(() => this.kids().filter(x => !x.is_company));

  protected sub(ch: ResPartner): string {
    const l = this.store.lookups();
    const first = ch.is_company ? [ch.city, nameOf(l.countries, ch.country_id)].filter(Boolean).join(', ') : ch.function;
    return [first, ch.email].filter(Boolean).join(' · ') || this.i18n.tr(`contacts.type.${ch.type}`);
  }
  protected headline(p: ResPartner): string { return [p.function, p.email].filter(x => !!x).join(' · '); }
  protected edit(): void { void this.router.navigate(['/contacts/master', this.id(), 'edit']); }
  protected async archive(): Promise<void> {
    const p = this.c();
    if (!p || !(await this.dialogs.confirm({ title: this.i18n.tr('contacts.cm.archiveTitle', { name: p.name }), message: this.i18n.tr('contacts.cm.archiveText'), confirmLabel: this.i18n.tr('contacts.cm.act.archive') }))) return;
    await this.store.setPartnerActive(p.id, false);
    this.toast.success(this.i18n.tr('contacts.cm.archived', { name: p.name }));
  }
  protected async restore(): Promise<void> {
    const p = this.c();
    if (!p) return;
    await this.store.setPartnerActive(p.id, true);
    this.toast.success(this.i18n.tr('contacts.cm.restored', { name: p.name }));
  }
  protected async remove(): Promise<void> {
    const p = this.c();
    if (!p) return;
    await this.dialogs.confirm({ title: this.i18n.tr('contacts.cm.deleteTitle', { name: p.name }), message: this.i18n.tr('contacts.cm.deleteText'), confirmLabel: this.i18n.tr('common.delete'), danger: true });
    this.toast.info(this.i18n.tr('contacts.cm.deleteKept', { name: p.name }));
  }
}
