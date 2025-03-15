const ApiError = require('../error/ApiError')
const jwt = require('jsonwebtoken')
const {User, Order, CartProduct, Product} = require('../models/models')
const Op = require('sequelize').Op;
const PNF = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

const generateJwt = (id, name, mail, phone, role) => {
    return jwt.sign({id, name, mail, phone, role}, process.env.SECRET_KEY,{expiresIn: '72h'})
}

const getMinutesBetweenDates = (startDate, endDate) => {
    const diff = endDate.getTime() - startDate.getTime();
    return (diff / 60000);
}
class UsersController {
    async login(req, res, next) {
        const {phone, session} = req.body
        
        if(!phoneUtil.isValidNumberForRegion(phoneUtil.parse(phone, 'RU'), 'RU')){
            return next(ApiError.internal('Неверный формат номера'))
        }
        
        const formattedPhone = phoneUtil.format(phone, PNF.E164)
        
        const user = await User.findOrCreate({where: {phone: formattedPhone}})
        if(session){
            await CartProduct.update({userId: user.id}, {where: {session, userId: null}})
        }
        
        codeDiff = getMinutesBetweenDates(user.prevCodeDatetime, new Date())
        
        if(user.prevCodeDatetime && getMinutesBetweenDates < 1.5){
            return next(ApiError.internal(`Подождите ${codeDiff} минут`))
        }

        return res.json(formattedPhone)
    }
 
    async check(req, res, next) {
        try {
            const user = await User.findOne({where: {id: req.user.id}})

            const token = generateJwt(user.id, user.name, user.mail, user.phone, user.role)
            return res.json({token})
            
        } catch (e) {
            return next(ApiError.badRequest(e.message))
        }
    }
    
    async fetch(req, res, next) {
        try {
            const { id } = req.params;
            
            if(id != req.user.id){
                return next(ApiError.internal(`Ошибка доступа`))
            }

            const user = await User.findByPk(id);

            return res.json(user);
            
        } catch (e) {
            return next(ApiError.badRequest(e.message))
        }
    }

    async fetchOrders(req, res, next) {
        try {
            const { id } = req.body;

            if(id != req.user.id){
                return next(ApiError.internal(`Ошибка доступа`))
            }

            const orders = await Order.findAll({
                where: {userId: id},
                include: [{model: Product, required: true}]
            });

            return res.json(orders);
        } catch (e) {
            return next(ApiError.badRequest(e.message))
        }
    }
    
    async fetchCart(req, res, next) {
        try {
            const { id, session } = req.body;

            const cartProducts = await CartProduct.findAll({
                where: {[Op.or]: [{userId: id}, {session}]},
                include: [{model: Product, required: true}]
            });

            return res.json(cartProducts);
            
        } catch (e) {
            return next(ApiError.badRequest(e.message))
        }
    }
    
    async plusCart(req, res, next) {
        try {
            const { id, session, productId } = req.body;

            const product = await Product.findByPk(productId)

            if(!product){
                return next(ApiError.internal('Товар не найден'))
            }

            const cartProduct = await CartProduct.findOne({
                where: {[Op.or]: [{userId: id}, {session}], productId}
            });

            if(cartProduct){
                await cartProduct.increment('count')
            } else {
                await CartProduct.create({userId: id, session, productId, count: 1})
            }

            return res.json("success");
        } catch (e) {
            return next(ApiError.badRequest(e.message))
        }
    }
    
    async minusCart(req, res, next) {
        try {
            const { id, session, productId } = req.body;

            const product = await Product.findByPk(productId)

            if(!product){
                return next(ApiError.internal('Товар не найден'))
            }

            const cartProduct = await CartProduct.findOne({
                where: {[Op.or]: [{userId: id}, {session}], productId}
            });

            if(!cartProduct){
                return next(ApiError.internal('Товара нет в корзине'))
            }

            if(cartProduct.count === 1){
                await cartProduct.destroy();
            } else {
                await cartProduct.decrement('count')
            }

            return res.json("success");
        } catch (e) {
            return next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new UsersController()