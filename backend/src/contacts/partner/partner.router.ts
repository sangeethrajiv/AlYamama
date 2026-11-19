import { Router } from 'express'
import { AppError, handle } from '../../common.helper'
import * as c from './partner.controller'

const router = Router()

// Express 5 has no inline regex in paths, so :id is guarded here instead.
router.param('id', (_req, _res, next, val) =>
  next(/^\d+$/.test(String(val)) ? undefined : new AppError('Contact not found', 404, 'not_found')),
)

// Static paths come before /:id so they are not read as an id.
router.get('/search-view', handle(c.searchView))
router.get('/read-group', handle(c.group))
router.get('/name-search', handle(c.nameSearch))
router.get('/', handle(c.list))
router.post('/', handle(c.create))

router.get('/:id', handle(c.detail))
router.get('/:id/stats', handle(c.stats))
router.put('/:id', handle(c.update))
router.patch('/:id', handle(c.update))
router.post('/:id/archive', handle(c.archive))
router.post('/:id/unarchive', handle(c.unarchive))
router.delete('/:id', handle(c.remove))

export default router
