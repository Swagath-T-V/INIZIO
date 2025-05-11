const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const SubCategory = require("../../models/subCategorySchema")
const Brand = require("../../models/brandSchema")
const path = require("path")
const sharp = require("sharp")

const getProductPage = async (req, res) => {

    try {

        const search = req.query.search || ""
        const page = parseInt(req.query.page) || 1
        const limit = 6

        const productData = await Product.find({
            isDelete: false,
            name: { $regex: search, $options: "i" },
        })
            .populate("category", "name")
            .populate("subCategory", "name")
            .populate("brand", "name")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Product.countDocuments({
            name: { $regex: search, $options: "i" },
            isDelete: false,
        });

        const category = await Category.find({ isListed: true, isDelete: false }).select('name')
        const subCategory = await SubCategory.find({ isListed: true, isDelete: false }).select('name')
        const brand = await Brand.find({ isListed: true, isDelete: false }).select("name")

        res.render('product', {
            data: productData,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            cat: category,
            subCategory: subCategory,
            brand: brand,
            search: search,
            activePage: "product"
        })


    } catch (error) {

        console.log("error in getProductPage", error)
        res.redirect('/admin/pageerror')

    }
}

const addProductPage = async (req, res) => {

    try {

        const category = await Category.find({ isListed: true, isDelete: false })
        const subCategory = await SubCategory.find({ isListed: true, isDelete: false })
        const brand = await Brand.find({ isListed: true, isDelete: false })

        res.render("addProduct", {
            cat: category,
            subCategory: subCategory,
            brand: brand,
            activePage: "product"
        })

    } catch (error) {

        console.log("Error in addProduct", error)
        res.redirect("/admin/pageerror")

    }
}

const addProduct = async (req, res) => {

    try {

        if (req.method === 'POST') {

            const { productName, category, subCategory, salePrice, quantity, description, brand, dimensions, material, weight } = req.body;

            const existingProduct = await Product.findOne({
                name: { $regex: productName , $options: "i" }
            });

            if (existingProduct && existingProduct.isDelete === true) {

                existingProduct.isDelete = false;
                existingProduct.category = category;
                existingProduct.subCategory = subCategory;
                existingProduct.salePrice = parseInt(salePrice);
                existingProduct.quantity = quantity;
                existingProduct.description = description;
                existingProduct.brand = brand;
                existingProduct.material = material;
                existingProduct.dimensions = dimensions;
                existingProduct.weight = weight;

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
                salePrice: parseInt(salePrice),
                quantity,
                description,
                Images: images,
                brand: brand,
                material: material,
                dimensions: dimensions,
                weight: weight
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

const getEditProduct = async (req, res) => {

    try {

        const id = req.query.id
        const product = await Product.findOne({ _id: id })
        const category = await Category.find({})
        const subCategory = await SubCategory.find({})
        const brand = await Brand.find({})

        res.render("edit-product", {
            product: product,
            cat: category,
            brand: brand,
            subCategory: subCategory,
            activePage: "product"
        })

    } catch (error) {

        console.log("Error in getting the edit product page", error)
        res.redirect("/admin/pageerror")
    }
}

const deleteProduct = async (req, res) => {

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
        const { productName, category, subCategory, salePrice, quantity, description, brand, material, dimensions, weight } = req.body;

        const existingProduct = await Product.findOne({
            name: { $regex: productName , $options : "i"},
            _id: { $ne: id },
            isDelete: false
        });
        
        if (existingProduct) {
            return res.status(400).json({
                success: false,
                message: "Product name already exists"
            });
        }

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

        const currentProduct = await Product.findById(id);
        if (currentProduct && images.length === 0) {
            images = currentProduct.Images;
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                name: productName,
                category: category,
                subCategory: subCategory,
                description: description,
                salePrice: parseInt(salePrice),
                quantity: parseInt(quantity),
                Images: images,
                updatedAt: Date.now(),
                brand: brand,
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
        await Product.findByIdAndUpdate(
            productId,
            { $set: { isListed: true } },
            { new: true }
        )

        res.json({ success: true, message: "Product has been listed." })

    } catch (error) {

        console.error("Error in getListProduct:", error);
        res.json({ success: false, message: "Failed to list the product." })

    }
};

const getUnlistProduct = async (req, res) => {

    try {

        const productId = req.query.id;
        await Product.findByIdAndUpdate(
            productId,
            { $set: { isListed: false } },
            { new: true }
        )

        res.json({ success: true, message: "Product has been unlisted." })

    } catch (error) {

        console.error("Error in getUnlistProduct:", error)
        res.json({ success: false, message: "Failed to unlist the product." })
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