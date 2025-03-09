const ApiError = require('../error/ApiError');
const { Tenant, Payment } = require('../models/models');
const { s3 } = require('../db');
const moment = require('moment');

class TenantController {
  async getTenant(req, res, next) {
    const userTenantId = req.user.tenantId;
    const userTenant = await Tenant.findOne({
      where: { id: userTenantId },
      include: [
        {
          model: Payment,
          as: 'payments',
          required: false,
          attributes: {
            exclude: ['TBankPaymentId'],
          },
        },
      ],
    });
    if (userTenant && userTenant.subscribtionDateTo) {
      userTenant.dataValues.subscribtionDateTo = moment(userTenant.subscribtionDateTo).format(
        'DD.MM.YYYY',
      );
    }
    return res.json(userTenant);
  }

  async getTenantByVkGroupId(req, res, next) {
    const { vkGroupId } = req.query;

    console.log(vkGroupId);
    if (!vkGroupId) return next(ApiError.badRequest('Не передан vkGroupId'));

    try {
      const userTenant = await Tenant.findOne({ where: { vkGroupId } });
      if (!userTenant) return res.json({ message: 'Бизнес не найден' });

      return res.json({ id: userTenant.id });
    } catch (e) {
      return next(ApiError.internal('Возникла внутренняя ошибка. Повторите позднее'));
    }
  }

  async setTenantVkGroupId(req, res, next) {
    const { tenantId, vkGroupId } = req.body;
    if (!tenantId || !vkGroupId)
      return next(ApiError.badRequest('Не переданы необходимые параметры'));

    try {
      const [numberOfAffectedRows, [updatedTenant]] = await Tenant.update(
        { vkGroupId },
        { where: { id: tenantId }, returning: true },
      );
      if (!updatedTenant) return next(ApiError.internal('Бизнес не найден'));
      return res.json(updatedTenant);
    } catch (e) {
      return next(ApiError.internal('Возникла внутренняя ошибка. Повторите позднее'));
    }
  }

  async updateTenantData(req, res, next) {
    try {
      const userTenantId = req.user.tenantId;
      const file = req.files?.file;
      const { name, description, appointmentStepMinutes } = req.body;

      if (
        appointmentStepMinutes &&
        (appointmentStepMinutes >= 5 || appointmentStepMinutes <= 240)
      ) {
        console.log(typeof appointmentStepMinutes);
        const [numberOfAffectedRows, [updatedTenant]] = await Tenant.update(
          { appointmentStepMinutes },
          {
            where: { id: userTenantId },
            returning: true,
          },
        );
        return res.json(updatedTenant.dataValues);
      }

      if (file) {
        let upload = await s3.Upload({ buffer: file?.data }, '/tenantAvatars/');
        const [numberOfAffectedRows, [updatedTenant]] = await Tenant.update(
          {
            name,
            description,
            imageUrl: upload.Key,
            imageName: file?.name,
          },
          { where: { id: userTenantId }, returning: true },
        );
        return res.json(updatedTenant.dataValues);
      } else {
        const userTenant = await Tenant.findByPk(userTenantId);
        userTenant?.imageUrl && (await s3.Remove(userTenant?.imageUrl));
        const [numberOfAffectedRows, [updatedTenant]] = await Tenant.update(
          {
            name,
            description,
            imageUrl: null,
            imageName: null,
          },
          { where: { id: userTenantId }, returning: true },
        );
        return res.json(updatedTenant.dataValues);
      }
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async updateTenantBanner(req, res, next) {
    try {
      const userTenantId = req.user.tenantId;
      const file = req.files?.file;

      if (file) {
        let upload = await s3.Upload({ buffer: file?.data }, '/tenantBanners/');
        const [numberOfAffectedRows, [updatedTenant]] = await Tenant.update(
          {
            bannerUrl: upload.Key,
            bannerName: file?.name,
          },
          { where: { id: userTenantId }, returning: true },
        );
        return res.json(updatedTenant.dataValues);
      } else {
        const userTenant = await Tenant.findByPk(userTenantId);
        userTenant?.bannerUrl && (await s3.Remove(userTenant?.bannerUrl));
        const [numberOfAffectedRows, [updatedTenant]] = await Tenant.update(
          {
            bannerUrl: null,
            bannerName: null,
          },
          { where: { id: userTenantId }, returning: true },
        );
        return res.json(updatedTenant.dataValues);
      }
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }
}

module.exports = new TenantController();
