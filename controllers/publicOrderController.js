const ApiError = require('../error/ApiError')
const { s3 } = require('../db');
const sharp = require('sharp');
const {Category, Product, Order, User, OrderProduct} = require('../models/models');
const updateUserCategory = require('../utils/updateUserCategory');
const { Op } = require('sequelize');

class OrderController {
    async create (req, res, next) {
        try {
            const {
                userId, name, phone, mail,
                address, flat, building, floor, intercom,
                comment, products
            } = req.body;

            if (!userId || !name||!phone||!mail||!address||!products?.length){
                return res.status(500).json({ error: 'Недостаточно данных' });
            }
            
            const user = await User.findByPk(userId)
            
            if (!user){
                return res.status(500).json({ error: 'Пользователь не найден' });
            }

            const dbProds = await Product.findAll({ where: { id: {[Op.in]: products.map(p=>p.productId)} } });
            
            let sum = 0;
            products.forEach(({productId,count}) => {
                const prod = dbProds.find(p=>p.id===productId);
                sum += prod.price * count;
            });

            if(user.discount && user.discount > 0){
                sum = sum * (1 - user.discount / 100)
            }

            const existingOrder = await Order.findOne({where: {state: "pending", userId}})
            if(existingOrder){
                await Order.destroy({where: {id: existingOrder.id}})
            }

            const order = await Order.create({
                userId, state: 'pending', sum, name, phone, mail,
                address, flat, building, floor, intercom, comment
            });

            await OrderProduct.bulkCreate(
                products.map(p=>({ orderId: order.id, productId: p.productId, count: p.count }))
            );

            return res.status(200).json({
                invoiceId: order.id,
                amount: sum,
                currency: 'RUB'
            });
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new OrderController()