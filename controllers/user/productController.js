// const Category = require("../../models/categorySchema")
// const Product = require("../../models/productSchema")
// const User = require("../../models/userSchema")



// const getProductdetails = async(req,res)=>{
//     try {
        
//         const userId = req.session.user
//         const userData = await User.findById(userId)
//         const productId = req.query.id
//         const product = await Product.findById(productId).populate("category")
//         const findCategory = product.category
//         res.render("productDetails",{
//             user:userData,
//             product:product,
//             quantity:product.quantity
//         })

//     } catch (error) {

//         console.log("Error in the getProductDetails Page" ,error)
//         res.redirect("/pageNotFound")
//     }
// }


// module.exports = {
//     getProductdetails
// }