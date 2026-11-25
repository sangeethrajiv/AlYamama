import { Router, type Request, type Response } from 'express'
import { AppError, handle, ok } from '../../common.helper'
import * as svc from './company.service'

/** /v2/res-companies: the Company screens (read only). Mounted behind isAuthenticated. */
export const companyRouter = Router()
companyRouter.param('id', (_req, _res, next, val) => next(/^\d+$/.test(String(val)) ? undefined : new AppError('Company not found', 404, 'not_found')))

companyRouter.get('/', handle(async (req: Request, res: Response) => {
  const rows = await svc.listCompanies(await svc.visibleCompanyIds(req.env))
  return ok(res, { records: rows, total: rows.length, page: 1, limit: rows.length })
}))
companyRouter.post('/', handle(async (req: Request, res: Response) => ok(res, await svc.createCompany(req.body ?? {}, req.env), 'Company created', 201)))
companyRouter.put('/:id', handle(async (req: Request, res: Response) => ok(res, await svc.updateCompany(Number(req.params.id), req.body ?? {}, req.env, await svc.visibleCompanyIds(req.env)))))
companyRouter.patch('/:id', handle(async (req: Request, res: Response) => ok(res, await svc.updateCompany(Number(req.params.id), req.body ?? {}, req.env, await svc.visibleCompanyIds(req.env)))))
companyRouter.get('/:id', handle(async (req: Request, res: Response) => ok(res, await svc.getCompany(Number(req.params.id), await svc.visibleCompanyIds(req.env)))))
