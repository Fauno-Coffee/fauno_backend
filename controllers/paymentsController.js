const ApiError = require('../error/ApiError')
const { s3 } = require('../db');
const sharp = require('sharp');
const {Category, Product, Order, User, OrderProduct} = require('../models/models');
const updateUserCategory = require('../utils/updateUserCategory');
const { Op } = require('sequelize');
const { ClientService, ResponseCodes } = require('cloudpayments'); 

class OrderController {
    async handle (req, res, next) {
        try {
            console.log("query")
            console.log(req.body)
            console.log(req.params)
            console.log(req)
            const client = new ClientService({
                publicId:  process.env.CP_PUBLIC_ID,
                privateKey: process.env.CP_PRIVATE_KEY
            });
            const handlers = client.getNotificationHandlers();

            // Вся полезная нагрузка CloudPayments лежит в req.body.NotificationObject
            const type         = req.body.NotificationType;
            const notification = req.body.NotificationObject || {};

            let response;

            switch (type) {
                // 1. Проверка заказа перед оплатой
                case 'Check':
                response = await handlers.handleCheckRequest(req, async () => {
                    const order = await Order.findByPk(notification.InvoiceId);
                    if (!order) {
                    return ResponseCodes.FAIL;
                    }
                    if (Number(notification.Amount) !== Number(order.sum)) {
                    return ResponseCodes.FAIL;
                    }
                    return ResponseCodes.SUCCESS;
                });
                break;

                // 2. Успешная оплата
                case 'Pay':
                response = await handlers.handlePayRequest(req, async () => {
                    const order = await Order.findByPk(notification.InvoiceId);
                    if (!order) return ResponseCodes.FAIL;

                    // Если платёж уже зафиксирован, игнорируем
                    if (order.state === 'paid') {
                    return ResponseCodes.SUCCESS;
                    }

                    // Обновляем статус на «оплачен»
                    await order.update({ state: 'paid' });
                    return ResponseCodes.SUCCESS;
                });
                break;

                // 3. Неуспешная попытка списания
                case 'Fail':
                response = await handlers.handleFailRequest(req, async () => {
                    const order = await Order.findByPk(notification.InvoiceId);
                    if (!order) return ResponseCodes.FAIL;

                    // Логируем и переводим в статус «failed»
                    await order.update({ state: 'failed' });
                    return ResponseCodes.SUCCESS;
                });
                break;

                // 4. Подтверждение списания (для двух-шаговых платежей)
                case 'Confirm':
                response = await handlers.handleConfirmRequest(req, async () => {
                    const order = await Order.findByPk(notification.InvoiceId);
                    if (!order) return ResponseCodes.FAIL;

                    // Обычно меняют статус на «confirmed» или сразу на «paid»
                    await order.update({ state: 'confirmed' });
                    return ResponseCodes.SUCCESS;
                });
                break;

                // 5. Возврат средств
                case 'Refund':
                response = await handlers.handleRefundRequest(req, async () => {
                    const order = await Order.findByPk(notification.InvoiceId);
                    if (!order) return ResponseCodes.FAIL;

                    // Переводим в статус «refunded»
                    await order.update({ state: 'refunded' });
                    return ResponseCodes.SUCCESS;
                });
                break;

                // 7. Рекуррентный платёж
                case 'Recurrent':
                response = await handlers.handleRecurrentRequest(req, async () => {
                    const order = await Order.findByPk(notification.InvoiceId);
                    if (!order) return ResponseCodes.FAIL;

                    // TODO: если у вас поддерживается подписка — активируем следующую отгрузку
                    await order.update({ state: 'recurring_charged' });
                    return ResponseCodes.SUCCESS;
                });
                break;

                // Неизвестный тип → просто отвечаем OK, ничего не делаем
                default:
                return res.json({ Success: true, Message: null });
            }

            return res.json(response);

        } catch (e) {
            return next(ApiError.badRequest(e.message));
        }
    }
    
    async check (req, res, next) {
        try {
            console.log("check query")
            console.log(req.body)
            console.log(req.params)
            console.log(req.query)
            
            const client = new ClientService({
                publicId:  process.env.CP_PUBLIC_ID,
                privateKey: process.env.CP_PRIVATE_KEY
            });
            const handlers = client.getNotificationHandlers();

            // Вся полезная нагрузка CloudPayments лежит в req.body.NotificationObject
            const type         = req.body.NotificationType;
            const notification = req.body.NotificationObject || {};

            let response;

            response = await handlers.handleCheckRequest(req, async (request) => {
                console.log(request)
                const order = await Order.findByPk(notification.InvoiceId);
                if (!order) {
                return ResponseCodes.FAIL;
                }
                if (Number(notification.Amount) !== Number(order.sum)) {
                return ResponseCodes.FAIL;
                }
                return ResponseCodes.SUCCESS;
            });

            return res.json(response);

        } catch (e) {
            return next(ApiError.badRequest(e.message));
        }
    }
}

module.exports = new OrderController()