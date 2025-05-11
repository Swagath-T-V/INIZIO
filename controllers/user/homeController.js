const SubCategory = require("../../models/subCategorySchema")
const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")

const loadHome = async (req, res) => {

    try {
 
        const userId = req.session.user

        const activeBrands = await Brand.find({ isListed: true, isDelete: false }).select('_id');
        const activeCategories = await Category.find({ isListed: true, isDelete: false }).select('_id');
        const activeSubCategories = await SubCategory.find({ isListed: true, isDelete: false }).select('_id');

        if (userId) {

            const userData = await User.findOne({ _id: userId });

            if (userData && userData.isBlocked) {
                req.session.destroy()
                return res.redirect('/login')
            }
            
            let productData = await Product.find({
                isDelete: false,
                isListed: true,
                category: { $in: activeCategories.map(cat => cat._id) },
                brand: { $in: activeBrands.map(b => b._id) },
                subCategory: { $in: activeSubCategories.map(s => s._id) }
            })
            .populate("category brand subCategory")
            .sort({ createdAt: -1 })
            .limit(4);

            return res.render("home", {
                user: userData,
                product: productData

            });
        }

        let productData = await Product.find({
            isDelete: false,
            isListed: true,
            category: { $in: activeCategories.map(cat => cat._id) },
            brand: { $in: activeBrands.map(b => b._id) },
            subCategory: { $in: activeSubCategories.map(s => s._id) }
        })
        .populate("category brand subCategory")
        .sort({ createdAt: -1 })
        .limit(4);

        return res.render("home", { 
            product: productData 
        });

    } catch (error) {

        console.log("HOME page error", error);
        res.status(500).send("server error");

    }
};

module.exports = {
    loadHome,
}