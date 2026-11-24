import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@erp/web/ui';
import type { ManifestItem } from '@erp/shared/contracts';
import { filter, map, startWith } from 'rxjs';
import { ManifestService } from '../manifest/manifest.service';

@Component({
  selector: 'erp-sidebar',
  imports: [RouterLink, IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mobileOpen()) {
      <div class="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden" (click)="closeMobile.emit()" aria-hidden="true"></div>
    }
    <aside class="fixed top-0 z-50 flex h-screen w-64 shrink-0 select-none flex-col border-e border-slate-800 bg-slate-900 text-slate-300 transition-transform duration-200 start-0 lg:sticky lg:z-40"
      [class]="mobileOpen() ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:translate-x-0 lg:rtl:translate-x-0'">
      <div class="flex items-center gap-3 border-b border-slate-800/80 p-4">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-xl font-extrabold text-white shadow-lg shadow-emerald-900/40">AY</div>
        <div>
          <div class="text-sm font-extrabold tracking-wide text-white">{{ 'shell.brand' | transloco }}</div>
          <div class="text-[11px] text-slate-400">{{ 'shell.brandSub' | transloco }}</div>
        </div>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto px-2 py-2 text-[13px]" [attr.aria-label]="'shell.mainNavigation' | transloco">
        @for (m of manifest.menu(); track m.id) {
          @if (m.children) {
            <button type="button" (click)="toggle(m.id)" [attr.aria-expanded]="openGroup() === m.id"
              class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 font-bold transition"
              [class]="activeGroup() === m.id ? 'text-emerald-400' : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'">
              <span class="flex items-center gap-3"><erp-icon [name]="m.icon ?? 'layers'" [size]="17" /><span>{{ m.labelKey | transloco }}</span></span>
              <erp-icon name="chevron-down" [size]="14" class="text-slate-400 transition-transform duration-200" [class.rotate-180]="openGroup() === m.id" />
            </button>
            @if (openGroup() === m.id) {
              <div class="ms-3 space-y-0.5 border-s border-slate-800 ps-2">
                @for (c of m.children; track c.id) {
                  @if (c.sectionKey) {
                    <div class="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">{{ c.sectionKey | transloco }}</div>
                  }
                  @if (c.children && !c.path) {
                    <button type="button" (click)="toggleSub(c.id)" [attr.aria-expanded]="isSubOpen(c)"
                      class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 font-bold transition"
                      [class]="containsActive(c) ? 'text-emerald-400' : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'">
                      <span class="flex items-center gap-2.5"><erp-icon [name]="c.icon ?? 'layers'" [size]="16" />{{ c.labelKey | transloco }}</span>
                      <erp-icon name="chevron-down" [size]="13" class="text-slate-400 transition-transform duration-200" [class.rotate-180]="isSubOpen(c)" />
                    </button>
                    @if (isSubOpen(c)) {
                      <div class="ms-3 space-y-0.5 border-s border-slate-800 ps-2">
                        @for (s of c.children; track s.id) {
                          @if (s.sectionKey) { <div class="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{{ s.sectionKey | transloco }}</div> }
                          <a [routerLink]="s.path" (click)="navigated()" [attr.aria-current]="isActive(s) ? 'page' : null"
                            class="flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition" [class]="isActive(s) ? activeCls : idleCls">
                            <span class="flex items-center gap-2.5"><erp-icon [name]="s.icon ?? 'file-text'" [size]="14" />{{ s.labelKey | transloco }}</span>
                          </a>
                        }
                      </div>
                    }
                  } @else if (c.children) {
                    <a [routerLink]="c.path" [queryParams]="{ category: null }" (click)="navigated()"
                      class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 font-semibold transition"
                      [class]="isActive(c) && !activeCategory() ? activeCls : idleCls">
                      <span class="flex items-center gap-3"><erp-icon [name]="c.icon ?? 'file-text'" [size]="17" />{{ c.labelKey | transloco }}</span>
                      @if (count(c); as n) { <span class="rounded-full bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">{{ n }}</span> }
                    </a>
                    @if (isActive(c)) {
                      <div class="space-y-0.5 py-1 ps-6 pe-1">
                        @for (s of c.children; track s.id) {
                          <a [routerLink]="s.path" [queryParams]="s.queryParams" (click)="navigated()"
                            class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-medium transition"
                            [class]="activeCategory() === s.queryParams?.['category'] ? 'bg-emerald-500/20 font-bold text-emerald-300' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'">
                            <span>{{ s.labelKey | transloco }}</span>
                            @if (count(s); as n) { <span class="rounded bg-slate-800 px-1.5 font-mono text-[10px] text-slate-300">{{ n }}</span> }
                          </a>
                        }
                      </div>
                    }
                  } @else {
                    <a [routerLink]="c.path" (click)="navigated()" [attr.aria-current]="isActive(c) ? 'page' : null"
                      class="flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2 font-semibold transition"
                      [class]="isActive(c) ? activeCls : idleCls">
                      <span class="flex items-center gap-2.5"><erp-icon [name]="c.icon ?? 'file-text'" [size]="15" />{{ c.labelKey | transloco }}</span>
                      @if (count(c); as n) { <span class="rounded-full bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">{{ n }}</span> }
                    </a>
                  }
                }
              </div>
            }
          } @else {
            <a [routerLink]="m.path" (click)="navigated()" [attr.aria-current]="isActive(m) ? 'page' : null"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-semibold transition" [class]="isActive(m) ? activeCls : idleCls">
              <erp-icon [name]="m.icon ?? 'file-text'" [size]="17" /><span>{{ m.labelKey | transloco }}</span>
            </a>
          }
        }
      </nav>

      <div class="flex items-center justify-between border-t border-slate-800/80 bg-slate-950/60 p-3 text-[11px] text-slate-400">
        <div><div class="font-semibold text-slate-300">{{ 'shell.brand' | transloco }} ERP</div><div class="text-[10px] text-slate-500">{{ 'shell.edition' | transloco }}</div></div>
        <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-500" [title]="'shell.systemOnline' | transloco"></span>
      </div>
    </aside>`,
})
export class SidebarComponent {
  protected readonly manifest = inject(ManifestService);
  private readonly router = inject(Router);

  readonly mobileOpen = input<boolean>(false);
  readonly closeMobile = output<void>();

  protected readonly activeCls = 'border-s-2 border-emerald-500 bg-emerald-600/20 text-emerald-400';
  protected readonly idleCls = 'text-slate-300 hover:bg-slate-800/80 hover:text-white';

  private readonly url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url), startWith(this.router.url)),
    { initialValue: this.router.url },
  );
  private readonly manualOpen = signal<string | null | undefined>(undefined);

  protected readonly activeCategory = computed(() => new URLSearchParams(this.url().split('?')[1] ?? '').get('category'));
  /** Menu group that holds the current page. */
  protected readonly activeGroup = computed(() => this.manifest.menu().find(m => m.children?.some(c => this.containsActive(c)))?.id ?? null);
  /** Sub-groups the user opened or closed by hand; otherwise the one holding the current page is open. */
  private readonly manualSub = signal<Record<string, boolean>>({});
  protected readonly openGroup = computed(() => (this.manualOpen() === undefined ? this.activeGroup() : this.manualOpen()));

  protected toggle(id: string): void {
    this.manualOpen.set(this.openGroup() === id ? null : id);
  }
  protected navigated(): void {
    this.manualOpen.set(undefined);
    this.closeMobile.emit();
  }
  protected toggleSub(id: string): void {
    const item = this.manifest.menu().flatMap(m => m.children ?? []).find(c => c.id === id);
    this.manualSub.update(m => ({ ...m, [id]: !(m[id] ?? (item ? this.containsActive(item) : false)) }));
  }
  protected isSubOpen(item: ManifestItem): boolean {
    return this.manualSub()[item.id] ?? this.containsActive(item);
  }
  /** The item, or anything inside it, is the current page. */
  protected containsActive(item: ManifestItem): boolean {
    return this.isActive(item) || !!item.children?.some(c => this.containsActive(c));
  }
  protected isActive(item: ManifestItem): boolean {
    const path = this.url().split('?')[0];
    return !!item.path && (path === item.path || path.startsWith(`${item.path}/`));
  }
  protected count(item: ManifestItem): number {
    return item.badge ? (this.manifest.badges()[item.badge] ?? 0) : 0;
  }
}
