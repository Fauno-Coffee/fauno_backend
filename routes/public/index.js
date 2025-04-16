const Router = require('express');
const router = new Router();

// const usersRouter = require('./usersRouter');
const productRouter = require('./productRouter');
const categoryRouter = require('./categoryRouter');
const userRouter = require('./usersRouter');

router.use('/product', productRouter);
router.use('/category', categoryRouter);
router.use('/user', userRouter);

module.exports = router

