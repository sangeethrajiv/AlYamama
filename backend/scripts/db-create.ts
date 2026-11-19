/**
 * Creates the development and test databases if they do not exist.
 * It never touches the Odoo database.
 *
 *   npm run db:create
 *   npm run db:create -- --drop-unit   recreate the test database from scratch
 */
import { config } from '../src/config'
import { maintenanceClient } from '../src/db'

const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`unsafe database name: ${name}`)
  return `"${name}"`
}

export async function createDatabase(name: string, { drop = false } = {}) {
  const c = maintenanceClient()
  await c.connect()
  try {
    const exists = async () =>
      (await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])).rowCount === 1
    if (drop && (await exists())) {
      await c.query(`DROP DATABASE ${ident(name)} WITH (FORCE)`)
      console.log(`dropped  ${name}`)
    }
    if (await exists()) { console.log(`exists   ${name}`); return false }
    await c.query(`CREATE DATABASE ${ident(name)} ENCODING 'UTF8' TEMPLATE template0`)
    console.log(`created  ${name}`)
    return true
  } finally {
    await c.end()
  }
}

if (require.main === module) {
  const dropUnit = process.argv.includes('--drop-unit')
  ;(async () => {
    await createDatabase(config.db.database)
    await createDatabase(config.unitDatabase, { drop: dropUnit })
  })().catch(e => {
    console.error(String(e instanceof Error ? e.message : e))
    process.exit(1)
  })
}
