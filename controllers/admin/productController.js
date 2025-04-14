const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const SubCategory = require("../../models/subCategorySchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")

const getProductPage = async(req, res) => {

    try {

        const search = req.query.search || ""
        const page = parseInt(req.query.page) || 1
        const limit = 4

        const matchingCategories = await Category.find({
            name: { $regex: search, $options: "i" },
            isListed: true,
            isDelete: false,
        }).select("_id");

        const categoryIds = matchingCategories.map((cat) => cat._id);

        const productData = await Product.find({
            isDelete: false,
            $or: [
                { name: { $regex: search, $options: "i" }},
                { category: { $in: categoryIds } },
            ],
        })
          .populate("category", "name") 
          .populate("subCategory", "name")
          .sort({ createdAt: -1 })
          .limit(limit * 1)
          .skip((page - 1) * limit)
          .exec();

        const count = await Product.countDocuments({
            isDelete: false,
            $or: [
                { name: { $regex: search, $options: "i" }},
                { category: { $in: categoryIds } },
            ],
        });

        const category = await Category.find({ isListed: true, isDelete: false }).select('name')
        const subCategory = await SubCategory.find({ isListed: true, isDelete: false }).select('name')

        if (category && subCategory) {

            res.render('product', {
                data: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
                subCategory: subCategory,
                activePage: "product"
            })

        } else {

            res.render('pageerror')

        }

    } catch (error) {

        console.log("error in getProductPage",error)
        res.redirect('/admin/pageerror')

    }
}

const addProductPage = async(req, res) => {

    try {

        const category = await Category.find({ isListed: true, isDelete: false })
        const subCategory = await SubCategory.find({ isListed: true, isDelete: false })

        res.render("addProduct", {
            cat: category,
            subCategory: subCategory,
            activePage: "product"
        })

    } catch (error) {

        console.log("Error in addProduct", error)
        res.redirect("/admin/pageerror")

    }
}

const addProduct = async(req, res) => {

    try {

        if (req.method === 'POST') {

            const { productName, category, subCategory, regularPrice, salePrice, quantity, description,brand,dimensions,material,weight } = req.body;

            const existingProduct = await Product.findOne({ name: productName });

            if (existingProduct && existingProduct.isDelete === true) {

                existingProduct.isDelete = false;
                existingProduct.category = category;
                existingProduct.subCategory = subCategory;
                existingProduct.regularPrice = parseInt(regularPrice);
                existingProduct.salePrice = parseInt(salePrice);
                existingProduct.quantity = quantity;
                existingProduct.description = description;
                existingProduct.brand = brand || "Generic"; 
                existingProduct.material = material || "N/A";
                existingProduct.dimensions = dimensions || "N/A";
                existingProduct.weight = weight || "N/A";

                const images = [];
                const imageFields = ['image1', 'image2', 'image3'];

                for (const field of imageFields) {

                    if (req.files && req.files[field] && req.files[field][0]) {
                        const file = req.files[field][0];
                        const originalImagePath = file.path;
                        const resizedImagePath = path.join(__dirname, '../../public/uploads/product-image', 'resized-' + file.filename);
                        
                        await sharp(originalImagePath)
                            .resize({ width: 400, height: 400 })
                            .toFile(resizedImagePath);
                        
                        images.push('resized-' + file.filename);
                    }
                }

                if (images.length > 0) {
                    existingProduct.Images = images;
                }

                await existingProduct.save();

                return res.json({ 
                    success: true, 
                    message: 'Product restored successfully',
                    redirectUrl: "/admin/product"
                });

            } else if (existingProduct && existingProduct.isDelete === false) {

                return res.json({ 
                    success: false, 
                    message: 'Product name already exists' 
                });
            }

            const images = [];
            const imageFields = ['image1', 'image2', 'image3'];

            for (const field of imageFields) {

                if (req.files && req.files[field] && req.files[field][0]) {
                    const file = req.files[field][0];
                    const originalImagePath = file.path;
                    const resizedImagePath = path.join(__dirname, '../../public/uploads/product-image', 'resized-' + file.filename);
                    
                    await sharp(originalImagePath)
                        .resize({ width: 400, height: 400 })
                        .toFile(resizedImagePath);
                    
                    images.push('resized-' + file.filename);
                }
            }

            const newProduct = new Product({
                name: productName,
                category,
                subCategory,
                regularPrice: parseInt(regularPrice),
                salePrice: parseInt(salePrice),
                quantity,
                description,
                Images: images,
                brand: brand || "Generic",
                material: material || "N/A",
                dimensions: dimensions || "N/A",
                weight: weight || "N/A"
            })

            await newProduct.save()

            return res.json({
                success: true,
                message: "Product added successfully",
                redirectUrl: "/admin/product"
            })
        }

    } catch (error) {

        console.log("Error in saving the Product", error)

        return res.json({
            success: false,
            message: "Error adding product: " + error.message
        })
    }
}

