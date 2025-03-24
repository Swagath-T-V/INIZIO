const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");

const productDetails = async (req, res) => {

    try {

        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;
        const product = await Product.findOne({_id:productId,isDelete:false,isListed:true});
        
        if (!product ) {
            return res.redirect("/shop");
        }

        const findCategory = await Category.findOne({ name: product.category, isListed: true });
        
        if (!findCategory) {
            return res.redirect("/shop");
        }
        
        const relatedProducts = await Product.find({
            isDelete:false,
            category: product.category,
            _id: { $ne: productId },
            quantity: { $gt: 0 }
        }).limit(4);

        res.render("productDetails", {
            product,
            user: userData,
            products: relatedProducts
        });
        
    } catch (error) {
        
        console.log("Error in productDetails:", error);
        res.redirect("/pageNotFound");
    }
};

module.exports = {
    productDetails
};