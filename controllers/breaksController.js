const ApiError = require('../error/ApiError')
const {Break} = require('../models/models')

class ReceptionsController {
    async add(req, res, next) {
        try {
            const {doctorId, date, time, endTime, branchId} = req.body
            const breakEntity = await Break.create({doctorId, date, time, endTime, branchId, isBreak: true, isDayOff: false})
            return res.json(breakEntity)
        } catch (e) {
           next(ApiError.badRequest(e.message))
        }
    }

    async addDayOff(req, res, next) {
        try {
            const {doctorId, date, time, endTime, branchId} = req.body
            const breakEntity = await Break.create({doctorId, date, time, endTime, branchId, isBreak: true, isDayOff: true})
            return res.json(breakEntity)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async delete(req, res, next){
        try {
            const {id} = req.query;
            const breakEntity = await Break.findByPk(id)
            if (!breakEntity) {
                return next(ApiError.badRequest('Ошибка при отмене перерыва'))
            }
            await breakEntity.destroy()
            res.status(200).json({message: 'Перерыв успешно отменен'})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async deleteAll(req, res, next){
        try {
            const {doctorId, date, branchId} = req.body
            await Break.destroy({
                where: {
                    doctorId: doctorId,
                    branchId: branchId,
                    date: date
                }
            });
            res.status(200).json({message: 'Перерывы успешно отменены'})
        } catch (error) {
            return next(ApiError.badRequest('Ошибка при отмене перерывов'))
        }
    }
}

module.exports = new ReceptionsController()