const getEditProduct = async(req, res) => {

    try {

        const id = req.query.id
        const product = await Product.findOne({ _id: id })
        const category = await Category.find({})
        const subCategory = await SubCategory.find({})

        res.render("edit-product", {
            product: product,
            cat: category,
            subCategory: subCategory,
            activePage: "product"
        })

    } catch (error) {

        console.log("Error in getting the edit product page", error)
        res.redirect("/admin/pageerror")
    }
}

const deleteProduct = async(req, res) => {

    try {

        const { productId } = req.params

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: { isDelete: true } },
            { new: true }
        );

        if (updatedProduct) {
            return res.json({ 
                success: true, 
                message: "Product soft deleted successfully" 
            });
        } else {
            return res.json({ 
                success: false, 
                message: "Product not found" 
            });
        }

    } catch (error) {

        console.error("Error in softDeleteProduct", error);
        return res.json({ 
            success: false, 
            message: "Internal server error" 
        });
    }
}

const editProduct = async (req, res) => {

    try {
        
        const id = req.params.id;
        const { productName, category, subCategory, regularPrice, salePrice, quantity, description, brand, material, dimensions, weight } = req.body;

        let images = [];
        const imageFields = ['image1', 'image2', 'image3'];

        for (const field of imageFields) {

            if (req.files && req.files[field] && req.files[field][0]) {
                const file = req.files[field][0];
                const originalImagePath = file.path;
                const resizedImagePath = path.join(__dirname, '../../public/uploads/product-image', 'resized-' + file.filename);
                
                await sharp(originalImagePath)
                    .resize({ width: 400, height: 400 })
                    .toFile(resizedImagePath);
                
                images.push('resized-' + file.filename);
            }
        }

        if (images.length === 0) {
            const currentProduct = await Product.findById(id);
            if (currentProduct) {
                images = currentProduct.Images;
            }
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                name: productName,
                category: category,
                subCategory: subCategory,
                description: description,
                regularPrice: parseInt(regularPrice),
                salePrice: parseInt(salePrice),
                quantity: parseInt(quantity),
                Images: images,
                updatedAt: Date.now(),
                brand: brand || "Generic",
                material: material || "N/A",
                dimensions: dimensions || "N/A",
                weight: weight || "N/A"
            },
            { new: true }
        );

        if (!updatedProduct) {
            return res.json({
                success: false,
                message: "Product not found"
            });
        }

        return res.json({
            success: true,
            message: "Product updated successfully",
            redirectUrl: "/admin/product"
        });

    } catch (error) {
        
        console.error("Error updating product:", error);
        return res.json({
            success: false,
            message: "Internal server error: " + error.message
        });
    }
}

const getListProduct = async (req, res) => {

    try {

        const productId = req.query.id;
        const product = await Product.findByIdAndUpdate(
            productId,
            { $set: { isListed: true } },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        res.json({ success: true, message: "Product has been listed." })

    } catch (error) {

        console.error("Error in getListProduct:", error);
        res.status(500).json({ success: false, message: "Failed to list the product." })

    }
};

const getUnlistProduct = async (req, res) => {

    try {
        
        const productId = req.query.id;
        const product = await Product.findByIdAndUpdate(
            productId,
            { $set: { isListed: false } },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        res.json({ success: true, message: "Product has been unlisted." })

    } catch (error) {

        console.error("Error in getUnlistProduct:", error)
        res.status(500).json({ success: false, message: "Failed to unlist the product." })
    }
};


module.exports = {
    getProductPage,
    addProductPage,
    addProduct,
    getEditProduct,
    deleteProduct,
    editProduct,
    getUnlistProduct,
    getListProduct
}