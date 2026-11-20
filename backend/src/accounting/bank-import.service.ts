import { createHash } from 'crypto'
import Decimal from 'decimal.js'
import { AppError } from '../common.helper'
import type { RequestEnv } from '../middleware'
import { q } from './crud'
import { createStatement } from './bank.service'

/**
 * Bank statement file import (Odoo `account_bank_statement_import`): CSV and OFX.
 * A line's `unique_import_id` is the bank's own id (OFX FITID, or an `id` column) or a hash of date, amount and label,
 * so importing the same file twice adds nothing. Not covered: CAMT.053 / MT940 (add a parser to `parseStatement`).
 */
export interface ParsedLine { date: string; name: string; amount: string; ref?: string | null; partner?: string | null; id?: string | null; balance?: string | null }
export interface ParsedStatement { lines: ParsedLine[]; endBalance: string | null }

const D = (v: unknown) => new Decimal(v as Decimal.Value)

/** YYYY-MM-DD from 2026-03-01, 01/03/2026 (day first), 01-03-2026, 20260301 or an OFX stamp 20260301120000. */
export function parseDate(raw: string): string {
  const v = raw.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{4})(\d{2})(\d{2})/.exec(v)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  throw new AppError(`Cannot read the date "${raw}". Use YYYY-MM-DD or DD/MM/YYYY.`)
}

/** 1,234.50  (1,234.50)  -1234.5  1.234,50 -> a plain decimal string. */
export function parseAmount(raw: string): string {
  let v = raw.trim().replace(/[^\d.,()\-+]/g, '')
  if (!v) throw new AppError(`Cannot read the amount "${raw}".`)
  const neg = /^\(.*\)$/.test(v) || v.startsWith('-')
  v = v.replace(/[()+-]/g, '')
  if (/,\d{1,2}$/.test(v) && !/\.\d{1,2}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.')   // European decimal comma
  else v = v.replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(v)) throw new AppError(`Cannot read the amount "${raw}".`)
  return (neg ? '-' : '') + new Decimal(v).toString()
}

function splitCsv(text: string, delim: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') quoted = false; else cell += c }
    else if (c === '"') quoted = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = [] }
    else cell += c
  }
  row.push(cell); if (row.some(x => x.trim() !== '')) rows.push(row)
  return rows
}

const HEAD = {
  date: ['date', 'transaction date', 'posting date', 'value date', 'booking date'],
  label: ['label', 'description', 'memo', 'details', 'narrative', 'payment ref', 'particulars'],
  amount: ['amount', 'amount (sar)', 'transaction amount'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'paid out', 'money out'],
  credit: ['credit', 'deposit', 'deposits', 'paid in', 'money in'],
  ref: ['ref', 'reference', 'cheque no', 'check number'],
  partner: ['partner', 'payee', 'counterparty', 'name'],
  balance: ['balance', 'running balance'],
  id: ['id', 'transaction id', 'fitid', 'unique id'],
}

export function parseCsv(text: string): ParsedStatement {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const delim = [';', '\t', ','].map(d => ({ d, n: first.split(d).length })).sort((a, b) => b.n - a.n)[0].d
  const rows = splitCsv(text.replace(/^﻿/, ''), delim)
  if (rows.length < 2) throw new AppError('The file has no transactions.')
  const head = rows[0].map(h => h.trim().toLowerCase())
  const col = (k: keyof typeof HEAD) => head.findIndex(h => HEAD[k].includes(h))
  const ci = { date: col('date'), label: col('label'), amount: col('amount'), debit: col('debit'), credit: col('credit'), ref: col('ref'), partner: col('partner'), balance: col('balance'), id: col('id') }
  if (ci.date < 0) throw new AppError('The file needs a "date" column.')
  if (ci.amount < 0 && ci.debit < 0 && ci.credit < 0) throw new AppError('The file needs an "amount" column (or "debit" and "credit").')
  const lines: ParsedLine[] = []
  rows.slice(1).forEach((r, i) => {
    const at = (k: number) => (k >= 0 ? (r[k] ?? '').trim() : '')
    try {
      let amount: string
      if (ci.amount >= 0 && at(ci.amount) !== '') amount = parseAmount(at(ci.amount))
      else {
        const dr = at(ci.debit) ? D(parseAmount(at(ci.debit))).abs() : D(0), cr = at(ci.credit) ? D(parseAmount(at(ci.credit))).abs() : D(0)
        amount = cr.minus(dr).toString()
      }
      if (D(amount).isZero()) return
      lines.push({ date: parseDate(at(ci.date)), name: at(ci.label) || at(ci.ref) || 'Bank transaction', amount, ref: at(ci.ref) || null, partner: at(ci.partner) || null, id: at(ci.id) || null, balance: at(ci.balance) ? parseAmount(at(ci.balance)) : null })
    } catch (e) { throw new AppError(`Row ${i + 2}: ${(e as Error).message}`) }
  })
  const withBalance = [...lines].reverse().find(l => l.balance)
  return { lines, endBalance: withBalance?.balance ?? null }
}

