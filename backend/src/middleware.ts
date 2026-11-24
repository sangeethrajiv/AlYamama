import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { UniqueConstraintError, ForeignKeyConstraintError, DatabaseError } from 'sequelize'
import { AppError, fail, toInt } from './common.helper'

/** Per-request environment, the Node equivalent of Odoo's `env` (uid, current company, allowed companies). */
export interface RequestEnv {
  uid: number | null
  companyId: number | null
  allowedCompanyIds: number[]
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      env: RequestEnv
    }
  }
}

const ids = (v: unknown) =>
  String(v ?? '')
    .split(',')
    .map(s => toInt(s.trim()))
    .filter((n): n is number => n !== undefined)

/**
 * AUTH STUB. Real JWT validation comes later (see docs/api-service-architecture-handover.md section 6).
 * Until then the caller states who it is with headers:
 *   X-User-Id, X-Company-Id (current company), X-Allowed-Company-Ids (comma list).
 * Without X-Allowed-Company-Ids every company is visible (no company filter), like an Odoo superuser.
 */
export function isAuthenticated(req: Request, _res: Response, next: NextFunction) {
  const companyId = toInt(req.header('x-company-id')) ?? null
  let allowed = ids(req.header('x-allowed-company-ids'))
  if (companyId !== null && allowed.length && !allowed.includes(companyId)) allowed = [...allowed, companyId]
  req.env = { uid: toInt(req.header('x-user-id')) ?? null, companyId, allowedCompanyIds: allowed }
  next()
}

/** Maps service, validation and Postgres errors to the standard { success:false, message } response. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) return fail(res, err.status, err.message, err.code)
  const kind = (err as { type?: string } | null)?.type
  if (kind === 'entity.parse.failed') return fail(res, 400, 'The request body is not valid JSON.', 'validation_error')
  if (kind === 'entity.too.large') return fail(res, 413, 'The request body is too large.', 'payload_too_large')
  if (err instanceof ZodError) {
    const msg = err.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
    return fail(res, 400, msg, 'validation_error')
  }
  if (err instanceof UniqueConstraintError || err instanceof ForeignKeyConstraintError || err instanceof DatabaseError) {
    const pg = (err as DatabaseError).parent as { code?: string; constraint?: string } | undefined
    const known = pg?.constraint ? CONSTRAINT_MESSAGES[pg.constraint] : undefined
    if (known) return fail(res, 400, known, 'constraint_error')
    if (pg?.code === '23503') return fail(res, 400, 'The record is referenced by, or refers to, a missing record.', 'constraint_error')
    if (pg?.code === '23505') return fail(res, 400, 'A record with the same unique value already exists.', 'constraint_error')
    if (pg?.code === '23514') return fail(res, 400, 'A check constraint was violated.', 'constraint_error')
  }
  console.error(err)
  return fail(res, 500, 'An unexpected error occurred', 'server_error')
}

/** Odoo 12 messages for the SQL constraints (same text as the Odoo source). */
export const CONSTRAINT_MESSAGES: Record<string, string> = {
  res_partner_check_name: 'Contacts require a name.',
  res_partner_company_name_code: 'Company Code already exists!',
  res_partner_bank_unique_number: 'Account Number must be unique',
  res_country_name_uniq: 'The name of the country must be unique !',
  res_country_code_uniq: 'The code of the country must be unique !',
  res_country_state_name_code_uniq: 'The code of the state must be unique by country !',
  // product / uom / stock
  product_product_barcode_uniq: 'A barcode can only be assigned to one product !',
  uom_category_uom_category_unique_type: 'You can have only one category per measurement type.',
  uom_uom_factor_gt_zero: 'The conversion ratio for a unit of measure cannot be 0!',
  uom_uom_rounding_gt_zero: 'The rounding precision must be strictly positive.',
  uom_uom_factor_reference_is_one: 'The reference unit must have a conversion factor equal to 1.',
  stock_warehouse_warehouse_name_uniq: 'The name of the warehouse must be unique per company!',
  stock_warehouse_warehouse_code_uniq: 'The code of the warehouse must be unique per company!',
  stock_location_barcode_company_uniq: 'The barcode for a location must be unique per company !',
}
