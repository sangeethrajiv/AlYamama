import type { Route } from '@angular/router';
import { appRoutes } from './app.routes';

describe('app routes', () => {
  const shell = appRoutes.find(r => r.path === '')?.children as Route[];

  it('guards the shell and keeps login outside it', () => {
    expect(appRoutes.find(r => r.path === 'login')?.canActivate?.length).toBe(1);
    expect(appRoutes.find(r => r.path === '')?.canActivate?.length).toBe(1);
  });

  it('exposes one lazy route per feature library', () => {
    const lazy = shell.filter(r => r.loadChildren).map(r => r.path).sort();
    expect(lazy).toEqual(['accounting', 'administration', 'contacts', 'dashboard', 'product', 'reports']);
  });

  it('each feature module resolves to a non-empty route table', async () => {
    for (const r of shell.filter(x => x.loadChildren)) {
      const routes = (await (r.loadChildren as () => Promise<Route[]>)()) as Route[];
      expect(routes.length, r.path).toBeGreaterThan(0);
    }
  });

  it('ends with a catch-all not-found route', () => {
    expect(shell[shell.length - 1].path).toBe('**');
  });
});
