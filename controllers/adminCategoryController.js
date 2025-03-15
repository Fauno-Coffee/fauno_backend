const ApiError = require('../error/ApiError')
const {User, Category, Product} = require('../models/models')

class CategoryController {
    async fetch(req, res, next) {
        try {
            const categories = await Category.findAll({order: [['name', 'ASC']]})
            return res.json(categories)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async fetchOne(req, res, next) {
        try {
            const { id } = req.params;
            const category = await Category.findByPk(id)
            return res.json(category)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async create(req, res, next) {
        try {
            const {name} = req.body
            console.log(name)
            const category = await Category.create({name})
            return res.json(category)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    async update(req, res, next) {
        try {
            const {id} = req.query;
            const {name} = req.body
            const category = await Category.update({name}, {where: {id}, returning: true})
            return res.json(category[1][0])
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async delete (req, res, next) {
        try {
            let {id} = req.query;
            Category.update({isDeleted: true}, {where: {id}})
            return res.json("Deleted successfully");
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new CategoryController()