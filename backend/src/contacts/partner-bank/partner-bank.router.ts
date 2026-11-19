import { Router } from 'express'
import { AppError, handle } from '../../common.helper'
import * as c from './partner-bank.controller'

const router = Router()
router.param('id', (_req, _res, next, val) =>
  next(/^\d+$/.test(String(val)) ? undefined : new AppError('Bank account not found', 404, 'not_found')),
)

router.get('/', handle(c.list))
router.post('/', handle(c.create))
router.put('/:id', handle(c.update))
router.delete('/:id', handle(c.remove))
export default router
