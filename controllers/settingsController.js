const ApiError = require('../error/ApiError')
const {Branch, UserBranch} = require('../models/models')
const {s3} = require('../db')

class SettingsController {
    async getBranches(req, res, next) {
        const branchesData = await UserBranch.findAll({where: {userId: req.user.id}, include: [{model: Branch}] })
        return res.json(branchesData.map(branch => branch.branch))
    }

    async fetchBranchData (req, res, next) {
        try {
            let {branchId} = req.query
            const branchData = await Branch.findOne({where: {id: branchId}})
            let branchSheduleString = ""
            if(branchData.isMon 
            && branchData.isTue 
            && branchData.isWed  
            && branchData.isThu
            && branchData.isFri 
            && branchData.monFrom === branchData.tueFrom
            && branchData.monFrom === branchData.wedFrom
            && branchData.monFrom === branchData.thuFrom
            && branchData.monFrom === branchData.friFrom
            && branchData.monTo === branchData.tueTo
            && branchData.monTo === branchData.wedTo
            && branchData.monTo === branchData.thuTo
            && branchData.monTo === branchData.friTo){
                if(branchData.isSat && branchData.isSun){
                    if(branchData.monTo === branchData.satTo && branchData.monTo === branchData.sunTo && branchData.monFrom === branchData.satFrom && branchData.monFrom === branchData.suFrom){
                        branchSheduleString = "Ежедневно с " + branchData.monFrom.slice(0,5) + " до " + branchData.monTo.slice(0,5);
                    } else {
                        branchSheduleString = "Пн-Пт: " + branchData.monFrom.slice(0,5) + "-" + branchData.monTo.slice(0,5) 
                        + ", Сб: " + branchData.satFrom.slice(0,5) + "-" + branchData.satTo.slice(0,5) 
                        + ", Вс: " + branchData.sunFrom.slice(0,5) + "-" + branchData.sunTo.slice(0,5);
                    }
                } else if(!branchData.isSat && !branchData.isSun) {
                    branchSheduleString = "Пн-Пт: " + branchData.monFrom.slice(0,5) + "-" + branchData.monTo.slice(0,5) 
                        + ", Сб-Вс: закрыто ";
                } else {
                    branchSheduleString = "Пн-Пт: " + branchData.monFrom.slice(0,5) + "-" + branchData.monTo.slice(0,5) 
                        + ", Сб: " + (branchData.isSat ? branchData.satFrom.slice(0,5) + "-" + branchData.satTo.slice(0,5) : "-") 
                        + ", Вс: " + (branchData.isSun ? branchData.sunFrom.slice(0,5) + "-" + branchData.sunTo.slice(0,5) : "-");
                }
            } else {
                branchSheduleString = "Пн: " + (branchData.isMon ? branchData.monFrom.slice(0,5) + " - " + branchData.monTo.slice(0,5) : "-") 
                + ", Вт: " + (branchData.isTue ? branchData.tueFrom.slice(0,5) + "-" + branchData.tueTo.slice(0,5) : "-")
                + ", Ср: " + (branchData.isWed ? branchData.wedFrom.slice(0,5) + "-" + branchData.wedTo.slice(0,5) : "-")
                + ", Чт: " + (branchData.isThu ? branchData.thuFrom.slice(0,5) + "-" + branchData.thuTo.slice(0,5) : "-")
                + ", Пт: " + (branchData.isFri ? branchData.friFrom.slice(0,5) + "-" + branchData.friTo.slice(0,5) : "-")
                + ", Сб: " + (branchData.isSat ? branchData.satFrom.slice(0,5) + "-" + branchData.satTo.slice(0,5) : "-")
                + ", Вс: " + (branchData.isSun ? branchData.sunFrom.slice(0,5) + "-" + branchData.sunTo.slice(0,5) : "-");
                console.log(branchSheduleString)
            }
            return res.json({"branchData": branchData, "branchSheduleString": branchSheduleString})
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async createBranch(req, res, next) {
        try {
            let {branchName, branchCity, branchStreet} = req.body;

            const branch = await Branch.create({name: branchName, city: branchCity, street: branchStreet, userId: req.user.id, tenantId: req.user.tenantId})
            await UserBranch.create({userId: req.user.id, branchId: branch.id})

            return res.json(branch)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async updateBranchData (req, res, next) {
        try {
            const {branchId} = req.query;
            const {branchName, branchCity, branchStreet, branchWebsite, branchContact, lat, lon, timezone, groupReceptions, abonements} = req.body;
            if(lat && lon) {
                const map_blob = await fetch(`https://static-maps.yandex.ru/v1?lang=ru_RU&ll=${lon},${lat}&size=550,250&z=16&pt=${lon},${lat},pm2rdl&apikey=c40ec6a0-ab06-4fd1-ac90-6a144342907b`)
                const map_buffer = Buffer.from(await map_blob.arrayBuffer())
                let upload = await s3.Upload(
                    { buffer: map_buffer },
                    '/maps/'
                );
                await Branch.update({name: branchName, city: branchCity, street: branchStreet, website: branchWebsite, phone: branchContact, lat, lon, timezone, groupReceptions, mapImgUrl: upload.Key, abonements}, {where: {id: branchId}})
            } else {
                await Branch.update({name: branchName, city: branchCity, street: branchStreet, website: branchWebsite, phone: branchContact, lat, lon, timezone, groupReceptions, abonements}, {where: {id: branchId}})
            }
            return res.json("Филиал изменен успешно!")
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async updateBranchSchedule (req, res, next) {
        try {
            const {branchId} = req.query;
            const {monFrom, monTo, tueFrom, tueTo, wedFrom, wedTo, thuFrom, thuTo, friFrom, friTo, satFrom, satTo, sunFrom, sunTo, isMon, isTue, isWed, isThu, isFri, isSat, isSun} = req.body;
            await Branch.update({monFrom, monTo, tueFrom, tueTo, wedFrom, wedTo, thuFrom, thuTo, friFrom, friTo, satFrom, satTo, sunFrom, sunTo, isMon, isTue, isWed, isThu, isFri, isSat, isSun}, {where: {id: branchId}})
            return res.json("Расписание филиала изменено успешно!")
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new SettingsController()