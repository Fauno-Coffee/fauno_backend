const ApiError = require('../error/ApiError')
const { s3 } = require('../db');
const sharp = require('sharp');
const {Category, Product} = require('../models/models')

class ProductController {
    async fetch(req, res, next) {
        try {
            let {page, limit} = req.query
            page = page || 1
            limit = limit || 20
            let offset = page * limit - limit
            const products = await Product.findAndCountAll({limit, offset, order: [['name', 'ASC']], include: [{model: Category}]})
            return res.json(products)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async fetchOne(req, res, next) {
        try {
            const { id } = req.params;
            const product = await Product.findByPk(id, {include: [{model: Category}]})
            return res.json(product)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    
    async fetchByCategory(req, res, next) {
        try {
            const categories = await Category.findAll({include: [{model: Product, required: true}]})
            return res.json(categories)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async create(req, res, next) {
        try {
            const file = req.files?.file;
            const {
                name, description, link, price, old_price, categoryId,
                about, weight, variation, processing, fermentation,
                region, farmer, keyDescriptor
            } = req.body;
    
            let imageUrl = '';
            let previewUrl = '';
    
            if (file) {
                // Загрузка оригинального изображения
                let upload = await s3.Upload({ buffer: file.data }, '/prodcts/');
                imageUrl = upload.Key;
    
                // Создание миниатюры 24x24px с помощью sharp
                const previewBuffer = await sharp(file.data)
                    .resize(24, 24)
                    .toBuffer();
    
                // Загрузка миниатюры на S3
                let previewUpload = await s3.Upload({ buffer: previewBuffer }, '/prodcts/previews/');
                previewUrl = previewUpload.Key;
            }
    
            const product = await Product.create({
                name, 
                description, 
                link, 
                price, 
                old_price, 
                categoryId, 
                about, 
                weight, 
                variation, 
                processing, 
                fermentation, 
                region, 
                farmer, 
                keyDescriptor,
                imageUrl,
                previewUrl
            });
    
            return res.json(product)
        } catch (e) {
            console.log(e)
            next(ApiError.badRequest(e.message));
        }
    }

    async update(req, res, next) {
        try {
            const {id} = req.query;
            const file = req.files?.file;
            const {
                name, description, link, price, old_price, categoryId,
                about, weight, variation, processing, fermentation,
                region, farmer, keyDescriptor
            } = req.body;
            
            let imageDetails = {};
    
            if (file) {
                // Загрузка оригинального изображения
                let upload = await s3.Upload({ buffer: file.data }, '/prodcts/');
                imageDetails["imageUrl"] = upload.Key;
    
                // Создание миниатюры 24x24px с помощью sharp
                const previewBuffer = await sharp(file.data)
                    .resize(24, 24)
                    .toBuffer();
    
                // Загрузка миниатюры на S3
                let previewUpload = await s3.Upload({ buffer: previewBuffer }, '/prodcts/previews/');
                imageDetails["previewUrl"] = previewUpload.Key;
            }
    
            const product = await Product.update({
                name, 
                description, 
                link, 
                price, 
                old_price, 
                categoryId, 
                about, 
                weight, 
                variation, 
                processing, 
                fermentation, 
                region, 
                farmer, 
                keyDescriptor,
                ...imageDetails
            }, {where: {id}, returning: true});

            return res.json(product[1][0])
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async delete (req, res, next) {
        try {
            let {id} = req.query;
            await Product.update({isDeleted: true}, {where: {id}})
            return res.json("Deleted successfully");
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new ProductController()