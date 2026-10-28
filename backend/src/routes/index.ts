import { Router } from 'express'
import { adminRouter } from './admin.routes.js'
import { healthRouter } from './health.routes.js'
import { publicRouter } from './public.routes.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/admin', adminRouter)
apiRouter.use('/', publicRouter)
