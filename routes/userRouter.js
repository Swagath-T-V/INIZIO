const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const passport = require("passport")
const {userAuth,adminAuth} = require("../middlewares/auth")

router.get("/pageNotFound",userController.pageNotFound)

router.get("/",userController.loadHome)
router.get("/signup",userController.loadSignup)
router.post("/signup",userController.signup)
router.get("/verify-otp",userController.getOptPage)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resentOtp)
router.get("/login",userController.loadLogin)
router.post("/login",userController.login)
router.get("/logout",userController.logout)

router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}))
router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),(req,res)=>{
    res.redirect("/")
})








module.exports= router