const express = require('express')
const cors = require('cors')
const router = require('../routes/index')
const errorHandler = require('../middleware/ErrorHandlingMiddleware')
const fileUpload = require('express-fileupload')

module.exports = function createServer() {
    const app = express()
    app.use(cors({
        origin: '*',
        methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    }));
    app.use(fileUpload({}))
    app.use('/static', express.static(__dirname + '/public'));
    app.use(express.static('files'));
    app.use(express.json())
    app.use('/api', router)
    app.use(errorHandler)
    return app
}