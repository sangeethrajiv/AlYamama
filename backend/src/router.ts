import { Router } from 'express'
import { handle } from './common.helper'
import { isAuthenticated } from './middleware'
import PartnerRouter from './contacts/partner/partner.router'
import PartnerBankRouter from './contacts/partner-bank/partner-bank.router'
import * as lookups from './contacts/lookups.controller'
import ProductRouter from './inventory/product/product.router'
import ProductCategoryRouter from './inventory/category/product-category.controller'
import { uomCategoryRouter, uomRouter } from './inventory/uom/uom.controller'
import { locationRouter, operationTypeRouter, warehouseRouter } from './inventory/warehouse/warehouse.controller'

/**
 * The /v2 aggregator. Protection is mounted here, not inside each feature
 * router (docs/api-service-architecture-handover.md section 5).
 */
const router = Router()

router.use('/contacts', isAuthenticated, PartnerRouter)
router.use('/partner-banks', isAuthenticated, PartnerBankRouter)

// Inventory basics: products, categories, units of measure, warehouses, locations, operation types.
router.use('/products', isAuthenticated, ProductRouter)
router.use('/product-categories', isAuthenticated, ProductCategoryRouter)
router.use('/uom-categories', isAuthenticated, uomCategoryRouter)
router.use('/uoms', isAuthenticated, uomRouter)
router.use('/warehouses', isAuthenticated, warehouseRouter)
router.use('/locations', isAuthenticated, locationRouter)
router.use('/operation-types', isAuthenticated, operationTypeRouter)

// Lookups behind the Contacts form dropdowns.
router.get('/partner-titles', isAuthenticated, handle(lookups.titles))
router.post('/partner-titles', isAuthenticated, handle(lookups.createLookup('titles')))
router.put('/partner-titles/:id', isAuthenticated, handle(lookups.updateLookup('titles')))

router.get('/partner-industries', isAuthenticated, handle(lookups.industries))
router.post('/partner-industries', isAuthenticated, handle(lookups.createLookup('industries')))
router.put('/partner-industries/:id', isAuthenticated, handle(lookups.updateLookup('industries')))

router.get('/partner-categories', isAuthenticated, handle(lookups.categories))
router.post('/partner-categories', isAuthenticated, handle(lookups.createLookup('categories')))
router.put('/partner-categories/:id', isAuthenticated, handle(lookups.updateLookup('categories')))

router.get('/banks', isAuthenticated, handle(lookups.banks))
router.get('/countries', isAuthenticated, handle(lookups.countries))
router.get('/countries/:id/states', isAuthenticated, handle(lookups.states))
router.get('/currencies', isAuthenticated, handle(lookups.currencies))
router.get('/companies', isAuthenticated, handle(lookups.companies))
router.get('/users', isAuthenticated, handle(lookups.users))

export default router
