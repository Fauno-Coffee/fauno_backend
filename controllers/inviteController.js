const ApiError = require('../error/ApiError')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {Invites, UserBranch, User, Branch} = require('../models/models')
const {Op} = require("sequelize");
const MailSending = require('../utils/mail')

const generateJwt = (id, name, login, role, branchId, tenantId) => {
    return jwt.sign({id, name, login, role, branchId, tenantId}, process.env.SECRET_KEY, {expiresIn: '24h'})
}

String.prototype.hashLarge = function() {
    var self = this, range = Array(this.length);
    for(var i = 0; i < this.length; i++) {
      range[i] = i;
    } 
    return Array.prototype.reduce.call(range, function(sum, i) {
      return sum + self.charCodeAt(i);
    }, 0).toString(16);
}

class InviteController {

    async create(req, res, next) {
        try {
            const {branchId, personName, personMail, isAdmin} = req.body
            if (!branchId || !personName || !personMail){
                return next(ApiError.badRequest('Заполните все поля'))
            }
            const link = `${branchId} ${personName} ${personMail} ${isAdmin}`.hashLarge()

            await Invites.create({link: link, branchId: branchId, personName: personName, personMail: personMail, isAdmin: isAdmin, isActive: true})
            const branch = await Branch.findOne({where: {id: branchId}})
            //personName, personMail, company, link
            MailSending.invitationMail(personName, personMail, branch.name, link)

            return res.json("Приглашение отправлено на почту")
        } catch (e) { 
            next(ApiError.badRequest(e.message))   
        }         
    }

    async list(req, res, next) {
        try {
            const {branchId} = req.query
            const invites = await Invites.findAll({where: {branchId}}) 
            return res.json({invites})
        } catch (e) { 
            next(ApiError.badRequest(e.message))   
        }  
    }

    async delete(req, res, next) {
        try {
            let {id, link} = req.query;
            Invites.destroy({
                where: {
                    id: id,
                    link: link
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

    async showInvite(req, res, next) {
        try {
            let {id} = req.params;
            const invite = await Invites.findOne({ where: { link: id }})
            return res.json({invite})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async accept(req, res, next) {
        try {

            let {link, name, mail, password, isAdmin, branchId} = req.body;

            await Invites.update({isActive: false}, {where: {link}})

            if (!mail || !password){
                return next(ApiError.badRequest('Некорректный логин или пароль'))
            }

            const candidate = await User.findOne({where: {login: mail}})
            if (candidate){
                return next(ApiError.badRequest('Пользователь с таким логином уже существует'))
            }
            const hashPassword = await bcrypt.hash(password, 5)
            const role = isAdmin ? 'ADMINISTRATOR' : 'USER'
            const user = await User.create({login: mail, name, role, password: hashPassword, branchId})
            //const user = await User.findOne({where: {login: mail}}) //Это убрать
            const currentBranch = await Branch.findOne({where: {id: branchId}})
            let branchesId

            // TODO: эту логику с isAdmin вндерить в возвращение всех бенчей в settings контроллере

            let branches = []
            if(isAdmin){
                const branches = await Branch.findAll({where: {'tenantId': currentBranch.tenantId}})
                branchesId = branches.map(a => a.id); 
                branchesId.map(async (id) => {
                    const branch = await UserBranch.create({userId: user.id, branchId: id})
                    branches.push(branch)
                })
            } else {
                const branch = await UserBranch.create({userId: user.id, branchId: currentBranch.id})
                branches.push(branch)
            }

            const token = generateJwt(user.id, user.name, user.login, user.role, user.branchId, currentBranch.tenantId)
            return res.json({token})

        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    // async accept(req, res, next) {
    //     const {login, password} = req.body
    //     const user = await User.findOne({where: {login}})
    //     if (!user){
    //         return next(ApiError.internal('Пользователь с таким логином не найден'))
    //     }
    //     let comparePassword = bcrypt.compareSync(password, user.password)
    //     if (!comparePassword){
    //         return next(ApiError.internal('Указан неверный пароль'))
    //     }
    //     const userBranches = await UserBranch.findAll({where: {'userId': user.id}})
    //     const branchId = userBranches.map(a => a.branchId);

    //     var branches = await Promise.all(branchId.map(async (id) => {
    //         const branch = await Branch.findOne({where: {id}, include: [{model: Tenant, where: {id: {[Op.col]: 'tenantId'}}}]})
    //         return branch;
    //     }));

    //     //console.log('\n\n\n', branches, '\n\n\n')
        
    //     const token = generateJwt(user.id, user.login, user.role, user.branchId, branches)
    //     return res.json({token})
    // }
 
    // async show(req, res, next) {
    //     const user = await User.findOne({where: {id: req.user.id}})

    //     const userBranches = await UserBranch.findAll({where: {'userId': user.id}})
    //     const branchId = userBranches.map(a => a.branchId);

    //     var branches = await Promise.all(branchId.map(async (id) => {
    //         const branch = await Branch.findOne({where: {id}, include: [{model: Tenant, where: {id: {[Op.col]: 'tenantId'}}}]})
    //         return branch;
    //     }));

    //     const token = generateJwt(user.id, user.login, user.role, user.branchId, branches)
    //     return res.json({token})
    // }

    // async list(req, res, next) {
    //     let {page, limit, branchId} = req.query
    //     page = page || 1
    //     limit = limit || 20
    //     let offset = page * limit - limit
    //     try {
    //         const branchUsers = await UserBranch.findAll({where: {branchId}})
    //         const usersId = branchUsers.map(a => a.userId)
    //         var users = await Promise.all(usersId.map(async (id) => {
    //             const user = await User.findOne({where: {id}})
    //             return user;
    //         }))
    //         //console.log('\n\n\n', users, '\n\n\n')
    //         return res.json(users)
    //     } catch (e) {
    //         next(ApiError.badRequest(e.message))
    //     }
    // }

    // async update(req, res, next) {
    //     try {
    //         const {id} = req.query;
    //         const {login, role, branchId} = req.body
    //         await User.update({login: login, role: role, branchId: branchId}, {where: {id: id}})
    //         return res.json("User updated!")
    //     } catch (e) {
    //         next(ApiError.badRequest(e.message))
    //     }
    // }
}

module.exports = new InviteController()