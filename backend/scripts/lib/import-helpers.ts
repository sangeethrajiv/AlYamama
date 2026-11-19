/**
 * Helpers shared by the Odoo importers (import-odoo.ts, import-inventory.ts).
 * Every importer reads Odoo through withOdooReadOnly() and writes here with
 * these functions, so an import is always idempotent: a re-run updates the same
 * rows and never duplicates them.
 */
import type { Client } from 'pg'

export type Row = Record<string, unknown>

/**
 * Inserts rows in batches, updating on conflict so a re-run is safe.
 * `conflict` names the conflicting columns (the primary key); link tables whose
 * key is a pair of ids pass both and are left alone when the row exists.
 */
export async function upsert(target: Client, table: string, columns: string[], rows: Row[], batch = 500, conflict: string[] = ['id']) {
  if (!rows.length) return 0
  const updatable = columns.filter(c => !conflict.includes(c))
  const setClause = updatable.length ? updatable.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ') : null
  const conflictSql = conflict.map(c => `"${c}"`).join(',')
  let done = 0
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch)
    const params: unknown[] = []
    const tuples = slice.map(r => {
      const ph = columns.map(c => {
        params.push(r[c] ?? null)
        return `$${params.length}`
      })
      return `(${ph.join(',')})`
    })
    const sql =
      `INSERT INTO ${table} (${columns.map(c => `"${c}"`).join(',')}) VALUES ${tuples.join(',')} ` +
      (setClause ? `ON CONFLICT (${conflictSql}) DO UPDATE SET ${setClause}` : `ON CONFLICT (${conflictSql}) DO NOTHING`)
    await target.query(sql, params)
    done += slice.length
  }
  return done
}

/** Records the Odoo id of each imported row in ir_model_data, so nothing is lost in translation. */
export async function recordExternalIds(target: Client, model: string, ids: number[], batch = 1000) {
  for (let i = 0; i < ids.length; i += batch) {
    const slice = ids.slice(i, i + batch)
    const params: unknown[] = []
    const tuples = slice.map(id => {
      params.push('odoo12', `${model.replace(/\./g, '_')}_${id}`, model, id)
      return `($${params.length - 3},$${params.length - 2},$${params.length - 1},$${params.length})`
    })
    await target.query(
      `INSERT INTO ir_model_data (module, name, model, res_id) VALUES ${tuples.join(',')}
       ON CONFLICT (module, name) DO UPDATE SET res_id = EXCLUDED.res_id`,
      params,
    )
  }
}

/** Keeps the serial sequences above the imported ids. */
export async function resetSequences(target: Client, tables: string[]) {
  for (const t of tables) {
    await target.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), GREATEST(COALESCE((SELECT max(id) FROM ${t}), 0), 1))`,
      [t],
    )
  }
}

export const argvFlag = (name: string) => process.argv.slice(2).includes(`--${name}`)
export const argvValue = (name: string) => {
  const a = process.argv.slice(2)
  const i = a.indexOf(`--${name}`)
  return i >= 0 ? a[i + 1] : undefined
}
