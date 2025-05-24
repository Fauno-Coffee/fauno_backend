'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'city', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('orders', 'cdekCityId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('orders', 'officeName', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('orders', 'cdekOfficeId', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('orders', 'type', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'city');
    await queryInterface.removeColumn('orders', 'cdekCityId');
    await queryInterface.removeColumn('orders', 'officeName');
    await queryInterface.removeColumn('orders', 'cdekOfficeId');
    await queryInterface.removeColumn('orders', 'type');
  }
};
