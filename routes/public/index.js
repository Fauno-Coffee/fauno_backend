const Router = require('express');
const router = new Router();

// const usersRouter = require('./usersRouter');
const productRouter = require('./productRouter');

router.use('/product', productRouter);

module.exports = router

