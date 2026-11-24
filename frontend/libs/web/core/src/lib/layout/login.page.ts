import { ChangeDetectionStrategy, Component, OnDestroy, inject, resource, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DEMO_PASSWORD, IdentityApi } from '@erp/web/api-client';
import { IconComponent } from '@erp/web/ui';
import type { AuthUser } from '@erp/shared/contracts';
import { AuthService } from '../auth/auth.service';
import { LanguageService } from '../i18n/language.service';

const MAX_TRIES = 5;
const LOCK_SECONDS = 30;

@Component({
  selector: 'erp-login-page',
  imports: [ReactiveFormsModule, IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-screen bg-slate-100 lg:grid-cols-[1.05fr_1fr]" [attr.dir]="lang.dir()">
      <aside class="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-12 text-slate-300 lg:flex">
        <div class="absolute -end-24 -top-24 h-96 w-96 rounded-full bg-emerald-600/20 blur-3xl" aria-hidden="true"></div>
        <div class="absolute -bottom-32 -start-16 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden="true"></div>
        <div class="relative flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-xl font-extrabold text-white shadow-lg shadow-emerald-900/40">AY</div>
          <div><div class="font-extrabold tracking-wide text-white">{{ 'shell.brand' | transloco }}</div><div class="text-xs text-slate-400">{{ 'shell.brandSub' | transloco }}</div></div>
        </div>
        <div class="relative max-w-md space-y-8">
          <div>
            <h1 class="text-3xl font-black leading-tight text-white">{{ 'login.heroTitle' | transloco }}</h1>
            <p class="mt-3 text-sm text-slate-400">{{ 'login.heroText' | transloco }}</p>
          </div>
          <ul class="space-y-4 text-sm">
            @for (f of features; track f.icon) {
              <li class="flex gap-3">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-emerald-400"><erp-icon [name]="f.icon" [size]="17" /></span>
                <span><span class="block font-bold text-white">{{ f.title | transloco }}</span><span class="text-xs text-slate-400">{{ f.text | transloco }}</span></span>
              </li>
            }
          </ul>
        </div>
        <div class="relative flex items-center gap-1.5 text-[11px] text-slate-500"><erp-icon name="shield-check" [size]="13" />{{ 'login.security' | transloco }}</div>
      </aside>

      <main class="flex items-center justify-center p-5 sm:p-10">
        <div class="w-full max-w-md">
          <div class="mb-6 flex items-center gap-3 lg:hidden">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 font-extrabold text-white">AY</div>
            <div class="font-extrabold text-slate-900">{{ 'shell.brand' | transloco }} {{ 'shell.brandSub' | transloco }}</div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div class="flex items-start justify-between">
              <div><h2 class="text-xl font-black text-slate-900">{{ 'login.title' | transloco }}</h2><p class="mt-1 text-xs text-slate-500">{{ 'login.subtitle' | transloco }}</p></div>
              <button type="button" class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100" (click)="lang.toggle()"><erp-icon name="languages" [size]="14" />{{ 'shell.languageButton' | transloco }}</button>
            </div>

            @if (auth.notice()) {
              <div role="status" class="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><erp-icon name="check-circle-2" [size]="14" />{{ auth.notice() | transloco }}</div>
            }
            @if (error()) {
              <div role="alert" class="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"><erp-icon name="alert-triangle" [size]="14" class="shrink-0" />{{ error() }}</div>
            }

            <form [formGroup]="form" (ngSubmit)="submit()" class="mt-5 space-y-4" novalidate>
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-slate-600">{{ 'login.email' | transloco }}</span>
                <span class="relative block"><erp-icon name="mail" [size]="15" class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" formControlName="email" autocomplete="username" [placeholder]="'login.emailPlaceholder' | transloco" class="field" /></span>
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-slate-600">{{ 'login.password' | transloco }}</span>
                <span class="relative block"><erp-icon name="lock" [size]="15" class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input [type]="show() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" placeholder="••••••••" class="field pe-10" (keyup)="caps.set($any($event).getModifierState?.('CapsLock') ?? false)" />
                  <button type="button" (click)="show.set(!show())" [attr.aria-label]="(show() ? 'login.hide' : 'login.show') | transloco" class="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700">
                    <erp-icon [name]="show() ? 'eye-off' : 'eye'" [size]="15" /></button></span>
                @if (caps()) { <span class="mt-1 block text-[11px] text-amber-600">{{ 'login.capsLock' | transloco }}</span> }
              </label>
              <div class="flex items-center justify-between text-xs">
                <label class="flex cursor-pointer items-center gap-2 text-slate-600"><input type="checkbox" formControlName="remember" class="accent-emerald-600" />{{ 'login.remember' | transloco }}</label>
                <button type="button" class="font-semibold text-emerald-700 hover:underline" (click)="forgot.set(!forgot())">{{ 'login.forgot' | transloco }}</button>
              </div>
              @if (forgot()) { <p class="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">{{ 'login.forgotText' | transloco }}</p> }
              <button type="submit" class="erp-btn-primary h-10 w-full" [disabled]="busy() || lockLeft() > 0">
                @if (busy()) { <erp-icon name="loader" [size]="15" class="animate-spin" />{{ 'login.busy' | transloco }} }
                @else if (lockLeft() > 0) { {{ 'login.lockedButton' | transloco: { seconds: lockLeft() } }} }
                @else { {{ 'login.submit' | transloco }} }
              </button>
            </form>

            <div class="mt-6 border-t border-slate-100 pt-4">
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ 'login.demo' | transloco }}</div>
              <p class="mt-1 text-[11px] text-slate-400">{{ 'login.demoNote' | transloco }}</p>
              <div class="mt-2 grid gap-1.5">
                @for (u of accounts.value() ?? []; track u.id) {
                  <button type="button" (click)="fill(u)" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5 text-start text-xs hover:border-emerald-300 hover:bg-emerald-50/40">
                    <span><span class="font-bold text-slate-700">{{ u.name }}</span> <span class="text-slate-400">· {{ u.role }}</span></span>
                    <span class="font-mono text-[10px] text-slate-400">{{ u.email }}</span>
                  </button>
                }
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>`,
  styles: `.field { @apply w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 ps-9 pe-3 text-sm text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/40; }`,
})
export class LoginPage implements OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly lang = inject(LanguageService);
  private readonly t = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly identity = inject(IdentityApi);
  private readonly fb = inject(FormBuilder);

  protected readonly accounts = resource({ loader: () => this.identity.demoAccounts() });
  protected readonly form = this.fb.nonNullable.group({ email: '', password: '', remember: true });
  protected readonly show = signal(false);
  protected readonly caps = signal(false);
  protected readonly busy = signal(false);
  protected readonly forgot = signal(false);
  protected readonly error = signal('');
  protected readonly lockLeft = signal(0);
  private tries = 0;
  private timer?: ReturnType<typeof setInterval>;

  protected readonly features = [
    { icon: 'book-open', title: 'login.featAccounting', text: 'login.featAccountingText' },
    { icon: 'users', title: 'login.featUsers', text: 'login.featUsersText' },
    { icon: 'boxes', title: 'login.featInventory', text: 'login.featInventoryText' },
  ];

  protected fill(u: AuthUser): void {
    this.form.patchValue({ email: u.email, password: DEMO_PASSWORD });
    this.error.set('');
  }

  protected async submit(): Promise<void> {
    if (this.busy() || this.lockLeft() > 0) return;
    const { email, password, remember } = this.form.getRawValue();
    if (!email.trim() || !password) return this.error.set(this.t.translate('login.needBoth'));
    this.error.set('');
    this.busy.set(true);
    try {
      await this.auth.login(email, password, remember);
      await this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard');
    } catch {
      this.tries += 1;
      this.form.patchValue({ password: '' });
      if (this.tries >= MAX_TRIES) {
        this.tries = 0;
        this.startLock();
        this.error.set(this.t.translate('login.locked', { seconds: LOCK_SECONDS }));
      } else {
        this.error.set(this.t.translate('login.invalid', { left: MAX_TRIES - this.tries }));
      }
    } finally {
      this.busy.set(false);
    }
  }

  private startLock(): void {
    this.lockLeft.set(LOCK_SECONDS);
    this.timer = setInterval(() => {
      this.lockLeft.update(v => v - 1);
      if (this.lockLeft() <= 0) clearInterval(this.timer);
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
