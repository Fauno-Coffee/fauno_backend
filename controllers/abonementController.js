const ApiError = require('../error/ApiError')
const {AbonementType, ClientAbonement, Client, AbonementTypeProcedure, Procedure, ClientAbonementProcedure} = require('../models/models')

class ReceptionsController {
    
    async getAllTypesByBranch(req, res, next) {
        try {
            const {branchId} = req.params;
            if (!branchId)
                return next(ApiError.badRequest('Укажите филиал'))

            let {page = 1, limit = 20} = req.query;
            let offset = page * limit - limit;
            const abonementTypes = await AbonementType.findAndCountAll({
                limit,
                offset,
                where: {branchId},
                include: [{model: AbonementTypeProcedure, required: false, include: [{model: Procedure, required: false}]}]
            })
            return res.json(abonementTypes);
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async getOneType(req, res, next) {
        try {
            const {abonementTypeId} = req.params;
            if (!abonementTypeId)
                return next(ApiError.badRequest('Укажите id абонемента'))
            const abonementType = await AbonementType.findByPk(abonementTypeId, {include: [{model: AbonementTypeProcedure, required: false, include: [{model: Procedure, required: false}]}]})
            return res.json(abonementType)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async createType(req, res, next) {
        try {
            const {branchId} = req.params;
            const {name, price, visitsLimit, daysLimit, isWidgetBuy, selectedServices} = req.body;

            if (!branchId)
                return next(ApiError.badRequest('Укажите филиал'))
            if (!name || !price)
                return next(ApiError.badRequest('Укажите название и цену'))
            if (!visitsLimit && !daysLimit)
                return next(ApiError.badRequest('Укажите либо количество посещений, либо время действия абонемента'))

            const abonementType = await AbonementType.create({branchId, name, price, visitsLimit, daysLimit, isWidgetBuy})

            selectedServices.map(async(service) => {
                await AbonementTypeProcedure.create({procedureId: service.id, abonementTypeId: abonementType.id, branchId})
            })

            return res.status(201).json(abonementType)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async editType(req, res, next) {
        try {
            const {abonementTypeId} = req.params;
            const {name, price, visitsLimit, daysLimit, isWidgetBuy, selectedServices, branchId} = req.body;

            if (!abonementTypeId)
                return next(ApiError.badRequest('Укажите id абонемента'))
            if (!name || !price)
                return next(ApiError.badRequest('Укажите название и цену'))
            if (!visitsLimit && !daysLimit)
                return next(ApiError.badRequest('Укажите либо количество посещений, либо время действия абонемента'))

            const [numberOfAffectedRows, [updatedAbonementType]] = await AbonementType.update({
                name,
                price,
                visitsLimit,
                daysLimit,
                isWidgetBuy
            }, {where: {id: abonementTypeId}, returning: true})

            await AbonementTypeProcedure.destroy({where: {abonementTypeId, branchId}})
            selectedServices.map(async(service) => {
                await AbonementTypeProcedure.create({procedureId: service.id, abonementTypeId, branchId})
            })

            return res.json(updatedAbonementType.dataValues)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async deleteType(req, res, next) {
        try {
            const {abonementTypeId} = req.params;

            if (!abonementTypeId)
                return next(ApiError.badRequest('Укажите id абонемента'))

            const abonementType = await AbonementType.findByPk(abonementTypeId)

            if (!abonementType)
                return next(ApiError.badRequest('Абонемент не найден!'))

            await abonementType.destroy()
            res.status(200).json({message: 'Абонемент успешно удалён'})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }


    async getOne(req, res, next) {
        try {
            const {abonementId} = req.params;

            if (!abonementId)
                return next(ApiError.badRequest('Укажите id абонемента'))

            const abonement = await ClientAbonement.findByPk(abonementId)
            return res.json(abonement)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async getAllByBranch(req, res, next) {
        try {
            const {branchId} = req.params;
            if (!branchId)
                return next(ApiError.badRequest('Укажите филиал'))

            let {page = 1, limit = 20} = req.query;
            let offset = page * limit - limit;
            const abonements = await ClientAbonement.findAndCountAll({
                limit,
                offset,
                where: {branchId},
                include: [{model: Client, required: false}]
            })
            return res.json(abonements);
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async getAllByClient(req, res, next) {
        try {
            const {clientId} = req.params;

            if (!clientId)
                return next(ApiError.badRequest('Укажите id клиента'))

            const abonements = await ClientAbonement.findAll({where: clientId})
            return res.json(abonements)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async pinToClient(req, res, next) {
        try {
            const {clientId} = req.params;
            const {
                name,
                price,
                visitsLimit,
                visits = 0,
                expirationDate,
                status = 'active',
                selectedServices,
                branchId
            } = req.body;

            if (!clientId)
                return next(ApiError.badRequest('Укажите id клиента'))

            const client = await Client.findByPk(clientId)

            if(!client){
                return next(ApiError.badRequest('Клиент не найден'))
            }

            const clientAbonement = await ClientAbonement.create({
                clientId,
                name,
                price,
                visitsLimit,
                visits,
                expirationDate,
                status,
                branchId
            })

            if(client.activeAbonementId){
                await ClientAbonement.update({status: "expired"}, {where: {id: client.activeAbonementId}})
            }

            client.activeAbonementId = clientAbonement.id
            await client.save()

            selectedServices.map(async(service) => {
                await ClientAbonementProcedure.create({procedureId: service.id, clientAbonementId: clientAbonement.id, branchId})
            })

            return res.status(201).json(clientAbonement)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async edit(req, res, next) {
        try {
            const {abonementId} = req.params;
            const {name, price, visitsLimit, visits = 0, expirationDate, selectedServices, branchId} = req.body;

            if (!abonementId)
                return next(ApiError.badRequest('Укажите id абонемента'))
            if (!name || !price)
                return next(ApiError.badRequest('Укажите название и цену'))
            if (!visitsLimit && !expirationDate)
                return next(ApiError.badRequest('Укажите либо количество посещений, либо дату сгорания абонемента'))

            const [numberOfAffectedRows, [updatedAbonement]] = await ClientAbonement.update({
                name, price, visitsLimit, visits, expirationDate
            }, {where: {id: abonementId}, returning: true})

            await ClientAbonementProcedure.destroy({where: {clientAbonementId: abonementId, branchId}})
            
            selectedServices.map(async(service) => {
                await ClientAbonementProcedure.create({procedureId: service.id, clientAbonementId: updatedAbonement.id, branchId})
            })

            return res.json(updatedAbonement.dataValues)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async delete(req, res, next) {
        try {
            const {abonementId} = req.params;

            if (!abonementId)
                return next(ApiError.badRequest('Укажите id абонемента'))

            const abonement = await ClientAbonement.findByPk(abonementId)

            if (!abonement)
                return next(ApiError.badRequest('Абонемент не найден!'))

            await abonement.destroy()
            res.status(200).json({message: 'Абонемент успешно удалён'})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async changeStatus(req, res, next) {
        try {
            const {clientId} = req.params;
            const {status} = req.body; // active, inactive, expired, withdrawn

            if (!clientId)
                return next(ApiError.badRequest('Укажите id клиента'))

            const abonement = await ClientAbonement.findOne({where: {clientId,}})

            if (!abonement)
                return next(ApiError.badRequest('Абонемент не найден!'))

            abonement.status = status
            await abonement.save()
            res.status(200).json({message: 'Статус абонемента успешно изменен'})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async changeVisit(req, res, next) {
        try {
            const {clientId} = req.params;
            const {increase} = req.body;

            if (!clientId)
                return next(ApiError.badRequest('Укажите id клиента'))

            const client = await Client.findOne({
                where: {id: clientId},
                include: [{
                    model: ClientAbonement,
                    as: 'activeAbonement',
                    required: false
                }]
            });

            if (!client || !client.activeAbonement)
                return next(ApiError.badRequest('Активный абонемент не найден для клиента'));

            let currentVisits = client.activeAbonement.visits;
            if (increase) currentVisits += 1;
            else currentVisits = Math.max(currentVisits - 1, 0);

            await client.activeAbonement.update({visits: currentVisits});

            return res.json({message: 'Количество визитов обновлено успешно'});
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

}

module.exports = new ReceptionsController()
