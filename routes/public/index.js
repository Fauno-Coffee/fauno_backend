const Router = require('express');
const router = new Router();

// const usersRouter = require('./usersRouter');
const productRouter = require('./productRouter');
const categoryRouter = require('./categoryRouter');

router.use('/product', productRouter);
router.use('/category', categoryRouter);

module.exports = router

