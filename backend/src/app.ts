import 'reflect-metadata'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import { config } from './config'
import { errorHandler } from './middleware'
import { fail } from './common.helper'
import router from './router'
import { sequelize } from './orm'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
      // Headers used by the auth stub until JWT exists.
      allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Company-Id', 'X-Allowed-Company-Ids'],
    }),
  )
  // Images arrive as base64 in the JSON body, so allow a larger payload.
  app.use(express.json({ limit: '12mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(compression({ threshold: 1024 * 1024 }))

  app.get('/health', async (_req, res) => {
    try {
      await sequelize.query('SELECT 1')
      res.json({ success: true, data: { status: 'ok', database: config.db.database } })
    } catch (e) {
      res.status(503).json({ success: false, message: `database unreachable: ${(e as Error).message}` })
    }
  })

  app.use('/v2', router)

  app.use((req, res) => fail(res, 404, `No route for ${req.method} ${req.originalUrl}`, 'not_found'))
  app.use(errorHandler)

  return app
}
