const ApiError = require('../error/ApiError')
const {Doctor, Procedure, Position, DoctorProcedure, Branch, Schedule, Tenant, Payment} = require('../models/models')
const {Op} = require("sequelize");
class DoctorsController {
    async add(req, res, next) {
        try {
            const {surname, first_name, middle_name, positionId, phone, mail, birth, employeeServices, branchId} = req.body

            const { user: requestedUser } = req;
            const tenant = await Tenant.findOne({ where: { id: requestedUser?.tenantId } });

            if(tenant?.employeesMaxCount <= tenant?.employeesCount && tenant?.subscribtionType === 'subscribe')
              return next(ApiError.badRequest('У Вас добавлено максимальное количество сотрудников.'))

            const doctor = await Doctor.create({surname: surname, first_name: first_name, middle_name: middle_name, positionId: positionId, phone: phone, mail: mail, birth: birth, branchId: branchId})
            if(employeeServices && employeeServices.length > 0){
                employeeServices.map(async (es) => {
                    await DoctorProcedure.create({branchId, doctorId: doctor.id, procedureId: es.id})
                })
            }
            const branch = await Branch.findOne({where: {id: branchId}})
            const schedule = await Schedule.create({
                doctorId: doctor.id,
                isMon: branch.isMon,
                isTue: branch.isTue,
                isWed: branch.isWed,
                isThu: branch.isThu,
                isFri: branch.isFri,
                isSat: branch.isSat,
                isSun: branch.isSun,
                monFrom: branch.monFrom,
                monTo: branch.monTo,
                tueFrom: branch.tueFrom,
                tueTo: branch.tueTo,
                wedFrom: branch.wedFrom,
                wedTo: branch.wedTo,
                thuFrom: branch.thuFrom,
                thuTo: branch.thuTo,
                friFrom: branch.friFrom,
                friTo: branch.friTo,
                satFrom: branch.satFrom,
                satTo: branch.satTo,
                sunFrom: branch.sunFrom,
                sunTo: branch.sunTo,
                branchId: branchId})
            return res.json({doctor})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async update(req, res, next) {
        try {
            const {id} = req.query;
            const {surname, first_name, middle_name, positionId, birth, phone, mail, employeeServices, branchId} = req.body
            const doctor = await Doctor.update({surname: surname, first_name: first_name, middle_name: middle_name, positionId: positionId, birth: birth, phone: phone, mail: mail, branchId: branchId}, {where: {id: id, branchId}})

            const isDoctorProcedure = await DoctorProcedure.findOne({where: {doctorId: id, branchId}})
            if(isDoctorProcedure){
                await DoctorProcedure.destroy({where: {doctorId: id, branchId}})
            }

            if(employeeServices && employeeServices.length > 0){
                employeeServices.map(async (es) => {
                    await DoctorProcedure.create({branchId, doctorId: id, procedureId: es.id})
                })
            }

            return res.json({doctor})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async updateSchedule(req, res, next) {
        try {
            const {id} = req.query;
            const {isMon, monFrom, monTo, isTue, tueFrom, tueTo, isWed, wedFrom, wedTo, isThu, thuFrom, thuTo, isFri, friFrom, friTo, isSat, satFrom, satTo, isSun, sunFrom, sunTo, branchId} = req.body;
            const schedule = await Schedule.findOne({where: {doctorId: id, branchId}})
            if(!schedule) {
                try {
                    await Schedule.create({doctorId: id, isMon, monFrom, monTo, isTue, tueFrom, tueTo, isWed, wedFrom, wedTo, isThu, thuFrom, thuTo, isFri, friFrom, friTo, isSat, satFrom, satTo, isSun, sunFrom, sunTo, branchId})
                } catch (e) {
                    return(
                        next(ApiError.badRequest(e.message))
                    )
                }
            } else {
                await Schedule.update({isMon, monFrom, monTo, isTue, tueFrom, tueTo, isWed, wedFrom, wedTo, isThu, thuFrom, thuTo, isFri, friFrom, friTo, isSat, satFrom, satTo, isSun, sunFrom, sunTo}, {where: {doctorId: id, branchId}})
            }
            return res.json("Распиание обновлено успешно!")
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
            const doctors = await Doctor.findAndCountAll({limit, offset, include: [
                        {model: DoctorProcedure, required: false, where: {doctorId: {[Op.col]: 'doctor.id'}, branchId}, attributes: ['procedureId'],
                            include: [{model: Procedure}]},
                        {model: Schedule, required: false, where: {doctorId: {[Op.col]: 'doctor.id'}, branchId}},
                        {model: Position, where: {id: {[Op.col]: 'positionId'}, branchId}}],
                        where: { branchId }, order: [['surname', 'ASC']]})

            return res.json({doctors})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async delete(req, res, next){
        try {
            const {id, branchId} = req.query;
            DoctorProcedure.destroy({
                where: {
                    doctorId: id,
                    branchId
                }
            })
            Doctor.destroy({
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

module.exports = new DoctorsController()