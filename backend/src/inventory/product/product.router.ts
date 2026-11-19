import { Router } from 'express'
import { AppError, handle } from '../../common.helper'
import * as c from './product.controller'

const router = Router()

router.param('id', (_req, _res, next, val) =>
  next(/^\d+$/.test(String(val)) ? undefined : new AppError('Product not found', 404, 'not_found')),
)

router.get('/search-view', handle(c.searchView))
router.get('/read-group', handle(c.group))
router.get('/name-search', handle(c.nameSearch))
router.get('/', handle(c.list))
router.post('/', handle(c.create))

router.get('/:id', handle(c.detail))
router.put('/:id', handle(c.update))
router.patch('/:id', handle(c.update))
router.post('/:id/archive', handle(c.archive))
router.post('/:id/unarchive', handle(c.unarchive))
router.delete('/:id', handle(c.remove))

export default router
