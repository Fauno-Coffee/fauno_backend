const ApiError = require('../error/ApiError')
const {Reception, Doctor, Client, Procedure, ClientAbonement, Branch, ReceptionProcedure, Group} = require('../models/models')
const {Note} = require('../models/models')
const {Op} = require("sequelize");
const MailSending = require('../utils/mail')
const axios = require("axios");
const DateFns = require("date-fns");

const env = process.env.NODE_ENV || 'local';
require('dotenv').config({ path: `.env.${env}` });

class ReceptionsController {
    async add(req, res, next) {
        try {
            const {date, time, endTime, clientId, doctorId, procedures, note, branchId, is_widget_appointment, sendEmailFor, polisOMS, polisOMSnumber, is_abonement_reception} = req.body
            const reception = await Reception.create({date, time, endTime, clientId, doctorId, note, branchId, is_widget_appointment, polisOMS: polisOMSnumber, is_abonement_reception})
            const proceduresList = []
            procedures.map(async(procedure) => {
                const procedureId = procedure.id
                proceduresList.push(procedure.name)
                await ReceptionProcedure.create({receptionId: reception.id, procedureId, branchId})
            })

            const client = await Client.findOne({where: {id: clientId, branchId}, include: [{
                    model: ClientAbonement,
                    as: 'activeAbonement',
                    required: false
                }]})
            const branch = await Branch.findOne({where: {id: branchId}})
            const doctor = await Doctor.findOne({where: {id: doctorId}})

            if(is_abonement_reception) {
                await ClientAbonement.update({visits: client.activeAbonement.visits + 1}, {where: {id: client.activeAbonementId}})
            }

            if(client.mail){
                MailSending.NewReceptionMail(`${client.mail}`, `${client.first_name} ${client.middle_name}`, `${branch.name}`, `${branch.city}`, `${branch.street}`, `${doctor.surname} ${doctor.first_name} ${doctor.middle_name}`, proceduresList,`${date}`, `${time}`, `${endTime}`)

                const now_GMT00 = new Date()
                const receptionDateTime_GMT00 = DateFns.subHours(DateFns.parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date()), Number(branch.timezone))

                const now_TIMEZONE = DateFns.addHours(now_GMT00, Number(branch.timezone))
                const receptionDateTime_TIMEZONE = DateFns.addHours(receptionDateTime_GMT00, Number(branch.timezone))

                const hoursToReception = DateFns.differenceInHours(receptionDateTime_TIMEZONE, now_TIMEZONE)
                const emailTime_GMT00 = DateFns.subHours(receptionDateTime_GMT00, sendEmailFor)

                if(hoursToReception > 12) {
                  try {
                    await axios.post(process.env.NOTIFICATIONS_SERVICE_URL, {
                      emailTimeGMT00: emailTime_GMT00,
                      branchTimezone: Number(branch?.timezone),
                      receptionId: reception?.id,

                      clientMail: client?.mail,
                      clientName: `${client?.first_name} ${client?.middle_name}`,
                      company: branch?.name,
                      branchCity: branch?.city,
                      branchAddress: branch?.street,
                      doctorName: `${doctor?.surname} ${doctor?.first_name} ${doctor?.middle_name}`,
                      servicesList: JSON.stringify(proceduresList)|| [],
                      date,
                      time,
                      endTime,
                    })
                  }
                  catch (e) {
                    console.error(e)
                  }
                }
            }
            if(doctor.mail){
                MailSending.NewReceptionMailForDoctor(`${doctor.mail}`, `${doctor.first_name} ${doctor.middle_name}`, `${branch.name}`, `${branch.city}`, `${branch.street}`, `${client.surname} ${client.first_name} ${client.middle_name}`, proceduresList,`${date}`, `${time}`, `${endTime}`)
            }


            return res.json(reception)
        } catch (e) {
           next(ApiError.badRequest(e.message))
        }
    }

    async addGroup(req, res, next) {
        try {
            const {date, time, endTime, groupId, doctorId, procedures, note, branchId, is_widget_appointment, sendEmailFor} = req.body
            const reception = await Reception.create({date, time, endTime, clientId: null, doctorId, note, branchId, is_widget_appointment, groupId})
            const proceduresList = []
            procedures.map(async(procedure) => {
                const procedureId = procedure.id
                proceduresList.push(procedure.name)
                await ReceptionProcedure.create({receptionId: reception.id, procedureId, branchId})
            })

            const group = await Group.findByPk(groupId, {
                include: [
                    {
                        model: Client,
                        through: { attributes: [] },
                    },
                ],
            });
            const branch = await Branch.findOne({where: {id: branchId}})
            const doctor = await Doctor.findOne({where: {id: doctorId}})

            group && group?.clients?.forEach(client => {
                if(client?.mail){
                    MailSending.NewReceptionMail(`${client.mail}`, `${client.first_name} ${client.middle_name}`, `${branch.name}`, `${branch.city}`, `${branch.street}`, `${doctor.surname} ${doctor.first_name} ${doctor.middle_name}`, proceduresList,`${date}`, `${time}`, `${endTime}`)
                }
            });

            if(doctor.mail){
                MailSending.NewReceptionMailForDoctor(`${doctor.mail}`, `${doctor.first_name} ${doctor.middle_name}`, `${branch.name}`, `${branch.city}`, `${branch.street}`, `Группа: ${group?.name}`, proceduresList,`${date}`, `${time}`, `${endTime}`)
              }

            return res.json(reception)
        } catch (e) {
           next(ApiError.badRequest(e.message))
        }
    }

    async getAll(req, res, next) {
        let {page, limit, selectedDoctor, searchDate, branchId} = req.query
        page = page || 1
        limit = limit || 20
        searchDate = searchDate || ""
        let offset = page * limit - limit
        let receptions
        try {
            if(selectedDoctor && !searchDate){
                receptions = await Reception.findAndCountAll({limit, offset, include: [
                        { model: Doctor, where: {id: {[Op.col]: 'doctorId'}, branchId}},
                        { model: Client, where: {id: {[Op.col]: 'clientId'}, branchId}},
                        {
                            model: Group,
                            required: false,
                            where: {id: {[Op.col]: 'groupId'}},
                            include: [
                                {
                                    model: Client,
                                    through: { attributes: [] },
                                },
                            ],
                        },
                        {model: ReceptionProcedure, required: false, attributes: ['id'], where: {receptionId: {[Op.col]: 'reception.id'}, branchId},
                        include: [{model: Procedure, required: false, where: {id: {[Op.col]: 'procedureId'}}}]}
                    ], where: {doctorId: selectedDoctor.id, branchId},
                    order: [['date', 'DESC']]},)
            }
            else if(!selectedDoctor && searchDate){
                receptions = await Reception.findAndCountAll({limit, offset, include: [
                        { model: Doctor, where: {id: {[Op.col]: 'doctorId'}}},
                        { model: Client, where: {id: {[Op.col]: 'clientId'}}},
                        {
                            model: Group,
                            required: false,
                            where: {id: {[Op.col]: 'groupId'}},
                            include: [
                                {
                                    model: Client,
                                    through: { attributes: [] },
                                },
                            ],
                        },
                        {model: ReceptionProcedure, required: false, attributes: ['id'], where: {receptionId: {[Op.col]: 'reception.id'}, branchId},
                        include: [{model: Procedure, required: false, where: {id: {[Op.col]: 'procedureId'}}}]}
                    ], where: {date: searchDate, branchId},
                    order: [['date', 'DESC']]},)
            }
            else if(selectedDoctor &&  searchDate){
                receptions = await Reception.findAndCountAll({limit, offset, include: [
                        { model: Doctor, where: {id: {[Op.col]: 'doctorId'}}},
                        { model: Client, where: {id: {[Op.col]: 'clientId'}}},
                        {
                            model: Group,
                            required: false,
                            where: {id: {[Op.col]: 'groupId'}},
                            include: [
                                {
                                    model: Client,
                                    through: { attributes: [] },
                                },
                            ],
                        },
                        {model: ReceptionProcedure, required: false, attributes: ['id'], where: {receptionId: {[Op.col]: 'reception.id'}, branchId},
                        include: [{model: Procedure, required: false, where: {id: {[Op.col]: 'procedureId'}}}]}
                    ], where: {date: searchDate, doctorId: selectedDoctor.id, branchId},
                    order: [['date', 'DESC']]},)
            }
            else {
                receptions = await Reception.findAndCountAll({
                    limit, offset, include: [
                        {model: Doctor, where: {id: {[Op.col]: 'doctorId'}}},
                        {model: Client, required: false, where: {id: {[Op.col]: 'clientId'}}},
                        {
                            model: Group,
                            required: false,
                            where: {id: {[Op.col]: 'groupId'}},
                            include: [
                                {
                                    model: Client,
                                    through: { attributes: [] },
                                },
                            ],
                        },
                        {model: ReceptionProcedure, required: false, attributes: ['id'], where: {receptionId: {[Op.col]: 'reception.id'}, branchId},
                        include: [{model: Procedure, required: false, where: {id: {[Op.col]: 'procedureId'}}}]}
                    ],
                    where: { branchId },
                    order: [['date', 'DESC']]
                })
            }
            const doctors = await Doctor.findAll({where: {branchId}})
            const procedures = await Procedure.findAll({where: {branchId}})
            return res.json({"receptions": receptions, "doctors": doctors, "procedures": procedures})
        }
        catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async getForClient(req, res) {
        const {branchId} = req.query
        const {id} = req.params
        const reception = await Reception.findAll({include: [
            { model: Doctor, where: {id: {[Op.col]: 'doctorId'}}},
            { model: Client, where: {id: {[Op.col]: 'clientId'}}},
            {model: ReceptionProcedure, required: false, attributes: ['id'], where: {receptionId: {[Op.col]: 'reception.id'}, branchId},
            include: [{model: Procedure, required: false, where: {id: {[Op.col]: 'procedureId'}}}]}
        ],
        where: {clientId: id, branchId}, order: [['date', 'DESC']]})
        return res.json(reception)
    }

    async getOne(req, res) {
        const {branchId} = req.query
        const {id} = req.params
        const reception = await Reception.findOne({where: {id: id, branchId}, include: [
                {model: Doctor, where: {id: {[Op.col]: 'doctorId'}, branchId}},
                {model: Client, where: {id: {[Op.col]: 'clientId'}, branchId}},
                {model: ReceptionProcedure, required: false, attributes: ['id'], where: {receptionId: {[Op.col]: 'reception.id'}, branchId},
                        include: [{model: Procedure, required: false, where: {id: {[Op.col]: 'procedureId'}}}]}
            ]})
        return res.json(reception)
    }

    async update(req, res, next) {
        try {
            const {id} = req.query;
            const {date, time, endTime, clientId, procedures, doctorId, note, branchId, polisOMSnumber} = req.body
            ReceptionProcedure.destroy({where: {receptionId: id, branchId}})
            procedures.map(async(procedure) => {
                const procedureId = procedure.id
                await ReceptionProcedure.create({receptionId: id, procedureId, branchId})
            })
            await Reception.update({date, time, endTime, clientId, doctorId, note, polisOMS: polisOMSnumber}, {where: {id: id, branchId}})
            return res.json("Прием успешно обновлен!")
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async getMonth(req, res, next) {
        try {
            const startDate = new Date()
            const endDate = new Date()

            const {branchId} = req.query;

            const reception = await Reception.findAll({
                where: {
                    date: {
                        [Op.between]: [endDate.setMonth(endDate.getMonth() - 1), startDate]
                    }, branchId },
                    include:[{ model: Doctor, required: true }, { model: Client, required: true }, {model: ReceptionProcedure, required: false, attributes: ['id'], where: {receptionId: {[Op.col]: 'reception.id'}, branchId},
                    include: [{model: Procedure, required: false, where: {id: {[Op.col]: 'procedureId'}}}]}],
                order: [['date', 'DESC']],
            })
            return res.json(reception)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async delete(req, res, next){
        const {id, branchId} = req.query;
        if (!id || !branchId) return next(ApiError.badRequest('Не указан id записи или филиала'))

        try {
            const reception = await Reception.findOne({ where: {id, branchId}})
            await ReceptionProcedure.destroy({where: {receptionId: id, branchId}})
            await Reception.destroy({ where: {id, branchId}})

            if(reception.is_abonement_reception) {
                const client = await Client.findOne({where: {id: reception.clientId}, include: [{
                        model: ClientAbonement,
                        as: 'activeAbonement',
                        required: false
                    }]})
                await ClientAbonement.update({visits: client.activeAbonement.visits - 1}, {where: {id: client.activeAbonementId}})
            }
            return res.json("Deleted successfully");
        }
        catch (e) {
            next(ApiError.internal(e.message))
        }
        try {
            await axios.delete(`${process.env.NOTIFICATIONS_SERVICE_URL}/${id}`)
        } catch (e) {
            console.log(e)
        }
    }
}

module.exports = new ReceptionsController()
