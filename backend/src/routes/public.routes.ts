import { Router } from 'express'
import {
  getCategories,
  getProduct,
  getProducts,
  getPublicSettings,
  postOrder,
  postOrderLookup,
  postQuote,
} from '../controllers/public.controller.js'
import { ordersLimiter, quoteLimiter } from '../middlewares/rate-limit.js'

export const publicRouter = Router()

publicRouter.get('/settings', getPublicSettings)
publicRouter.get('/categories', getCategories)
publicRouter.get('/products', getProducts)
publicRouter.get('/products/:slug', getProduct)
publicRouter.post('/cart/quote', quoteLimiter, postQuote)
publicRouter.post('/orders', ordersLimiter, postOrder)
publicRouter.post('/orders/lookup', ordersLimiter, postOrderLookup)
