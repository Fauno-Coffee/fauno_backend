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

const Category = sequelize.define('category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: false, allowNull: false, defaultValue: '' },
});

const Product = sequelize.define('product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: false, allowNull: false, defaultValue: '' },
  description: { type: DataTypes.TEXT, unique: false, allowNull: false, defaultValue: '' },
  link: { type: DataTypes.STRING, unique: true, allowNull: false, defaultValue: '' },
  imageUrl: { type: DataTypes.STRING, unique: false, allowNull: false, defaultValue: '' },
  previewUrl: { type: DataTypes.STRING, unique: false, allowNull: false, defaultValue: '' },
  price: { type: DataTypes.FLOAT, unique: false, allowNull: false, defaultValue: 0 },
  old_price: { type: DataTypes.FLOAT, unique: false, allowNull: false, defaultValue: 0 },
  categoryId: { type: DataTypes.INTEGER, unique: false, allowNull: true },
  
  about: { type: DataTypes.TEXT, unique: false, allowNull: false, defaultValue: '' },
  
  weight: { type: DataTypes.INTEGER, unique: false, allowNull: true },
  variation: {type: DataTypes.ARRAY(DataTypes.STRING)},
  processing: {type: DataTypes.ARRAY(DataTypes.STRING)},
  fermentation: {type: DataTypes.ARRAY(DataTypes.STRING)},
  region: { type: DataTypes.STRING, allowNull: true },
  farmer: { type: DataTypes.STRING, allowNull: true },
  keyDescriptor: { type: DataTypes.STRING, allowNull: true },
});

Product.belongsTo(Category)
Category.hasMany(Product);


module.exports = {
  User,
  Category,
  Product
};
