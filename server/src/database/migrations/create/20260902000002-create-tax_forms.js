const { getTenantPool } = require('../util/tenantConnection.util')

module.exports = async (sequelize, Sequelize) => {
  const DataTypes = sequelize.DataTypes

  // Create table in all tenant databases
  const tenantDatabases = await getTenantPool()

  for (const dbName of tenantDatabases) {
    const connection = require('../config/connection.config')(dbName)

    const query = `
      CREATE TABLE IF NOT EXISTS tax_forms (
        tf_id INT AUTO_INCREMENT PRIMARY KEY,
        tf_form_type VARCHAR(50) NOT NULL COMMENT '2550M, 0619E, 2307, 1601EQ',
        tf_user_id INT NOT NULL,
        tf_company_id INT NOT NULL,
        tf_start_date DATE NOT NULL,
        tf_end_date DATE NOT NULL,
        tf_form_data LONGTEXT NOT NULL COMMENT 'JSON data with edited form values',
        tf_status ENUM('draft', 'filed', 'filed_with_bir', 'rejected') DEFAULT 'draft',
        tf_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tf_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_form_type (tf_form_type),
        INDEX idx_user_id (tf_user_id),
        INDEX idx_company_id (tf_company_id),
        INDEX idx_status (tf_status),
        UNIQUE KEY unique_form_period (tf_form_type, tf_company_id, tf_start_date, tf_end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Tax Compliance Forms Storage';
    `

    try {
      await connection.query(query)
      console.log(`✓ tax_forms table created in ${dbName}`)
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log(`ℹ tax_forms table already exists in ${dbName}`)
      } else {
        console.error(`✗ Error creating tax_forms in ${dbName}:`, err.message)
      }
    }

    connection.end()
  }
}
