import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, output, resource, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SystemApi } from '@erp/web/api-client';
import { DialogService, IconComponent } from '@erp/web/ui';
import type { UserRole } from '@erp/shared/contracts';
import { AuthService } from '../auth/auth.service';
import { CompanyContext } from '../company/company-context.service';
import { LanguageService } from '../i18n/language.service';
import { SearchService } from './search.service';
import { CurrenciesDialogComponent } from './currencies-dialog.component';

type Menu = 'company' | 'role' | 'user' | 'bell' | null;

const ROLE_TONE: Record<UserRole, string> = {
  'Finance Director': 'bg-slate-100 text-slate-800 border-slate-200',
  'Accounts Manager': 'bg-slate-100 text-slate-800 border-slate-200',
  'Senior Accountant': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Accountant: 'bg-amber-100 text-amber-800 border-amber-200',
  Auditor: 'bg-slate-100 text-slate-700 border-slate-300',
};
const ROLES: UserRole[] = ['Finance Director', 'Accounts Manager', 'Senior Accountant', 'Accountant', 'Auditor'];

@Component({
  selector: 'erp-header',
  imports: [IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur">
      <div class="flex items-center justify-between gap-4">
        <div class="flex max-w-xl flex-1 items-center gap-3">
          <button type="button" class="-ms-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" [attr.aria-label]="'shell.openMenu' | transloco" (click)="toggleSidebar.emit()">
            <erp-icon name="menu" [size]="20" />
          </button>
          <div class="relative w-full">
            <erp-icon name="search" [size]="17" class="pointer-events-none absolute start-3 top-2 text-slate-400" />
            <input #searchBox type="text" [value]="search.query()" (input)="search.query.set($any($event.target).value)"
              [placeholder]="'shell.searchPlaceholder' | transloco"
              class="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pe-8 ps-9 text-xs text-slate-800 placeholder-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            @if (search.query()) {
              <button type="button" class="absolute end-2 top-1.5 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" [attr.aria-label]="'shell.clearSearch' | transloco" (click)="search.query.set('')">
                <erp-icon name="x" [size]="14" />
              </button>
            }
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2.5">
          <!-- Company switcher -->
          <div class="relative">
            <button type="button" (click)="toggle('company')" [title]="'shell.switchCompany' | transloco" aria-haspopup="menu" [attr.aria-expanded]="menu() === 'company'"
              class="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
              <span class="max-w-[150px] truncate font-semibold">{{ company.active()?.name }}</span>
              <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{{ company.active()?.code }}</span>
              <erp-icon name="chevron-down" [size]="13" class="text-slate-400" />
            </button>
            @if (menu() === 'company') {
              <div class="fixed inset-0 z-40" (click)="menu.set(null)" aria-hidden="true"></div>
              <div role="menu" class="absolute end-0 z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                <div class="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{{ 'shell.selectEntity' | transloco }}</div>
                @for (c of company.companies(); track c.id) {
                  <button type="button" role="menuitem" (click)="selectCompany(c.id)"
                    class="flex w-full items-center justify-between px-3 py-2 text-start text-xs transition hover:bg-emerald-50"
                    [class]="c.id === company.activeId() ? 'bg-emerald-50/70 font-bold text-emerald-900' : 'text-slate-700'">
                    <div><div class="font-semibold text-slate-800">{{ c.name }}</div><div class="text-[10px] text-slate-400">{{ c.city }} • {{ 'shell.vat' | transloco }}: {{ c.vatNumber }}</div></div>
                    @if (c.id === company.activeId()) { <erp-icon name="check-circle-2" [size]="15" class="text-emerald-600" /> }
                  </button>
                }
              </div>
            }
          </div>

          <!-- Role switcher -->
          <div class="relative">
            <button type="button" (click)="toggle('role')" [title]="'shell.switchRole' | transloco" aria-haspopup="menu" [attr.aria-expanded]="menu() === 'role'"
              class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition" [class]="roleTone()">
              <span>{{ auth.role() }}</span><erp-icon name="chevron-down" [size]="12" class="opacity-70" />
            </button>
            @if (menu() === 'role') {
              <div class="fixed inset-0 z-40" (click)="menu.set(null)" aria-hidden="true"></div>
              <div role="menu" class="absolute end-0 z-50 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                <div class="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase text-slate-500">{{ 'shell.activeRole' | transloco }}</div>
                @for (r of roles; track r) {
                  <button type="button" role="menuitem" (click)="selectRole(r)" class="flex w-full items-center justify-between px-3 py-2 text-start text-xs hover:bg-slate-50"
                    [class]="r === auth.role() ? 'bg-emerald-50/50 font-bold text-emerald-700' : 'text-slate-700'">
                    <span>{{ r }}</span>@if (r === auth.role()) { <erp-icon name="check-circle-2" [size]="14" class="text-emerald-600" /> }
                  </button>
                }
              </div>
            }
          </div>

          <button type="button" (click)="openCurrencies()" [title]="'shell.currenciesTitle' | transloco"
            class="hidden items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700 transition hover:bg-slate-200 sm:flex">
            <erp-icon name="banknote" [size]="13" /><span>{{ 'shell.ratePill' | transloco: { rate: usdRate() } }}</span>
          </button>

          <button type="button" (click)="lang.toggle(); auth.persist()" [title]="'shell.toggleLanguage' | transloco"
            class="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100">
            <erp-icon name="languages" [size]="15" /><span class="font-semibold">{{ 'shell.languageButton' | transloco }}</span>
          </button>

          <!-- Notifications -->
          <div class="relative">
            <button type="button" (click)="toggle('bell')" [attr.aria-label]="'shell.notifications' | transloco" class="relative rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
              <erp-icon name="bell" [size]="17" />
            </button>
            @if (menu() === 'bell') {
              <div class="fixed inset-0 z-40" (click)="menu.set(null)" aria-hidden="true"></div>
              <div class="absolute end-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-500 shadow-xl">
                <erp-icon name="inbox" [size]="22" class="mb-1 text-slate-300" /><div>{{ 'shell.noNotifications' | transloco }}</div>
              </div>
            }
          </div>

          <!-- Account -->
          <div class="relative border-s border-slate-200 ps-2">
            <button type="button" (click)="toggle('user')" aria-haspopup="menu" [attr.aria-expanded]="menu() === 'user'" [attr.aria-label]="'shell.account' | transloco"
              class="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-slate-50">
              <span class="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white shadow-sm">{{ auth.user()?.initials }}</span>
              <span class="hidden text-start leading-tight md:block"><span class="block text-xs font-bold text-slate-800">{{ auth.user()?.name }}</span><span class="block text-[10px] text-slate-400">{{ auth.user()?.title }}</span></span>
              <erp-icon name="chevron-down" [size]="12" class="hidden text-slate-400 md:block" />
            </button>
            @if (menu() === 'user') {
              <div class="fixed inset-0 z-40" (click)="menu.set(null)" aria-hidden="true"></div>
              <div role="menu" class="absolute end-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div class="border-b border-slate-100 px-4 py-3">
                  <div class="text-xs font-bold text-slate-900">{{ auth.user()?.name }}</div>
                  <div class="truncate text-[11px] text-slate-500">{{ auth.user()?.email }}</div>
                  <div class="mt-1 text-[10px] font-bold text-emerald-700">{{ auth.role() }}</div>
                </div>
                <button type="button" role="menuitem" (click)="signOut()" class="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50">
                  <erp-icon name="log-out" [size]="14" />{{ 'shell.signOut' | transloco }}
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    </header>`,
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  protected readonly company = inject(CompanyContext);
  protected readonly lang = inject(LanguageService);
  protected readonly search = inject(SearchService);
  private readonly dialogs = inject(DialogService);
  private readonly system = inject(SystemApi);
  private readonly router = inject(Router);

  readonly toggleSidebar = output<void>();
  protected readonly menu = signal<Menu>(null);
  protected readonly roles = ROLES;
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');

  protected readonly roleTone = computed(() => ROLE_TONE[this.auth.role()]);
  private readonly currencies = resource({ loader: () => this.system.currencies() });
  protected readonly usdRate = computed(() => {
    const r = this.currencies.value()?.find(c => c.currency === 'USD')?.rateToBase ?? '3.75';
    return Number(r).toFixed(2);
  });

  @HostListener('window:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.searchBox()?.nativeElement.focus();
      this.searchBox()?.nativeElement.select();
    }
  }

  protected toggle(m: Exclude<Menu, null>): void {
    this.menu.set(this.menu() === m ? null : m);
  }
  protected selectCompany(id: Parameters<AuthService['selectCompany']>[0]): void {
    this.auth.selectCompany(id);
    this.menu.set(null);
  }
  protected async selectRole(r: UserRole): Promise<void> {
    this.menu.set(null);
    await this.auth.switchRole(r);
  }
  protected openCurrencies(): void {
    this.dialogs.open(CurrenciesDialogComponent, { kind: 'modal' });
  }
  protected signOut(): void {
    this.menu.set(null);
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
