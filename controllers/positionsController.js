const ApiError = require('../error/ApiError')
const {Position, Procedure} = require('../models/models')

class PositionsController {

    async add(req, res, next) {
        try {
            const {name, branchId} = req.body
            const position = await Position.create({name: name, branchId: branchId})
            return res.json({position})
        } catch (e) {
            next(ApiError.badRequest(e.message))   
        } 
    }

    async update(req, res, next) {
        try {
            const {id} = req.query;
            const {name, branchId} = req.body
            await Position.update({name: name, branchId: branchId}, {where: {id, branchId}})
            return res.json("Должность изменена успешно!")
        } catch (e) {
            next(ApiError.badRequest(e.message))   
        } 
    }

    async getAll(req, res, next) {
        let {page, limit, branchId} = req.query
        page = page || 1
        limit = limit || 20
        let offset = page * limit - limit
        try {
            const positions = await Position.findAndCountAll({limit, offset, where: { branchId }, order: [['name', 'ASC']]})
            const services = await Procedure.findAll({where: {branchId}})
            positions.services = services
            return res.json({positions})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async getOne(req, res, next){
        let {id, branchId} = req.query
        try {
            const position = await Position.findOne({where: {id, branchId}})
            return res.json({position})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async delete(req, res, next){
        try {
            const {id, branchId} = req.query;
            Position.destroy({
                where: {
                    id: id,
                    branchId
                }
            }).then(function(rowDeleted){
                if(rowDeleted === 1){
                    return res.json("Deleted successfully");
                }
            }, function(err){
                next(ApiError.badRequest(err))
            });
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new PositionsController()