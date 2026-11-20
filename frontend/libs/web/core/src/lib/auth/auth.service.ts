import { Injectable, computed, inject, signal } from '@angular/core';
import { IdentityApi, RequestContext } from '@erp/web/api-client';
import type { AuthUser, CompanyId, Permission, UserRole } from '@erp/shared/contracts';
import { CompanyContext } from '../company/company-context.service';
import { LanguageService } from '../i18n/language.service';
import { sessionStore } from './session-store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(IdentityApi);
  private readonly ctx = inject(RequestContext);
  private readonly company = inject(CompanyContext);
  private readonly language = inject(LanguageService);

  private readonly userSig = signal<AuthUser | null>(null);
  private readonly permissionSig = signal<ReadonlySet<Permission>>(new Set());
  private readonly rememberSig = signal(true);
  private readonly noticeSig = signal('');

  readonly user = this.userSig.asReadonly();
  readonly isAuthenticated = computed(() => this.userSig() !== null);
  readonly role = this.ctx.actorRole;
  readonly permissions = this.permissionSig.asReadonly();
  /** Message shown on the login page after sign-out. */
  readonly notice = this.noticeSig.asReadonly();

  /** Restores a remembered session (called once at startup). */
  async restore(): Promise<void> {
    await this.loadCompanies();
    const saved = sessionStore.load();
    if (!saved) return;
    const info = await this.api.session(saved.userId);
    if (!info) { sessionStore.clear(); return; }
    this.rememberSig.set(saved.remember);
    this.language.set(saved.arabic ? 'ar' : 'en');
    this.userSig.set(info.user);
    this.ctx.actorRole.set(saved.role);
    this.ctx.companyId.set(saved.companyId);
    this.permissionSig.set(new Set(await this.api.permissionsFor(saved.role)));
  }

  /** Rejects with an ApiError (401) on bad credentials. */
  async login(email: string, password: string, remember: boolean): Promise<void> {
    const info = await this.api.login(email, password);
    this.rememberSig.set(remember);
    this.noticeSig.set('');
    this.userSig.set(info.user);
    this.ctx.actorRole.set(info.user.role);
    this.permissionSig.set(new Set(info.permissions));
    this.persist();
  }

  logout(): void {
    sessionStore.clear();
    this.userSig.set(null);
    this.permissionSig.set(new Set());
    this.noticeSig.set('login.signedOut');
  }

  async switchRole(role: UserRole): Promise<void> {
    this.ctx.actorRole.set(role);
    this.permissionSig.set(new Set(await this.api.permissionsFor(role)));
    this.persist();
  }

  selectCompany(id: CompanyId): void {
    this.company.select(id);
    this.persist();
  }

  persist(): void {
    const u = this.userSig();
    if (!u) return;
    sessionStore.save({ userId: u.id, role: this.ctx.actorRole(), companyId: this.ctx.companyId(), arabic: this.language.isArabic(), remember: this.rememberSig() });
  }

  private async loadCompanies(): Promise<void> {
    this.company.setCompanies(await this.api.companies());
  }
}
