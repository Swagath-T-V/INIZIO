const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")
const User = require("../../models/userSchema")
const Wishlist = require("../../models/wishlistSchema")
const Cart = require("../../models/cartSchema")
const Address = require("../../models/addressSchema")
const Offer = require("../../models/offerSchema")
const Coupons = require("../../models/couponSchema")
const { calculateShippingCharge } = require("../../utils/shippingCharge")


 
const getCartPage = async (req, res) => {

    try {

        const userId = req.session.user;
        const user = await User.findById(userId);

        const cart = await Cart.findOne({ userId })
        .populate({
            path: "items.productId",
            match: { isDelete: false, isListed: true },
            populate: [
                { path: "category", select: "name" },
                { path: "subCategory", select: "name" },
                { path: "brand", select: "name" },
            ],
        })
        .populate("appliedCoupon");
        
        if (!cart ) {

            return res.render("cart", {
                user,
                cartItems: [],
                coupons: 0,
                appliedCoupon: null, 
            });
        }

        const coupons = await Coupons.find({
            status: "Active",
            isDelete: false,
            startingDate: { $lte: new Date() },
            expireOn: { $gte: new Date() },
        }).lean();

        const allOffers = await Offer.find({
            isListed: true,
            isDelete: false,
            validUpto: { $gte: new Date() },
        })
        .populate("applicableTo")
        .lean();
        // console.log("offer",allOffers)

        let total = 0;
        let offerDiscount = 0;
        const itemsInCart = cart.items.map((item) => {
            const product = item.productId;

            const applicableOffers = allOffers.filter((offer) => {
                const offerId = offer.applicableTo?._id?.toString();
                return (
                    (offer.offerType === "Category" && offerId === product.category?._id?.toString()) ||
                    (offer.offerType === "subCategory" && offerId === product.subCategory?._id?.toString()) ||
                    (offer.offerType === "Product" && offerId === product._id.toString()) ||
                    (offer.offerType === "Brand" && offerId === product.brand?._id?.toString())
                );
            });

            let bestOffer = null;
            let discountedPrice = item.price;
            let offerAmount = 0;

            if (applicableOffers.length > 0) {
                bestOffer = applicableOffers.reduce((best, current) => { 
                    const bestDiscount = best ? (item.price * best.discountAmount) / 100 : 0;
                    const currentDiscount = (item.price * current.discountAmount) / 100;
                    return currentDiscount > bestDiscount ? current : best;
                }, null);

                if (bestOffer) {
                    const discountAmount = (item.price * bestOffer.discountAmount) / 100;
                    discountedPrice = Math.max(0, item.price - discountAmount);
                    offerAmount = discountAmount * item.quantity;
                }
            }

            const itemTotal = discountedPrice * item.quantity;
            total += itemTotal;
            offerDiscount += offerAmount;
            
            return {
                ...item.toObject(),
                product,
                bestOffer,
                discountedPrice,
                totalPrice: itemTotal,
                offerAmount, 
            };
        });

        let couponDiscount = 0;
        let appliedCoupon = cart.appliedCoupon;

        if (cart.appliedCoupon) {
            const coupon = cart.appliedCoupon;
            let isCouponValid = true;
            for (const item of cart.items) {
                const product = item.productId;

                if (!product) continue;

                const used = user.usedDiscounts.find((d) => d.productId.toString() === product._id.toString() && d.couponId && d.couponId.toString() === coupon._id.toString() );

                if (used) {
                    isCouponValid = false;
                    break;
                }
            }

            if (total < coupon.minimumPurchase || !isCouponValid) {
                await Cart.updateOne(
                    { userId },
                    {
                        $unset: { appliedCoupon: 1 },
                        couponDiscount: 0,
                        totalAmount: total,
                    }
                );
                appliedCoupon = null;
            } else {
                couponDiscount = coupon.offerPrice;
                total -= couponDiscount;
            }
        }

        await Cart.updateOne(
            { userId },
            {
                totalAmount: total,
                offerDiscount,
                couponDiscount,
            }
        );

        const availableCoupons = coupons.filter((coupon) => {
            return !cart.items.some((item) => {
                const product = item.productId;
                if (!product) return false;
                return user.usedDiscounts.some((d) => d.productId.toString() === product._id.toString() && d.couponId && d.couponId.toString() === coupon._id.toString() );
            });
        });

        res.render("cart", {
            user,
            cartItems: itemsInCart,
            total,
            coupons: availableCoupons,
            appliedCoupon,
            offerDiscount,
            couponDiscount,
        });

    } catch (error) {

        console.error("Error in getCartPage:", error);
        res.redirect("/pageNotFound");
    }
};



