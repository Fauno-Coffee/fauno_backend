const moment = require('moment');
const getPluralNoun = require('../utils/getPluralNoun');
const ApiError = require('../error/ApiError');
const { User, Tenant, Payment } = require('../models/models');
const generatePaymentToken = require('../utils/generatePaymentToken');
const generateCheckPaymentToken = require('../utils/generateCheckPaymentToken');
const axios = require('axios');
const tg_bot = require('../utils/tg_bot');

const env = process.env.NODE_ENV || 'local';
require('dotenv').config({ path: `.env.${env}` });

class BillingController {
  async getLastPaymentState(req, res, next) {
    const { user: requestedUser } = req;
    // const { paymentId } = req.body;
    if (!requestedUser.id) return next(ApiError.badRequest('Пользователь не найден'));

    const lastPayment = await Payment.findOne({
      where: { tenantId: requestedUser?.tenantId },
      order: [['createdAt', 'DESC']],
    });

    if (!lastPayment) return next(ApiError.badRequest('Платёж не найден'));

    // if(!lastPayment.id !== paymentId){
    //   return next(ApiError.badRequest('Платёж не найден'));
    // }

    if (!lastPayment?.TBankPaymentId)
      return res.json({
        success: true,
        message: 'Платеж не был инициирован на стороне банка',
      });

    if (
      lastPayment?.TBankPaymentId &&
      lastPayment?.status === 'CONFIRMED' &&
      new Date(lastPayment.periodFrom) <= new Date() &&
      new Date(lastPayment.periodTo) > new Date()
    )
      return res.json({
        success: true,
        message: 'У вас уже есть активная подписка и платёж по ней успешен',
      });

    if (
      lastPayment?.TBankPaymentId &&
      lastPayment?.status === 'NEW' &&
      new Date(lastPayment.periodTo) > new Date()
    ) {
      const cashierUrl = process.env.TINKOFF_CASHIER_URL;
      const TerminalKey = process.env.TINKOFF_TERMINAL_KEY;
      const TerminalPass = process.env.TINKOFF_TERMINAL_PASS;
      const checkPaymentToken = await generateCheckPaymentToken(
        TerminalKey,
        lastPayment?.TBankPaymentId,
        TerminalPass,
      );
      const paymentData = {
        TerminalKey: TerminalKey,
        PaymentId: lastPayment?.TBankPaymentId,
        Token: checkPaymentToken,
      };
      try {
        const tinkoffPayment = await axios.post(`${cashierUrl}/GetState`, paymentData, {
          headers: { 'Content-Type': 'application/json' },
        });

        if (tinkoffPayment?.data?.Success) {
          await Payment.update(
            { status: tinkoffPayment?.data?.Status },
            { where: { id: lastPayment.id } },
          );
          if (tinkoffPayment?.data?.Status === 'NEW') {
            return res.json({
              success: true,
              status: tinkoffPayment?.data?.Status,
              message: 'Вам необходимо совершить платёж в открвышейся вкладке с платёжной формой',
            });
          }
          if (tinkoffPayment?.data?.Status === 'CONFIRMING') {
            return res.json({
              success: true,
              status: tinkoffPayment?.data?.Status,
              message: 'Платеж в статусе подтверждения! Подождите немного и обновите страницу',
            });
          }
          if (tinkoffPayment?.data?.Status === 'CONFIRMED') {
            await Tenant.update(
              {
                employeesMaxCount: lastPayment?.employeesMaxCount,
                subscribtionMonths: lastPayment?.subscribtionMonths,
                subscribtionType: 'subscribe',
                subscribtionDateFrom: lastPayment?.periodFrom,
                subscribtionDateTo: lastPayment?.periodTo,
              },
              { where: { id: requestedUser.tenantId } },
            );
            return res.json({
              success: true,
              status: tinkoffPayment?.data?.Status,
              message: 'Платеж успешно проведен!',
            });
          }
          if (tinkoffPayment?.data?.Status === 'REJECTED') {
            return res.json({
              success: true,
              status: tinkoffPayment?.data?.Status,
              message: 'Платеж отклонён банком. Свяжитесь с техподдержкой!',
            });
          }
          if (tinkoffPayment?.data?.Status === 'DEADLINE_EXPIRED') {
            return res.json({
              success: true,
              status: tinkoffPayment?.data?.Status,
              message: 'Вы не успели совершить платёж в платежной форме банка. Начните сначала',
            });
          }
          return res.json({
            success: true,
            status: tinkoffPayment?.data?.Status,
            message:
              'Возникла непредвиденная ошибка при оплате. Подождите немного и обновите страницу. Если проблема осталась, немедленно свяжитесь с техподдержкой!',
          });
        } else {
          return next(ApiError.internal('Ошибка при проверке платежа'));
        }
      } catch (error) {
        return next(ApiError.internal('Ошибка при проверке платежа'));
      }
    }
  }

