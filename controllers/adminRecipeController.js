const ApiError = require('../error/ApiError')
const { s3 } = require('../db');
const sharp = require('sharp');
const {Category, Product, Recipe} = require('../models/models')

class RecipeController {
    // async fetch(req, res, next) {
    //     try {
    //         let {page, limit} = req.query
    //         page = page || 1
    //         limit = limit || 20
    //         let offset = page * limit - limit
    //         const products = await Product.findAndCountAll({limit, offset, order: [['name', 'ASC']], include: [{model: Category}]})
    //         return res.json(products)
    //     } catch (e) {
    //         next(ApiError.badRequest(e.message))
    //     }
    // }

    // async fetchOne(req, res, next) {
    //     try {
    //         const { id } = req.params;
    //         const product = await Product.findByPk(id, {include: [{model: Category}]})
    //         return res.json(product)
    //     } catch (e) {
    //         next(ApiError.badRequest(e.message))
    //     }
    // }
    
    // async fetchByCategory(req, res, next) {
    //     try {
    //         const categories = await Category.findAll({include: [{model: Product, required: true}]})
    //         return res.json(categories)
    //     } catch (e) {
    //         next(ApiError.badRequest(e.message))
    //     }
    // }

    async createRecipe(req, res, next) {
        try {
            const files = req.files?.files;
            const {name, link, categoryId, productId, recipeSteps} = JSON.parse(req.body.data);

            let filesPromises = []
            
            if(files && files.length > 0){
                filesPromises = files.map(async (file) => {
                    if (file) {
                        // Загрузка оригинального изображения
                        const upload = await s3.Upload({ buffer: file.data }, '/recipes/');
                        const imageUrl = upload.Key;
            
                        // Создание миниатюры 24x24px с помощью sharp
    
                        const previewBuffer = await sharp(file.data)
                            .resize(24, 24)
                            .toBuffer();
            
                        // Загрузка миниатюры на S3
                        const previewUpload = await s3.Upload({ buffer: previewBuffer }, '/recipes/previews/');
                        const previewUrl = previewUpload.Key;
    
                        return {imageUrl, previewUrl, name: file.name}
                    }
                });
            }

            const filesData = await Promise.all(filesPromises);

            const recipeData = recipeSteps.map((element) => {
                let fileData = {}
                
                if(element.fileName){
                    console.log(`search file ${element.fileName}`)
                    fileData = filesData.find(file => file.name === element.fileName)
                    console.log(fileData)
                }

                return {text: element.text, ...fileData}
            })

            const recipe = await Recipe.create({
                recipeCategoryId: categoryId,
                link,
                name,
                steps: recipeData,
                productId
            })
    
            return res.json(recipe)
        } catch (e) {
            console.log(e)
            next(ApiError.badRequest(e.message));
        }
    }

    // async delete (req, res, next) {
    //     try {
    //         let {id} = req.query;
    //         await Product.update({isDeleted: true}, {where: {id}})
    //         return res.json("Deleted successfully");
    //     } catch (e) {
    //         next(ApiError.badRequest(e.message))
    //     }
    // }
}

module.exports = new RecipeController()