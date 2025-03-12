const express =require("express")
const router = express.Router()
const adminController = require("../controllers/admin/adminController")
const customerController = require("../controllers/admin/customerController")
const {adminAuth,userAuth}= require("../middlewares/auth")
const categoryController = require("../controllers/admin/categoryController")
const brandController = require("../controllers/admin/brandController")
const productController = require("../controllers/admin/productController")
const multer = require("multer")
const storage = require("../helpers/multer")
const uploads = multer({storage:storage})


//adminpage error
router.get("/pageerror",adminController.pageerror)

//login 
router.get("/login",adminController.loadLogin)
router.post("/login",adminController.login)
router.get("/",adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout)

//coustomer 
router.get("/users",adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked)

//category
router.get("/category",adminAuth,categoryController.categoryInfo)
router.get("/addCategory",adminAuth,categoryController.addCategory)
router.post("/addCategory",adminAuth,categoryController.addCategory)
router.get("/listCategory",adminAuth,categoryController.getListCategory)
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory)
router.get("/editCategory",adminAuth,categoryController.getEditCategory)
router.post("/editCategory/:id",adminAuth,categoryController.editCategory)
router.patch("/deleteCategory/:categoryId",adminAuth,categoryController.deleteCategory)

//Brand
router.get("/brand",adminAuth,brandController.getBrandPage)
router.get("/addBrand",adminAuth,brandController.addBrand)
router.post("/addBrand",adminAuth,brandController.addBrand)
router.get("/listBrand",adminAuth,brandController.getListBrand)
router.get("/unlistBrand",adminAuth,brandController.getUnlistBrand)
router.get("/editBrand",adminAuth,brandController.getEditBrand)
router.post("/editBrand/:id",adminAuth,brandController.editBrand)
router.patch("/deleteBrand/:brandId",adminAuth,brandController.deleteBrand)

//Product 
router.get("/product",adminAuth,productController.getProductPage)
router.get("/addProduct",adminAuth,productController.addProductPage)
router.post("/addProduct", adminAuth, uploads.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 }
]), productController.addProduct)
router.get("/editProduct",adminAuth,productController.getEditProduct)
router.post("/editProduct/:id", adminAuth, uploads.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 }
]), productController.editProduct);
router.patch("/deleteProduct/:productId",adminAuth,productController.deleteProduct)




















module.exports = router