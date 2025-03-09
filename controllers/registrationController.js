const ApiError = require('../error/ApiError')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {User, Branch, Registration, Tenant, UserBranch, Position, Procedure, Doctor, DoctorProcedure, Payment} = require('../models/models')
const MailSending = require('../utils/mail')
const axios = require("axios");
const moment = require("moment");
const tg_bot = require('../utils/tg_bot')

const generateJwt = (id, name, login, role, branchId, tenantId) => {
    return jwt.sign({id, name, login, role, branchId, tenantId}, process.env.SECRET_KEY,{expiresIn: '24h'})
}

const cyrb53 = (str, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for(let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

class RegistrationController {

    async create(req, res, next) {
        try {
            const {name, phone, mail, password, ip, location, timezone} = req.body
            if (!name || !phone || !mail || !password) {
                return next(ApiError.badRequest('Заполните все поля'))
            }
            const candidateMail = await User.findOne({where: {login: mail}})
            if (candidateMail){
                const existingRegistration = await Registration.findOne({where: {personId: candidateMail.id}})
                if(existingRegistration && !existingRegistration.finished){
                    await User.destroy({where: {login: mail}})
                } else {
                    return next(ApiError.badRequest('Пользователь с такой почтой уже существует'))
                }
            }
            const candidatePhone = await User.findOne({where: {phone}})
            if (candidatePhone){
                const existingRegistration = await Registration.findOne({where: {personId: candidatePhone.id}})
                if(existingRegistration && !existingRegistration.finished){
                    await User.destroy({where: {phone}})
                } else {
                    return next(ApiError.badRequest('Пользователь с таким номером телефона уже существует'))
                }
            }

            const link = String(cyrb53(`${phone} ${mail} ${password} ${ip} ${location}`))

            const tenant = await Tenant.create({name: link})
            const branch = await Branch.create({name: link, tenantId: tenant.id, timezone})
            const hashPassword = await bcrypt.hash(password, 5)
            const user = await User.create({name: name, login: mail, phone: phone, password: hashPassword, role: 'ADMINISTRATOR', branchId: branch.id})

            await UserBranch.create({userId: user.id, branchId: branch.id})

            const registration = await Registration.create({link: link, personId: user.id, branchId: branch.id, tenantId: tenant.id, personIP: ip, personLocation: location, systemFor: 'default', finished: false})

            MailSending.registrationMail(mail, name, mail, password)

            const token = generateJwt(user.id, user.name, user.login, user.role, user.branchId, tenant.id)
            return res.json({'token': token, 'registration': registration})

        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async show (req, res, next) {
        try {
            let {id} = req.params;
            const registration = await Registration.findOne({ where: { link: id }})
            if (!registration.finished){
                return res.json({registration})
            }
            else {
                return next(ApiError.badRequest("Регистрация завершена"))
            }

        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async second (req, res, next) {
        try {
            let {link, tenantId, tenantName, position, branchId} = req.body;
            const registration = await Registration.findOne({where: {tenantId, link}})
            if(registration.finished){
                return next(ApiError.badRequest("Регистрация завершена"))
            }
            await Tenant.update({name: tenantName}, {where: {id: tenantId, name: link}})

            if(position && branchId) {
                const user = await User.findByPk(registration?.personId)
                console.log('////', user);

                const newPosition = await Position.create({name: position, branchId})
                const procedure = await Procedure.create({name: 'Тестовая услуга', price: 1500, duration: 60, branchId: branchId, is_online_appointment: false})
                const doctor = await Doctor.create({surname: '-', first_name: user?.name, positionId: newPosition.id, branchId: branchId})
                await DoctorProcedure.create({branchId, doctorId: doctor.id, procedureId: procedure.id})
            }
            return res.json('Tenant updated successfully, mock data created!')
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async third (req, res, next) {
        try {
            let {link, branchId, branchName, branchCity, branchStreet} = req.body;
            const registration = Registration.findOne({where: { link }})
            if(registration.finished){
                return next(ApiError.badRequest("Регистрация завершена"))
            }
            await Branch.update({name: branchName, city: branchCity, street: branchStreet}, {where: {id: branchId, name: link}})
            return res.json('Branch updated successfully')
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async fourth (req, res, next) {
        try {
            let {link, businessType, employeeCount} = req.body;
            const registration = await Registration.findOne({where: {link}})
            if(!registration){
                return next(ApiError.badRequest("Регистрация не найдена"))
            }
            if(registration.finished){
                return next(ApiError.badRequest("Регистрация завершена"))
            }
            if (businessType){
                await Registration.update({businessType: businessType}, {where: {link}})
            }
            if (employeeCount){
                await Registration.update({employeeCount: employeeCount}, {where: {link}})
            }

            await Registration.update({finished: true}, {where: {link}})

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.AMO_CRM_ACCESS_TOKEN
            }

            const tenant = await Tenant.findOne({where: {id: registration.tenantId}})
            const branch = await Branch.findOne({where: {id: registration.branchId}})
            const user = await User.findOne({where: {id: registration.personId}})

            const subscribtionDateTo = moment().add(1, 'month').toDate()
            await Tenant.update({subscribtionDateTo, employeeCount: 1}, {where: {id: tenant?.id}})
            await Payment.create({
                plan: 'Пробный',
                tenantId: tenant.id,
                duration: '1 месяц',
                periodFrom: moment().toDate(),
                periodTo: moment().add(1, 'month').toDate(),
                price: 0,
                status: 'CONFIRMED',
                employeesMaxCount: 3,
              });

            const postData = JSON.stringify([{
                "name": "Регистрация",
                "_embedded":{
                    "contacts": [{
                        "first_name": user.name,
                        "custom_fields_values": [
                            {"field_id": 520277, "values": [{"value": user.phone}]},
                            {"field_id": 520279, "values": [{"value": user.login}]}
                        ]
                    }],
                    "companies": [{
                        "name": tenant.name,
                        "custom_fields_values": [
                            {"field_id": 520277, "values": [{"value": user.phone}]},
                            {"field_id": 520279, "values": [{"value": user.login}]},
                            {"field_id": 520283, "values": [{"value": branch.city + ', ' + branch.street}]},
                            {"field_id": 582315, "values": [{"value": employeeCount ? employeeCount : '-'}]},
                            {"field_id": 582313, "values": [{"value": businessType ? businessType : '-'}]}
                        ]
                    }]

                },
                "responsible_user_id": 11253174,
                 "custom_fields_values": [
                    {"field_id": 582305, "values": [{"value": registration.personIP}]},
                    {"field_id": 582307, "values": [{"value": `${branch.timezone}`}]},
                    {"field_id": 582311, "values": [{"value": registration.personLocation}]}
                ]
            }])

            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://iamoivladru.amocrm.ru/api/v4/leads/complex',
                headers: { 
                  'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjYwOTk0Zjg0MzkxZjVmYTE0MjhlOGUwNjk2Zjk3ZWFkOTllOTg5YjgzNjhlZjhmNWIwMzliNWU1YjVmYTM1NzU4NmI3Y2VhMWMyNzk4OTk1In0.eyJhdWQiOiI5NzFhYWJlZi1kYTg1LTRjYTctYjQwNS0zZDAyOWE2NDUwOTEiLCJqdGkiOiI2MDk5NGY4NDM5MWY1ZmExNDI4ZThlMDY5NmY5N2VhZDk5ZTk4OWI4MzY4ZWY4ZjViMDM5YjVlNWI1ZmEzNTc1ODZiN2NlYTFjMjc5ODk5NSIsImlhdCI6MTcyOTI0NDQ5OCwibmJmIjoxNzI5MjQ0NDk4LCJleHAiOjE4NjA5Njk2MDAsInN1YiI6IjExMjUzMTUwIiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMxODM5ODQyLCJiYXNlX2RvbWFpbiI6ImFtb2NybS5ydSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiOWRlNmNlMTEtZWFiNS00ZWVhLTg2YTAtMTgwM2NkZWFkOTIxIiwiYXBpX2RvbWFpbiI6ImFwaS1iLmFtb2NybS5ydSJ9.cWRYWPBerXSJBM36pombtdMr2SQF8uQO4k0MTbKkBKyX1ABwZDSMRZmuIV_h9099Ro-MRsht4dTGUhBwlc7OqvFm3QyQnwmM0PnhK64tB3koVbh5vh4EKjbw63tt2k_9s9HK9HtsNbZT1FsXaGlSxSaJQVx3QzHpbric8_7Jm8xwhDxi9gXoj2mt_1oYRwbQbNMUvXnvtUhE4sygpNJVVaZQkUhKZIt7NILHauUj5qcPTCAngbyb6-VEhe-SX03rEI-vl7jatnaFC1Fhm6XDURzelB-f-fYVXqV3onV4PLGyiZQVzG6empsBO6jyeVLVyu-JToXLxFw9VEO2_ciWAQ',
                  'Content-Type': 'application/json', 
                  'Cookie': 'session_id=gi47sl5vakspsmqd7en8f0ohla; user_lang=ru'
                },
                data: postData
            };
              
            try{
                const crm_responce = await axios.request(config)
                tg_bot.sendMessage("-1002182917633", `<b>РЕГИСТРАЦИЯ</b>\n\nКлиент: ${user.name}\nТелефон: ${user.phone}\nПочта: ${user.login}\n\n<a href="https://iamoivladru.amocrm.ru/leads/pipeline/?skip_filter=Y">Смотреть в CRM</a>`, {parse_mode: "HTML"})
            }catch(e){
                console.log(e)
            }

            return res.json({message: 'Registration finished succesfully'})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new RegistrationController()
