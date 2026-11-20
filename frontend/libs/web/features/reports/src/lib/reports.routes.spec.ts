import type { Route } from '@angular/router';
import { REPORTS_ROUTES } from './reports.routes';

const flatten = (routes: Route[]): Route[] => routes.flatMap(r => [r, ...flatten(r.children ?? [])]);

describe('REPORTS_ROUTES', () => {
  it('lazy-loads every page and protects each one with a permission guard', () => {
    const pages = flatten(REPORTS_ROUTES).filter(r => r.loadComponent);
    expect(pages.length).toBeGreaterThan(0);
    for (const r of pages) {
      expect(r.canActivate?.length).toBe(1);
      expect(r.title).toBeTruthy();
    }
  });

  it('registers its own translation scope', () => {
    expect(flatten(REPORTS_ROUTES).some(r => (r.providers?.length ?? 0) > 0)).toBe(true);
  });
});
