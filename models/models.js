const { sequelize } = require('../db');
const { DataTypes } = require('sequelize');

const User = sequelize.define('user', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: false, allowNull: false, defaultValue: '' },
  mail: { type: DataTypes.STRING, unique: true, allowNull: false },
  phone: { type: DataTypes.STRING, unique: false, allowNull: false, defaultValue: '' },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'WAIT', allowNull: false },
  wrongRecoveryCodeAttempts: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: true },
  recoveryCode: { type: DataTypes.STRING, unique: false, allowNull: true, defaultValue: '' },
});


module.exports = {
  User,
};
