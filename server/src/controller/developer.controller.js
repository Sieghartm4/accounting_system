const fs = require('fs')
const path = require('path')

const migrationsDir = path.join(__dirname, '..', 'database', 'migrations', 'create')

const parseMigration = (content) => {
  const createTableMatch = content.match(
    /createTable\(['"`]([^'"`]+)['"`],\s*\{([\s\S]*?)\}\s*\)/m,
  )
  if (!createTableMatch) return null

  const tableName = createTableMatch[1]
  const columnsBlock = createTableMatch[2]
  const columnMatches = [
    ...columnsBlock.matchAll(/(\w+)\s*:\s*\{([\s\S]*?)(?:\n\s*\}|\n\s*\},)/g),
  ]

  const columns = columnMatches.map(([, name, body]) => {
    const typeMatch =
      body.match(/type\s*:\s*Sequelize\.([A-Za-z0-9_]+)(\([^)]*\))?/) ||
      body.match(/type\s*:\s*Sequelize\.([A-Za-z0-9_]+)/)
    const primaryKey = /primaryKey\s*:\s*true/.test(body)
    const autoIncrement = /autoIncrement\s*:\s*true/.test(body)
    const allowNullMatch = body.match(/allowNull\s*:\s*(true|false)/)
    const allowNull = allowNullMatch ? allowNullMatch[1] === 'true' : null

    let type = 'UNKNOWN'
    if (typeMatch) {
      type = typeMatch[1] + (typeMatch[2] || '')
    }

    const key = primaryKey ? 'PK' : ''
    const notes = [
      autoIncrement ? 'Auto Increment' : null,
      allowNull === false ? 'NOT NULL' : null,
    ]
      .filter(Boolean)
      .join(', ')

    return {
      name,
      type,
      key,
      notes,
    }
  })

  return { table: tableName, columns }
}

const getMigrations = async (req, res) => {
  try {
    const files = await fs.promises.readdir(migrationsDir)
    const migrations = []

    for (const file of files) {
      if (!file.endsWith('.js')) continue
      const match = file.match(/create-(.+)\.js$/)
      if (!match) continue

      const raw = await fs.promises.readFile(path.join(migrationsDir, file), 'utf8')
      const parsed = parseMigration(raw)
      const table = parsed ? parsed.table : match[1].replace(/_/g, ' ')
      const name = match[1].replace(/_/g, ' ')
      migrations.push({
        filename: file,
        name,
        table,
        desc: parsed
          ? `Table definition parsed from ${file}`
          : `Migration ${file} contains the ${name} schema`,
        columns: parsed ? parsed.columns : [],
      })
    }

    migrations.sort((a, b) => a.filename.localeCompare(b.filename))
    res.json({ success: true, migrations })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { getMigrations }
