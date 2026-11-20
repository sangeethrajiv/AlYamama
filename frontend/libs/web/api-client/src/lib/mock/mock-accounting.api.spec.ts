import { TestBed } from '@angular/core/testing';
import { gt } from '@erp/shared/utils';
import type { Invoice, JournalEntry, Payment } from '@erp/shared/contracts';
import { ApiError } from '../api/api-error';
import { DataChanges } from '../api/data-changes';
import { MockAccountingApi } from './mock-accounting.api';

describe('MockAccountingApi', () => {
  let api: MockAccountingApi;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MockAccountingApi] });
    api = TestBed.inject(MockAccountingApi);
  });

  const draftOf = async (): Promise<Invoice> => {
    const seed = (await api.invoices()).find(i => i.state === 'open') as Invoice;
    return { ...seed, id: 'inv_test', number: 'INV/TEST/0001', state: 'draft', residual: seed.amountTotal };
  };

  it('returns copies so callers cannot mutate the store', async () => {
    const first = await api.invoices();
    first[0].partner = 'mutated';
    expect((await api.invoices())[0].partner).not.toBe('mutated');
  });

  it('rejects an invoice without a customer with a 400 validation problem', async () => {
    const inv = { ...(await draftOf()), partner: ' ' };
    const err = await api.saveInvoice(inv).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.problem.status).toBe(400);
    expect(err.problem.errors[0].field).toBe('partner');
  });

  it('posting opens the invoice, creates one balanced journal entry and bumps the change revision', async () => {
    const changes = TestBed.inject(DataChanges);
    const before = changes.revision();
    const entriesBefore = (await api.journalEntries()).length;
    const posted = await api.saveInvoice(await draftOf(), { post: true });
    expect(posted.state).toBe('open');
    expect(posted.residual).toBe(posted.amountTotal);
    const entries = await api.journalEntries();
    expect(entries.length).toBe(entriesBefore + 1);
    const je = entries.find(e => e.id === 'je_inv_inv_test') as JournalEntry;
    const dr = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const cr = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(dr).toBeCloseTo(cr, 2);
    expect(changes.revision()).toBeGreaterThan(before);
  });

  it('a partial payment moves the invoice to in_payment, a full one to paid', async () => {
    const posted = await api.saveInvoice(await draftOf(), { post: true });
    const base = (await api.payments())[0] as Payment;
    const pay = (id: string, amount: string): Payment => ({ ...base, id, paymentNumber: id, amount, amountBaseCurrency: amount, partnerType: 'customer', partner: posted.partner, paymentMethod: 'Bank Transfer' });
    await api.savePayment(pay('pay_a', '1.00'), { invoiceId: posted.id });
    let inv = (await api.invoices()).find(i => i.id === posted.id) as Invoice;
    expect(inv.state).toBe('in_payment');
    expect(gt(inv.residual, '0')).toBe(true);
    await api.savePayment(pay('pay_b', posted.amountTotal), { invoiceId: posted.id });
    inv = (await api.invoices()).find(i => i.id === posted.id) as Invoice;
    expect(inv.state).toBe('paid');
    expect(inv.residual).toBe('0.00');
  });

  it('refuses a zero payment amount', async () => {
    const base = (await api.payments())[0] as Payment;
    const err = await api.savePayment({ ...base, amount: '0.00' }).catch(e => e);
    expect(err.problem.code).toBe('VALIDATION_FAILED');
  });

  it('refuses unbalanced and edited-after-posting journal entries', async () => {
    const posted = (await api.journalEntries()).find(e => e.state === 'posted') as JournalEntry;
    const unbalanced = { ...posted, id: '', lines: posted.lines.map((l, i) => (i === 0 ? { ...l, debit: '999.00' } : l)) };
    expect((await api.saveJournalEntry(unbalanced).catch(e => e)).problem.code).toBe('JOURNAL_UNBALANCED');
    expect((await api.saveJournalEntry(posted).catch(e => e)).problem.code).toBe('JOURNAL_POSTED_IMMUTABLE');
  });

  it('reverses a posted entry once, with swapped debit and credit', async () => {
    const orig = (await api.journalEntries()).find(e => e.state === 'posted' && !e.isReversed) as JournalEntry;
    const rev = await api.reverseJournalEntry(orig.id);
    expect(rev.lines[0].debit).toBe(orig.lines[0].credit);
    expect(rev.lines[0].credit).toBe(orig.lines[0].debit);
    expect((await api.reverseJournalEntry(orig.id).catch(e => e)).problem.code).toBe('JOURNAL_ALREADY_REVERSED');
  });

  it('the hard lock date can only move forward', async () => {
    const cur = await api.fiscalConfig('co_1');
    const err = await api.advanceLockDate('co_1', '2000-01-01', cur.fiscalYearLockDate).catch(e => e);
    expect(err.problem.code).toBe('LOCK_DATE_BACKWARDS');
    const next = await api.advanceLockDate('co_1', '2099-12-31', cur.fiscalYearLockDate);
    expect(next.periodLockDate).toBe('2099-12-31');
  });
});
