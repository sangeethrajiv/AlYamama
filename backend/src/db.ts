import { Client, Pool } from 'pg'
import { config, type PgConfig } from './config'

/** A plain pg pool, used by the migration runner, the scripts and the search queries. */
export const makePool = (db: PgConfig = config.db) =>
  new Pool({ ...db, max: config.poolMax, application_name: 'alyamama-erp' })

export const makeClient = (db: PgConfig) => new Client({ ...db, application_name: 'alyamama-erp' })

/** Connects to the `postgres` maintenance database, for CREATE/DROP DATABASE. */
export const maintenanceClient = (db: PgConfig = config.db) => makeClient({ ...db, database: 'postgres' })

/**
 * Opens a read-only connection to the Odoo database. Every statement runs inside
 * `BEGIN READ ONLY`, so the Odoo data cannot be changed even by mistake.
 */
export async function withOdooReadOnly<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  if (!config.odoo.database) throw new Error('ODOO_PGDATABASE is not set in backend/.env')
  const c = makeClient(config.odoo)
  await c.connect()
  try {
    await c.query('BEGIN READ ONLY')
    const out = await fn(c)
    await c.query('ROLLBACK')
    return out
  } finally {
    await c.end()
  }
}
