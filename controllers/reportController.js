const ApiError = require('../error/ApiError')
const {Reception, Doctor, Client, Procedure, User, Branch, ReceptionProcedure} = require('../models/models')
const {Op} = require("sequelize");
const moment = require("moment");
const calculateSum = require('../utils/calculateSum');

class ReportController {
    async getMainReport(req, res, next) {
        try {
            const {branchId, startDate, endDate} = req.query;

            const branch = await Branch.findOne({
                where: {id: branchId},
            });
         
            if(!branch){
                return next(
                    ApiError.badRequest("01120003 | Произошла ошибка. Такого филиала не существует.")
                );
            }

            if(!startDate && !endDate){
                return next(
                    ApiError.badRequest("Произошла ошибка. Неверный временной диапазон.")
                );
            }

            const firstDate = startDate
            const secondDate = endDate

            const fromDate = moment(firstDate, 'YYYY-MM-DD')
            const toDate = moment(secondDate, 'YYYY-MM-DD')

            const days_count = toDate.diff(fromDate, "days")

            
            const previous_period_from = moment(fromDate).subtract(days_count, 'days')

            let charts_data = {
                specs_data: {
                    appointments_count: 0,
                    previous_period_appointments_count: 0,
                    periods_appointments_count_diff: 0.0,
                    revenue: 0,
                    previous_period_revenue: 0,
                    periods_revenue_diff: 0.0,
                    new_clients: 0,
                    previous_period_new_clients: 0,
                    periods_new_clients_diff: 0.0,
                    widget_appointments_count: 0,
                    previous_period_widget_appointments_count: 0,
                    periods_widget_appointments_count_diff: 0.0,
                    widget_appointments_percent: 0.0,
                    previous_period_widget_appointments_percent: 0,
                    periods_widget_appointments_percent_diff: 0.0,
                }, 
                chart_data: [],
                days_selected: days_count
            }

            for(let i = 0; i <= days_count; i++){
                let search_date = moment(fromDate).add(i, 'days')

                const records = await Reception.findAll({   
                    where: { 
                        date: moment(search_date).format('YYYY-MM-DD'), 
                        branchId
                    },
                    include: [
                        { model: Doctor, required: true }, 
                        { model: Client, required: true }, 
                        { model: ReceptionProcedure, required: false, attributes: ['id'], 
                            where: {receptionId: {[Op.col]: 'reception.id'}, branchId}, 
                            include: [
                                {model: Procedure, required: false, attributes: ['name', 'price', 'duration'], where: {id: {[Op.col]: 'procedureId'}, branchId}}
                            ]
                        }
                    ]
                })

                records.date = moment(search_date).format('YYYY.MM.DD');
                const day_total = records.map((record) => {
                    if(record.receptionProcedures){
                        return record.receptionProcedures.map(item => item.procedure.price)
                        .reduce((prev, curr) => prev + curr, 0)
                    } else {
                        return(0)
                    }
                })
                .reduce((prev, curr) => prev + curr, 0)

                records.total = day_total

                charts_data.specs_data.revenue += day_total,
                charts_data.specs_data.appointments_count += records.length
                charts_data.specs_data.widget_appointments_count += records.filter(x => x.is_widget_appointment === true).length

                charts_data.chart_data.push({date: records.date, count: records.length, total: records.total})
            }

            charts_data.specs_data.widget_appointments_percent = (charts_data.specs_data.widget_appointments_count / charts_data.specs_data.appointments_count * 100).toFixed(2);

            for(let i = 0; i <= days_count; i++){
                let search_date = moment(previous_period_from).add(i, 'days')

                const records = await Reception.findAll({   
                    where: { 
                        date: moment(search_date).format('YYYY-MM-DD'), 
                        branchId
                    },
                    include: [
                        { model: Doctor, required: true }, 
                        { model: Client, required: true }, 
                        { model: ReceptionProcedure, required: false, attributes: ['id'], 
                            where: {receptionId: {[Op.col]: 'reception.id'}, branchId}, 
                            include: [
                                {model: Procedure, required: false, attributes: ['name', 'price', 'duration'], where: {id: {[Op.col]: 'procedureId'}, branchId}}
                            ]
                        }
                    ]
                })

                const day_total = records.map((record) => {
                    if(record.receptionProcedures){
                        return record.receptionProcedures.map(item => item.procedure.price)
                        .reduce((prev, curr) => prev + curr, 0)
                    } else {
                        return(0)
                    }
                })
                .reduce((prev, curr) => prev + curr, 0)

                records.total = day_total

                charts_data.specs_data.previous_period_revenue += day_total,
                charts_data.specs_data.previous_period_appointments_count += records.length
                charts_data.specs_data.previous_period_widget_appointments_count += records.filter(x => x.is_widget_appointment === true).length

            }

            charts_data.specs_data.previous_period_widget_appointments_percent = 
                (charts_data.specs_data.previous_period_widget_appointments_count 
                / charts_data.specs_data.previous_period_appointments_count * 100).toFixed(2);

            if(charts_data.specs_data.appointments_count > 0
                && charts_data.specs_data.previous_period_appointments_count > 0){
                charts_data.specs_data.periods_appointments_count_diff = 
                ((charts_data.specs_data.appointments_count
                - charts_data.specs_data.previous_period_appointments_count)
                / charts_data.specs_data.previous_period_appointments_count * 100).toFixed(0)
            }

            if(charts_data.specs_data.revenue > 0
                && charts_data.specs_data.previous_period_revenue > 0){
                charts_data.specs_data.periods_revenue_diff = 
                ((charts_data.specs_data.revenue
                - charts_data.specs_data.previous_period_revenue)
                / charts_data.specs_data.previous_period_revenue * 100).toFixed(0)
            }

            if(charts_data.specs_data.widget_appointments_percent > 0
                &&  charts_data.specs_data.previous_period_widget_appointments_percent > 0){
                charts_data.specs_data.periods_widget_appointments_percent_diff = 
                ((charts_data.specs_data.widget_appointments_percent
                - charts_data.specs_data.previous_period_widget_appointments_percent)
                / charts_data.specs_data.previous_period_widget_appointments_percent * 100).toFixed(0)
            }

            const new_clients =  await Client.count({
                where: {
                    createdAt: {
                        [Op.between]: [fromDate, toDate]
                    }, branchId }
            })

            const previous_period_new_clients =  await Client.count({
                where: {
                    createdAt: {
                        [Op.between]: [fromDate, toDate]
                    }, branchId }
            })

            charts_data.specs_data.new_clients = new_clients
            charts_data.specs_data.previous_period_new_clients = previous_period_new_clients

            if(charts_data.specs_data.new_clients > 0
                &&  charts_data.specs_data.previous_period_new_clients > 0){
                charts_data.specs_data.periods_new_clients_diff = 
                ((charts_data.specs_data.new_clients
                - charts_data.specs_data.previous_period_new_clients)
                / charts_data.specs_data.previous_period_new_clients * 100).toFixed(0)
            }

            const period_appointments_services = await ReceptionProcedure.findAll({
                where: {
                    createdAt: {
                        [Op.between]: [fromDate, toDate]
                    }, branchId 
                }
            })

            return res.json(charts_data)

        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new ReportController()