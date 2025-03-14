const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const productController = require("../controllers/user/productController")
const passport = require("passport")
const {userAuth,adminAuth} = require("../middlewares/auth")



//page error
router.get("/pageNotFound",userController.pageNotFound)

//login and signup
router.get("/",userController.loadHome)
router.get("/signup",userController.loadSignup)
router.post("/signup",userController.signup)
router.get("/verify-otp",userController.getOptPage)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resentOtp)
router.get("/login",userController.loadLogin)
router.post("/login",userController.login)
router.get("/logout",userController.logout)

//mail
router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}))
router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),(req,res)=>{
    req.session.user = req.user._id;
    res.redirect("/")
})



module.exports= router