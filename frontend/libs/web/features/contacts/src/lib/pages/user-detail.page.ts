import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService, type HasUnsavedChanges } from '@erp/web/core';
import { MetadataFormComponent, type Rec } from '@erp/web/metadata-forms';
import { AvatarComponent, CardComponent, DialogService, EmptyStateComponent, IconComponent, PillComponent, TabsComponent, ToastService, ErrorBannerComponent, I18n, MultiSelectComponent, SelectComponent } from '@erp/web/ui';
import { ApiError } from '@erp/web/api-client';
import { PERM, type ResUser } from '@erp/shared/contracts';
import { ChangePasswordDialogComponent, MIN_PASSWORD_LENGTH, type ChangePasswordData } from '../components/change-password-dialog.component';
import { UserAccessRightsComponent } from '../components/user-access-rights.component';
import { ContactsStore } from '../data/contacts.store';
import { EMAIL_RE } from '../views/contact.view';
import { lookupOptions, nameOf } from '../models/options';
import { USER_GENERAL_VIEW, USER_PREFERENCES_VIEW } from '../views/user.view';

type TabId = 'general' | 'access' | 'preferences';

/** Editable view of one res.users record. */
@Component({
  selector: 'erp-user-detail-page',
  imports: [TranslocoPipe, RouterLink, FormsModule, MultiSelectComponent, SelectComponent, MetadataFormComponent, UserAccessRightsComponent, AvatarComponent, CardComponent, EmptyStateComponent, IconComponent, PillComponent, TabsComponent, ErrorBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isNew() || user()) {
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <nav class="flex min-w-0 items-center gap-1 text-xs" [attr.aria-label]="'common.breadcrumb' | transloco">
            <a routerLink="/contacts/users" class="font-bold text-emerald-700 hover:underline">{{ 'contacts.users.title' | transloco }}</a>
            <erp-icon name="chevron-right" [size]="12" [flip]="true" class="shrink-0 text-slate-400" /><span class="truncate font-bold text-slate-700">{{ d().name || ('contacts.users.newUser' | transloco) }}</span>
          </nav>
          <div class="flex items-center gap-1 text-xs text-slate-500">
            <span class="tabular-nums">{{ pos() >= 0 ? pos() + 1 + ' / ' + ids().length : '' }}</span>
            <button type="button" [attr.aria-label]="'contacts.users.prev' | transloco" [disabled]="pos() <= 0" (click)="go(ids()[pos() - 1])" class="erp-btn-ghost erp-btn-sm"><erp-icon name="chevron-left" [size]="14" [flip]="true" /></button>
            <button type="button" [attr.aria-label]="'contacts.users.next' | transloco" [disabled]="pos() < 0 || pos() >= ids().length - 1" (click)="go(ids()[pos() + 1])" class="erp-btn-ghost erp-btn-sm"><erp-icon name="chevron-right" [size]="14" [flip]="true" /></button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <erp-avatar [name]="d().name || '?'" [size]="56" [round]="true" />
          <div class="min-w-0 flex-1">
            <h1 class="truncate font-display text-xl font-extrabold tracking-tight text-slate-900">{{ d().name || ('contacts.users.unnamed' | transloco) }}</h1>
            <div class="truncate text-xs text-slate-500">{{ d().email || d().login }}</div>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <erp-pill [tone]="d().active ? 'green' : 'slate'">{{ (d().active ? 'common.active' : 'common.archived') | transloco }}</erp-pill>
              @if (userType() !== 'internal') { <erp-pill tone="amber">{{ 'contacts.users.type.' + userType() | transloco }}</erp-pill> }
              @if (departmentName(); as dep) { <erp-pill tone="blue">{{ dep }}</erp-pill> }
              @if (d().is_gcc_user) { <erp-pill tone="blue">GCC</erp-pill> }
              @if (d().company_id) { <erp-pill>{{ companyName(d().company_id) }}</erp-pill> }
            </div>
          </div>
          <div class="flex items-center gap-2">
            @if (saved() && !dirty()) { <span class="flex items-center gap-1 text-xs font-bold text-emerald-700"><erp-icon name="check-circle-2" [size]="14" />{{ 'common.saved' | transloco }}</span> }
            @if (canWrite()) {
              @if (!isNew()) {
              <button type="button" class="erp-btn-ghost erp-btn-sm" [attr.title]="'contacts.users.changePassword' | transloco" (click)="changePassword()"><erp-icon name="lock" [size]="13" />{{ 'contacts.users.changePassword' | transloco }}</button>
              }
              <button type="button" class="erp-btn-ghost" [disabled]="!dirty()" (click)="discard()"><erp-icon name="undo" [size]="13" />{{ 'common.discard' | transloco }}</button>
              <button type="button" class="erp-btn-primary" [disabled]="!dirty()" (click)="save()"><erp-icon name="save" [size]="14" />{{ 'common.save' | transloco }}</button>
            }
          </div>
        </div>
        <erp-error-banner [text]="error()" />

        <erp-tabs [tabs]="tabs()" [(active)]="tab" />

        @switch (tab()) {
          @case ('general') {
            @for (k of [resetKey()]; track k) {
              <erp-metadata-form [view]="generalView" [value]="seed()" [readonly]="!canWrite()" [lookups]="options()" (valueChange)="patch($event)" />
            }
            <erp-card [title]="'contacts.users.multiCompanies' | transloco">
              <div class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'contacts.users.allowedCompaniesLabel' | transloco }}</span>
                  <erp-multi-select [options]="companyOptions()" [placeholder]="'contacts.users.selectCompanies' | transloco" [ngModel]="d().company_ids" [disabled]="!canWrite()" (ngModelChange)="setAllowed($event)" /></label>
                <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'contacts.users.currentCompany' | transloco }}</span>
                  <erp-select [options]="companyOptions()" [clearable]="false" [placeholder]="'contacts.users.selectCompany' | transloco" [ngModel]="d().company_id || null" [disabled]="!canWrite()" (ngModelChange)="$event !== null && setCompany(+$event)" />
                  <span class="mt-1 block text-[10px] text-slate-400">{{ 'contacts.users.defaultCompanyHint' | transloco }}</span></label>
              </div>
            </erp-card>
            <erp-card [title]="'contacts.users.userType' | transloco">
              <div class="flex flex-wrap gap-x-8 gap-y-2" role="radiogroup" [attr.aria-label]="'contacts.users.userType' | transloco">
                @for (t of userTypes; track t) {
                  <label class="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="radio" name="user-type" class="accent-emerald-600" [value]="t" [checked]="userType() === t" [disabled]="!canWrite()" (change)="setUserType(t)" />{{ 'contacts.users.type.' + t | transloco }}
                  </label>
                }
              </div>
            </erp-card>
          }
          @case ('access') {
            <erp-user-access-rights [groups]="store.lookups().groups" [selected]="d().groups" [readonly]="!canWrite()" (changed)="set('groups', $event)" />
          }
          @case ('preferences') {
            @for (k of [resetKey()]; track k) {
              <erp-metadata-form [view]="prefsView" [value]="seed()" [readonly]="!canWrite()" [lookups]="options()" (valueChange)="patch($event)" />
            }
          }
        }
      </div>
    } @else {
      <erp-card><erp-empty-state [title]="'contacts.users.notFound' | transloco" icon="user" /></erp-card>
    }`,
})
export class UserDetailPage implements HasUnsavedChanges {
  protected readonly store = inject(ContactsStore);
  private readonly router = inject(Router);
  private readonly perms = inject(PermissionService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);
  private readonly forms = viewChildren(MetadataFormComponent);

  /** Route param. */
  readonly id = input.required<string>();

  protected readonly generalView = USER_GENERAL_VIEW;
  protected readonly prefsView = USER_PREFERENCES_VIEW;
  protected readonly tab = signal<string>('general');
  protected readonly saved = signal(false);
  protected readonly error = signal('');
  protected readonly resetKey = signal(0);
  protected readonly pw = signal('');
  protected readonly pw2 = signal('');

  /** `/contacts/users/new` opens this page on a blank, not yet stored user. */
  protected readonly isNew = computed(() => this.id() === 'new');
  private readonly base = signal<ResUser | null>(null);

  protected readonly user = computed(() => (this.isNew() ? undefined : this.store.users().find(u => u.id === Number(this.id()))));
  protected readonly draft = signal<ResUser | null>(null);
  protected readonly d = computed(() => this.draft() ?? this.user() ?? this.blankUser());
  protected readonly seed = signal<Rec>({});
  protected readonly canWrite = computed(() => this.perms.has(PERM.user.write));
  protected readonly options = computed(() => {
    const l = this.store.lookups();
    return { ...lookupOptions(l), states: l.states.map(s => ({ value: s.id, label: s.name, group: s.country_id })) };
  });
  protected readonly ids = computed(() => this.store.users().map(u => u.id));
  protected readonly pos = computed(() => this.ids().indexOf(Number(this.id())));
  protected readonly dirty = computed(() => {
    const draft = this.draft();
    if (!draft) return false;
    if (this.isNew()) return JSON.stringify(draft) !== JSON.stringify(this.base()) || !!this.pw() || !!this.pw2();
    return !!this.user() && JSON.stringify(draft) !== JSON.stringify(this.user());
  });
  protected readonly tabs = computed(() => [
    { id: 'general', label: this.i18n.tr('contacts.users.tab.general') },
    { id: 'access', label: `${this.i18n.tr('contacts.users.tab.access')} (${this.d()?.groups.length ?? 0})` },
    { id: 'preferences', label: this.i18n.tr('contacts.users.tab.preferences') },
  ]);


  constructor() {
    // Load the draft whenever a different user is opened (or after a save refreshes the store)
    effect(() => {
      if (this.isNew()) {
        if (this.store.loaded() && this.draft()?.id !== 0) this.load(this.blankUser());
        return;
      }
      const u = this.user();
      if (!u) return;
      if (!this.draft() || this.draft()?.id !== u.id) this.load(u);
    });
  }

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  /** Defaults for a user that does not exist yet (id 0 marks it as new). */
  private blankUser(): ResUser {
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    return {
      id: 0, active: true, login: '', company_id: 0, partner_id: 0, share: false, create_date: now, write_date: now,
      notification_type: 'email', odoobot_state: 'not_initialized', sidebar_type: 'large', chatter_position: 'sided',
      name: '', lang: 'en_US', tz: 'Asia/Riyadh', employee: false, company_ids: [], groups: [],
    };
  }

  private load(u: ResUser): void {
    this.base.set(structuredClone(u));
    this.pw.set('');
    this.pw2.set('');
    this.draft.set(structuredClone(u));
    // The signature is an uploaded image now; older records hold HTML text, which the image field cannot show
    this.seed.set({ ...structuredClone(u), signature: u.signature?.startsWith('data:image') ? u.signature : undefined } as unknown as Rec);
    this.saved.set(false);
    this.error.set('');
    this.resetKey.update(v => v + 1);
  }

  protected set<K extends keyof ResUser>(k: K, v: ResUser[K]): void {
    this.saved.set(false);
    this.error.set('');
    this.draft.update(d => (d ? { ...d, [k]: v } : d));
  }
  protected patch(v: Rec): void {
    this.saved.set(false);
    this.error.set('');
    // The password pair lives in the form but never in the stored user
    const { new_password, confirm_password, ...rest } = v;
    this.pw.set(typeof new_password === 'string' ? new_password : '');
    this.pw2.set(typeof confirm_password === 'string' ? confirm_password : '');
    v = rest;
    this.draft.update(d => {
      if (!d) return d;
      const next = { ...d } as unknown as Rec;
      for (const k of Object.keys(v)) if (k in (d as unknown as Rec) || v[k] !== null) next[k] = v[k] === null || v[k] === '' ? undefined : v[k];
      return { ...(next as unknown as ResUser), emp: d.emp, groups: d.groups, company_ids: d.company_ids, company_id: d.company_id, logins: d.logins };
    });
  }
  /** The current company can never be dropped from the allowed list. */
  protected setAllowed(ids: (number | string | null)[] | null): void {
    const d = this.draft();
    if (!d) return;
    const next = (ids ?? []).map(Number);
    this.set('company_ids', !d.company_id || next.includes(d.company_id) ? next : [...next, d.company_id]);
  }
  protected setUserType(t: 'internal' | 'portal' | 'public'): void {
    this.saved.set(false);
    this.draft.update(d => (d ? { ...d, share: t !== 'internal', user_type: t } : d));
  }
  protected setCompany(cid: number): void {
    this.draft.update(d => (d ? { ...d, company_id: cid, company_ids: d.company_ids.includes(cid) ? d.company_ids : [...d.company_ids, cid] } : d));
  }
  protected readonly userTypes = ['internal', 'portal', 'public'] as const;
  protected readonly userType = computed<(typeof this.userTypes)[number]>(() => {
    const d = this.d();
    return !d.share ? 'internal' : d.user_type === 'public' ? 'public' : 'portal';
  });
  protected readonly companyOptions = computed(() => this.store.lookups().companies.map(c => ({ value: c.id, label: c.name })));
  protected readonly departmentName = computed(() => {
    const id = this.d().department_id;
    return id ? nameOf(this.store.lookups().departments, id) : '';
  });
  protected companyName = (id: number) => nameOf(this.store.lookups().companies, id);

  protected discard(): void {
    const u = this.isNew() ? this.blankUser() : this.user();
    if (u) this.load(u);
  }

  protected async save(): Promise<void> {
    const d = this.draft();
    if (!d) return;
    const bad = this.forms().find(f => !f.validate());
    const email = d.email?.trim() ?? '';
    if (bad || !d.name.trim() || (this.isNew() && !EMAIL_RE.test(email))) return this.error.set(this.i18n.tr('contacts.users.err.nameEmail'));
    try {
      if (this.isNew()) return await this.create({ ...d, login: email });
      // The email is the sign-in name; keep following it only while the two were the same
      const before = this.user();
      const follows = !!before && before.login.toLowerCase() === (before.email ?? '').toLowerCase();
      await this.store.saveUser(follows && email ? { ...d, login: email } : d);
      this.saved.set(true);
      this.toast.success(this.i18n.tr('common.saved'));
    } catch (e) {
      this.error.set(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric'));
    }
  }

  /** Creates the account, stores the rest of the form on it, then opens the stored user. */
  private async create(d: ResUser): Promise<void> {
    if (d.email && !EMAIL_RE.test(d.email)) return this.error.set(this.i18n.tr('contacts.err.email'));
    if (!d.company_id) return this.error.set(this.i18n.tr('contacts.users.err.company'));
    if (this.pw().length < MIN_PASSWORD_LENGTH) return this.error.set(this.i18n.tr('contacts.users.err.passwordShort', { n: MIN_PASSWORD_LENGTH }));
    if (this.pw() !== this.pw2()) return this.error.set(this.i18n.tr('contacts.users.err.passwordMismatch'));
    const made = await this.store.createUser({ name: d.name.trim(), login: d.login.trim(), email: d.email?.trim() || undefined, company_id: d.company_id, password: this.pw() });
    await this.store.saveUser({ ...d, id: made.id, partner_id: made.partner_id, create_date: made.create_date, write_date: made.write_date, name: made.name, login: made.login });
    this.toast.success(this.i18n.tr('common.saved'));
    await this.router.navigate(['/contacts/users', made.id], { replaceUrl: true });
  }

  protected async changePassword(): Promise<void> {
    const u = this.user();
    if (!u) return;
    const ref = this.dialogs.open<ChangePasswordDialogComponent, ChangePasswordData, boolean>(ChangePasswordDialogComponent, { data: { userId: u.id, name: u.name }, kind: 'modal' });
    if ((await firstValueFrom(ref.closed, { defaultValue: false })) === true) this.toast.success(this.i18n.tr('contacts.users.passwordChanged'));
  }

  protected async go(id: number): Promise<void> {
    if (this.dirty() && !(await this.dialogs.confirm({ title: this.i18n.tr('common.unsavedTitle'), message: this.i18n.tr('common.unsavedMessage'), confirmLabel: this.i18n.tr('common.discard'), danger: true }))) return;
    this.draft.set(null);
    void this.router.navigate(['/contacts/users', id]);
  }
}
