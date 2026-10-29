import { Router } from 'express'
import * as admin from '../controllers/admin.controller.js'
import { requireAuth, requireRole } from '../middlewares/auth.js'
import { adminLimiter } from '../middlewares/rate-limit.js'

// Todas las rutas del panel exigen sesión válida y un rol.
//   admin: todo.
//   staff: operación diaria (pedidos, inventario, dashboard); no cambia
//          catálogo, precios ni configuración.
export const adminRouter = Router()

// Respuestas del panel: datos personales y operativos, nunca en caché.
adminRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
adminRouter.use(adminLimiter, requireAuth)

const staff = requireRole('admin', 'staff')
const onlyAdmin = requireRole('admin')

adminRouter.get('/me', staff, admin.getMe)
adminRouter.get('/dashboard', staff, admin.getDashboard)

adminRouter.get('/orders', staff, admin.getOrders)
adminRouter.get('/orders/:id', staff, admin.getOrder)
adminRouter.patch('/orders/:id/status', staff, admin.patchOrderStatus)

adminRouter.get('/inventory', staff, admin.getInventory)
adminRouter.get('/inventory/movements', staff, admin.getMovements)
adminRouter.post('/inventory/movements', staff, admin.postMovement)

adminRouter.get('/products', staff, admin.getAdminProducts)
adminRouter.get('/products/:id', staff, admin.getAdminProduct)
adminRouter.post('/products', onlyAdmin, admin.postProduct)
adminRouter.patch('/products/:id', onlyAdmin, admin.patchProduct)

adminRouter.get('/categories', staff, admin.getAdminCategories)
adminRouter.post('/categories', onlyAdmin, admin.postCategory)
adminRouter.patch('/categories/:id', onlyAdmin, admin.patchCategory)

adminRouter.get('/option-groups', staff, admin.getOptionGroups)
adminRouter.post('/option-groups', onlyAdmin, admin.postOptionGroup)
adminRouter.patch('/option-groups/:id', onlyAdmin, admin.patchOptionGroup)
adminRouter.post('/option-groups/:id/options', onlyAdmin, admin.postOption)
adminRouter.patch('/options/:id', onlyAdmin, admin.patchOption)

adminRouter.get('/settings', onlyAdmin, admin.getAdminSettings)
adminRouter.patch('/settings', onlyAdmin, admin.patchSettings)
adminRouter.post('/delivery-zones', onlyAdmin, admin.postDeliveryZone)
adminRouter.patch('/delivery-zones/:id', onlyAdmin, admin.patchDeliveryZone)