const applyCoupon = async (req, res) => {

    try {

        const userId = req.session.user;
        const { couponCode } = req.body;
 
        const coupon = await Coupons.findOne({
            couponCode,
            status: "Active",
            isDelete: false,
            startingDate: { $lte: new Date() },
            expireOn: { $gte: new Date() },
        });

        const user = await User.findById(userId);

        const cart = await Cart.findOne({ userId }).populate({
            path: "items.productId",
            match: { isDelete: false, isListed: true },
            populate: [
                { path: "category", select: "name" },
                { path: "subCategory", select: "name" },
                { path: "brand", select: "name" },
            ],
        });

        for (const item of cart.items) {
            const product = item.productId;
            if (!product) continue;
            const used = user.usedDiscounts.find( (d) => d.productId.toString() === product._id.toString() && d.couponId && d.couponId.toString() === coupon._id.toString() );

            if (used) {
                return res.json({ success: false, message: `This coupon has already been used for ${product.name}` });
            }
        }

        const allOffers = await Offer.find({
            isListed: true,
            isDelete: false,
            validUpto: { $gte: new Date() },
        })
        .populate("applicableTo")
        .lean();

        let total = 0;
        let offerDiscount = 0;

        cart.items.forEach((item) => {
            const product = item.productId;
            if (!product) return;

            let discountedPrice = item.price;
            const applicableOffers = allOffers.filter((offer) => {
                const offerId = offer.applicableTo?._id?.toString();
                return (
                    (offer.offerType === "Category" && offerId === product.category?._id?.toString()) ||
                    (offer.offerType === "subCategory" && offerId === product.subCategory?._id?.toString()) ||
                    (offer.offerType === "Product" && offerId === product._id.toString()) ||
                    (offer.offerType === "Brand" && product.brand && offerId === product.brand._id?.toString())
                );
            });

            if (applicableOffers.length > 0) {
                const bestOffer = applicableOffers.reduce((best, current) => {
                    const bestDiscount = best ? (item.price * best.discountAmount) / 100 : 0;
                    const currentDiscount = (item.price * current.discountAmount) / 100;
                    return currentDiscount > bestDiscount ? current : best;
                }, null);

                if (bestOffer) {
                    const discountAmount = (item.price * bestOffer.discountAmount) / 100;
                    discountedPrice = Math.max(0, item.price - discountAmount);
                }
            }

            total += discountedPrice * item.quantity;
            offerDiscount += (item.price - discountedPrice) * item.quantity;
        });

        if (total < coupon.minimumPurchase) {
            return res.json({ success: false, message: `Minimum purchase of ₹${coupon.minimumPurchase} required to apply this coupon` });
        }

        const couponDiscount = coupon.offerPrice;
        const finalTotal = total - couponDiscount;

        await Cart.updateOne(
            { userId },
            {
                appliedCoupon: coupon._id,
                totalAmount: finalTotal,
                offerDiscount,
                couponDiscount,
            }
        );

        return res.json({
            success: true,
            message: `Coupon "${coupon.couponName}" applied successfully! You saved ₹${coupon.offerPrice}.`,
            totalAmount: finalTotal,
            couponDiscount,
            offerDiscount,
        });

    } catch (error) {

        console.error("Error in applyCoupon:", error);
        return res.json({ success: false, message: "Internal server error" });
    }
};

