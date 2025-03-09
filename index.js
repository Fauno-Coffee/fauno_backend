const express = require('express');
const {sequelize} = require('./db');
const models = require('./models/models');
const cors = require('cors');
const router = require('./routes/index');
const createServer = require('./utils/server');

const env = process.env.NODE_ENV || 'local';
require('dotenv').config({ path: `.env.${env}` });

const PORT = process.env.PORT || 5050;

const app = createServer();

const start = async () => {
    try {
        // await sequelize.authenticate();
        await sequelize.sync();
        app.listen(PORT, () => console.log(`Server started on ${PORT}`));
    } catch (e) {
        console.log(e);
    }
};

start();