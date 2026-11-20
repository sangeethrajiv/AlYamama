import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from '../i18n/language.service';
import { HeaderComponent } from './header.component';
import { SidebarComponent } from './sidebar.component';

/** Application shell (section 12.2): navigation, header, layout and the routed feature outlet. */
@Component({
  selector: 'erp-shell',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen bg-slate-100 text-slate-800" [attr.dir]="lang.dir()">
      <erp-sidebar [mobileOpen]="mobileNav()" (closeMobile)="mobileNav.set(false)" />
      <div class="flex min-w-0 flex-1 flex-col">
        <erp-header (toggleSidebar)="mobileNav.set(true)" />
        <main class="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6"><div class="page-fade"><router-outlet /></div></main>
      </div>
    </div>`,
})
export class ShellComponent {
  protected readonly lang = inject(LanguageService);
  protected readonly mobileNav = signal(false);

  @HostListener('window:keydown.escape')
  protected onEscape(): void {
    this.mobileNav.set(false);
  }
}
