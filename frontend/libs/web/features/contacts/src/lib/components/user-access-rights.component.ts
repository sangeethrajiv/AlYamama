import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent, PillComponent, SearchBoxComponent } from '@erp/web/ui';
import type { SecurityGroup } from '@erp/shared/contracts';

interface Area { id: string; labelKey: string; hintKey: string; icon: string; cats: string[] }

/** Groups are split into business areas, then into the application each group belongs to. */
const AREAS: Area[] = [
  { id: 'core', labelKey: 'contacts.rights.area.core', hintKey: 'contacts.rights.hint.core', icon: 'settings-2', cats: ['User types', 'Administration', 'Extra Rights', 'Other', 'Technical Settings'] },
  { id: 'sales', labelKey: 'contacts.rights.area.sales', hintKey: 'contacts.rights.hint.sales', icon: 'shopping-cart', cats: ['Sales', 'Sales Quotation Management', 'Installation Request', 'Job Estimation', 'After-Sales', 'Subscription User', 'Direct Delivery', 'Consumable Delivery Orders', 'Asset Rental'] },
  { id: 'supply', labelKey: 'contacts.rights.area.supply', hintKey: 'contacts.rights.hint.supply', icon: 'boxes', cats: ['Purchases', 'Purchase Request', 'Purchase Orders', 'Inventory', 'Manufacturing'] },
  { id: 'finance', labelKey: 'contacts.rights.area.finance', hintKey: 'contacts.rights.hint.finance', icon: 'landmark', cats: ['Accounting & Finance', 'Internal Voucher', 'Payable Voucher'] },
  { id: 'hr', labelKey: 'contacts.rights.area.hr', hintKey: 'contacts.rights.hint.hr', icon: 'users', cats: ['Employees', 'Attendance', 'Leaves', 'HR Custom', 'Overtime', 'Contracts', 'ZK Machine'] },
  { id: 'tools', labelKey: 'contacts.rights.area.tools', hintKey: 'contacts.rights.hint.tools', icon: 'folder-cog', cats: ['Document', 'Website', 'Auto backup access', 'API Configuration Access', 'ATT Menu Access', 'Direct User Creation', 'GCC User Manager', 'User Notify List'] },
];
const AREA_OF = new Map(AREAS.flatMap(a => a.cats.map(c => [c, a.id] as const)));
const catOf = (g: SecurityGroup) => g.category ?? 'Other';
const areaOf = (g: SecurityGroup) => AREA_OF.get(catOf(g)) ?? 'core';

