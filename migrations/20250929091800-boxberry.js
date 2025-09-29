'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'boxberryCityId', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: '',
    });
    await queryInterface.addColumn('orders', 'boxberryOfficeId', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: '',
    });
    await queryInterface.addColumn('orders', 'boxberryOfficeName', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: '',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'boxberryCityId');
    await queryInterface.removeColumn('orders', 'boxberryOfficeId');
    await queryInterface.removeColumn('orders', 'boxberryOfficeName');
  }
};
