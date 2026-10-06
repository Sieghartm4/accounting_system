'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const responsibilityCenters = [
      {
        rc_code: 'RC-001',
        rc_name: 'Default Responsibility Center',
        rc_department: 'General',
        rc_status: 'ACTIVE',
      },
      {
        rc_code: 'RC-002',
        rc_name: 'Sales Department',
        rc_department: 'Sales',
        rc_status: 'ACTIVE',
      },
    ];

    for (const rc of responsibilityCenters) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT rc_code FROM responsibility_center WHERE rc_code = ?',
        { replacements: [rc.rc_code] }
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('responsibility_center', [rc]);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('responsibility_center', null, {})
  },
}
