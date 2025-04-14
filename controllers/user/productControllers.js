const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Offer = require("../../models/offerSchema");

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;

        if (!productId) {
            return res.redirect("/shop");
        }

        const product = await Product.findOne({ _id: productId, isDelete: false, isListed: true })
            .populate('category', 'name')
            .populate('subCategory', 'name')
            .lean();

        if (!product) {
            return res.redirect("/shop");
        }

        const allOffers = await Offer.find({ isListed: true, isDelete: false, validUpto: { $gte: new Date() } })
            .populate('applicableTo')
            .lean();

        const offers = allOffers.filter(item => {
            const offerId = item.applicableTo?._id?.toString();
            return (
                item.offerType === 'Category' && offerId === product.category._id.toString() ||
                item.offerType === 'subCategory' && offerId === product.subCategory._id.toString() ||
                item.offerType === 'Product' && offerId === product._id.toString()
            );
        });

        let bestOffer = null;
        let discountedPrice = product.salePrice;

        if (offers.length > 0) {
            bestOffer = offers.reduce((best, current) => {
                const bestDiscount = best ? 
                    (best.discountType === 'percentage' ? (product.salePrice * best.discountAmount / 100) : best.discountAmount) : 0;
                const currentDiscount = current.discountType === 'percentage' ? 
                    (product.salePrice * current.discountAmount / 100) : current.discountAmount;
                return currentDiscount > bestDiscount ? current : best;
            }, null);

            if (bestOffer) {
                const discountAmount = bestOffer.discountType === 'percentage' ?
                    (product.salePrice * bestOffer.discountAmount / 100) :
                    Math.min(bestOffer.discountAmount, product.salePrice); 
                discountedPrice = Math.max(0, product.salePrice - discountAmount); 
            }
        }

        const relatedProducts = await Product.find({
            isDelete: false,
            category: product.category._id,
            _id: { $ne: productId },
            quantity: { $gt: 0 }
        })
            .populate('category', 'name')
            .populate('subCategory', 'name')
            .limit(4)
            .lean();

        res.render("productDetails", {
            product,
            user: userData,
            products: relatedProducts,
            offers,
            bestOffer,
            discountedPrice 
        });
    } catch (error) {
        console.log("Error in productDetails:", error);
        res.redirect("/pageNotFound");
    }
};

module.exports = {
    productDetails
};