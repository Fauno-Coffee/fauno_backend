const Router = require('express')
const router = new Router()
const categoryController = require('../../controllers/clientCategoryController')

router.get('/', categoryController.fetch)

module.exports = router