/** Access Rights tab of a user: grant or revoke security groups. */
@Component({
  selector: 'erp-user-access-rights',
  imports: [TranslocoPipe, IconComponent, PillComponent, SearchBoxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div class="flex items-center gap-2">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><erp-icon name="shield-check" [size]="18" /></span>
          <div>
            <div class="text-sm font-extrabold tabular-nums text-slate-900">{{ selected().length }} <span class="font-bold text-slate-400">{{ 'contacts.rights.ofGranted' | transloco: { total: groups().length } }}</span></div>
            <div class="mt-0.5 flex gap-1.5">
              @for (t of userTypes(); track t) { <erp-pill tone="blue">{{ t }}</erp-pill> } @empty { <erp-pill tone="amber">{{ 'contacts.rights.noUserType' | transloco }}</erp-pill> }
            </div>
          </div>
        </div>
        <div class="ms-auto flex flex-wrap items-center gap-2">
          <div class="flex rounded-lg bg-slate-100 p-1 text-xs font-bold" role="group">
            <button type="button" (click)="onlyOn.set(false)" [attr.aria-pressed]="!onlyOn()" class="rounded-md px-3 py-1.5" [class]="!onlyOn() ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'">{{ 'contacts.rights.all' | transloco }}</button>
            <button type="button" (click)="onlyOn.set(true)" [attr.aria-pressed]="onlyOn()" class="rounded-md px-3 py-1.5" [class]="onlyOn() ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'">{{ 'contacts.rights.grantedOnly' | transloco }}</button>
          </div>
          <erp-search-box [(value)]="q" [placeholder]="'contacts.rights.search' | transloco" />
        </div>
      </div>

      <div class="grid items-start gap-4 lg:grid-cols-[260px_1fr]">
        <nav class="space-y-1 rounded-xl border border-slate-200 bg-white p-2 lg:sticky lg:top-2" [attr.aria-label]="'contacts.rights.areas' | transloco">
          @for (a of areas; track a.id) {
            @let s = stats().get(a.id)!;
            <button type="button" (click)="q.set(''); area.set(a.id)" class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition" [class]="!term() && area() === a.id ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-slate-50'">
              <erp-icon [name]="a.icon" [size]="16" [class]="!term() && area() === a.id ? 'text-emerald-700' : 'text-slate-400'" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-xs font-bold" [class]="!term() && area() === a.id ? 'text-emerald-800' : 'text-slate-800'">{{ a.labelKey | transloco }}</span>
                <span class="mt-1 block h-1 overflow-hidden rounded-full bg-slate-100"><span class="block h-full bg-emerald-500" [style.width.%]="s.total ? (s.on / s.total) * 100 : 0"></span></span>
              </span>
              <span class="rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums" [class]="s.on ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'">{{ s.on }}/{{ s.total }}</span>
            </button>
          }
        </nav>
        <div class="min-w-0 space-y-3">
          <div>
            <h3 class="text-sm font-extrabold text-slate-900">{{ term() ? ('contacts.rights.resultsFor' | transloco: { q: q() }) : (current().labelKey | transloco) }}</h3>
            <p class="text-[11px] text-slate-500">{{ term() ? ('contacts.rights.matching' | transloco: { n: visible().length }) : (current().hintKey | transloco) }}</p>
          </div>
          @if (cards().length === 0) { <div class="rounded-xl border border-slate-200 bg-white py-10 text-center text-xs text-slate-400">{{ (onlyOn() ? 'contacts.rights.noneGranted' : 'contacts.rights.noMatch') | transloco }}</div> }
          <div class="grid gap-3 xl:grid-cols-2">
            @for (c of cards(); track c.cat) {
              <section class="overflow-hidden rounded-xl border bg-white" [class]="(c.cat === 'Technical Settings' ? 'xl:col-span-2 ' : '') + (c.on ? 'border-emerald-200' : 'border-slate-200')" [attr.aria-label]="c.cat">
                <header class="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <h4 class="flex-1 truncate text-xs font-extrabold text-slate-800">{{ c.cat }}</h4>
                  <span class="text-[10px] font-bold tabular-nums text-slate-500">{{ c.on }}/{{ c.all.length }}</span>
                  <button type="button" (click)="setMany(c.all, true)" [disabled]="c.on === c.all.length" class="rounded p-1 text-slate-500 hover:bg-white hover:text-emerald-700 disabled:opacity-30" [attr.aria-label]="'contacts.rights.grantAll' | transloco"><erp-icon name="check-check" [size]="14" /></button>
                  <button type="button" (click)="setMany(c.all, false)" [disabled]="c.on === 0" class="rounded p-1 text-slate-500 hover:bg-white hover:text-rose-700 disabled:opacity-30" [attr.aria-label]="'contacts.rights.clearAll' | transloco"><erp-icon name="eraser" [size]="14" /></button>
                </header>
                <ul class="p-1.5" [class]="c.cat === 'Technical Settings' ? 'grid gap-x-2 sm:grid-cols-2' : ''">
                  @for (g of c.groups; track g.id) {
                    <li>
                      <label class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs" [class]="on().has(g.id) ? 'bg-emerald-50/60 font-bold text-slate-900' : 'text-slate-600 hover:bg-slate-50'">
                        <input type="checkbox" class="accent-emerald-600" [checked]="on().has(g.id)" [disabled]="readonly()" (change)="toggle(g.id)" /><span class="flex-1">{{ g.name }}</span>
                      </label>
                    </li>
                  }
                </ul>
              </section>
            }
          </div>
        </div>
      </div>
    </div>`,
})
export class UserAccessRightsComponent {
  readonly groups = input.required<SecurityGroup[]>();
  readonly selected = input.required<number[]>();
  readonly readonly = input<boolean>(false);
  readonly changed = output<number[]>();

  protected readonly areas = AREAS;
  protected readonly area = signal('core');
  protected readonly q = signal('');
  protected readonly onlyOn = signal(false);
  protected readonly term = computed(() => this.q().trim().toLowerCase());
  protected readonly on = computed(() => new Set(this.selected()));
  protected readonly current = computed(() => AREAS.find(a => a.id === this.area()) ?? AREAS[0]);
  protected readonly userTypes = computed(() => this.groups().filter(g => g.category === 'User types' && this.on().has(g.id)).map(g => g.name));

  protected readonly stats = computed(() => {
    const m = new Map<string, { on: number; total: number }>(AREAS.map(a => [a.id, { on: 0, total: 0 }]));
    for (const g of this.groups()) {
      const s = m.get(areaOf(g)) as { on: number; total: number };
      s.total++;
      if (this.on().has(g.id)) s.on++;
    }
    return m;
  });

  protected readonly visible = computed(() =>
    this.groups().filter(g => (this.term() ? g.name.toLowerCase().includes(this.term()) || catOf(g).toLowerCase().includes(this.term()) : areaOf(g) === this.area()) && (!this.onlyOn() || this.on().has(g.id))),
  );
  protected readonly cards = computed(() => {
    const m = new Map<string, SecurityGroup[]>();
    for (const g of this.visible()) m.set(catOf(g), [...(m.get(catOf(g)) ?? []), g]);
    const order = AREAS.flatMap(a => a.cats);
    return [...m.entries()]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([cat, groups]) => {
        const all = this.groups().filter(g => catOf(g) === cat);
        return { cat, groups, all, on: all.filter(g => this.on().has(g.id)).length };
      });
  });

  protected toggle(id: number): void {
    const next = this.on().has(id) ? this.selected().filter(x => x !== id) : [...this.selected(), id].sort((a, b) => a - b);
    this.changed.emit(next);
  }
  protected setMany(groups: SecurityGroup[], value: boolean): void {
    if (this.readonly()) return;
    const s = new Set(this.selected());
    groups.forEach(g => (value ? s.add(g.id) : s.delete(g.id)));
    this.changed.emit([...s].sort((a, b) => a - b));
  }
}
