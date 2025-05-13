const Router = require('express')
const router = new Router()
const paymentsController = require('../../controllers/paymentsController')

router.post('/', paymentsController.handle)

module.exports = router