const ApiError = require('../error/ApiError')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {User, Doctor, Client, UserBranch, Branch, Tenant} = require('../models/models')
const {Op} = require("sequelize");
const crypto = require('crypto');
const MailSending = require('../utils/mail')

const generateJwt = (id, name, mail, role, branchId, tenantId) => {
    return jwt.sign({id, name, mail, role, branchId, tenantId}, process.env.SECRET_KEY,{expiresIn: '72h'})
}

class UsersController {
    // async registration(req, res, next) {
    //
    //     const {mail, password, role, branchId} = req.body
    //     if (!mail || !password){
    //         return next(ApiError.badRequest('Некорректный логин или пароль'))
    //     }
    //     const candidate = await User.findOne({where: {mail}})
    //     if (candidate){
    //         return next(ApiError.badRequest('Пользователь с таким логином уже существует'))
    //     }
    //     const hashPassword = await bcrypt.hash(password, 5)
    //     const user = await User.create({mail, role, password: hashPassword, branchId})
    //     const token = generateJwt(user.id, user.mail, user.role, user.branchId)
    //     return res.json({token})
    // }

    async login(req, res, next) {

        const {mail, password} = req.body
        const user = await User.findOne({where: {mail}})
        if (!user){
            return next(ApiError.internal('Пользователь с таким логином не найден'))
        }
        let comparePassword = bcrypt.compareSync(password, user.password)
        if (!comparePassword){
            return next(ApiError.internal('Указан неверный пароль'))
        }
        const { tenantId } = await Branch.findOne({where: {id: user.branchId}})

        const token = generateJwt(user.id, user.name, user.mail, user.role, user.branchId, tenantId)
        return res.json({token})
    }

    async find_mail(req, res, next) {
        try{
            const mail = req.query.mail
            if(mail){
                const user = await User.findOne({where: {mail}})
                if(!user){
                    return next(ApiError.badRequest("Такой пользователь не найден"))
                }
                
                crypto.randomInt(0, 1_000_000)

                crypto.randomInt(0, 1_000_000, async (err, code) => {
                    if (err) return next(ApiError.badRequest("Ой, что-то пошло не так"))

                    const codeFormatted = code.toString().padStart(6, '0')
                    MailSending.resetPasswordCodmail(user.mail, codeFormatted)
                    await User.update({recoveryCode: codeFormatted}, {where: {id: user.id}})
                });

                return res.json(true)
            } else {
                return next(ApiError.badRequest("Отправьте логин"))
            }
        } catch(e){
            next(ApiError.badRequest(e.message))
        }
        

    }

    async recovery_password(req, res, next) {
        try{
            const {mail, password} = req.body
            if(mail){
                const user = await User.findOne({where: {mail: mail}})
                if(!user){
                    return next(ApiError.badRequest("Такой пользователь не найден"))
                }
                const userId = user.id
                const hashPassword = await bcrypt.hash(password, 5)
                await User.update({password: hashPassword}, {where: {id: userId}})
                await User.update({wrongRecoveryCodeAttempts: null}, {where: {id: userId}})
                await User.update({recoveryCode: null}, {where: {id: userId}})
                return res.json("password updated")
            } else {
                return next(ApiError.badRequest("Отправьте логин"))
            }
        } catch(e){
            next(ApiError.badRequest(e.message))
        }
    }

    async check_code(req, res, next) {
        try{
            const {mail, code} = req.body
            if(mail && code !== null){
                const user = await User.findOne({where: {mail: mail}})
                const attempts = user.wrongRecoveryCodeAttempts || 0
                if(!user){
                    return next(ApiError.badRequest("Такой пользователь не найден"))
                }
                if(attempts > 4) {
                    return res.json({a_lot_attempts: true})
                }

                if (user.recoveryCode === code) {   
                    return res.json(true)
                }

                else {
                    await User.update({wrongRecoveryCodeAttempts: attempts + 1}, {where: {id: user.id}})
                    return res.json(false)
                }

            } else {
                return next(ApiError.badRequest("Ошибка. Отпправьте корректные данные"))
            }
        } catch(e){
            next(ApiError.badRequest(e.message))
        }
    }
 
    async check(req, res, next) {
        try {
            const user = await User.findOne({where: {id: req.user.id}})
            const { tenantId } = await Branch.findOne({where: {id: user.branchId}})
            const token = generateJwt(user.id, user.name, user.mail, user.role, user.branchId, tenantId)
            return res.json({token})
            
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
            const branchUsers = await UserBranch.findAll({where: {branchId}})
            const usersId = branchUsers.map(a => a.userId)
            var users = await Promise.all(usersId.map(async (id) => {
                const user = await User.findOne({where: {id}})
                return user;
            }))
            return res.json(users)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async update(req, res, next) {
        try {
            const {id} = req.query;
            const {name, mail, role, branchId} = req.body
            await User.update({name: name, mail: mail, role: role, branchId: branchId}, {where: {id: id}})
            return res.json("User updated!")
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async delete (req, res, next) {
        try {
            let {id, branchId} = req.query;
            User.destroy({
                where: {
                    id,
                    branchId
                }
            }).then(function(rowDeleted){
                if(rowDeleted === 1){
                    UserBranch.destroy({
                        where: {
                            userId: id,
                        }
                    })
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

module.exports = new UsersController()