'use strict'

/**
 * Idempotent bulk insert for the tenant seeders.
 *
 * db:seed:all re-runs every seeder in the folder on each call, and signup can be
 * retried after a partial failure. A bare bulkInsert therefore added a second
 * copy of every reference row on a second pass and then failed on the primary
 * key, which surfaced as "Validation error" and left the tenant half-seeded.
 *
 * Existence is checked on the row's natural key rather than the auto-increment
 * id, so re-running is a no-op while a genuinely new row is still inserted.
 */
const insertIfMissing = async (queryInterface, table, rows, keyColumns) => {
  if (!Array.isArray(rows) || rows.length === 0) return 0

  const columns = keyColumns && keyColumns.length ? keyColumns : Object.keys(rows[0])
  const where = columns.map((c) => `\`${c}\` = ?`).join(' AND ')

  let inserted = 0
  for (const row of rows) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT 1 FROM \`${table}\` WHERE ${where} LIMIT 1`,
      { replacements: columns.map((c) => row[c]) },
    )
    if (existing.length > 0) continue
    await queryInterface.bulkInsert(table, [row])
    inserted++
  }
  return inserted
}

module.exports = { insertIfMissing }