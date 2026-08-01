'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Helper function to update a table's user fields
    const updateUserFieldsInTable = async (tableName, idColumn, createdByColumn, checkedByColumn, approvedByColumn) => {
      // Get all users from master_user
      const [users] = await queryInterface.sequelize.query(
        'SELECT mu_id, mu_username, mu_fullname FROM master_user'
      )

      // Create a map of username to fullname
      const usernameToFullnameMap = {}
      users.forEach(user => {
        if (user.mu_username && user.mu_fullname) {
          usernameToFullnameMap[user.mu_username] = user.mu_fullname
        }
      })

      // Get all records from the table
      const [records] = await queryInterface.sequelize.query(
        `SELECT ${idColumn}, ${createdByColumn}, ${checkedByColumn}, ${approvedByColumn} FROM ${tableName}`
      )

      // Update each record
      for (const record of records) {
        const updates = []
        const updateValues = []

        // Check and update created_by
        if (record[createdByColumn] && usernameToFullnameMap[record[createdByColumn]]) {
          updates.push(`${createdByColumn} = ?`)
          updateValues.push(usernameToFullnameMap[record[createdByColumn]])
        }

        // Check and update checked_by
        if (record[checkedByColumn] && usernameToFullnameMap[record[checkedByColumn]]) {
          updates.push(`${checkedByColumn} = ?`)
          updateValues.push(usernameToFullnameMap[record[checkedByColumn]])
        }

        // Check and update approved_by
        if (record[approvedByColumn] && usernameToFullnameMap[record[approvedByColumn]]) {
          updates.push(`${approvedByColumn} = ?`)
          updateValues.push(usernameToFullnameMap[record[approvedByColumn]])
        }

        // Execute update if there are changes
        if (updates.length > 0) {
          updateValues.push(record[idColumn])
          await queryInterface.sequelize.query(
            `UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${idColumn} = ?`,
            { replacements: updateValues }
          )
        }
      }
    }

    // Update receipts table
    await updateUserFieldsInTable(
      'receipts',
      'r_id',
      'r_created_by',
      'r_checked_by',
      'r_approved_by'
    )

    // Update cash_disbursements table
    await updateUserFieldsInTable(
      'cash_disbursements',
      'cd_id',
      'cd_created_by',
      'cd_checked_by',
      'cd_approved_by'
    )

    // Update sales table
    await updateUserFieldsInTable(
      'sales',
      's_id',
      's_created_by',
      's_checked_by',
      's_approved_by'
    )

    // Update collections table
    await updateUserFieldsInTable(
      'collections',
      'c_id',
      'c_created_by',
      'c_checked_by',
      'c_approved_by'
    )

    // Update purchase table
    await updateUserFieldsInTable(
      'purchase',
      'p_id',
      'p_created_by',
      'p_checked_by',
      'p_approved_by'
    )

    // Update payments table
    await updateUserFieldsInTable(
      'payments',
      'c_id',
      'c_created_by',
      'c_checked_by',
      'c_approved_by'
    )
  },

  async down(queryInterface, Sequelize) {
    // This migration is not easily reversible as we don't have the original usernames
    // In a production environment, you might want to store the original values in a backup table
    console.log('Warning: This migration cannot be automatically rolled back. Please restore from backup if needed.')
  },
}
