const ApiError = require('../error/ApiError')
const { s3 } = require('../db');
const sharp = require('sharp');
const {Category, Product, Order, User, OrderProduct} = require('../models/models');
const updateUserCategory = require('../utils/updateUserCategory');
const { Op } = require('sequelize');
const { ClientService, ResponseCodes, ReceiptTypes, VAT } = require('cloudpayments'); 

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
            const client = new ClientService({
                publicId:  process.env.CP_PUBLIC_ID,
                privateKey: process.env.CP_PRIVATE_KEY
            });

            const handlers = client.getNotificationHandlers();
            const receiptApi = client.getReceiptApi();

            let response;

            response = await handlers.handleCheckRequest(req, async (request) => {
                console.log(request)
                const order = await Order.findByPk(request.InvoiceId, {include: [{model: OrderProduct, required: true, include: [{model: Product}]}]});
                if (!order) {
                return ResponseCodes.FAIL;
                }
                if (Number(request.Amount) !== Number(order.sum)) {
                return ResponseCodes.FAIL;
                }

                const receiptOptions = {
                        inn: 502919589904,
                        email: order.mail,
                        phone: order.phone,
                        Items: order.orderProducts.map((op) => {
                            return({
                                label: op.product.name,
                                quantity: op.count,
                                price: op.product.price,
                                amount: op.product.price * op.count,
                                vat: VAT.VAT18,
                            })
                        })
                }
                
                console.log(receiptOptions)

                const response = await receiptApi.createReceipt(
                    { 
                        Type: ReceiptTypes.Income,
                        invoiceId: request.InvoiceId,
                        accountId: request.AccountId,
                        Inn: 502919589904,
                    },
                    receiptOptions
                );

                
                return ResponseCodes.SUCCESS;
            });

            console.log("Payment checked")
            return res.json(response);

        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message));
        }
    }
}

module.exports = new OrderController()