import { Router, type Request, type Response } from 'express'
import { AppError, handle, ok } from '../../common.helper'
import * as svc from './user.service'

/** /v2/res-users: the Users screens (list, form, create, password). Mounted behind isAuthenticated. */
export const userRouter = Router()
userRouter.param('id', (_req, _res, next, val) => next(/^\d+$/.test(String(val)) ? undefined : new AppError('User not found', 404, 'not_found')))

userRouter.get('/', handle(async (req: Request, res: Response) => {
  const a = req.query.active
  const rows = await svc.listUsers(a === 'true' ? true : a === 'false' ? false : 'all')
  return ok(res, { records: rows, total: rows.length, page: 1, limit: rows.length })
}))
userRouter.get('/:id', handle(async (req: Request, res: Response) => ok(res, await svc.getUser(Number(req.params.id)))))
userRouter.post('/', handle(async (req: Request, res: Response) => ok(res, await svc.createUser(req.body ?? {}, req.env), 'User created', 201)))
userRouter.put('/:id', handle(async (req: Request, res: Response) => ok(res, await svc.updateUser(Number(req.params.id), req.body ?? {}, req.env))))
userRouter.patch('/:id', handle(async (req: Request, res: Response) => ok(res, await svc.updateUser(Number(req.params.id), req.body ?? {}, req.env))))
userRouter.post('/:id/password', handle(async (req: Request, res: Response) => {
  await svc.setPassword(Number(req.params.id), req.body?.password, req.env)
  return ok(res, { id: Number(req.params.id) }, 'Password changed')
}))

/** POST /v2/auth/login: public, it is how a session starts. */
export const authRouter = Router()
authRouter.post('/login', handle(async (req: Request, res: Response) => ok(res, await svc.login(req.body?.login, req.body?.password))))
