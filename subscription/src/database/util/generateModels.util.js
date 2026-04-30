const fs = require('fs')
const path = require('path')

const migrationsDir = path.join(__dirname, '../', 'migrations')
const modelsDir = path.join(__dirname, '../model')

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true })
  console.log(`📁 Created models directory at: ${modelsDir}`)
}

const groupedModels = {}

fs.readdirSync(migrationsDir).forEach((file) => {
  const fullPath = path.join(migrationsDir, file)
  if (file.endsWith('.js')) {
    try {
      console.log(`🔍 Processing migration: ${file}`)
      const models = extractModelFromMigration(fullPath)
      if (!models) {
        console.warn(`⚠️ Skipped: No createTable() found in ${file}`)
        return
      }

      const { baseName, tableName, modelObject } = models

      if (!groupedModels[baseName]) groupedModels[baseName] = {}
      groupedModels[baseName][tableName] = modelObject
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message)
    }
  }
})

Object.entries(groupedModels).forEach(([baseName, models]) => {
  const capitalizedBase = capitalizeFirst(baseName)
  const fileName = `${capitalizedBase}.js`

  let content = `const ${capitalizedBase} = {\n`

  for (const [modelKey, modelObj] of Object.entries(models)) {
    // Note: serializeObject must be able to handle nested objects and arrays
    content += ` 	${modelKey}: ${serializeObject(modelObj)},\n`
  }

  content += `};\n\nexports.${capitalizedBase} = ${capitalizedBase};`

  const filePath = path.join(modelsDir, fileName)
  fs.writeFileSync(filePath, content, 'utf-8')
  console.log(`✅ Model file generated: ${filePath}`)
})

// ==========================================
// 🧠 Helper Functions
// ==========================================

function extractModelFromMigration(migrationPath) {
  const code = fs.readFileSync(migrationPath, 'utf8')

  const tableMatch = code.match(/queryInterface\.createTable\(\s*['"`](\w+)['"`]\s*,\s*{([\s\S]*?)\s*}\s*\)/s)
  if (!tableMatch) return null

  const tableName = tableMatch[1]
  const tableBody = tableMatch[2]

  const parts = tableName.split('_')
  const rawBase = parts[0]
  const baseName = normalizeBaseName(rawBase)

  // Regex to capture the entire column definition block, including the type
  const fieldRegex = /(\w+)\s*:\s*{([\s\S]*?)}\s*(,)?/gm

  let match
  const selectColumns = []
  const insertColumns = []
  const selectOptionColumns = {}
  const updateOptionColumns = {}
  const selectDateFormatColumns = {}
  const selectMiscColumns = {}

  // NEW: Object to hold the extracted Sequelize data types for each clean column name
  const columnDataTypes = {}

  while ((match = fieldRegex.exec(tableBody)) !== null) {
    const column = match[1]
    const fieldDef = match[2]

    // EXTRACT TYPE: Matches: type: Sequelize.TYPE(...) or type: Sequelize.TYPE
    const typeMatch = fieldDef.match(/type\s*:\s*Sequelize\.(\w+)/)
    const sequelizeType = typeMatch ? typeMatch[1] : 'STRING' // Default to STRING if not found

    const clean = column.replace(/^.*?_/, '')
    const isAuto = /autoIncrement\s*:\s*true/i.test(fieldDef)
    const isPk = /primaryKey\s*:\s*true/i.test(fieldDef)
    const hasDefault = /defaultValue\s*:/i.test(fieldDef)
    const isDateField = /Sequelize\.DATE(ONLY)?/.test(fieldDef)

    selectColumns.push(column)
    if ((!isAuto && !isPk && !hasDefault) || (isPk && !isAuto)) {
      insertColumns.push(clean)
    }

    selectOptionColumns[clean] = column
    updateOptionColumns[clean] = clean

    // STORE TYPE: Store the extracted data type using the clean column name
    columnDataTypes[clean] = sequelizeType

    if (isDateField) {
      selectDateFormatColumns[clean] = `REPLACE(REPLACE(${column}, 'T', ' '), 'Z', '') AS ${column}`
    }
  }

  const nameCols = Object.keys(selectOptionColumns).map((c) => c.toLowerCase())
  const firstNameCol = nameCols.find((c) => c === 'first_name' || c === 'firstname')
  const lastNameCol = nameCols.find((c) => c === 'last_name' || c === 'lastname')

  if (firstNameCol && lastNameCol) {
    const firstColDb = selectOptionColumns[firstNameCol]
    const lastColDb = selectOptionColumns[lastNameCol]

    selectMiscColumns['fullname'] = `CONCAT(${firstColDb},' ',${lastColDb}) AS fullname`
  }

  const prefix = extractPrefix(selectOptionColumns)
  const prefix_ = prefix ? `${prefix}_` : ''

  const modelObject = {
    tablename: tableName,
    prefix,
    prefix_,
    insertColumns,
    selectColumns,
    selectOptionColumns,
    updateOptionColumns,
    selectDateFormatColumns,
    selectMiscColumns,
    // NEW: Include the column data type map for the schema generator
    columnDataTypes,
  }

  console.log(`📦 Model extracted: ${tableName}`)
  return { baseName, tableName, modelObject }
}

function extractPrefix(selectOptionColumns) {
  const sampleColumn = Object.values(selectOptionColumns)[0]
  const match = sampleColumn.match(/^([a-z]+)_/i)
  return match ? match[1] : ''
}

function normalizeBaseName(name) {
  return name.endsWith('s') ? name.slice(0, -1) : name
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function serializeObject(obj, indent = 2) {
  const pad = (level) => ' '.repeat(level)

  if (Array.isArray(obj)) {
    return `[\n${obj
      .map((v) => pad(indent + 2) + serializeObject(v, indent + 2))
      .join(',\n')}\n${pad(indent)}]`
  }

  if (typeof obj === 'function') {
    return obj.toString()
  }

  if (typeof obj === 'string') {
    return `"${obj.replace(/"/g, '\\"')}"`
  }

  if (typeof obj === 'object' && obj !== null) {
    const entries = Object.entries(obj).map(([key, value]) => {
      const safeKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : `'${key}'`
      return `${pad(indent)}${safeKey}: ${serializeObject(value, indent + 2)}`
    })
    return `{\n${entries.join(',\n')}\n${pad(indent - 2)}}`
  }

  return String(obj)
}
