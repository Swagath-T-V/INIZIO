const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const passport = require("passport")
const {userAuth,adminAuth} = require("../middlewares/auth")
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productControllers")
const cartController = require("../controllers/user/cartController")


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

//login profile 
router.get("/forgot-password",profileController.getForgotPage)
router.post("/forgot-email-validate",profileController.forgotEmail)
router.get("/forgotPass-otp",profileController.getForgotPassOtp)
router.post("/verify-forgotPass-otp",profileController.verifyForgotPassOtp)
router.post("/resent-otp",profileController.resentOtp)
router.get("/reset-password",profileController.getResetPassword)
router.post("/reset-password",profileController.postnewPassword)

//userProfile
router.get("/userProfile",userAuth,profileController.userProfile)
router.get("/editUserProfile",userAuth,profileController.loadEditProfile)
router.post("/change-profile",userAuth,profileController.changeUserProfile)
router.get('/userVerifyOtp', userAuth,profileController.getUserVerifyOtp);
router.post("/verifyUserOtp",userAuth,profileController.verifyUserOtp)
router.post("/resendUserOtp", userAuth, profileController.resendUserOtp)

//address
router.get("/addressPage",userAuth,profileController.getAddressPage)
router.get("/addAddress",userAuth,profileController.getAddAddress)
router.post("/addAddress",userAuth,profileController.addAddress)
router.get("/editAddress",userAuth,profileController.getEditAddress)
router.post("/editAddress",userAuth,profileController.postEditAddress)
router.get("/deleteAddress",userAuth,profileController.deleteAddress)


//shop
router.get("/shop",userController.loadShopPage)
//products
router.get("/productDetails",productController.productDetails)


//cart 
router.get("/cart",userAuth,cartController.getCartPage)
router.post("/cartAdd",userAuth, cartController.addCart);
router.post("/cartQuantity", userAuth, cartController.cartQuantity);
router.get("/deleteCart", userAuth, cartController.deleteCart);
router.post("/cartCheckout", userAuth, cartController.cartCheckout);

//wishlist
router.get("/wishlist",userAuth,cartController.getWishlist)
router.post("/addWishlist",userAuth,cartController.addWishlist)
router.get("/deleteWishlist",userAuth,cartController.deleteWishlist)







module.exports= router