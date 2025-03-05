const express =require("express")
const router = express.Router()
const adminController = require("../controllers/admin/adminController")
const customerController = require("../controllers/admin/customerController")
const {adminAuth,userAuth}= require("../middlewares/auth")


router.get("/pageerror",adminController.pageerror)

//login management
router.get("/login",adminController.loadLogin)
router.post("/login",adminController.login)
router.get("/",adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout)

//coustomer management
router.get("/users",adminAuth,customerController.customerInfo)



module.exports = router