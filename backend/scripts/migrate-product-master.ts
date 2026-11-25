/**
 * Copies the product master data from the Odoo 12 database into this one:
 *   products (product.template), product categories, units of measure, UoM categories,
 *   plus the product genres (att.product.type) and the product <-> customer tax links.
 * It never touches product.product (variants), stock, invoices, orders, Accounting, Contacts, Users or HR.
 *
 *   npm run migrate:product-master                      DRY RUN against PGDATABASE: does everything, verifies, rolls back
 *   npm run migrate:product-master -- --target-db NAME  dry run against another database (e.g. a scratch copy)
 *   npm run migrate:product-master -- --execute --confirm <PGDATABASE>
 *                                                       the real run: commits. --confirm must repeat the target database name
 *   --update          also update rows that already exist in the target (default: leave them alone)
 *   --allow-partial   commit what worked even if some records failed (default: any failure rolls everything back)
 *   --no-cost         do not copy each product's cost (needs a read of the source variants / ir_property)
 *   --unit            use the test database (PGDATABASE_UNIT) as the target
 *
 * Source: ODOO_PG* in backend/.env, read-only (BEGIN READ ONLY). Target: PG* in backend/.env.
 * Idempotent: ids are mapped through ir_model_data (module odoo12), never assumed equal; a second run finds
 * everything already there. Nothing is removed. Log: backend/migration-logs/.
 */
import * as fs from 'fs'
import * as path from 'path'
import { config } from '../src/config'
import { makeClient, withOdooReadOnly } from '../src/db'
import { argvFlag, argvValue } from './lib/import-helpers'
import { migrateProductMaster, type Result } from './lib/product-master'

const execute = argvFlag('execute')
const targetDb = argvFlag('unit') ? config.unitDatabase : (argvValue('target-db') ?? config.db.database)
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const logDir = path.resolve(__dirname, '..', 'migration-logs')
const logFile = path.join(logDir, `product-master-${targetDb}-${execute ? 'EXECUTE' : 'dry-run'}-${stamp}.log`)
const lines: string[] = []
const log = (line = '') => { lines.push(line); console.log(line) }

function report(r: Result) {
  log('\n=== Result ===')
  log(`${'model'.padEnd(22)}${'inserted'.padStart(9)}${'updated'.padStart(9)}${'linked'.padStart(8)}${'skipped'.padStart(9)}${'failed'.padStart(8)}`)
  for (const [model, c] of Object.entries(r.counts)) {
    log(`${model.padEnd(22)}${String(c.inserted).padStart(9)}${String(c.updated).padStart(9)}${String(c.linked).padStart(8)}${String(c.skipped).padStart(9)}${String(c.failed).padStart(8)}`)
  }
  for (const [model, cols] of Object.entries(r.changes)) {
    const list = Object.entries(cols)
    if (list.length) log(`\n${model}: columns that differ -> ${list.map(([c, n]) => `${c} (${n})`).join(', ')}`)
  }
  if (r.warnings.length) { log('\nWarnings:'); r.warnings.forEach(w => log(`  - ${w}`)) }
  log('\nVerification:')
  for (const c of r.checks) log(`  [${c.ok ? 'OK' : 'FAIL'}] ${c.name}: ${c.detail}`)
  if (r.failures.length) {
    log(`\nFailed records (${r.failures.length}):`)
    r.failures.slice(0, 200).forEach(f => log(`  ${f.model} source id ${f.sourceId}: ${f.reason}`))
    if (r.failures.length > 200) log(`  ... and ${r.failures.length - 200} more (the log lists the first 200)`)
  }
}

async function main() {
  if (!config.odoo.database) throw new Error('ODOO_PGDATABASE is not set in backend/.env')
  if (targetDb === config.odoo.database) throw new Error('The target is the Odoo database. Refusing to run.')
  if (execute && argvValue('confirm') !== targetDb) {
    throw new Error(`--execute writes to "${targetDb}". Repeat the database name to confirm:  --execute --confirm ${targetDb}`)
  }
  log(`${execute ? 'EXECUTE (commits)' : 'DRY RUN (rolls back)'}  ${new Date().toISOString()}`)
  log(`source: ${config.odoo.database} @ ${config.odoo.host}:${config.odoo.port}  (read-only)`)
  log(`target: ${targetDb} @ ${config.db.host}:${config.db.port}`)
  log(`options: update=${argvFlag('update')} allowPartial=${argvFlag('allow-partial')} cost=${!argvFlag('no-cost')}\n`)

  const target = makeClient({ ...config.db, database: targetDb })
  await target.connect()
  let result: Result
  try {
    result = await withOdooReadOnly(source => migrateProductMaster(source, target, {
      execute, update: argvFlag('update'), allowPartial: argvFlag('allow-partial'), cost: !argvFlag('no-cost'), log,
    }))
  } finally {
    await target.end()
  }
  report(result)
  log(`\n${result.committed ? 'COMMITTED.' : execute ? 'NOT committed: something failed, everything was rolled back.' : 'Dry run finished: nothing was written.'}`)
  fs.mkdirSync(logDir, { recursive: true })
  fs.writeFileSync(logFile, lines.join('\n') + '\n')
  console.log(`log: ${logFile}`)
  if (execute && !result.committed) process.exitCode = 1
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
