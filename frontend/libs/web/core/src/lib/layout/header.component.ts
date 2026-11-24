import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@erp/web/ui';
import { AuthService } from '../auth/auth.service';
import { CompanyContext } from '../company/company-context.service';

type Menu = 'company' | 'user' | 'bell' | null;

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
  private readonly router = inject(Router);

  readonly toggleSidebar = output<void>();
  protected readonly menu = signal<Menu>(null);

  protected toggle(m: Exclude<Menu, null>): void {
    this.menu.set(this.menu() === m ? null : m);
  }
  protected selectCompany(id: Parameters<AuthService['selectCompany']>[0]): void {
    this.auth.selectCompany(id);
    this.menu.set(null);
  }
  protected signOut(): void {
    this.menu.set(null);
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
