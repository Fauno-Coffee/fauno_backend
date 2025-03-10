const Router = require('express');
const router = new Router();
const checkRole = require('../middleware/checkRoleMiddleware');

const adminRouter = require('./admin/index');

router.use('/admin', adminRouter);
// router.use('/billing', checkRole('USER', 'ADMINISTRATOR'), billingRouter);

module.exports = router;