const removeCoupon = async (req, res) => {

    try {

        const userId = req.session.user;
        const { couponId } = req.body;

        const user = await User.findById(userId);
        if(!user){
           return res.redirect("/login")
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: "items.productId",
            match: { isDelete: false, isListed: true },
            populate: [
                { path: "category", select: "name" },
                { path: "subCategory", select: "name" },
                { path: "brand", select: "name" },
            ],
        });


        if (!cart.appliedCoupon || cart.appliedCoupon.toString() !== couponId) {
            return res.json({ success: false, message: "No coupon applied or invalid coupon ID" });
        }

        const allOffers = await Offer.find({
            isListed: true,
            isDelete: false,
            validUpto: { $gte: new Date() },
        })
        .populate("applicableTo")
        .lean();

        let total = 0;
        let offerDiscount = 0;

        cart.items.forEach((item) => {
            const product = item.productId;
            if (!product) return;

            let discountedPrice = item.price;
            
            const applicableOffers = allOffers.filter((offer) => {
                const offerId = offer.applicableTo?._id?.toString();
                return (
                    (offer.offerType === "Category" && offerId === product.category?._id?.toString()) ||
                    (offer.offerType === "subCategory" && offerId === product.subCategory?._id?.toString()) ||
                    (offer.offerType === "Product" && offerId === product._id.toString()) ||
                    (offer.offerType === "Brand" && offerId === product.brand._id?.toString())
                );
            });

            if (applicableOffers.length > 0) {
                const bestOffer = applicableOffers.reduce((best, current) => {
                    const bestDiscount = best ? (item.price * best.discountAmount) / 100 : 0;
                    const currentDiscount = (item.price * current.discountAmount) / 100;
                    return currentDiscount > bestDiscount ? current : best;
                }, null);

                if (bestOffer) {
                    const discountAmount = (item.price * bestOffer.discountAmount) / 100;
                    discountedPrice = Math.max(0, item.price - discountAmount);
                }
            }

            total += discountedPrice * item.quantity;
            offerDiscount += (item.price - discountedPrice) * item.quantity;
        });

        await Cart.updateOne(
            { userId },
            {
                $unset: { appliedCoupon: 1 },
                totalAmount: total,
                offerDiscount,
                couponDiscount: 0,
            }
        );

        return res.json({
            success: true,
            message: "Coupon removed successfully",
            totalAmount: total,
            offerDiscount,
            couponDiscount: 0,
        });

    } catch (error) {

        console.error("Error in removeCoupon:", error);
        return res.json({ success: false, message: "Internal server error" });

    }
};


