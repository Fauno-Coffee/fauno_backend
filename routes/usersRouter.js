const Router = require('express')
const router = new Router()
const usersController = require('../controllers/usersController')
const authMiddleware = require('../middleware/authMiddleware')
const checkRole = require('../middleware/checkRoleMiddleware')

router.post('/login', usersController.login)
router.get('/find_email', usersController.find_mail)
router.post('/recovery_password', usersController.recovery_password)
router.post('/check_code', usersController.check_code)
router.get('/auth', authMiddleware, usersController.check)
router.get('/list', checkRole('ADMINISTRATOR'), usersController.list)
router.put('/edit', checkRole('ADMINISTRATOR'), usersController.update)
router.delete('/delete', checkRole('ADMINISTRATOR'), usersController.delete)

module.exports = router