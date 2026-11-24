/**
 * Applies the SQL files in migrations/ in filename order, once each.
 *
 * There is no sequelize.sync() and no ALTER at boot: the schema is only ever
 * changed by a reviewable file in migrations/. Each file runs in its own
 * transaction, so a failing migration leaves nothing behind.
 *
 *   npm run migrate              -> apply to PGDATABASE
 *   npm run migrate -- --unit    -> apply to PGDATABASE_UNIT (test database)
 *   npm run migrate -- --status  -> list applied / pending, change nothing
 */
import * as fs from 'fs'
import * as path from 'path'
import { config } from '../src/config'
import { makeClient } from '../src/db'

// migrations/ sits next to scripts/ in the source tree and two levels up from the compiled dist/scripts/
const DIR = [path.resolve(__dirname, '..', 'migrations'), path.resolve(__dirname, '..', '..', 'migrations')].find(d => fs.existsSync(d)) ?? path.resolve(__dirname, '..', 'migrations')

export async function migrate(database = config.db.database, opts: { status?: boolean; quiet?: boolean } = {}) {
  const log = (...a: unknown[]) => { if (!opts.quiet) console.log(...a) }
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()
  const client = makeClient({ ...config.db, database })
  await client.connect()
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS erp_migration (
      name varchar PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
    const done = new Set((await client.query<{ name: string }>('SELECT name FROM erp_migration')).rows.map(r => r.name))
    const pending = files.filter(f => !done.has(f))

    if (opts.status) {
      log(`database: ${database}`)
      files.forEach(f => log(`  ${done.has(f) ? 'applied' : 'PENDING'}  ${f}`))
      return { applied: [] as string[], pending }
    }

    if (!pending.length) { log(`Nothing to apply; ${done.size} migration(s) already in ${database}.`) ; return { applied: [], pending: [] } }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(DIR, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO erp_migration (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        log(`applied  ${file}`)
      } catch (e) {
        await client.query('ROLLBACK')
        throw new Error(`migration ${file} failed: ${(e as Error).message}`)
      }
    }
    return { applied: pending, pending: [] }
  } finally {
    await client.end()
  }
}

if (require.main === module) {
  const argv = process.argv.slice(2)
  const database = argv.includes('--unit') ? config.unitDatabase : config.db.database
  migrate(database, { status: argv.includes('--status') }).catch(e => {
    console.error(String(e instanceof Error ? e.message : e))
    process.exit(1)
  })
}
