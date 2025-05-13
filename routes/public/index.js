const Router = require('express');
const router = new Router();

// const usersRouter = require('./usersRouter');
const blockRouter = require('./blockRouter');
const productRouter = require('./productRouter');
const categoryRouter = require('./categoryRouter');
const userRouter = require('./usersRouter');
const recipeRouter = require('./recipeRouter');
const orderRouter = require('./orderRouter');
const paymentsRouter = require('./paymentsRouter');

router.use('/block', blockRouter);
router.use('/order', orderRouter);
router.use('/product', productRouter);
router.use('/category', categoryRouter);
router.use('/user', userRouter);
router.use('/recipe', recipeRouter);
router.use('/payments', paymentsRouter);

module.exports = router

