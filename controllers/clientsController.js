const ApiError = require("../error/ApiError");
const {
    Client,
    Reception,
    Doctor,
    Procedure,
    ReceptionProcedure,
    Group, ClientAbonement,
    ClientAbonementProcedure,
} = require("../models/models");
const { Op } = require("sequelize");

class ClientsController {
    /*
     *  КЛИЕНТЫ
     * */

    async add(req, res, next) {
        try {
            const {
                surname,
                first_name,
                middle_name,
                genderId,
                phone,
                birth,
                branchId,
                mail,
                caretaker,
            } = req.body;
            let client;
            if (!first_name || !phone) {
                return next(
                    ApiError.badRequest("Укажите имя и номер телефона клиента")
                );
            }
            if (birth && genderId > 0) {
                client = await Client.create({
                    surname,
                    first_name,
                    middle_name,
                    genderId,
                    phone,
                    birth,
                    branchId,
                    mail,
                    caretaker,
                });
            } else if (birth && genderId == 0) {
                client = await Client.create({
                    surname,
                    first_name,
                    middle_name,
                    phone,
                    birth,
                    branchId,
                    mail,
                    caretaker,
                });
            } else if (!birth && genderId == 0) {
                client = await Client.create({
                    surname,
                    first_name,
                    middle_name,
                    phone,
                    branchId,
                    mail,
                    caretaker,
                });
            } else if (!birth && genderId > 0) {
                client = await Client.create({
                    surname,
                    first_name,
                    middle_name,
                    genderId,
                    phone,
                    branchId,
                    mail,
                    caretaker,
                });
            }
            return res.json(client);
        } catch (e) {
            next(ApiError.badRequest(e.message));
        }
    }

    async edit(req, res, next) {
        try {
            const { id } = req.query;
            const {
                surname,
                first_name,
                middle_name,
                genderId,
                phone,
                birth,
                branchId,
                mail,
                caretaker,
            } = req.body;
            await Client.update(
                {
                    surname: surname,
                    first_name: first_name,
                    middle_name: middle_name,
                    genderId: genderId,
                    phone: phone,
                    birth: birth,
                    branchId: branchId,
                    mail: mail,
                    caretaker,
                },
                { where: { id: id } }
            );
            return res.json("updated successfully");
        } catch (e) {
            next(ApiError.badRequest(e.message));
        }
    }

    async delete(req, res, next) {
        try {
            const { id, branchId } = req.query;
            Client.destroy({
                where: {
                    id: id,
                    branchId: branchId,
                },
            }).then(
                function (rowDeleted) {
                    if (rowDeleted === 1) {
                        return res.json("Deleted successfully");
                    }
                },
                function (err) {
                    return next(ApiError.badRequest(err));
                }
            );
        } catch (e) {
            return next(ApiError.badRequest(e.message));
        }
    }

    async getAll(req, res) {
        let { page, limit, name, branchId } = req.query;
        page = page || 1;
        limit = limit || 20;
        name = name || "";
        let offset = page * limit - limit;
        let clients;
        if (name.length <= 2) {
            clients = await Client.findAndCountAll({
                limit,
                offset,
                where: { branchId },
                include: [{
                    model: ClientAbonement,
                    as: 'activeAbonement',
                    required: false,
                    include: [{model: ClientAbonementProcedure, required: false, include: [{model: Procedure, required: false}]}]
                }],
                order: [["surname", "ASC"]],
            });
        } else {
            clients = await Client.findAndCountAll({
                limit,
                offset,
                where: {
                    surname: {
                        [Op.like]:
                            "%" +
                            name.charAt(0).toUpperCase() +
                            name.toLowerCase().slice(1) +
                            "%",
                    },
                    branchId: branchId,
                },
                include: [{
                    model: ClientAbonement,
                    as: 'activeAbonement',
                    required: false,
                    include: [{model: ClientAbonementProcedure, required: false, include: [{model: Procedure, required: false}]}]
                }],
                order: [["surname", "ASC"]],
            });
        }
        return res.json(clients);
    }

