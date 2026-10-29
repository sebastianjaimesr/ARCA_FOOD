import { Router, type RequestHandler } from 'express'
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

// Caché corta para lecturas públicas del catálogo: un cambio en el panel se ve
// en máximo ~30 s. Los precios nunca dependen de esto: el carrito y el pedido
// siempre se recalculan en el backend.
const publicCache: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
  next()
}

// Pedidos y cotizaciones: nunca se guardan en caché (contienen datos personales).
const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}

export const publicRouter = Router()

publicRouter.get('/settings', publicCache, getPublicSettings)
publicRouter.get('/categories', publicCache, getCategories)
publicRouter.get('/products', publicCache, getProducts)
publicRouter.get('/products/:slug', publicCache, getProduct)
publicRouter.post('/cart/quote', noStore, quoteLimiter, postQuote)
publicRouter.post('/orders', noStore, ordersLimiter, postOrder)
publicRouter.post('/orders/lookup', noStore, ordersLimiter, postOrderLookup)
