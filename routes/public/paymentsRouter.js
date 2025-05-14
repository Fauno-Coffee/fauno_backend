const Router = require('express')
const router = new Router()
const paymentsController = require('../../controllers/paymentsController')

router.post('/', paymentsController.handle)
router.post('/check', paymentsController.check)

module.exports = router