    async getOne(req, res, next) {
        let { branchId } = req.query;
        const { id } = req.params;

        if (!id || !branchId)
            return next(
                ApiError.badRequest("Не переданы необходимые параметры")
            );

        const client = await Client.findOne({ where: { id, branchId }, include: [{
                model: ClientAbonement,
                as: 'activeAbonement',
                required: false,
                include: [{model: ClientAbonementProcedure, required: false, include: [{model: Procedure, required: false}]}]
            }] });
        const receptions = await Reception.findAll({
            where: { clientId: id, branchId },
            include: [
                { model: Doctor, required: true },
                {
                    model: ReceptionProcedure,
                    required: false,
                    attributes: ["id"],
                    where: {
                        receptionId: { [Op.col]: "reception.id" },
                        branchId,
                    },
                    include: [
                        {
                            model: Procedure,
                            required: false,
                            where: { id: { [Op.col]: "procedureId" } },
                        },
                    ],
                },
            ],
        });
        const result = { client: client, receptions: receptions };
        return res.json(result);
    }

    /*
     *  ГРУППЫ КЛИЕНТОВ
     * */

    // Создать группу
    async groupAdd(req, res, next) {
        try {
            const { branchId } = req.query;
            const { name, clientsIds } = req.body;
            if (!name) {
                return next(ApiError.badRequest("Укажите название группы"));
            }
            if (!branchId) {
                return next(ApiError.badRequest("Ошибка при создании группы"));
            }
            const newGroup = await Group.create({ name, branchId });

            if (clientsIds && clientsIds.length > 0) {
                const clients = await Client.findAll({
                    where: { id: clientsIds },
                    include: [{
                        model: ClientAbonement,
                        as: 'activeAbonement',
                        required: false
                    }],
                });
                await newGroup.addClients(clients);
            }
            res.status(201).json(newGroup);
        } catch (e) {
            next(ApiError.badRequest(e.message));
        }
    }

    // Редактировать группу
    async groupEdit(req, res, next) {
        try {
            const { id } = req.params;
            const { name, clientsIds } = req.body;

            const group = await Group.findByPk(id, {
                include: [
                    {
                        model: Client,
                        through: { attributes: [] },
                    },
                ],
            });
            if (!group) {
                return next(ApiError.badRequest("Группа не найдена"));
            }
            if (name) {
                group.name = name;
                await group.save();
            }

            if (clientsIds && clientsIds.length > 0) {
                const clients = await Client.findAll({
                    where: { id: clientsIds },
                    include: [{
                        model: ClientAbonement,
                        as: 'activeAbonement',
                        required: false
                    }],
                });
                if (clients.length !== clientsIds.length) {
                    return next(
                        ApiError.badRequest("Указанные клиенты не найдены")
                    );
                }
                await group.setClients(clients);
            } else {
                await group.setClients([]);
            }
            res.status(200).json(group);
        } catch (e) {
            next(ApiError.badRequest(e.message));
        }
    }

    // Удалить группу
    async groupDelete(req, res, next) {
        try {
            const { id } = req.params;
            const group = await Group.findByPk(id);
            if (!group) {
                return next(ApiError.badRequest("Группа не найдена"));
            }
            await group.destroy();
            res.status(200).json({ message: "Группа успешно удалена" });
        } catch (e) {
            next(ApiError.badRequest(e.message));
        }
    }

    // Поиск групп моего филиала
    async groupGetAll(req, res, next) {
        let { page, limit, name, branchId } = req.query;
        if (!branchId) return next(ApiError.badRequest("Филиал не указан"));

        try {
            if (!name || name?.length < 2) {
                const groups = await Group.findAll({
                    where: {
                        branchId: branchId,
                    },
                    include: [
                        {
                            model: Client,
                            through: { attributes: [] },
                        },
                    ],
                });
                res.status(200).json(groups);
            } else {
                const groups = await Group.findAll({
                    where: {
                        name: {
                            [Op.iLike]: `%${name}%`,
                        },
                        branchId: branchId,
                    },
                    include: [
                        {
                            model: Client,
                            through: { attributes: [] },
                        },
                    ],
                    order: [["name", "ASC"]],
                });
                res.status(200).json(groups);
            }
        } catch (e) {
            next(ApiError.badRequest(e.message));
        }
    }
    // Поиск группы по id
    async groupGetOne(req, res, next) {
        try {
            const { id } = req.params;
            const group = await Group.findByPk(id, {
                include: [
                    {
                        model: Client,
                        through: { attributes: [] },
                    },
                ],
            });

            if (!group) {
                return next(ApiError.badRequest("Группа не найдена"));
            }
            res.status(200).json(group);
        } catch (e) {
            next(ApiError.badRequest(e.message));
        }
    }
}

module.exports = new ClientsController();
