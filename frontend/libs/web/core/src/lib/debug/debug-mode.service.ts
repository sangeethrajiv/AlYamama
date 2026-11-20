import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

const STORAGE_KEY = 'erp.debug';
const OFF = new Set(['0', 'false', 'off']);

/**
 * Developer ("debug") mode, switched like Odoo's: open any page with `?debug=1` (or `?debug`, `?debug=true`) to turn it on
 * and `?debug=0` to turn it off. It is remembered for the browser session, so it survives in-app navigation (the router drops
 * query strings). Debug mode only reveals technical fields in the UI; it never grants access. The API still enforces
 * authorization, and screens combine it with a permission check.
 */
@Injectable({ providedIn: 'root' })
export class DebugModeService {
  private readonly router = inject(Router);
  private readonly on = signal(this.stored());
  readonly active = this.on.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') this.fromQuery(new URLSearchParams(window.location.search).get('debug'));
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) this.fromQuery(this.router.parseUrl(e.urlAfterRedirects).queryParams['debug'] ?? null);
    });
  }

  set(active: boolean): void {
    this.on.set(active);
    try { if (active) sessionStorage.setItem(STORAGE_KEY, '1'); else sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked: stays on for this page load */ }
  }

  /** `null` = no `debug` parameter (leave as is); `''` = bare `?debug`. */
  private fromQuery(v: string | null): void {
    if (v === null) return;
    this.set(!OFF.has(v.toLowerCase()));
  }

  private stored(): boolean {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  }
}
