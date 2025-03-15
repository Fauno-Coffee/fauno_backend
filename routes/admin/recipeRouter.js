const Router = require('express')
const router = new Router()
const recipeController = require('../../controllers/adminRecipeController')

// router.get('/', productController.fetch)
// router.get('/category', productController.fetchByCategory)
// router.get('/:id', productController.fetchOne)
router.post('/', recipeController.createRecipe)
// router.put('/', productController.update)
// router.delete('/', productController.delete)

module.exports = router