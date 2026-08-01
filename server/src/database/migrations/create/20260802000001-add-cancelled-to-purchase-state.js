'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add CANCELLED to p_state enum
    await queryInterface.sequelize.query(`
      ALTER TABLE purchase 
      MODIFY COLUMN p_state ENUM('PREPARED', 'CHECKED', 'APPROVED', 'REJECTED', 'CANCELLED') 
      NOT NULL DEFAULT 'PREPARED'
    `)
  },

  async down(queryInterface, Sequelize) {
    // Revert to original enum
    await queryInterface.sequelize.query(`
      ALTER TABLE purchase 
      MODIFY COLUMN p_state ENUM('PREPARED', 'CHECKED', 'APPROVED', 'REJECTED') 
      NOT NULL DEFAULT 'PREPARED'
    `)
  },
}
