/**
 * Recursive test runner (the pattern from docs/api-service-architecture-handover.md
 * section 8), with one addition: it rebuilds the throwaway test database first,
 * so a run never depends on leftover rows and never touches the dev database.
 *
 *   npm test                 every *.test.ts
 *   npm test partner         only files whose path contains "partner"
 *   npm test -- --keep-db    reuse the existing test database
 */
import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { config } from './src/config'
import { createDatabase } from './scripts/db-create'
import { migrate } from './scripts/migrate'

const SRC = path.resolve(__dirname, 'src')

function findTests(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) findTests(full, out)
    else if (entry.name.endsWith('.test.ts')) out.push(full)
  }
  return out
}

async function main() {
  const args = process.argv.slice(2)
  const keepDb = args.includes('--keep-db')
  const filters = args.filter(a => !a.startsWith('--'))

  let files = findTests(SRC).sort()
  if (filters.length) files = files.filter(f => filters.some(k => f.includes(k)))
  if (!files.length) {
    console.log('no test files matched')
    return
  }

  console.log(`test database: ${config.unitDatabase}${keepDb ? ' (reused)' : ' (recreated)'}`)
  await createDatabase(config.unitDatabase, { drop: !keepDb })
  await migrate(config.unitDatabase, { quiet: true })

  console.log(`running ${files.length} test file(s)\n`)
  const result = spawnSync(
    path.resolve(__dirname, 'node_modules/.bin/mocha'),
    ['--require', 'ts-node/register/transpile-only', '--timeout', '20000', '--exit', ...files],
    {
      stdio: 'inherit',
      // Point the suite at the test database. dotenv does not override an
      // existing variable, so this wins over .env inside the child.
      env: { ...process.env, PGDATABASE: config.unitDatabase, TS_NODE_TRANSPILE_ONLY: 'true' },
    },
  )
  process.exit(result.status ?? 1)
}

main().catch(e => {
  console.error(String(e instanceof Error ? e.message : e))
  process.exit(1)
})
