import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChildren } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PermissionService, type HasUnsavedChanges } from '@erp/web/core';
import { MetadataFormComponent, type Rec } from '@erp/web/metadata-forms';
import { AvatarComponent, CardComponent, DialogService, EmptyStateComponent, IconComponent, PillComponent, TabsComponent, ToastService, ErrorBannerComponent, I18n } from '@erp/web/ui';
import { ApiError } from '@erp/web/api-client';
import { PERM, type Employee, type ResUser } from '@erp/shared/contracts';
import { UserAccessRightsComponent } from '../components/user-access-rights.component';
import { ContactsStore } from '../data/contacts.store';
import { lookupOptions, nameOf } from '../models/options';
import { USER_EMPLOYEE_VIEW, USER_GENERAL_VIEW, USER_PREFERENCES_VIEW } from '../views/user.view';

type TabId = 'general' | 'access' | 'companies' | 'preferences' | 'employee' | 'activity';

/** Editable view of one res.users record. */
@Component({
  selector: 'erp-user-detail-page',
  imports: [TranslocoPipe, RouterLink, MetadataFormComponent, UserAccessRightsComponent, AvatarComponent, CardComponent, EmptyStateComponent, IconComponent, PillComponent, TabsComponent, ErrorBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (user(); as u) {
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
            <div class="truncate text-xs text-slate-500">{{ d().login }}</div>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <erp-pill [tone]="d().active ? 'green' : 'slate'">{{ (d().active ? 'common.active' : 'common.archived') | transloco }}</erp-pill>
              <erp-pill [tone]="d().share ? 'amber' : 'blue'">{{ d().share ? 'Portal / Public' : 'Internal' }}</erp-pill>
              @if (d().is_gcc_user) { <erp-pill tone="blue">GCC</erp-pill> }
              @if (d().emp) { <erp-pill>{{ 'contacts.users.c.employee' | transloco }}</erp-pill> }
              <erp-pill>{{ companyName(d().company_id) }}</erp-pill>
            </div>
          </div>
          <div class="flex items-center gap-2">
            @if (saved() && !dirty()) { <span class="flex items-center gap-1 text-xs font-bold text-emerald-700"><erp-icon name="check-circle-2" [size]="14" />{{ 'common.saved' | transloco }}</span> }
            @if (canWrite()) {
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
          }
          @case ('access') {
            <erp-user-access-rights [groups]="store.lookups().groups" [selected]="d().groups" [readonly]="!canWrite()" (changed)="set('groups', $event)" />
          }
          @case ('companies') {
            <div class="grid gap-4 lg:grid-cols-3">
              <erp-card [title]="'contacts.users.defaultCompany' | transloco">
                <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'contacts.users.c.company' | transloco }}</span>
                  <select class="erp-input" [disabled]="!canWrite()" [value]="d().company_id" (change)="setCompany(+$any($event.target).value)">
                    @for (c of store.lookups().companies; track c.id) { <option [value]="c.id" [selected]="c.id === d().company_id">{{ c.name }}</option> }
                  </select><span class="mt-1 block text-[10px] text-slate-400">{{ 'contacts.users.defaultCompanyHint' | transloco }}</span></label>
              </erp-card>
              <div class="lg:col-span-2">
                <erp-card [title]="'contacts.users.allowedCompanies' | transloco">
                  <div class="grid gap-2 sm:grid-cols-2">
                    @for (c of store.lookups().companies; track c.id) {
                      <label class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5" [class]="d().company_ids.includes(c.id) ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'">
                        <input type="checkbox" class="accent-emerald-600" [checked]="d().company_ids.includes(c.id)" [disabled]="c.id === d().company_id || !canWrite()" (change)="toggleCompany(c.id)" />
                        <span class="flex-1 text-xs font-bold text-slate-900">{{ c.name }}</span>
                        @if (c.id === d().company_id) { <erp-pill tone="green">{{ 'contacts.users.default' | transloco }}</erp-pill> }
                      </label>
                    }
                  </div>
                </erp-card>
              </div>
            </div>
          }
          @case ('preferences') {
            @for (k of [resetKey()]; track k) {
              <erp-metadata-form [view]="prefsView" [value]="seed()" [readonly]="!canWrite()" [lookups]="options()" (valueChange)="patch($event)" />
            }
          }
          @case ('employee') {
            @if (d().emp) {
              @for (k of [resetKey()]; track k) {
                <erp-metadata-form [view]="employeeView" [value]="seedEmp()" [readonly]="!canWrite()" [lookups]="options()" (valueChange)="patchEmp($event)" />
              }
            } @else {
              <erp-card [title]="'contacts.users.section.employee' | transloco"><erp-empty-state [title]="'contacts.users.noEmployee' | transloco" /></erp-card>
            }
          }
          @case ('activity') {
            <div class="grid gap-4 lg:grid-cols-2">
              <erp-card [title]="'contacts.users.authentication' | transloco">
                <p class="mb-3 text-[11px] text-slate-400">{{ 'contacts.users.latestLogins' | transloco }}</p>
                @if (d().logins?.length) {
                  <ul class="divide-y divide-slate-100 text-xs">
                    @for (l of d().logins; track l; let i = $index) { <li class="flex justify-between py-1.5"><span class="tabular-nums">{{ l }}</span>@if (i === 0) { <erp-pill tone="green">{{ 'contacts.users.latest' | transloco }}</erp-pill> }</li> }
                  </ul>
                } @else { <div class="py-4 text-center text-xs text-slate-400">{{ 'contacts.users.neverSignedIn' | transloco }}</div> }
              </erp-card>
              <erp-card [title]="'contacts.users.recordAudit' | transloco">
                <div class="grid gap-3 sm:grid-cols-2">
                  @for (a of audit(); track a[0]) { <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ a[0] | transloco }}</span><input class="erp-input" [value]="a[1]" readonly disabled /></label> }
                </div>
              </erp-card>
            </div>
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
  protected readonly employeeView = USER_EMPLOYEE_VIEW;
  protected readonly tab = signal<string>('general');
  protected readonly saved = signal(false);
  protected readonly error = signal('');
  protected readonly resetKey = signal(0);

  protected readonly user = computed(() => this.store.users().find(u => u.id === Number(this.id())));
  protected readonly draft = signal<ResUser | null>(null);
  protected readonly d = computed(() => this.draft() ?? (this.user() as ResUser));
  protected readonly seed = signal<Rec>({});
  protected readonly seedEmp = signal<Rec>({});
  protected readonly canWrite = computed(() => this.perms.has(PERM.user.write));
  protected readonly options = computed(() => {
    const l = this.store.lookups();
    return { ...lookupOptions(l), states: l.states.map(s => ({ value: s.id, label: s.name, group: s.country_id })) };
  });
  protected readonly ids = computed(() => this.store.users().map(u => u.id));
  protected readonly pos = computed(() => this.ids().indexOf(Number(this.id())));
  protected readonly dirty = computed(() => !!this.user() && !!this.draft() && JSON.stringify(this.draft()) !== JSON.stringify(this.user()));
  protected readonly tabs = computed(() => [
    { id: 'general', label: this.i18n.tr('contacts.users.tab.general') },
    { id: 'access', label: `${this.i18n.tr('contacts.users.tab.access')} (${this.d()?.groups.length ?? 0})` },
    { id: 'companies', label: `${this.i18n.tr('contacts.users.tab.companies')} (${this.d()?.company_ids.length ?? 0})` },
    { id: 'preferences', label: this.i18n.tr('contacts.users.tab.preferences') },
    { id: 'employee', label: this.i18n.tr('contacts.users.tab.employee') },
    { id: 'activity', label: this.i18n.tr('contacts.users.tab.activity') },
  ]);
  protected readonly audit = computed<[string, string][]>(() => {
    const u = this.d();
    const who = (id?: number) => nameOf(this.store.users().map(x => ({ id: x.id, name: x.name })), id);
    return [['contacts.users.c.createDate', u.create_date], ['contacts.users.c.createUid', who(u.create_uid)], ['contacts.users.c.writeDate', u.write_date], ['contacts.users.c.writeUid', who(u.write_uid)]];
  });

  constructor() {
    // Load the draft whenever a different user is opened (or after a save refreshes the store)
    effect(() => {
      const u = this.user();
      if (!u) return;
      if (!this.draft() || this.draft()?.id !== u.id) this.load(u);
    });
  }

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  private load(u: ResUser): void {
    this.draft.set(structuredClone(u));
    this.seed.set(structuredClone(u) as unknown as Rec);
    this.seedEmp.set(structuredClone(u.emp ?? {}) as unknown as Rec);
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
    this.draft.update(d => {
      if (!d) return d;
      const next = { ...d } as unknown as Rec;
      for (const k of Object.keys(v)) if (k in (d as unknown as Rec) || v[k] !== null) next[k] = v[k] === null || v[k] === '' ? undefined : v[k];
      return { ...(next as unknown as ResUser), emp: d.emp, groups: d.groups, company_ids: d.company_ids, company_id: d.company_id, logins: d.logins };
    });
  }
  protected patchEmp(v: Rec): void {
    this.saved.set(false);
    this.draft.update(d => (d && d.emp ? { ...d, emp: { ...d.emp, ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === null || x === '' ? undefined : x])) } as Employee } : d));
  }
  protected setCompany(cid: number): void {
    this.draft.update(d => (d ? { ...d, company_id: cid, company_ids: d.company_ids.includes(cid) ? d.company_ids : [...d.company_ids, cid] } : d));
  }
  protected toggleCompany(cid: number): void {
    const d = this.draft();
    if (!d || cid === d.company_id) return;
    this.set('company_ids', d.company_ids.includes(cid) ? d.company_ids.filter(x => x !== cid) : [...d.company_ids, cid]);
  }
  protected companyName = (id: number) => nameOf(this.store.lookups().companies, id);

  protected discard(): void {
    const u = this.user();
    if (u) this.load(u);
  }

  protected async save(): Promise<void> {
    const d = this.draft();
    if (!d) return;
    const bad = this.forms().find(f => !f.validate());
    if (bad || !d.name.trim() || !d.login.trim()) return this.error.set(this.i18n.tr('contacts.users.err.nameLogin'));
    try {
      await this.store.saveUser(d);
      this.saved.set(true);
      this.toast.success(this.i18n.tr('common.saved'));
    } catch (e) {
      this.error.set(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric'));
    }
  }

  protected async go(id: number): Promise<void> {
    if (this.dirty() && !(await this.dialogs.confirm({ title: this.i18n.tr('common.unsavedTitle'), message: this.i18n.tr('common.unsavedMessage'), confirmLabel: this.i18n.tr('common.discard'), danger: true }))) return;
    this.draft.set(null);
    void this.router.navigate(['/contacts/users', id]);
  }
}
