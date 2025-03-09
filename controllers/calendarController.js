const ApiError = require('../error/ApiError')
const {Doctor, Procedure, Reception, Client, ReceptionProcedure, Schedule, Break, Group} = require('../models/models')
const {Op} = require("sequelize");

class CalendarController {

    async list(req, res, next) {
        let {page, limit, date, branchId} = req.query
        page = page || 1
        limit = limit || 20
        let offset = page * limit - limit
        try {
            const doctors = await Doctor.findAll({where: {branchId}, include: [{model: Schedule, required: false, where: {doctorId: {[Op.col]: 'doctor.id'}}}], order: [['surname', 'ASC']]})
            const calendar = await Promise.all(doctors.map(async (doctor) => {
                const receptions = await Reception.findAll({
                    include: [
                        { model: Client },
                        {
                            model: Group,
                            required: false,
                            include: [
                                {
                                    model: Client,
                                    through: { attributes: [] },
                                },
                            ],
                        },
                        {
                            model: ReceptionProcedure,
                            required: false,
                            where: {receptionId: {[Op.col]: 'reception.id'}, branchId}, 
                            include: [
                                {
                                    model: Procedure,
                                    required: false,
                                    where: {id: {[Op.col]: 'procedureId'}}
                                }
                            ]
                        }
                    ], 
                    where: {date, doctorId: doctor.id, branchId}})

                const breaks = await Break.findAll({where: {date, doctorId: doctor.id, branchId}})

                const combinedReceptions = receptions.concat(breaks);

                combinedReceptions.sort((a, b) => {
                    return a.time.localeCompare(b.time);
                });

                return {
                    'doctor': doctor,
                    'receptions': combinedReceptions,
                }
            }))
            const procedures = await Procedure.findAll({where: {branchId}})
            return res.json({"calendar": calendar, "procedures": procedures})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new CalendarController()