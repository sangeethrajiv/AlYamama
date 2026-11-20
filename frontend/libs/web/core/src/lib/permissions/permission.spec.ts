import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { PERM, type Permission } from '@erp/shared/contracts';
import { AuthService } from '../auth/auth.service';
import { PermissionService } from './permission.service';
import { permissionGuard } from './permission.guard';

describe('permissions', () => {
  const granted = new Set<Permission>([PERM.invoice.read]);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { permissions: () => granted } }],
    });
  });

  it('has/hasAny reflect the signed-in permissions; an empty requirement is always allowed', () => {
    const s = TestBed.inject(PermissionService);
    expect(s.has(PERM.invoice.read)).toBe(true);
    expect(s.has(PERM.invoice.write)).toBe(false);
    expect(s.hasAny(PERM.invoice.write, PERM.invoice.read)).toBe(true);
    expect(s.has(null)).toBe(true);
  });

  it('the guard lets a permitted user in and redirects others to /forbidden', () => {
    const run = (p: Permission) => TestBed.runInInjectionContext(() => permissionGuard(p)({} as never, {} as never));
    expect(run(PERM.invoice.read)).toBe(true);
    const denied = run(PERM.invoice.write) as UrlTree;
    expect(denied).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(denied)).toBe('/forbidden');
  });
});
