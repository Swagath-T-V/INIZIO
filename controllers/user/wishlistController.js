const Product = require("../../models/productSchema")
const User = require("../../models/userSchema")
const Wishlist = require("../../models/wishlistSchema")


const getWishlist = async (req, res) => {

    try { 

        const userId = req.session.user
        const user = await User.findById(userId)
        if (!user) {
            return res.redirect("/login")
        }

        const wishlist = await Wishlist.findOne({ userId }).populate("products.productId")
        const wishlistItems = wishlist ? wishlist.products : []

        res.render("wishlist", { 
            user, 
            wishlistItems 
        })

    } catch (error) {

        console.log("Error in getWishlist", error)
        res.redirect("/pageNotFound")

    }

};


const addWishlist = async (req, res) => {

    try {

        const userId = req.session.user

        const { productId } = req.body

        const user = await User.findById(userId)

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Please log in to add items to your wishlist",
                redirectUrl: "/login",
            });
        }

        const product = await Product.findById(productId)
        if (!product) {
            return res.status(404).json({ message: "Product not found" })
        }

        let wishlist = await Wishlist.findOne({ userId })
        if (!wishlist) {
            
            wishlist = new Wishlist({ 
                userId, 
                products: [] 
            })
        }

        const itemIndex = wishlist.products.findIndex((item) => item.productId.toString() === productId)

        if (itemIndex === -1) {

            wishlist.products.push({ productId })

            await wishlist.save()

            return res.status(200).json({
                success: true,
                message: "Product added to wishlist",
                productId,
                added: true,
            })

        } else {

            wishlist.products.splice(itemIndex, 1)

            await wishlist.save()

            return res.status(200).json({
                success: true,
                message: "Product removed from wishlist",
                productId,
                added: false,
            })

        }

    } catch (error) {

        console.log("Error in addWishlist:", error);
        return res.status(500).json({ success: false, message: "Server error" });

    }
};


const checkWishlist = async (req, res) => {

    try {

        const userId = req.session.user
        const { productId } = req.query

        if (!userId) {
            return res.redirect("/login")
        }

        const wishlist = await Wishlist.findOne({ userId: userId })
        const inWishlist = wishlist && wishlist.products.some(item => item.productId.toString() === productId)

        res.status(200).json({ inWishlist })

    } catch (error) {

        console.log("Error in checkWishlist:", error)
        return res.redirect("/pageNotFound")

    }
}


const deleteWishlist = async (req, res) => {

    try {

        const userId = req.session.user
        const { productId } = req.query

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login first' });
        }

        const wishlist = await Wishlist.findOne({ userId: userId })
        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }

        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        )

        return res.status(200).json({ success: true, message: 'Item removed from wishlist' });

    } catch (error) {

        console.log("Error in deleteWishlist:", error);
        return res.status(500).json({ success: false, message: 'Server error' });

    }
}



module.exports = {

    getWishlist,
    addWishlist,
    checkWishlist,
    deleteWishlist,

}