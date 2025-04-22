const express =require("express")
const router = express.Router()
const adminController = require("../controllers/admin/adminController")
const customerController = require("../controllers/admin/customerController")
const {adminAuth,userAuth}= require("../middlewares/auth")
const categoryController = require("../controllers/admin/categoryController")
const subCategoryController = require("../controllers/admin/subCategoryContoller")
const productController = require("../controllers/admin/productController")
const multer = require("multer")
const storage = require("../helpers/multer")
const uploads = multer({storage:storage})
const orderController = require("../controllers/admin/orderController")
const couponController  = require("../controllers/admin/couponController")
const offerController = require('../controllers/admin/offerController')
const dashboardController =  require("../controllers/admin/dashboardController")
const walletController =  require("../controllers/admin/walletController")


//adminpage error
router.get("/pageerror",adminController.pageerror)

//login 
router.get("/login",adminController.loadLogin)
router.post("/login",adminController.login)
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

//subCategory
router.get("/subCategory",adminAuth,subCategoryController.subCategoryInfo)
router.get("/addSubCategory",adminAuth,subCategoryController.addSubCategory)
router.post("/addSubCategory",adminAuth,subCategoryController.addSubCategory)
router.get("/listSubCategory",adminAuth,subCategoryController.getListSubCategory)
router.get("/unlistSubCategory",adminAuth,subCategoryController.getUnlistSubCategory)
router.get("/editSubCategory",adminAuth,subCategoryController.getEditSubCategory)
router.post("/editSubCategory/:id",adminAuth,subCategoryController.editSubCategory)
router.patch("/deleteSubCategory/:subCategoryId",adminAuth,subCategoryController.deleteSubCategory)

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
router.get("/listProduct", adminAuth, productController.getListProduct); 
router.get("/unlistProduct", adminAuth, productController.getUnlistProduct);


//order
router.get("/getOrderPage",adminAuth,orderController.getOrderPage)
router.get("/adminOrderDetails",adminAuth,orderController.getAdminOrderDetails)
router.post("/updateOrderStatus",adminAuth,orderController.updateOrderStatus)

//coupons
router.get("/coupon",adminAuth,couponController.loadCoupon)
router.get("/addCoupon",adminAuth,couponController.getAddCoupon)
router.post("/addCoupon",adminAuth,couponController.addCoupon)
router.get("/editCoupon",adminAuth,couponController.getEditCoupon)
router.post("/editCoupon",adminAuth,couponController.editCoupon)
router.patch("/deleteCoupon/:couponId",adminAuth,couponController.deleteCoupon)

//offers
router.get("/offer",adminAuth,offerController.getOffer)
router.get("/addOffer",adminAuth,offerController.getAddOffer)
router.post("/addOffer",adminAuth,offerController.addOffer)
router.get("/getEditOffer",adminAuth,offerController.getEditOffer)
router.post('/editOffer',adminAuth,offerController.editOffer)
router.get("/listOffer",adminAuth,offerController.listOffer)
router.get("/unlistOffer",adminAuth,offerController.unlistOffer)
router.patch("/deleteOffer",adminAuth,offerController.deleteOffer)
 
//dashboard 
router.get("/",adminAuth,dashboardController.loadDashboard)
router.get("/sales-report",adminAuth,dashboardController.getSalesReport);
router.get("/sales-chart",adminAuth,dashboardController.getSalesChart);
router.get("/sales-report-excel",adminAuth,dashboardController.getSalesReportExcel);

//wallet
router.get("/getWallet",adminAuth,walletController.getWallet)
router.get("/viewWallet",adminAuth,walletController.viewWallet)
router.get("/viewWalletDetails",adminAuth,walletController.viewWalletDetails)

module.exports = router