export function parseOfx(text: string): ParsedStatement {
  const tag = (block: string, name: string) => new RegExp(`<${name}>([^<\\r\\n]*)`, 'i').exec(block)?.[1]?.trim() ?? ''
  const blocks = text.split(/<STMTTRN>/i).slice(1).map(b => b.split(/<\/STMTTRN>/i)[0])
  if (!blocks.length) throw new AppError('No transactions found in the OFX file.')
  const lines: ParsedLine[] = blocks.map(b => ({
    date: parseDate(tag(b, 'DTPOSTED')), amount: parseAmount(tag(b, 'TRNAMT')), name: tag(b, 'MEMO') || tag(b, 'NAME') || 'Bank transaction',
    ref: tag(b, 'CHECKNUM') || null, partner: tag(b, 'NAME') || null, id: tag(b, 'FITID') || null,
  })).filter(l => !D(l.amount).isZero())
  const bal = /<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]*)/i.exec(text)?.[1]
  return { lines, endBalance: bal ? parseAmount(bal) : null }
}

export function parseStatement(content: string, format: string, filename = ''): ParsedStatement {
  const f = format === 'auto' ? (/<OFX>|OFXHEADER/i.test(content) || /\.(ofx|qfx)$/i.test(filename) ? 'ofx' : 'csv') : format
  if (f === 'ofx') return parseOfx(content)
  if (f === 'csv') return parseCsv(content)
  throw new AppError(`Unsupported format "${format}". Use csv or ofx.`)
}

export async function importStatement(i: { journal_id?: number; filename?: string; content?: string; format?: string; name?: string }, env: RequestEnv) {
  if (!i.journal_id) throw new AppError('journal_id: is required')
  if (!i.content?.trim()) throw new AppError('The file is empty.')
  const parsed = parseStatement(i.content, i.format ?? 'auto', i.filename)
  if (!parsed.lines.length) throw new AppError('The file has no transactions.')

  // the bank's id, or a hash of what the line says; identical rows inside one file get a counter so none is lost
  const seen = new Map<string, number>()
  const keyed = parsed.lines.map(l => {
    const base = l.id ? `id:${l.id}` : 'h:' + createHash('sha1').update(`${l.date}|${l.amount}|${l.name}`).digest('hex').slice(0, 20)
    const n = (seen.get(base) ?? 0) + 1; seen.set(base, n)
    return { ...l, key: n === 1 ? base : `${base}#${n}` }
  })
  const existing = new Set((await q<{ k: string }>('SELECT unique_import_id k FROM account_bank_statement_line WHERE journal_id = :j AND unique_import_id IN (:keys)', { j: i.journal_id, keys: keyed.map(k => k.key) })).map(r => r.k))
  const fresh = keyed.filter(k => !existing.has(k.key))
  if (!fresh.length) throw new AppError(`Nothing new to import: all ${keyed.length} transactions were already imported.`)

  const total = fresh.reduce((s, l) => s.plus(l.amount), D(0))
  let start: Decimal
  if (parsed.endBalance !== null) start = D(parsed.endBalance).minus(total)
  else {
    const [prev] = await q<{ b: string }>('SELECT balance_end_real b FROM account_bank_statement WHERE journal_id = :j ORDER BY date DESC, id DESC LIMIT 1', { j: i.journal_id })
    start = D(prev?.b ?? 0)
  }
  const end = start.plus(total)
  const date = fresh.map(l => l.date).sort().pop()!

  // match a partner by exact name when the file has one
  const lines = []
  for (const l of fresh) {
    let partner: number | null = null
    if (l.partner) partner = (await q<{ id: number }>('SELECT id FROM res_partner WHERE lower(name) = lower(:n) AND active ORDER BY id LIMIT 1', { n: l.partner }))[0]?.id ?? null
    lines.push({ date: l.date, name: l.name, amount: l.amount, ref: l.ref ?? null, partner_id: partner, unique_import_id: l.key })
  }
  const id = await createStatement({
    journal_id: i.journal_id, name: i.name ?? (i.filename ? i.filename.replace(/\.[^.]+$/, '') : undefined), date,
    balance_start: start.toString(), balance_end_real: end.toString(), lines,
  }, env)
  return { statement_id: id, imported: fresh.length, skipped: keyed.length - fresh.length }
}
