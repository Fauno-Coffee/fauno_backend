const Router = require('express');
const router = new Router();
const checkRole = require('../../middleware/checkRoleMiddleware')

const usersRouter = require('./usersRouter');
const categoryRouter = require('./categoryRouter');
const productRouter = require('./productRouter');
const orderRouter = require('./orderRouter');

router.use('/user', usersRouter);
router.use('/category', checkRole('ADMINISTRATOR'), categoryRouter);
router.use('/product', checkRole('ADMINISTRATOR'), productRouter);
router.use('/order', checkRole('ADMINISTRATOR'), orderRouter);

module.exports = router

