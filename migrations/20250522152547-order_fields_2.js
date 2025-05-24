'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'deliveryName', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('orders', 'deliveryPrice', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
    await queryInterface.addColumn('orders', 'deliveryCdekId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'deliveryName');
    await queryInterface.removeColumn('orders', 'deliveryPrice');
    await queryInterface.removeColumn('orders', 'deliveryCdekId');
  }
};