const addCart = async (req, res) => {

    try {

        const userId = req.session.user;
        const user = await User.findById(userId);
        const { productId, quantity = 1 } = req.body;
        const MAX_CART_QUANTITY = 10;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Please log in to add items to your cart",
                redirectUrl: "/login",
            });
        }

        const product = await Product.findById(productId).populate([
            { path: "category", select: "name isListed isDelete" },
            { path: "subCategory", select: "name" },
            { path: "brand", select: "name" },
        ]);

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        if (!product.isListed || product.isDelete) {
            return res.status(400).json({ message: "This product is unavailable" });
        }

        const category = await Category.findOne({ _id: product.category });
        if (!category || !category.isListed || category.isDelete) {
            return res.status(400).json({
                success: false,
                message: "This product's category is unavailable",
            });
        }

        const requestedQuantity = parseInt(quantity);
        const maxAllowed = Math.min(MAX_CART_QUANTITY, product.quantity);
        const currentQuantity = parseInt(product.quantity);

        if (currentQuantity < 1) {
            return res.status(400).json({ success: false, message: "Out of stock" });
        }

        if (requestedQuantity > maxAllowed) {
            return res.status(400).json({
                success: false,
                message: `You can only add up to ${maxAllowed} items of this product to the cart`,
            });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const allOffers = await Offer.find({
            isListed: true,
            isDelete: false,
            validUpto: { $gte: new Date() },
        })
        .populate("applicableTo")
        .lean();

        const applicableOffers = allOffers.filter((offer) => {
            const offerId = offer.applicableTo?._id?.toString();
            return (
                (offer.offerType === "Category" && offerId === product.category?._id?.toString()) ||
                (offer.offerType === "subCategory" && offerId === product.subCategory?._id?.toString()) ||
                (offer.offerType === "Product" && offerId === product._id.toString()) ||
                (offer.offerType === "Brand" && offerId === product.brand?._id?.toString())
            );
        });

        let bestOffer = null;
        let discountedPrice = product.salePrice;
        let offerAmount = 0;

        if (applicableOffers.length > 0) {
            bestOffer = applicableOffers.reduce((best, current) => {
                const bestDiscount = best ? (product.salePrice * best.discountAmount) / 100 : 0;
                const currentDiscount = (product.salePrice * current.discountAmount) / 100;
                return currentDiscount > bestDiscount ? current : best;
            }, null);

            if (bestOffer) {
                const discountAmount = (product.salePrice * bestOffer.discountAmount) / 100;
                offerAmount = discountAmount * requestedQuantity; 
                discountedPrice = Math.max(0, product.salePrice - discountAmount);
            }
        }

        const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);

        if (itemIndex > -1) {
            const currentQuantity = cart.items[itemIndex].quantity;
            const newQuantity = currentQuantity + requestedQuantity;

            if (newQuantity > maxAllowed) {
                return res.status(400).json({
                    success: false,
                    message: `You can only add up to ${maxAllowed} items of this product to the cart`,
                });
            }

            cart.items[itemIndex].quantity = newQuantity;
            cart.items[itemIndex].price = product.salePrice;
            cart.items[itemIndex].totalPrice = newQuantity * discountedPrice;
            cart.items[itemIndex].offerAmount = offerAmount;

        } else {

            cart.items.push({
                productId,
                quantity: requestedQuantity,
                price: product.salePrice,
                totalPrice: discountedPrice * requestedQuantity,
                offerAmount, 
            });
        }

        let total = 0;
        let offerDiscount = 0;

        for (const item of cart.items) {
            const itemProduct = item.productId.equals(productId)
                ? product
                : await Product.findById(item.productId).populate([
                    { path: "category", select: "name" },
                    { path: "subCategory", select: "name" },
                    { path: "brand", select: "name" },
                ]);

            if (!itemProduct) continue;

            let itemDiscountedPrice = item.price;
            let itemOfferAmount = 0;
            const itemOffers = allOffers.filter((offer) => {
                const offerId = offer.applicableTo?._id?.toString();
                return (
                    (offer.offerType === "Category" && offerId === itemProduct.category?._id?.toString()) ||
                    (offer.offerType === "subCategory" && offerId === itemProduct.subCategory?._id?.toString()) ||
                    (offer.offerType === "Product" && offerId === itemProduct._id.toString()) ||
                    (offer.offerType === "Brand" && offerId === itemProduct.brand?._id?.toString())
                );
            });

            if (itemOffers.length > 0) {
                const itemBestOffer = itemOffers.reduce((best, current) => {
                    const bestDiscount = best ? (item.price * best.discountAmount) / 100 : 0;
                    const currentDiscount = (item.price * current.discountAmount) / 100;
                    return currentDiscount > bestDiscount ? current : best;
                }, null);

                if (itemBestOffer) {
                    const discountAmount = (item.price * itemBestOffer.discountAmount) / 100;
                    itemDiscountedPrice = Math.max(0, item.price - discountAmount);
                    itemOfferAmount = discountAmount * item.quantity;
                }
            }

            item.offerAmount = itemOfferAmount; 
            item.totalPrice = itemDiscountedPrice * item.quantity; 
            total += itemDiscountedPrice * item.quantity;
            offerDiscount += itemOfferAmount;
        }

        let couponDiscount = 0;
        if (cart.appliedCoupon) {
            const coupon = await Coupons.findById(cart.appliedCoupon);
            if (coupon && total >= coupon.minimumPurchase) {
                couponDiscount = coupon.offerPrice;
                total -= couponDiscount;
            } else {
                cart.appliedCoupon = null;
            }
        }

        cart.totalAmount = total;
        cart.offerDiscount = offerDiscount;
        cart.couponDiscount = couponDiscount;

        await cart.save();

        const wishlist = await Wishlist.findOne({ userId });
        if (wishlist) {
            await Wishlist.updateOne({ userId }, { $pull: { products: { productId } } });
        }

        return res.status(200).json({
            success: true,
            message: "Product added to cart successfully",
            redirectUrl: "/cart",
        });

    } catch (error) {

        console.log("Error in addCart", error);
        return res.status(500).json({ success: false, message: "Internal server error" });

    }
};


