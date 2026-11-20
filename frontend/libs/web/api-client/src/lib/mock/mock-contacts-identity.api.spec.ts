import { TestBed } from '@angular/core/testing';
import { MockContactsApi } from './mock-contacts.api';
import { MockIdentityApi } from './mock-identity.api';

describe('MockContactsApi', () => {
  it('lists the directory and archives a contact without deleting it', async () => {
    TestBed.configureTestingModule({ providers: [MockContactsApi] });
    const api = TestBed.inject(MockContactsApi);
    const [first] = await api.directory();
    await api.archiveContact(first.id, false);
    const after = (await api.directory()).find(c => c.id === first.id);
    expect(after).toBeDefined();
    expect(after?.active).toBe(false);
  });
});

describe('MockIdentityApi', () => {
  let api: MockIdentityApi;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MockIdentityApi] });
    api = TestBed.inject(MockIdentityApi);
  });

  it('rejects bad credentials with a 401 problem', async () => {
    const err = await api.login('auditor@alyamama.example', 'wrong').catch(e => e);
    expect(err.problem.status).toBe(401);
  });

  it('gives the auditor read-only permissions and the director everything', async () => {
    const auditor = await api.permissionsFor('Auditor');
    expect(auditor.length).toBeGreaterThan(0);
    expect(auditor.every(p => p.endsWith('.read'))).toBe(true);
    const director = await api.permissionsFor('Finance Director');
    expect(director).toContain('accounting.bill.approve_level2');
    expect(director.length).toBeGreaterThan(auditor.length);
  });
});
