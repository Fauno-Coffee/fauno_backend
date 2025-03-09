const ApiError = require('../error/ApiError')
const {Procedure, Doctor, Client, DoctorProcedure, ServicesGroup} = require('../models/models')

class ProceduresController {

    async add(req, res, next) {
        const {name, price, duration, is_online_appointment, branchId, groupToAdd = null} = req.body
        try {
            const procedure = await Procedure.create({name, price, duration, is_online_appointment, branchId, groupId: groupToAdd})
            return res.json(procedure)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async createGroup(req, res, next) {
        const {name, services, branchId} = req.body
        try {
            if(!name){
                return next(
                    ApiError.badRequest("Не переданы необходимые параметры")
                );
            }
            const group = await ServicesGroup.create({name, branchId})
            if(services){
                services.map(async(service) => {
                    await Procedure.update({groupId: group.id}, {where: {id: service.id}})
                })
            }
            return res.json(group)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async updateGroup(req, res, next) {
        const {id, name, services, branchId} = req.body
        try {
            if(!name || !id || !branchId){
                return next(
                    ApiError.badRequest("Не переданы необходимые параметры")
                );
            }
            await Procedure.update({groupId: null}, {where: {groupId: id, branchId}})
            const group = await ServicesGroup.update({name}, {where: {id}})
            if(services){
                services.map(async(service) => {
                    await Procedure.update({groupId: id}, {where: {id: service.id}})
                })
            }
            return res.json('success')
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async deleteGroup(req, res, next) {
        const {id, branchId} = req.query
        try {
            if(!id || !branchId){
                return next(
                    ApiError.badRequest("Не переданы необходимые параметры")
                );
            }
            await Procedure.update({groupId: null}, {where: {groupId: id, branchId}})
            await ServicesGroup.destroy({where: {id, branchId}})
            return res.json('success')
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async list(req, res, next) {
        let {page, limit, branchId} = req.query
        page = page || 1
        limit = limit || 20
        let offset = page * limit - limit
        try {
            const procedures = await Procedure.findAndCountAll({limit, offset, where: { branchId }, order: [['name', 'ASC']]})
            return res.json(procedures)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async move(req, res, next) {
        let {service_id, group_id} = req.body
        try {
            if(!service_id){
                return next(
                    ApiError.badRequest("Не переданы необходимые параметры")
                );
            }
            const service = await Procedure.findByPk(service_id)
            if(!service){
                return next(
                    ApiError.badRequest("Услуга не найдена")
                );
            }

            service.groupId = group_id
            await service.save()

            return res.json(service)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }



    async groupedServices(req, res, next) {
        let { branchId } = req.query;
    
        try {
            // Получаем услуги без группы
            const ungroupedServices = await Procedure.findAll({
                where: {
                    branchId,
                    groupId: null
                },
                order: [['name', 'ASC']]
            });
    
            // Получаем группы с вложенными услугами
            const groups = await ServicesGroup.findAll({
                where: {
                    branchId
                },
                include: [{
                    model: Procedure,
                    where: { branchId },
                    required: false
                }],
                order: [['name', 'ASC']]
            });
    
            return res.json({ ungroupedServices, groups });
        } catch (e) {
            next(ApiError.badRequest(e.message));
        }
    }

    async update(req, res, next) {
        try {
            const {id} = req.query;
            const {name, price, duration, is_online_appointment, branchId} = req.body
            await Procedure.update({name: name, price, duration, is_online_appointment}, {where: {id, branchId}})
            return res.json("Процедура обновлена успешно")
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async delete(req, res, next) {
        try {
            const {id, branchId} = req.query;
            DoctorProcedure.destroy({
                where: {
                    procedureId: id,
                    branchId
                }
            })
            Procedure.destroy({
                where: {
                    id: id,
                    branchId
                }
            }).then(function(rowDeleted){
                if(rowDeleted === 1){
                    return res.json("Процедура успешно удалена!");
                }
            }, function(err){
                next(ApiError.badRequest(err))
            });
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new ProceduresController()