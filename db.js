const fs = require("fs");
const { Sequelize } = require("sequelize");
let EasyYandexS3 = require('easy-yandex-s3').default;

const env = process.env.NODE_ENV || "local";
const env_file = ".env." + env
require("dotenv").config({ path: env_file });

const db_uri = `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;



const sequelize = new Sequelize(db_uri, {
    dialect: "postgres",
    protocol: "postgres",
    dialectOptions: {
        ssl: process.env.YANDEX_DB_CERT_PATH
            ? {
                  require: true,
                  rejectUnauthorized: true,
                  ca: fs
                      .readFileSync(process.env.YANDEX_DB_CERT_PATH)
                      .toString(),
              }
            : undefined,
    },
});

const s3 = new EasyYandexS3({
    auth: {
        accessKeyId: process.env.S3_ID,
        secretAccessKey: process.env.S3_KEY,
    },
    Bucket: "clycon-static-map-images",
    debug: true,
});

module.exports = { sequelize, s3 };
