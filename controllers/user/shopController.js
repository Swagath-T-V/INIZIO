const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const SubCategory = require("../../models/subCategorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")


const loadShopPage = async (req, res) => {

    try {

        const user = req.session.user;
        let userData = null;

        if (user) {

            userData = await User.findById(user);

            if (userData && userData.isBlocked) {
                req.session.destroy();
                return res.redirect('/login');
            }
        }

        const activeCategories = await Category.find({ isListed: true, isDelete: false }).lean();
        const activeSubCategories = await SubCategory.find({ isListed: true, isDelete: false }).lean();
        const activeBrands = await Brand.find({ isListed: true, isDelete: false }).lean();

        const { page = 1, query = '', sort, category, subCategory, priceFrom, priceTo, clear, brand } = req.query;
        const limit = 9;
        const skip = (page - 1) * limit;

        let filter = {
            isDelete: false,
            isListed: true,
            category: { $in: activeCategories.map(cat => cat._id) },
            subCategory: { $in: activeSubCategories.map(sub => sub._id) },
            brand: { $in: activeBrands.map(sub => sub._id) }
        };

        if (clear === 'true') {
            return res.redirect('/shop?page=1');
        }

        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }

        let selectedCategory = category || 'all';
        let selectedSubCategory = subCategory || 'all';
        let selectedBrand = brand || "all"

        if (selectedCategory && selectedCategory !== 'all') {

            const cat = await Category.findOne({ _id: selectedCategory, isListed: true, isDelete: false });

            if (cat) {
                filter.category = cat._id;
            } else {
                selectedCategory = 'all';
                filter.category = { $in: activeCategories.map(cat => cat._id) };
            }
        }

        if (selectedSubCategory && selectedSubCategory !== 'all') {

            const sub = await SubCategory.findOne({ _id: selectedSubCategory, isListed: true, isDelete: false });

            if (sub) {
                filter.subCategory = sub._id;
            } else {
                selectedSubCategory = 'all';
                filter.subCategory = { $in: activeSubCategories.map(sub => sub._id) };
            }
        }

        if (selectedBrand && selectedBrand !== 'all') {

            const br = await Brand.findOne({ _id: selectedBrand, isListed: true, isDelete: false });

            if (br) {

                filter.brand = br._id;

            } else {

                selectedBrand = 'all';
                filter.brand = { $in: activeBrands.map(b => b._id) };
            }
        }

        if (priceFrom || priceTo) {

            filter.salePrice = {};
            if (priceFrom) filter.salePrice.$gte = Number(priceFrom);
            if (priceTo) filter.salePrice.$lte = Number(priceTo);
        }

        const sortOptions = {
            'price-low-high': { salePrice: 1 },
            'price-high-low': { salePrice: -1 },
            'name-asc': { name: 1 },
            'name-desc': { name: -1 },
            'new-arrivals': { createdAt: -1 }
        };
        const sortQuery = sortOptions[sort] || { createdAt: -1 };

        const totalProducts = await Product.countDocuments(filter);

        const products = await Product.find(filter)
            .populate('category subCategory brand')
            .sort(sortQuery)
            .skip(skip)
            .limit(limit)
            .lean();

        res.render('shop', {
            user: userData,
            products,
            category: activeCategories,
            subCategory: activeSubCategories,
            brand: activeBrands,
            totalPages: Math.ceil(totalProducts / limit),
            currentPage: Number(page),
            query,
            sort,
            selectedCategory,
            selectedSubCategory,
            selectedBrand,
            priceFrom: priceFrom || '',
            priceTo: priceTo || ''
        });

    } catch (error) {

        console.error('Shop page error:', error);
        res.redirect('/pageNotFound');

    }
}



module.exports = {

    loadShopPage,

}