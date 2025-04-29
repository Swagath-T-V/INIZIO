const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const passport = require("passport")
const { userAuth } = require("../middlewares/auth")
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productControllers")
const cartController = require("../controllers/user/cartController")
const orderController = require("../controllers/user/orderController")
const walletController = require("../controllers/user/walletController")
const shopController = require("../controllers/user/shopController")
const homeController = require("../controllers/user/homeController")
const wishlistController = require("../controllers/user/wishlistController")
const checkOutController = require("../controllers/user/checkOutContoller")
const profileLoginController = require("../controllers/user/profileLoginController")
const profileAddressController = require("../controllers/user/profileAddressController")
const upload = require("../helpers/profileMulter")

//page error
router.get("/pageNotFound", userController.pageNotFound)


//Home 
router.get("/", homeController.loadHome)


//login and signup
router.get("/signup", userController.loadSignup)
router.post("/signup", userController.signup)
router.get("/verify-otp", userController.getOptPage)
router.post("/verify-otp", userController.verifyOtp)
router.post("/resend-otp", userController.resentOtp)
router.get("/login", userController.loadLogin)
router.post("/login", userController.login)
router.get("/logout", userController.logout)


//mail 
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }))
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/signup" }), (req, res) => {
    req.session.user = req.user._id;
    res.redirect("/")
})


//login profile 
router.get("/forgot-password", profileLoginController.getForgotPage)
router.post("/forgot-email-validate", profileLoginController.forgotEmail)
router.get("/forgotPass-otp", profileLoginController.getForgotPassOtp)
router.post("/verify-forgotPass-otp", profileLoginController.verifyForgotPassOtp)
router.post("/resent-otp", profileLoginController.resentOtp)
router.get("/reset-password", profileLoginController.getResetPassword)
router.post("/reset-password", profileLoginController.postnewPassword)

//userProfile
router.get("/userProfile", userAuth, profileController.userProfile)
router.get("/editUserProfile", userAuth, profileController.loadEditProfile)
router.post("/change-profile", userAuth, upload, profileController.changeUserProfile)
router.get('/userVerifyOtp', userAuth, profileController.getUserVerifyOtp);
router.post("/verifyUserOtp", userAuth, profileController.verifyUserOtp)
router.post("/resendUserOtp", userAuth, profileController.resendUserOtp)
router.get("/getChangePassword", userAuth, profileController.getChangePassword)
router.post("/changePassword", userAuth, profileController.changePassword);
router.post("/delete-profile-image", userAuth, profileController.deleteProfileImage);


//address
router.get("/addressPage", userAuth, profileAddressController.getAddressPage)
router.get("/addAddress", userAuth, profileAddressController.getAddAddress)
router.post("/addAddress", userAuth, profileAddressController.addAddress)
router.get("/editAddress", userAuth, profileAddressController.getEditAddress)
router.post("/editAddress", userAuth, profileAddressController.postEditAddress)
router.get("/deleteAddress", userAuth, profileAddressController.deleteAddress)
router.get("/setDefaultAddress", userAuth, profileAddressController.setDefaultAddress)


//shop
router.get("/shop", shopController.loadShopPage)


//products
router.get("/productDetails", productController.productDetails)


//cart 
router.get("/cart", userAuth, cartController.getCartPage)
router.post("/cartAdd", userAuth, cartController.addCart);
router.post("/cartQuantity", userAuth, cartController.cartQuantity);
router.get("/deleteCart", userAuth, cartController.deleteCart);
router.post("/cartCheckout", userAuth, cartController.cartCheckout);

// Coupon Routes
router.post("/applyCoupon", userAuth, cartController.applyCoupon);
router.post("/removeCoupon", userAuth, cartController.removeCoupon);


//wishlist
router.get("/wishlist", userAuth, wishlistController.getWishlist)
router.post("/addWishlist", userAuth, wishlistController.addWishlist)
router.get('/checkWishlist', userAuth, wishlistController.checkWishlist);
router.get("/deleteWishlist", userAuth, wishlistController.deleteWishlist)


//chekOut 
router.get("/checkOut", userAuth, checkOutController.checkOut)
router.post("/editCheckoutAddress", userAuth, checkOutController.editCheckoutAddress)
router.post("/addCheckoutAddress", userAuth, checkOutController.addCheckoutAddress)
router.post("/checkOutSubmit", userAuth, checkOutController.checkOutSubmit)
router.post('/verifyPayment', userAuth, checkOutController.verifyPayment);
router.post('/retryPayment', userAuth, checkOutController.retryPayment);
router.get("/successPage", userAuth, checkOutController.successPage)
router.get('/paymentFailure', userAuth, checkOutController.paymentFailure)


//order
router.get("/getOrderPage", userAuth, orderController.getOrderPage)
router.get("/orderDetails", userAuth, orderController.orderDetails)
router.get("/cancelOrder", userAuth, orderController.cancelOrder)
router.post("/returnProduct", userAuth, orderController.returnProduct)

//invoice
router.get("/getInvoice", userAuth, orderController.getInvoice)

//trackOrder
router.get("/trackOrder", userAuth, orderController.trackOrder)


//wallet
router.get("/walletPage", userAuth, walletController.walletPage)
router.get("/walletViewAll", walletController.walletViewAll)
router.post("/addToWallet", userAuth, walletController.addToWallet)



module.exports = router