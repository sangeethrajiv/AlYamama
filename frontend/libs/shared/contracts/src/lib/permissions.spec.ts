import { ALL_PERMISSIONS, PERM } from './permissions';

describe('permission strings', () => {
  it('follow <module>.<resource>[.<action>] and are unique', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
    for (const p of ALL_PERMISSIONS) expect(p).toMatch(/^[a-z_]+(\.[a-z0-9_]+){1,2}$/);
  });

  it('exposes the approval levels separately', () => {
    expect(PERM.bill.approveL1).not.toBe(PERM.bill.approveL2);
    expect(ALL_PERMISSIONS).toContain(PERM.settings.lockDate);
  });
});
