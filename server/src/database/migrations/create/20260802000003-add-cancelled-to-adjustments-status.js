'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add CANCELLED to a_status enum
    await queryInterface.sequelize.query(`
      ALTER TABLE adjustments 
      MODIFY COLUMN a_status ENUM('PREPARED', 'CHECKED', 'APPROVED', 'REJECTED', 'CANCELLED') 
      NULL
    `)
  },

  async down(queryInterface, Sequelize) {
    // Revert to original enum
    await queryInterface.sequelize.query(`
      ALTER TABLE adjustments 
      MODIFY COLUMN a_status ENUM('PREPARED', 'CHECKED', 'APPROVED', 'REJECTED') 
      NULL
    `)
  },
}
