const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")



const productDetails = async(req,res)=>{
    try {

        const userId = req.session.user
        const userData = await User.findById(userId)
        const productId = req.query.id
        const product = await Product.findById(productId)
        const findCategory = product.category
        
        console.log("this issssssssssss",userId,userData,product,productId)
        res.render("productDetails",{
            product, 
            user: userData
        })
        
    } catch (error) {

        console.log("error in productDetails",error)
        res.redirect("/pageNotFound")
        
    }
}

module.exports = {
    productDetails
}