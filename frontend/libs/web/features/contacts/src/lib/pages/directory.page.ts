import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService, SearchService } from '@erp/web/core';
import { AvatarComponent, DialogService, EmptyStateComponent, IconComponent, MoneyPipe, PageHeaderComponent, PillComponent, SearchBoxComponent, SegmentedComponent, I18n } from '@erp/web/ui';
import { PERM, type Contact } from '@erp/shared/contracts';
import { gt, sub, sum } from '@erp/shared/utils';
import { ContactDialogComponent, type ContactDialogData } from '../components/contact-dialog.component';
import { ContactsStore } from '../data/contacts.store';

type Section = 'all' | 'customers' | 'vendors' | 'employees' | 'logins' | 'other' | 'archived';
type SortKey = 'name' | 'phone' | 'email';
const SECTIONS: Section[] = ['customers', 'vendors', 'employees', 'logins', 'other', 'archived'];
/** Business partners: customers, vendors and plain contacts. Staff, logins and special records stay out of the default list. */
const isBusiness = (c: Contact) => c.isCustomer || c.isVendor || (!c.isEmployee && !c.isLogin && !c.otherKind);
const phoneOf = (c: Contact) => c.phone || c.mobile;

/** Contacts directory (Users menu): customers, vendors, employees, system users, company & banks, archived. */
@Component({
  selector: 'erp-directory-page',
  imports: [TranslocoPipe, PageHeaderComponent, SearchBoxComponent, SegmentedComponent, AvatarComponent, PillComponent, EmptyStateComponent, IconComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <erp-page-header [title]="('contacts.dir.section.' + section() + '.title') | transloco" [subtitle]="('contacts.dir.section.' + section() + '.sub') | transloco">
        <ng-container actions>
          <erp-search-box [(value)]="local" [placeholder]="'contacts.dir.searchPlaceholder' | transloco" />
          <div class="inline-flex rounded-lg bg-slate-100 p-0.5" role="group">
            <button type="button" (click)="view.set('list')" [attr.aria-pressed]="view() === 'list'" [attr.aria-label]="'contacts.dir.listView' | transloco" class="rounded-md p-2" [class]="view() === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"><erp-icon name="list" [size]="14" /></button>
            <button type="button" (click)="view.set('cards')" [attr.aria-pressed]="view() === 'cards'" [attr.aria-label]="'contacts.dir.cardView' | transloco" class="rounded-md p-2" [class]="view() === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"><erp-icon name="layout-grid" [size]="14" /></button>
          </div>
          @if (canWrite()) { <button type="button" class="erp-btn-primary" (click)="open()"><erp-icon name="plus" [size]="15" />{{ 'contacts.dir.newUser' | transloco }}</button> }
        </ng-container>
      </erp-page-header>

      <erp-segmented [options]="segments()" [(value)]="filter" />

      @if (rows().length === 0) {
        <div class="rounded-xl border border-slate-200 bg-white"><erp-empty-state [title]="'contacts.dir.empty' | transloco" [text]="'contacts.dir.emptyHint' | transloco" /></div>
      } @else if (view() === 'list') {
        <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table class="erp-table">
            <thead><tr>
              <th class="w-14">{{ 'contacts.dir.col.image' | transloco }}</th>
              @for (k of sortKeys; track k) {
                <th [attr.aria-sort]="sort().key === k ? (sort().dir === 1 ? 'ascending' : 'descending') : 'none'"><button type="button" class="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800" (click)="toggleSort(k)">{{ ('contacts.dir.col.' + k) | transloco }}@if (sort().key === k) { <erp-icon [name]="sort().dir === 1 ? 'arrow-up' : 'arrow-down'" [size]="11" /> }</button></th>
              }
              <th>{{ 'contacts.dir.col.type' | transloco }}</th><th class="text-end">{{ 'contacts.dir.col.balance' | transloco }}</th>
            </tr></thead>
            <tbody>
              @for (c of rows(); track c.id) {
                <tr class="cursor-pointer" tabindex="0" (click)="open(c)" (keydown.enter)="open(c)">
                  <td><erp-avatar [name]="c.name" [src]="c.image" [size]="36" [round]="c.kind === 'individual'" /></td>
                  <td><div class="max-w-[300px] truncate font-bold text-slate-900">{{ c.name }}</div>@if (parentName(c); as p) { <div class="text-[10px] text-slate-500">{{ c.jobTitle ? c.jobTitle + ' · ' : '' }}{{ p }}</div> }</td>
                  <td class="font-mono">{{ phone(c) || '—' }}</td>
                  <td>{{ c.email || '—' }}</td>
                  <td><div class="flex flex-wrap gap-1">
                    @if (c.isCustomer) { <erp-pill tone="green">{{ 'contacts.role.customer' | transloco }}</erp-pill> } @if (c.isVendor) { <erp-pill tone="blue">{{ 'contacts.role.vendor' | transloco }}</erp-pill> }
                    @if (c.isEmployee) { <erp-pill tone="amber">{{ 'contacts.role.employee' | transloco }}</erp-pill> } @if (c.isLogin) { <erp-pill>{{ 'contacts.role.login' | transloco }}</erp-pill> }
                    @if (c.otherKind) { <erp-pill>{{ 'contacts.other.' + c.otherKind | transloco }}</erp-pill> }
                    @if (c.kind === 'individual' && !c.isCustomer && !c.isVendor && !c.isEmployee && !c.isLogin && !c.otherKind) { <erp-pill>{{ 'contacts.role.person' | transloco }}</erp-pill> }
                  </div></td>
                  <td class="text-end">
                    @if (balanceOf(c); as b) {
                      <div class="leading-tight"><div class="font-mono font-bold" [class]="b.net === 'pos' ? 'text-emerald-700' : b.net === 'neg' ? 'text-amber-700' : 'text-slate-600'">{{ b.abs | erpMoney }}</div>
                        <div class="text-[10px] text-slate-500">{{ ('contacts.dir.bal.' + b.note) | transloco }}</div></div>
                    } @else { <span class="text-slate-300">—</span> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          @for (c of rows(); track c.id) {
            <button type="button" (click)="open(c)" class="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 text-start transition hover:border-emerald-400 hover:shadow-sm">
              <erp-avatar [name]="c.name" [src]="c.image" [size]="56" [round]="c.kind === 'individual'" />
              <div class="min-w-0 flex-1 space-y-1">
                <div class="truncate text-sm font-extrabold text-slate-900">{{ c.name }}</div>
                @if (parentName(c); as p) { <div class="flex items-center gap-1 truncate text-[11px] text-slate-500"><erp-icon name="building" [size]="11" />{{ c.jobTitle ? c.jobTitle + ' · ' : '' }}{{ p }}</div> }
                @if (c.email) { <div class="flex items-center gap-1 truncate text-[11px] text-slate-600"><erp-icon name="mail" [size]="11" />{{ c.email }}</div> }
                @if (phone(c)) { <div class="flex items-center gap-1 font-mono text-[11px] text-slate-600"><erp-icon name="phone" [size]="11" />{{ phone(c) }}</div> }
              </div>
            </button>
          }
        </div>
      }
      <div class="text-[11px] text-slate-400">{{ 'contacts.dir.count' | transloco: { n: rows().length } }}</div>
    </div>`,
})
export class DirectoryPage {
  protected readonly store = inject(ContactsStore);
  private readonly search = inject(SearchService);
  private readonly dialogs = inject(DialogService);
  private readonly perms = inject(PermissionService);
  private readonly i18n = inject(I18n);

  /** Route param: customers | vendors | employees | logins | other | archived. */
  readonly sectionParam = input<string>('', { alias: 'section' });
  protected readonly section = computed<Section>(() => (SECTIONS.includes(this.sectionParam() as Section) ? (this.sectionParam() as Section) : 'all'));
  protected readonly filter = signal('all');
  protected readonly local = signal('');
  protected readonly view = signal<'list' | 'cards'>('list');
  protected readonly sort = signal<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  protected readonly sortKeys: SortKey[] = ['name', 'phone', 'email'];
  protected readonly canWrite = computed(() => this.perms.has(PERM.contact.write));

  private readonly scoped = computed(() => {
    const s = this.section();
    return this.store.contacts().filter(c => {
      if (s === 'archived') return !c.active;
      if (!c.active) return false;
      switch (s) {
        case 'customers': return c.isCustomer;
        case 'vendors': return c.isVendor;
        case 'employees': return !!c.isEmployee;
        case 'logins': return !!c.isLogin;
        case 'other': return !!c.otherKind;
        default: return isBusiness(c);
      }
    });
  });
  protected readonly segments = computed(() => {
    const l = this.scoped();
    const o = [
      { id: 'all', label: this.i18n.tr('contacts.dir.filter.all'), count: l.length },
      { id: 'companies', label: this.i18n.tr('contacts.dir.filter.companies'), count: l.filter(c => c.kind === 'company').length },
      { id: 'individuals', label: this.i18n.tr('contacts.dir.filter.individuals'), count: l.filter(c => c.kind === 'individual').length },
    ];
    if (this.section() === 'customers' || this.section() === 'vendors') o.push({ id: 'both', label: this.i18n.tr('contacts.dir.filter.both'), count: l.filter(c => c.isCustomer && c.isVendor).length });
    return o;
  });

  protected readonly rows = computed(() => {
    const q = (this.local() || this.search.query()).trim().toLowerCase();
    const f = this.filter();
    const list = this.scoped().filter(c => {
      if (f === 'both' && !(c.isCustomer && c.isVendor)) return false;
      if (f === 'companies' && c.kind !== 'company') return false;
      if (f === 'individuals' && c.kind !== 'individual') return false;
      return !q || [c.name, c.email, c.phone, c.mobile, c.vat, c.crNumber, c.customerCode, ...c.tags].some(v => v?.toLowerCase().includes(q));
    });
    const { key, dir } = this.sort();
    const val = (c: Contact) => (key === 'name' ? c.name : key === 'email' ? c.email : phoneOf(c)).toLowerCase();
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      if (!x !== !y) return x ? -1 : 1; // empty values always sink to the bottom
      return x.localeCompare(y) * dir;
    });
  });

  /** Net balance by exact name: receivable (customer invoices) minus payable (vendor bills). */
  private readonly balances = computed(() => {
    const m = new Map<string, { rec: string[]; pay: string[] }>();
    const e = (n: string) => { const k = n.trim().toLowerCase(); if (!m.has(k)) m.set(k, { rec: [], pay: [] }); return m.get(k) as { rec: string[]; pay: string[] }; };
    const open = (s: string) => s === 'open' || s === 'in_payment';
    this.store.activity().invoices.forEach(i => { if (open(i.state)) e(i.partner).rec.push(i.residual); });
    this.store.activity().bills.forEach(b => { if (open(b.state)) e(b.vendor).pay.push(b.residual); });
    return m;
  });
  protected balanceOf(c: Contact): { abs: string; net: 'pos' | 'neg' | 'zero'; note: string } | null {
    const b = this.balances().get(c.name.trim().toLowerCase());
    if (!b || (!b.rec.length && !b.pay.length)) return null;
    const rec = sum(b.rec), pay = sum(b.pay);
    const net = gt(rec, pay) ? 'pos' : gt(pay, rec) ? 'neg' : 'zero';
    const abs = net === 'neg' ? sub(pay, rec) : sub(rec, pay);
    const both = c.isCustomer && c.isVendor;
    const note = both ? (net === 'pos' ? 'netOwe' : net === 'neg' ? 'netOwed' : 'netSettled') : net === 'pos' ? 'owe' : 'owed';
    return { abs, net, note };
  }

  constructor() {
    // A different section starts from a clean filter, like a fresh page
    effect(() => {
      this.section();
      untracked(() => { this.filter.set('all'); this.local.set(''); });
    });
  }

  protected phone = phoneOf;
  protected parentName(c: Contact): string | undefined { return this.store.contacts().find(p => p.id === c.parentId)?.name; }
  protected toggleSort(key: SortKey): void { this.sort.update(s => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 })); }
  protected open(contact?: Contact): void {
    this.dialogs.open<ContactDialogComponent, ContactDialogData>(ContactDialogComponent, { data: { contact, readOnly: !this.canWrite() }, kind: 'modal-wide' });
  }
}
