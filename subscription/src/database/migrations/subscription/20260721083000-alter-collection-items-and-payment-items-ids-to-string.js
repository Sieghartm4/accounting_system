'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update ci_purchase_id in payment_items to INTEGER with reference to purchase_items
    await queryInterface.changeColumn('payment_items', 'ci_purchase_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'purchase_items',
        key: 'pi_id',
      },
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert ci_purchase_id in payment_items back to STRING(300)
    await queryInterface.changeColumn('payment_items', 'ci_purchase_id', {
      type: Sequelize.STRING(300),
      allowNull: true,
    });
  }
};
