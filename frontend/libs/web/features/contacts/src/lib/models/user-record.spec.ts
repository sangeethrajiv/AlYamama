import type { ResUser } from '@erp/shared/contracts';
import { tidyUserForm, userFormSeed, type UserRecord } from './user-record';
import { userColumns } from './user-columns';

const mk = (o: Partial<UserRecord> = {}): UserRecord => ({
  id: 7, active: true, login: 'a@b.test', company_id: 1, partner_id: 9, create_date: '', write_date: '', notification_type: 'email', odoobot_state: 'not_initialized',
  sidebar_type: 'large', chatter_position: 'sided', name: 'A', lang: 'en_US', company_ids: [1], groups: [], ...o,
});

describe('userFormSeed', () => {
  it('uses user_department_ids and falls back to the old single department_id', () => {
    expect(userFormSeed(mk({ user_department_ids: [3, 4] }))['user_department_ids']).toEqual([3, 4]);
    expect(userFormSeed(mk({ department_id: 5 }))['user_department_ids']).toEqual([5]);
    expect(userFormSeed(mk())['user_department_ids']).toEqual([]);
  });

  it('keeps the html signature and leaves user_signature empty', () => {
    const s = userFormSeed(mk({ signature: '<p>-- Admin</p>' }));
    expect(s['signature']).toBe('<p>-- Admin</p>');
    expect(s['user_signature']).toBeUndefined();
  });

  it('moves an image an earlier form saved into signature over to user_signature', () => {
    const s = userFormSeed(mk({ signature: 'data:image/png;base64,AAAA' }));
    expect(s['user_signature']).toBe('data:image/png;base64,AAAA');
    expect(s['signature']).toBeUndefined();
  });

  it('prefers a stored user_signature', () => {
    expect(userFormSeed(mk({ user_signature: 'data:image/png;base64,BBBB', signature: '<p>x</p>' }))['user_signature']).toBe('data:image/png;base64,BBBB');
  });
});

describe('tidyUserForm', () => {
  it('drops an empty department list and the old department_id', () => {
    const r = tidyUserForm({ user_department_ids: [], department_id: 4 });
    expect(r['user_department_ids']).toBeUndefined();
    expect(r['department_id']).toBeUndefined();
  });
  it('keeps a chosen department list', () => {
    expect(tidyUserForm({ user_department_ids: [2, 3] })['user_department_ids']).toEqual([2, 3]);
  });
});

describe('userColumns created/updated by', () => {
  const lookups = { employees: [{ id: 1, name: 'Some Employee' }], companies: [], titles: [], states: [], countries: [] } as never;
  const users: ResUser[] = [mk({ id: 1, name: 'EpicBot' }), mk({ id: 2, name: 'Administrator' })];
  const text = (key: string, row: ResUser) => (userColumns(lookups, users).find(c => c.key === key)?.text as (u: ResUser) => unknown)(row);

  it('resolves create_uid and write_uid against res.users, not employees', () => {
    const row = mk({ create_uid: 1, write_uid: 2 });
    expect(text('create_uid', row)).toBe('EpicBot');
    expect(text('write_uid', row)).toBe('Administrator');
  });
});

describe('many2many columns list every assigned record', () => {
  const companies = [1, 5, 6, 7, 9].map(id => ({ id, name: `Company ${id}`, parent_id: null }));
  const lookups = { employees: [], companies, titles: [], states: [], countries: [], departments: [{ id: 4, name: 'Hydraulic' }, { id: 7, name: 'Sales' }] } as never;
  const text = (key: string, row: ResUser) => (userColumns(lookups, []).find(c => c.key === key)?.text as (u: ResUser) => unknown)(row);

  it('shows all five allowed companies, not just the current one', () => {
    const row = mk({ company_id: 5, company_ids: [1, 5, 6, 7, 9] });
    expect(text('company_ids', row)).toBe('Company 1, Company 5, Company 6, Company 7, Company 9');
  });

  it('shows every department and keeps an id that has no lookup entry instead of dropping it', () => {
    expect(text('user_department_ids', mk({ user_department_ids: [4, 7, 99] }))).toBe('Hydraulic, Sales, #99');
    expect(text('user_department_ids', mk())).toBe('');
  });
});

describe('editing keeps existing many2many assignments', () => {
  it('round-trips a department list through the form unchanged', () => {
    const seed = userFormSeed(mk({ user_department_ids: [3, 4, 8, 11, 12] }));
    expect(tidyUserForm({ ...seed })['user_department_ids']).toEqual([3, 4, 8, 11, 12]);
  });
});