const cartQuantity = async (req, res) => {

    try {

        const userId = req.session.user;
        const { productId, action } = req.body;
        const MAX_CART_QUANTITY = 10;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        const cart = await Cart.findOne({ userId }).populate("appliedCoupon");
        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const product = await Product.findById(productId)
        .populate([
            { path: "category", select: "name" },
            { path: "subCategory", select: "name" },
            { path: "brand", select: "name" },
        ]);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({ message: "Item not found in cart" });
        }

        let newQuantity = cart.items[itemIndex].quantity;
        const maxAllowed = Math.min(MAX_CART_QUANTITY, Math.max(0, product.quantity));

        if (action === "increment") {
            newQuantity += 1;
            if (newQuantity > maxAllowed) {
                return res.status(400).json({
                    message: `You can only add up to ${maxAllowed} items of this product to the cart`,
                });
            }
        } else if (action === "decrement") {
            newQuantity -= 1;
            if (newQuantity < 1) {
                return res.status(400).json({ message: "Quantity cannot be less than 1" });
            }
        }

        cart.items[itemIndex].quantity = newQuantity;

        const allOffers = await Offer.find({
            isListed: true,
            isDelete: false,
            validUpto: { $gte: new Date() },
        })
            .populate("applicableTo")
            .lean();

        let total = 0;
        let offerDiscount = 0;

        for (const item of cart.items) {
            const itemProduct = item.productId.equals(productId)
                ? product
                : await Product.findById(item.productId).populate([
                    { path: "category", select: "name" },
                    { path: "subCategory", select: "name" },
                    { path: "brand", select: "name" },
                ]);
            if (!itemProduct) continue;

            let discountedPrice = item.price;
            let itemOfferAmount = 0;

            const applicableOffers = allOffers.filter((offer) => {
                const offerId = offer.applicableTo?._id?.toString();
                return (
                    (offer.offerType === "Category" && offerId === itemProduct.category?._id?.toString()) ||
                    (offer.offerType === "subCategory" && offerId === itemProduct.subCategory?._id?.toString()) ||
                    (offer.offerType === "Product" && offerId === itemProduct._id.toString()) ||
                    (offer.offerType === "Brand" && offerId === itemProduct.brand?._id?.toString())
                );
            });

            if (applicableOffers.length > 0) {
                const bestOffer = applicableOffers.reduce((best, current) => {
                    const bestDiscount = best ? (item.price * best.discountAmount) / 100 : 0;
                    const currentDiscount = (item.price * current.discountAmount) / 100;
                    return currentDiscount > bestDiscount ? current : best;
                }, null);

                if (bestOffer) {
                    const discountAmount = (item.price * bestOffer.discountAmount) / 100;
                    discountedPrice = Math.max(0, item.price - discountAmount);
                    itemOfferAmount = discountAmount * item.quantity;
                }
            }

            item.offerAmount = itemOfferAmount; 
            item.totalPrice = discountedPrice * item.quantity; 
            total += discountedPrice * item.quantity;
            offerDiscount += itemOfferAmount;
        }

        let couponDiscount = 0;
        let appliedCoupon = cart.appliedCoupon;
        let couponRemoved = false;

        if (cart.appliedCoupon) {
            const coupon = await Coupons.findById(cart.appliedCoupon);
            if (coupon && total >= coupon.minimumPurchase) {
                couponDiscount = coupon.offerPrice;
                total -= couponDiscount;
            } else {
                cart.appliedCoupon = null;
                appliedCoupon = null;
                couponRemoved = true;
            }
        }

        cart.totalAmount = total;
        cart.offerDiscount = offerDiscount;
        cart.couponDiscount = couponDiscount;

        await cart.save();

        const updatedCart = await Cart.findOne({ userId }).populate({
            path: "items.productId",
            match: { isDelete: false, isListed: true },
            populate: [
                { path: "category", select: "name" },
                { path: "subCategory", select: "name" },
                { path: "brand", select: "name" },
            ],
        }).populate("appliedCoupon");

        const itemsInCart = updatedCart.items.map((item) => {
            const product = item.productId;
            if (!product) {
                return {
                    ...item.toObject(),
                    bestOffer: null,
                    discountedPrice: item.price,
                    totalPrice: item.price * item.quantity,
                };
            }

            const applicableOffers = allOffers.filter((offer) => {
                const offerId = offer.applicableTo?._id?.toString();
                return (
                    (offer.offerType === "Category" && offerId === product.category?._id?.toString()) ||
                    (offer.offerType === "subCategory" && offerId === product.subCategory?._id?.toString()) ||
                    (offer.offerType === "Product" && offerId === product._id.toString()) ||
                    (offer.offerType === "Brand" && product.brand && offerId === product.brand._id?.toString())
                );
            });

            let bestOffer = null;
            let discountedPrice = item.price;

            if (applicableOffers.length > 0) {
                bestOffer = applicableOffers.reduce((best, current) => {
                    const bestDiscount = best ? (item.price * best.discountAmount) / 100 : 0;
                    const currentDiscount = (item.price * current.discountAmount) / 100;
                    return currentDiscount > bestDiscount ? current : best;
                }, null);

                if (bestOffer) {
                    const discountAmount = (item.price * bestOffer.discountAmount) / 100;
                    discountedPrice = Math.max(0, item.price - discountAmount);
                }
            }

            const itemTotal = discountedPrice * item.quantity;

            return {
                ...item.toObject(),
                product,
                bestOffer,
                discountedPrice,
                totalPrice: itemTotal,
            };
        });

        let originalTotal = 0;
        itemsInCart.forEach((item) => {
            const salePrice = item.price;
            originalTotal += salePrice * item.quantity;
        });

        res.status(200).json({
            success: true,
            quantity: newQuantity,
            price: cart.items[itemIndex].totalPrice,
            total: total.toFixed(2),
            originalTotal: originalTotal.toFixed(2),
            totalDiscount: (offerDiscount + couponDiscount).toFixed(2),
            cartItems: itemsInCart,
            appliedCoupon,
            couponRemoved,
            message: couponRemoved ? "Coupon removed due to insufficient cart total" : "Cart updated successfully",
        });
        
    } catch (error) {

        console.error("Error in cartQuantity:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


const deleteCart = async (req, res) => {

    try {

    const userId  =  req.session.user 
    
    const { productId } = req.query

    if (!userId) {
        return res.redirect("/login");
    }

    const cart = await Cart.findOne({ userId })
    if (!cart) {
        return res.redirect("/pageNotFound");
    }

    await Cart.updateOne(
        { userId },
        { $pull: { items: { productId } } },
        { new : true}
    )

    return res.redirect("/cart");
        
    } catch (error) {
        
        console.error("Error in deleteCart:", error);
        return res.redirect("/pageNotFound");
    }
}


const cartCheckout = async (req, res) => {

    try {

        const userId = req.session.user;
        const cart = await Cart.findOne({ userId })
            .populate({
                path: "items.productId",
                match: { isDelete: false, isListed: true },
                populate: [
                    { path: "category", select: "name" },
                    { path: "subCategory", select: "name" },
                    { path: "brand", select: "name" },
                ],
            })
            .populate("appliedCoupon");

        if (!cart ) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        let outOfStock = [];
        for (let item of cart.items) {
            const product = item.productId;
            if (!product || product.quantity < item.quantity || !product.isListed || product.isDelete) {
                outOfStock.push(product?.name || "Unknown Product");
            }
        }

        if (outOfStock.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Some items are out of stock or unavailable: ${outOfStock.join(", ")}`,
            });
        }

        if (cart.appliedCoupon) {
            const coupon = cart.appliedCoupon;
            if (cart.totalAmount + cart.couponDiscount < coupon.minimumPurchase) {
                await Cart.updateOne({ userId }, {
                    $unset: { appliedCoupon: 1 },
                    couponDiscount: 0,
                    totalAmount: cart.totalAmount + cart.couponDiscount,
                });

                return res.status(400).json({
                    success: false,
                    message: `Coupon minimum purchase requirement of ₹${coupon.minimumPurchase.toFixed(2)} not met. Coupon has been removed.`,
                });
            }
        }

        if (cart.totalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Cart total is invalid. Please review your cart.",
            });
        }
        const addressDocument = await Address.findOne({ userId });
        const addresses = addressDocument ? addressDocument.address : [];
        const defaultAddress = addresses.find((addr) => addr.isDefault) || addresses[0];
        const shippingCharge = defaultAddress ? calculateShippingCharge(defaultAddress.pincode, cart.totalAmount) : 0;

        const finalTotal = cart.totalAmount + shippingCharge;
        if (finalTotal <= 0) {
            return res.status(400).json({
                success: false,
                message: "Cart total is invalid. Please review your cart.",
            });
        }

        res.status(200).json({ success: true, message: "Proceed to checkout" });

    } catch (error) {

        console.log("Error in cartCheckout:", error);
        res.status(500).json({ success: false, message: "Internal server error" });

    }
};



module.exports = {

    getCartPage,
    addCart,
    cartQuantity,
    deleteCart,
    cartCheckout,
    applyCoupon,
    removeCoupon
}  