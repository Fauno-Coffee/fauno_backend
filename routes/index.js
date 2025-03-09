const Router = require('express');
const router = new Router();
const checkRole = require('../middleware/checkRoleMiddleware');

const usersRouter = require('./usersRouter');

router.use('/user', usersRouter);
// router.use('/billing', checkRole('USER', 'ADMINISTRATOR'), billingRouter);

module.exports = router;
