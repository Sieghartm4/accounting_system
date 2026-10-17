/**
 * Fix collection notification links from /collection to /collections
 *
 * Old notifications were created with link: '/collection' which doesn't match
 * the route definition. This migration updates all existing notifications to
 * use the correct '/collections' path.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update all collection notification links from singular to plural
    await queryInterface.sequelize.query(`
      UPDATE notifications
      SET nt_link = '/collections'
      WHERE nt_link = '/collection'
    `)
  },

  async down(queryInterface, Sequelize) {
    // Revert the change
    await queryInterface.sequelize.query(`
      UPDATE notifications
      SET nt_link = '/collection'
      WHERE nt_link = '/collections'
    `)
  },
}
