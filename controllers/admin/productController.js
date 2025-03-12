const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")
const Brand = require("../../models/brandSchema")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")


const getProductPage = async(req,res)=>{

    try {
        
        const search = req.query.search || ""
        const page = req.query.page || 1
        const limit = 4

        const productData = await Product.find({
            isDeleted:false,
            $or:[
                {name: { $regex: search, $options: "i" }}
            ],
          }).limit(limit*1)
            .skip((page-1)*limit)
            .populate('category')
            .exec();
        
            // console.log(productData);

const count = await Product.find({
    isDeleted:false,
    $or:[
      {name: {$regex: new RegExp("." + search + ".", "i")}},
      {brand: {$regex: new RegExp("." + search + ".", "i")}}
    ],
  }).countDocuments();

          const category = await Category.find({isListed:true,isDeleted:false})
          const brand = await Brand.find({isListed:true,isDeleted:false})

          if(category && brand){
            res.render('product',{
                data:productData,
                currentPage:page,
                totalPages:Math.ceil(count/limit),
                cat:category,
                brand:brand,
                activePage:"product"

            })
          }else{
            res.render('page-404')
          }
    } catch (error) {
        res.redirect('/admin/pageerror')
    }  
}

const addProductPage = async(req,res)=>{

    try {

        const category = await Category.find({isListed:true,isDelete:false})
        const brand = await Brand.find({isListed:true,isDelete:false})
        res.render("addProduct",{
            cat:category,
            brand:brand,
            activePage:"product"
        })
        
    } catch (error) {

        console.log("Error in addProduct",error)
        res.redirect("/admin/pageerror")

    }
    
}


const addProduct = async(req, res) => {
    try {
        const {productName, brand, category, status, subCategory, regularPrice, salePrice, quantity, description} = req.body
        
        // console.log(productName, brand, category, status, subCategory, regularPrice, salePrice, quantity, description)
        
        const productExists = await Product.findOne({
            name: productName 
        })

        if(!productExists) {
            const images = []
            
            const imageFields = ['image1', 'image2', 'image3']
            
            for(const field of imageFields) {
                if(req.files && req.files[field] && req.files[field][0]) {
                    const file = req.files[field][0]
                    const originalImagePath = file.path
                    const resizedImagePath = path.join(__dirname, '../../public/uploads/product-image', 'resized-' + file.filename)
                    
                    await sharp(originalImagePath)
                        .resize({width: 400, height: 400})
                        .toFile(resizedImagePath)
                    
                    images.push('resized-' + file.filename)
                }
            }
            
            const categoryId = await Category.findOne({name: category})

            if(!categoryId) {
                return res.status(400).json("Invalid category name")
            }

            const newProduct = new Product({
                name: productName,
                brand: brand,
                category: category,
                status: status,
                subCategory: subCategory,
                description: description,
                regularPrice: parseInt(regularPrice),
                salePrice: parseInt(salePrice),
                quantity: quantity,
                Images: images, 
                createdAt: Date.now()
            }) 
            
            await newProduct.save()
            return res.redirect("/admin/product")
        } else {
            return res.status(400).json("Product already exists. Please try with another name")
        }
    } catch (error) {
        console.log("Error in saving the Product", error)
        return res.redirect("/admin/pageerror")
    }
}

const getEditProduct = async(req,res)=>{
    try {

        const id = req.query.id
        const product = await Product.findOne({_id:id})
        const category = await Category.find({})
        const brand = await Brand.find({})
        res.render("edit-product",{
            product:product,
            cat:category,
            brand:brand,
            activePage:"product"
        })
        
    } catch (error) {

        console.log("Error in getting the edit product page",error)
        res.redirect("/admin/pageerror")
        
    }
}

const deleteProduct = async(req,res)=> {
    try {
        const { productId } = req.params;
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: { isDeleted: true } },
            { new: true }
        );

        if (updatedProduct) {
            res.status(200).json({ success: true, message: "Product soft deleted successfully" });
        } else {
            res.status(404).json({ success: false, message: "Product not found" });
        }
    } catch (error) {
        console.error("Error in softDeleteProduct", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const { productName, brand, category, status, subCategory, regularPrice, salePrice, quantity, description } = req.body;
        // console.log(productName, brand, category, status, subCategory, regularPrice, salePrice, quantity, description)

        
        const existingProduct = await Product.findOne({
            name: productName,
            _id: { $eq: id }  
        });
        
        if (existingProduct) {
            return res.status(400).json({
                success: false,
                message: "Product with this name already exists"
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
                brand: brand,
                category: category,
                status: status,
                subCategory: subCategory,
                description: description,
                regularPrice: parseInt(regularPrice),
                salePrice: parseInt(salePrice),
                quantity: parseInt(quantity),
                Images: images,
                updatedAt: Date.now()
            },
            { new: true }
        );
        
        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
            redirectUrl: "/admin/product"
        });
    } catch (error) {
        console.error("Error updating product:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error: " + error.message
        });
    }
};


module.exports = {
    getProductPage,
    addProductPage,
    addProduct,
    getEditProduct,
    deleteProduct,
    editProduct
}