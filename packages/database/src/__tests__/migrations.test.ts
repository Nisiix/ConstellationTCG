import { getTableColumns, getTableName, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPgliteDatabase, type Database } from '../client'
import { rowsOf, runMigrations } from '../migrator'
import { schema } from '../schema'

let database: Database

beforeAll(async () => {
  database = await createPgliteDatabase(':memory:')
})

afterAll(async () => {
  await database.close()
})

describe('migrations', () => {
  it('apply cleanly to an empty database and are idempotent', async () => {
    const first = await runMigrations(database)
    expect(first.applied.length).toBeGreaterThan(0)
    expect(first.skipped).toEqual([])

    const second = await runMigrations(database)
    expect(second.applied).toEqual([])
    expect(second.skipped).toEqual(first.applied)
  })

  it('creates every table declared in the drizzle schema', async () => {
    const rows = rowsOf<{ table_name: string }>(
      await database.db.execute(
        sql`select table_name from information_schema.tables where table_schema = 'public'`,
      ),
    )
    const tables = new Set(rows.map((r) => r.table_name))
    for (const table of Object.values(schema)) {
      expect(tables.has(getTableName(table)), `table ${getTableName(table)}`).toBe(true)
    }
  })

  it('has no drift between the drizzle schema and the SQL migrations', async () => {
    const rows = rowsOf<{ table_name: string; column_name: string; is_nullable: string }>(
      await database.db.execute(
        sql`select table_name, column_name, is_nullable from information_schema.columns where table_schema = 'public'`,
      ),
    )
    const byTable = new Map<string, Map<string, boolean>>()
    for (const row of rows) {
      const cols = byTable.get(row.table_name) ?? new Map<string, boolean>()
      cols.set(row.column_name, row.is_nullable === 'YES')
      byTable.set(row.table_name, cols)
    }

    const problems: string[] = []
    for (const table of Object.values(schema)) {
      const name = getTableName(table)
      const dbColumns = byTable.get(name)
      if (!dbColumns) {
        problems.push(`missing table ${name}`)
        continue
      }
      const drizzleColumns = getTableColumns(table)
      for (const column of Object.values(drizzleColumns)) {
        const nullable = dbColumns.get(column.name)
        if (nullable === undefined) {
          problems.push(`${name}.${column.name} declared in drizzle but missing in SQL`)
        } else if (nullable === column.notNull) {
          problems.push(`${name}.${column.name} nullability differs (sql nullable=${nullable})`)
        }
      }
      const drizzleNames = new Set(Object.values(drizzleColumns).map((c) => c.name))
      for (const sqlColumn of dbColumns.keys()) {
        if (!drizzleNames.has(sqlColumn)) {
          problems.push(`${name}.${sqlColumn} exists in SQL but not in drizzle`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('has the pg_trgm extension available for fuzzy search', async () => {
    const rows = rowsOf<{ similarity: number }>(
      await database.db.execute(sql`select similarity('charizard', 'charizrd') as similarity`),
    )
    expect(rows[0]?.similarity).toBeGreaterThan(0.5)
  })
})
