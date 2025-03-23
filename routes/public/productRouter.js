const Router = require('express')
const router = new Router()
const productController = require('../../controllers/clientProductController')

router.get('/', productController.fetch)
router.get('/category', productController.fetchByCategory)
router.get('/:link', productController.fetchOne)

module.exports = router