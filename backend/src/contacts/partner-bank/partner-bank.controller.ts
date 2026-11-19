import type { Request, Response } from 'express'
import { notFound, ok } from '../../common.helper'
import { partnerBankSchema } from '../../requestValidator'
import { PartnerBank, sanitizeAccountNumber, accountType } from './partner-bank.model'
import { Bank } from '../bank/bank.model'

/**
 * res.partner.bank CRUD. `sanitized_acc_number` is computed on write, as Odoo
 * does, because it is half of the unique key (sanitized_acc_number, company_id).
 */

const row = (b: PartnerBank) => ({
  ...(b.toJSON() as unknown as Record<string, unknown>),
  acc_type: accountType(b.sanitized_acc_number),
})

export async function list(req: Request, res: Response) {
  const partnerId = Number(req.query.partner_id)
  const rows = await PartnerBank.findAll({
    where: Number.isInteger(partnerId) ? { partner_id: partnerId } : {},
    include: [{ model: Bank, as: 'bank', attributes: ['id', 'name', 'bic'], required: false }],
    order: [['sequence', 'ASC'], ['id', 'ASC']],
    limit: 500,
  })
  return ok(res, { records: rows.map(row), total: rows.length })
}

export async function create(req: Request, res: Response) {
  const v = partnerBankSchema.parse(req.body)
  const b = await PartnerBank.create({
    ...v,
    sanitized_acc_number: sanitizeAccountNumber(v.acc_number),
    create_uid: req.env.uid,
    write_uid: req.env.uid,
  } as never)
  return ok(res, row(b), 'Bank account added', 201)
}

export async function update(req: Request, res: Response) {
  const v = partnerBankSchema.partial().parse(req.body)
  const b = await PartnerBank.findByPk(Number(req.params.id))
  if (!b) throw notFound('Bank account')
  const patch: Record<string, unknown> = { ...v, write_uid: req.env.uid }
  if (v.acc_number !== undefined) patch.sanitized_acc_number = sanitizeAccountNumber(v.acc_number)
  await b.update(patch as never)
  return ok(res, row(b), 'Bank account updated')
}

export async function remove(req: Request, res: Response) {
  const b = await PartnerBank.findByPk(Number(req.params.id))
  if (!b) throw notFound('Bank account')
  await b.destroy()
  return ok(res, { id: Number(req.params.id) }, 'Bank account deleted')
}
