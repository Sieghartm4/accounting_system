'use strict'

const TABLE = 'idempotency_keys'

const getIdempotencyKey = (req) => {
  const raw = req.get('Idempotency-Key') || req.body?.idempotency_key
  if (raw === undefined || raw === null) return null
  const key = String(raw).trim()
  if (!key || key.length > 64) return null
  return key
}

const claimIdempotencyKey = async (connection, key, module) => {
  try {
    await connection.execute(
      `INSERT INTO ${TABLE} (idempotency_key, module) VALUES (?, ?)`,
      [key, module],
    )
    return { duplicate: false, documentId: null }
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') throw error
  }

  const [rows] = await connection.execute(
    `SELECT document_id FROM ${TABLE} WHERE idempotency_key = ? AND module = ?`,
    [key, module],
  )

  return { duplicate: true, documentId: rows?.[0]?.document_id || null }
}

const linkIdempotencyKey = async (connection, key, module, documentId) => {
  await connection.execute(
    `UPDATE ${TABLE} SET document_id = ? WHERE idempotency_key = ? AND module = ?`,
    [documentId === null || documentId === undefined ? null : String(documentId), key, module],
  )
}

module.exports = {
  getIdempotencyKey,
  claimIdempotencyKey,
  linkIdempotencyKey,
}
