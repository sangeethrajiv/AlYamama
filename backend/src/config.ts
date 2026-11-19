import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true })

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d)

export interface PgConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export const config = {
  port: num(process.env.PORT, 3000),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean),
  poolMax: num(process.env.PG_POOL_MAX, 20),
  db: {
    host: process.env.PGHOST || 'localhost',
    port: num(process.env.PGPORT, 5433),
    user: process.env.PGUSER || '',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'accounting_26_test',
  } as PgConfig,
  unitDatabase: process.env.PGDATABASE_UNIT || 'accounting_26_test_unit',
  odoo: {
    host: process.env.ODOO_PGHOST || process.env.PGHOST || 'localhost',
    port: num(process.env.ODOO_PGPORT, 5433),
    user: process.env.ODOO_PGUSER || process.env.PGUSER || '',
    password: process.env.ODOO_PGPASSWORD || process.env.PGPASSWORD || '',
    database: process.env.ODOO_PGDATABASE || '',
  } as PgConfig,
}