  async initiatePayment(req, res, next) {
    const { user: requestedUser } = req;
    const { employeesMaxCount, selectedPeriod } = req.body;

    if (!requestedUser.id) return next(ApiError.badRequest('Пользователь не найден'));

    if (employeesMaxCount < 3 || selectedPeriod < 3 || selectedPeriod > 24)
      return next(ApiError.badRequest('Передены некорректные данные о подписке'));

    const tenant = await Tenant.findOne({
      where: { id: requestedUser?.tenantId },
      include: [
        {
          model: Payment,
          as: 'payments',
          required: false,
        },
      ],
    });

    const isPossibleToEqualSub =
      tenant?.employeesMaxCount === employeesMaxCount && tenant?.subscribtionType === 'subscribe';

    const periodVariants = [
      { value: 3, label: '3 месяца' },
      { value: 6, label: '6 месяцев' },
      { value: 12, label: '1 год' },
      { value: 24, label: '2 года' },
    ];

    const prices = {
      3: { base: 1199, additionalEmployee: 300 },
      6: { base: 999, additionalEmployee: 275 },
      12: { base: 849, additionalEmployee: 250 },
      24: { base: 749, additionalEmployee: 225 },
    };

    // const getFullPeriodPrice = (months, employees) => {
    //   return (prices[3].base + prices[3].additionalEmployee * (employees - 3)) * months;
    // };
    const getMonthPrice = (months, employees) => {
      return prices?.[months]?.base + prices?.[months]?.additionalEmployee * (employees - 3);
    };
    // const getPeriodDiscount = (
    //   months,
    //   employees,
    //   subscribtionDateTo,
    //   subscribtionMonths,
    // ) => {
    //   if (subscribtionDateTo && subscribtionMonths) {
    //     const currentDate = moment();
    //     const endDate = moment(subscribtionDateTo, 'DD.MM.YYYY');
    //     const remainingDays = endDate.diff(currentDate, 'day');
    //     const currentSubPrice = getMonthPrice(subscribtionMonths, employees) * subscribtionMonths;
    //     const currentSubPriceInDay = currentSubPrice / subscribtionMonths / currentDate?.daysInMonth();
    //
    //     const equalSubPrice = parseInt((remainingDays * currentSubPriceInDay).toFixed(1));
    //
    //     return (
    //       getFullPeriodPrice(subscribtionMonths, employees) -
    //       getMonthPrice(subscribtionMonths, employees) * subscribtionMonths -
    //       equalSubPrice
    //     );
    //   }
    //   return getFullPeriodPrice(months, employees) - getMonthPrice(months, employees) * months;
    // };
    // const fullPeriodPrice = getFullPeriodPrice(selectedPeriod, employeesMaxCount);
    // const periodDiscount = getPeriodDiscount(
    //   selectedPeriod,
    //   employeesMaxCount,
    //   isPossibleToEqualSub ? tenant?.subscribtionDateTo : undefined,
    //   isPossibleToEqualSub ? tenant?.subscribtionMonths : undefined,
    // );

    const totalPrice = getMonthPrice(selectedPeriod, employeesMaxCount) * selectedPeriod;
    const subscribtionPlanName = `${employeesMaxCount} ${getPluralNoun(employeesMaxCount, [
      'пользователь',
      'пользователя',
      'пользователей',
    ])}`;

    const payment = await Payment.create({
      plan: subscribtionPlanName,
      tenantId: tenant.id,
      duration: periodVariants.find(variant => variant.value === selectedPeriod).label,
      periodFrom: isPossibleToEqualSub
        ? moment(tenant?.subscribtionDateFrom).toDate()
        : moment().toDate(),
      periodTo: isPossibleToEqualSub
        ? moment(tenant?.subscribtionDateTo).add(selectedPeriod, 'month').toDate()
        : moment().add(selectedPeriod, 'month').toDate(),
      price: totalPrice,
      status: 'NEW',
      employeesMaxCount: employeesMaxCount,
      subscribtionMonths: selectedPeriod,
    });
    if (!payment?.id) {
      return next(ApiError.internal('Ошибка при создании платежа'));
    }
    const cashierUrl = process.env.TINKOFF_CASHIER_URL;
    const TerminalKey = process.env.TINKOFF_TERMINAL_KEY;
    const TerminalPass = process.env.TINKOFF_TERMINAL_PASS;
    const paymentDescription = 'Оплата лицензии CLYCON';
    const PaymentReturnUrl = process.env.PAYMENT_RETURN_URL;

    const paymentToken = await generatePaymentToken(
      TerminalKey,
      totalPrice * 100,
      payment.id,
      paymentDescription,
      TerminalPass,
      PaymentReturnUrl,
    );

    const PaymentReceipt = {
      Items: [
        {
          Name: subscribtionPlanName,
          Price: totalPrice * 100,
          Quantity: 1,
          Amount: totalPrice * 100 * 1,
          Tax: 'none',
        },
      ],
      Email: requestedUser?.login,
      Taxation: 'osn',
    };

    const paymentData = {
      TerminalKey: TerminalKey,
      Amount: totalPrice * 100, // в копейках
      OrderId: payment.id,
      Description: paymentDescription,
      Token: paymentToken,
      SuccessURL: PaymentReturnUrl,
      Receipt: PaymentReceipt,
    };
    try {
      const tinkoffPaymentWizard = await axios.post(`${cashierUrl}/Init`, paymentData, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (tinkoffPaymentWizard?.data?.Success) {
        await Payment.update(
          { TBankPaymentId: tinkoffPaymentWizard.data.PaymentId },
          { where: { id: payment.id } },
        );
        return res.json({
          success: tinkoffPaymentWizard?.data?.Success,
          message: 'Платеж успешно назначен!',
          PaymentURL: tinkoffPaymentWizard?.data?.PaymentURL,
        });
      } else {
        return next(ApiError.internal('Ошибка при назначении платежа'));
      }
    } catch (error) {
      console.log(error);
      return next(ApiError.internal('Ошибка при создании платежа'));
    }
  }

  async individualOffer(req, res, next) {
    const { user: requestedUser } = req;

    if (!requestedUser.id) return next(ApiError.badRequest('Пользователь не найден'));
    try {
      const user = await User.findByPk(requestedUser.id);
      await Tenant.update(
        { waitingIndividualOffer: true },
        { where: { id: requestedUser.tenantId } },
      );
      await tg_bot.sendMessage(
        '-1002182917633',
        `<b>ЗАЯВКА НА РАСЧЕТ СТОИМОСТИ</b>\n\nКлиент: ${user.name}\nТелефон: ${user.phone}\nПочта: ${user.login}`,
        { parse_mode: 'HTML' },
      );
      return res.json({ message: 'Заявка успешно отправлена!' });
    } catch (e) {
      return next(ApiError.internal('Ошибка при отправке заявки'));
    }
  }
}

module.exports = new BillingController();
