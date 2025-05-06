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

        models.BlockData.findOrCreate({ 
            where: {
                name: "products"
            },
            defaults: {
                data: {
                  categories: [
                    { id: 1, layout: "bigLeftVideo" },
                    { id: 2, layout: "rightImage" },
                    { id: 3, layout: "leftImage" },
                    { id: 4, layout: "centerImage" }
                  ]
                }
            }
        })

        app.listen(PORT, () => console.log(`Server started on ${PORT}`));
    } catch (e) {
        console.log(e);
    }
};

start();