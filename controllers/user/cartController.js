const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")
const User = require("../../models/userSchema")
const Wishlist = require("../../models/wishlistSchema")
const Cart = require("../../models/cartSchema")
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const crypto = require("crypto")
const env = require("dotenv").config()
const razorpay = require('../../config/razorpay')
const Wallet = require("../../models/walletSchema")
const Offer = require("../../models/offerSchema")
const Coupons = require("../../models/couponSchema")



const getCartPage = async (req, res) => {

  try {

    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.redirect("/login");
    }

    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        match: { isDelete: false, isListed: true },
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name" },
        ],
      })
      .populate("appliedCoupon");

    const coupons = await Coupons.find({
      status: "Active",
      isDelete: false,
      startingDate: { $lte: new Date() },
      expireOn: { $gte: new Date() },
    }).lean();

    if (!cart || !cart.items.length) {
      await Cart.updateOne(
        { userId },
        {
          totalAmount: 0,
          offerDiscount: 0,
          couponDiscount: 0,
          appliedCoupon: null,
        }
      );

      return res.render("cart", {
        user,
        cartItems: [],
        total: 0,
        coupons,
        appliedCoupon: null,
        offerDiscount: 0,
        couponDiscount: 0,
      });
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
    const enhancedCartItems = cart.items.map((item) => {
      const product = item.productId;

      if (!product) {
        return {
          ...item.toObject(),
          bestOffer: null,
          discountedPrice: item.price,
          totalPrice: item.price * item.quantity,
        };
      }

      const usedOfferIds = user.usedDiscounts
        .filter((d) => d.productId.toString() === product._id.toString() && d.offerId)
        .map((d) => d.offerId.toString());

      const applicableOffers = allOffers.filter((offer) => {
        const offerId = offer.applicableTo?._id?.toString();
        return (
          !usedOfferIds.includes(offer._id.toString()) &&
          ((offer.offerType === "Category" && offerId === product.category?._id?.toString()) ||
            (offer.offerType === "subCategory" && offerId === product.subCategory?._id?.toString()) ||
            (offer.offerType === "Product" && offerId === product._id.toString()))
        );
      });

      let bestOffer = null;
      let discountedPrice = item.price;

      if (applicableOffers.length > 0) {
        bestOffer = applicableOffers.reduce((best, current) => {
          const bestDiscount = best ? best.discountType === "percentage" ? (item.price * best.discountAmount) / 100 : best.discountAmount : 0;
          const currentDiscount = current.discountType === "percentage" ? (item.price * current.discountAmount) / 100 : current.discountAmount;
          return currentDiscount > bestDiscount ? current : best;
        }, null);

        if (bestOffer) {
          const discountAmount = bestOffer.discountType === "percentage" ? (item.price * bestOffer.discountAmount) / 100 : Math.min(bestOffer.discountAmount, item.price);
          discountedPrice = Math.max(0, item.price - discountAmount);
        }
      }

      const itemTotal = discountedPrice * item.quantity;
      total += itemTotal;
      offerDiscount += (item.price - discountedPrice) * item.quantity;

      return {
        ...item.toObject(),
        product,
        bestOffer,
        discountedPrice,
        totalPrice: itemTotal,
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
        
        const used = user.usedDiscounts.find((d) => d.productId.toString() === product._id.toString() && d.couponId && d.couponId.toString() === coupon._id.toString());

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
        return user.usedDiscounts.some((d) => d.productId.toString() === product._id.toString() && d.couponId && d.couponId.toString() === coupon._id.toString());
      });
    });

    res.render("cart", {
      user,
      cartItems: enhancedCartItems,
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

    if (!userId) {
      return res.json({ success: false, message: "Please log in to apply a coupon" });
    }

    const coupon = await Coupons.findOne({
      couponCode,
      status: "Active",
      isDelete: false,
      startingDate: { $lte: new Date() },
      expireOn: { $gte: new Date() },
    });

    if (!coupon) {
      return res.json({ success: false, message: "Invalid or expired coupon" });
    }

    const user = await User.findById(userId);
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      match: { isDelete: false, isListed: true },
    });

    if (!cart || !cart.items.length) {
      return res.json({ success: false, message: "Your cart is empty" });
    }

    for (const item of cart.items) {
      const product = item.productId;
      if (!product) continue;
      const used = user.usedDiscounts.find((d) => d.productId.toString() === product._id.toString() && d.couponId && d.couponId.toString() === coupon._id.toString());

      if (used) {
        return res.json({
          success: false,
          message: `This coupon has already been used for ${product.name}`,
        });

      }
    }

    let total = 0;
    cart.items.forEach((item) => {
      const product = item.productId;
      if (!product) return;
      total += item.price * item.quantity;
    });

    if (total < coupon.minimumPurchase) {
      return res.json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minimumPurchase} required to apply this coupon`,
      });
    }

    const couponDiscount = coupon.offerPrice;
    const finalTotal = total - couponDiscount;

    await Cart.updateOne(
      { userId },
      {
        appliedCoupon: coupon._id,
        totalAmount: finalTotal,
        offerDiscount: 0,
        couponDiscount,
      }
    );

    return res.status(200).json({
      success: true,
      message: `Coupon "${coupon.couponName}" applied successfully! You saved ₹${coupon.offerPrice}.`,
      totalAmount: finalTotal,
      couponDiscount,
      offerDiscount: 0,
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

    if (!userId) {
      return res.json({ success: false, message: "Please log in to remove a coupon" });
    }

    const user = await User.findById(userId);
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      match: { isDelete: false, isListed: true },
    });

    if (!cart) {
      return res.json({ success: false, message: "Cart not found" });
    }

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

      const usedOfferIds = user.usedDiscounts
        .filter((d) => d.productId.toString() === product._id.toString() && d.offerId)
        .map((d) => d.offerId.toString());

      let discountedPrice = item.price;
      const applicableOffers = allOffers.filter((offer) => {
        const offerId = offer.applicableTo?._id?.toString();
        return (
          !usedOfferIds.includes(offer._id.toString()) &&
          ((offer.offerType === "Category" && offerId === product.category?._id?.toString()) ||
            (offer.offerType === "subCategory" && offerId === product.subCategory?._id?.toString()) ||
            (offer.offerType === "Product" && offerId === product._id.toString()))
        );
      });

      if (applicableOffers.length > 0) {
        const bestOffer = applicableOffers.reduce((best, current) => {
          const bestDiscount = best ? best.discountType === "percentage" ? (item.price * best.discountAmount) / 100 : best.discountAmount : 0;
          const currentDiscount =
            current.discountType === "percentage" ? (item.price * current.discountAmount) / 100 : current.discountAmount;
          return currentDiscount > bestDiscount ? current : best;
        }, null);

        if (bestOffer) {
          const discountAmount = bestOffer.discountType === "percentage" ? (item.price * bestOffer.discountAmount) / 100 : Math.min(bestOffer.discountAmount, item.price);
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

    return res.status(200).json({
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
    const { productId, quantity = 1 } = req.body;
    const MAX_CART_QUANTITY = 10;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Please log in to add items to your cart", 
        redirectUrl: "/login" 
      });
    }

    const product = await Product.findById(productId);
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
        message: "This product's category is unavailable" 
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
        (offer.offerType === "Category" &&
          offerId === product.category?._id?.toString()) ||
        (offer.offerType === "subCategory" &&
          offerId === product.subCategory?._id?.toString()) ||
        (offer.offerType === "Product" && offerId === product._id.toString())
      );
    });

    let bestOffer = null;
    let discountedPrice = product.salePrice;

    if (applicableOffers.length > 0) {
      bestOffer = applicableOffers.reduce((best, current) => {
        const bestDiscount = best  ? best.discountType === "percentage" ? (product.salePrice * best.discountAmount) / 100  : best.discountAmount : 0;
        const currentDiscount =  current.discountType === "percentage"  ? (product.salePrice * current.discountAmount) / 100  : current.discountAmount;
        return currentDiscount > bestDiscount ? current : best;
      }, null);

      if (bestOffer) {
        const discountAmount =  bestOffer.discountType === "percentage"  ? (product.salePrice * bestOffer.discountAmount) / 100  : Math.min(bestOffer.discountAmount, product.salePrice);
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
      cart.items[itemIndex].totalPrice = newQuantity * product.salePrice;

    } else {

      cart.items.push({
        productId,
        quantity: requestedQuantity,
        price: product.salePrice,
        totalPrice: product.salePrice * requestedQuantity,
      });

    }

    let total = 0;
    let offerDiscount = 0;

    for (const item of cart.items) {
      const itemProduct = item.productId.equals(productId) ? product : await Product.findById(item.productId);
      if (!itemProduct) continue;

      let itemDiscountedPrice = item.price;
      const itemOffers = allOffers.filter((offer) => {
        const offerId = offer.applicableTo?._id?.toString();
        return (
          (offer.offerType === "Category" &&
            offerId === itemProduct.category?._id?.toString()) ||
          (offer.offerType === "subCategory" &&
            offerId === itemProduct.subCategory?._id?.toString()) ||
          (offer.offerType === "Product" && offerId === itemProduct._id.toString())
        );
      });

      if (itemOffers.length > 0) {
        const itemBestOffer = itemOffers.reduce((best, current) => {
          const bestDiscount = best ? best.discountType === "percentage"  ? (item.price * best.discountAmount) / 100  : best.discountAmount  : 0;
          const currentDiscount =  current.discountType === "percentage"  ? (item.price * current.discountAmount) / 100  : current.discountAmount;
          return currentDiscount > bestDiscount ? current : best;
        }, null);

        if (itemBestOffer) {
          const discountAmount =  itemBestOffer.discountType === "percentage"  ? (item.price * itemBestOffer.discountAmount) / 100  : Math.min(itemBestOffer.discountAmount, item.price);
          itemDiscountedPrice = Math.max(0, item.price - discountAmount);
        }
      }

      total += itemDiscountedPrice * item.quantity;
      offerDiscount += (item.price - itemDiscountedPrice) * item.quantity;
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
      redirectUrl: "/cart" 
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

    const cart = await Cart.findOne({ userId }).populate("appliedCoupon");
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const product = await Product.findById(productId);
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
    cart.items[itemIndex].totalPrice = newQuantity * cart.items[itemIndex].price;

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
      const itemProduct = item.productId.equals(productId) ? product : await Product.findById(item.productId);
      if (!itemProduct) continue;

      let discountedPrice = item.price;
      const applicableOffers = allOffers.filter((offer) => {
        const offerId = offer.applicableTo?._id?.toString();
        return (
          (offer.offerType === "Category" &&
            offerId === itemProduct.category?._id?.toString()) ||
          (offer.offerType === "subCategory" &&
            offerId === itemProduct.subCategory?._id?.toString()) ||
          (offer.offerType === "Product" && offerId === itemProduct._id.toString())
        );
      });

      if (applicableOffers.length > 0) {
        const bestOffer = applicableOffers.reduce((best, current) => {
          const bestDiscount = best ? best.discountType === "percentage" ? (item.price * best.discountAmount) / 100  : best.discountAmount : 0;
          const currentDiscount = current.discountType === "percentage" ? (item.price * current.discountAmount) / 100 : current.discountAmount;
          return currentDiscount > bestDiscount ? current : best;
        }, null);

        if (bestOffer) {
          const discountAmount = bestOffer.discountType === "percentage" ? (item.price * bestOffer.discountAmount) / 100 : Math.min(bestOffer.discountAmount, item.price);
          discountedPrice = Math.max(0, item.price - discountAmount);
        }
      }

      total += discountedPrice * item.quantity;
      offerDiscount += (item.price - discountedPrice) * item.quantity;
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
      ],
    }).populate("appliedCoupon");

    const enhancedCartItems = updatedCart.items.map((item) => {
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
          (offer.offerType === "Category" &&
            offerId === product.category?._id?.toString()) ||
          (offer.offerType === "subCategory" &&
            offerId === product.subCategory?._id?.toString()) ||
          (offer.offerType === "Product" && offerId === product._id.toString())
        );
      });

      let bestOffer = null;
      let discountedPrice = item.price;

      if (applicableOffers.length > 0) {
        bestOffer = applicableOffers.reduce((best, current) => {
          const bestDiscount = best ? best.discountType === "percentage" ? (item.price * best.discountAmount) / 100 : best.discountAmount  : 0;
          const currentDiscount =  current.discountType === "percentage" ? (item.price * current.discountAmount) / 100  : current.discountAmount;
          return currentDiscount > bestDiscount ? current : best;
        }, null);

        if (bestOffer) {
          const discountAmount =  bestOffer.discountType === "percentage" ? (item.price * bestOffer.discountAmount) / 100  : Math.min(bestOffer.discountAmount, item.price);
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
    enhancedCartItems.forEach((item) => {
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
      cartItems: enhancedCartItems,
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

    const userId = req.session.user;
    const { productId } = req.query;

    if (!userId) {
      return res.redirect("/login");
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.redirect("/pageNotFound");
    }

    await Cart.updateOne(
      { userId },
      { $pull: { items: { productId } } }
    );

    const updatedCart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      match: { isDelete: false, isListed: true },
    });

    if (!updatedCart || !updatedCart.items.length) {
      await Cart.updateOne({ userId }, {
        totalAmount: 0,
        offerDiscount: 0,
        couponDiscount: 0,
        appliedCoupon: null,
      });
      return res.redirect("/cart");
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

    for (const item of updatedCart.items) {
      const product = item.productId;
      if (!product) continue;

      let discountedPrice = item.price;
      const applicableOffers = allOffers.filter((offer) => {
        const offerId = offer.applicableTo?._id?.toString();
        return (
          (offer.offerType === "Category" &&
            offerId === product.category?._id?.toString()) ||
          (offer.offerType === "subCategory" &&
            offerId === product.subCategory?._id?.toString()) ||
          (offer.offerType === "Product" && offerId === product._id.toString())
        );
      });

      if (applicableOffers.length > 0) {
        const bestOffer = applicableOffers.reduce((best, current) => {
          const bestDiscount = best ? best.discountType === "percentage" ? (item.price * best.discountAmount) / 100 : best.discountAmount : 0;
          const currentDiscount = current.discountType === "percentage" ? (item.price * current.discountAmount) / 100 : current.discountAmount;
          return currentDiscount > bestDiscount ? current : best;
        }, null);

        if (bestOffer) {
          const discountAmount = bestOffer.discountType === "percentage" ? (item.price * bestOffer.discountAmount) / 100 : Math.min(bestOffer.discountAmount, item.price);
          discountedPrice = Math.max(0, item.price - discountAmount);
        }
      }

      total += discountedPrice * item.quantity;
      offerDiscount += (item.price - discountedPrice) * item.quantity;
    }

    let couponDiscount = 0;
    if (updatedCart.appliedCoupon) {
      const coupon = await Coupons.findById(updatedCart.appliedCoupon);

      if (coupon && total >= coupon.minimumPurchase) {

        couponDiscount = coupon.offerPrice;
        total -= couponDiscount;

      } else {

        updatedCart.appliedCoupon = null;

      }
    }

    await Cart.updateOne({ userId }, {
      totalAmount: total,
      offerDiscount,
      couponDiscount,
      appliedCoupon: updatedCart.appliedCoupon,
    });

    return res.redirect("/cart");

  } catch (error) {

    console.log("Error in deleteCart:", error);
    res.redirect("/pageNotFound");

  }
};

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
        ],
      })
      .populate("appliedCoupon");

    if (!cart || !cart.items.length) {
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
          couponRemoved: true,
        });
      }
    }

    if (cart.totalAmount <= 0) {
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

const getWishlist = async (req, res) => {

  try {

    const userId = req.session.user
    const user = await User.findById(userId)
    if (!user) {
      return res.redirect("/login")
    }

    const wishlist = await Wishlist.findOne({ userId }).populate("products.productId")
    const wishlistItems = wishlist ? wishlist.products : []

    res.render("wishlist", { user, wishlistItems })

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
        redirectUrl: "/login",
        message: "Please log in to add items to your wishlist"
      });
    }

    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    let wishlist = await Wishlist.findOne({ userId })
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] })
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

    const wishlist = await Wishlist.findOne({ userId })
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

    const wishlist = await Wishlist.findOne({ userId })
    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }

    const result = await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId } } }
    )

    return res.status(200).json({ success: true, message: 'Item removed from wishlist' });

  } catch (error) {

    console.log("Error in deleteWishlist:", error);
    return res.status(500).json({ success: false, message: 'Server error' });

  }
}

//////////////////////////////////////////////////// CHEKOUT //////////////////////////////////////////////////////////////

const checkOut = async (req, res) => {

  try {

    const userId = req.session.user
    const user = await User.findById(userId)

    if (!user) {
      return res.redirect("/login")
    }

    const addressDocument = await Address.findOne({ userId })
    const addresses = addressDocument ? addressDocument.address : []

    const cart = await Cart.findOne({ userId }).populate('items.productId')

    const totalAmount = cart.items.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0)
    const Discount = cart.items.reduce((sum, item) => sum + ((item.productId.regularPrice - item.productId.salePrice) * item.quantity), 0)

    return res.render("checkOut", {
      user,
      cart,
      address: addresses,
      totalAmount: totalAmount,
      Discount: Discount

    })

  } catch (error) {

    console.error("Error in addCheckoutAddress:", error)
    res.redirect("/pageNotFound")

  }
}


const editCheckoutAddress = async (req, res) => {

  try {

    const addressId = req.body.addressId
    const userId = req.session.user
    const { addressType, name, city, landMark, state, pincode, phone, isDefault } = req.body

    const findAddress = await Address.findOne({ "address._id": addressId })
    if (!findAddress) {
      return res.redirect("/pageNotFound")
    }

    if (isDefault === 'on') {
      await Address.updateMany(
        { userId, "address.isDefault": true },
        { $set: { "address.$[].isDefault": false } }
      )
    }

    await Address.updateOne(
      { "address._id": addressId },
      {
        $set: {
          "address.$.addressType": addressType,
          "address.$.name": name,
          "address.$.city": city,
          "address.$.landMark": landMark,
          "address.$.state": state,
          "address.$.pincode": pincode,
          "address.$.phone": phone,
          "address.$.isDefault": isDefault === 'on'
        }
      }
    )

    return res.redirect("/checkOut")

  } catch (error) {

    console.log("error in editCheckoutAddress", error)
    return res.redirect("/pageNotFound")

  }

}


const addCheckoutAddress = async (req, res) => {

  try {

    const userId = req.session.user
    const userData = await User.findOne({ _id: userId })
    const { addressType, name, city, landMark, state, pincode, phone, isDefault } = req.body

    const isDefaultBool = isDefault === 'on'

    let userAddress = await Address.findOne({ userId: userData._id })

    if (!userAddress) {
      const newAddress = new Address({
        userId: userData._id,
        address: [
          {
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone,
            isDefault: isDefaultBool,
          },
        ],
      })

      await newAddress.save()

    } else {

      if (isDefaultBool) {
        await Address.updateOne(
          { userId: userData._id },
          { $set: { "address.$[].isDefault": false } }
        )
      }

      userAddress.address.push({
        addressType,
        name,
        city,
        landMark,
        state,
        pincode,
        phone,
        isDefault: isDefaultBool,
      })

      await userAddress.save()

    }

    res.redirect("/checkOut")

  } catch (error) {

    console.log("Error in addCheckoutAddress:", error)
    res.redirect("/pageNotFound")

  }
}

const checkOutSubmit = async (req, res) => {

  try {

      const userId = req.session.user;
      const { addressId, paymentMethod } = req.body;

      const user = await User.findById(userId);
      if (!user) {
          return res.redirect("/login");
      }

      const addressDoc = await Address.findOne({ userId, "address._id": addressId });
      if (!addressDoc) {
          return res.redirect("/pageNotFound");
      }
      const selectedAddress = addressDoc.address.id(addressId);
      const cart = await Cart.findOne({ userId })
          .populate("items.productId")
          .populate("appliedCoupon");

      if (!cart || !cart.items.length) {
          return res.status(400).json({ success: false, message: "Cart is empty" });
      }

      const usedDiscounts = [];
      const allOffers = await Offer.find({
          isListed: true,
          isDelete: false,
          validUpto: { $gte: new Date() },
      })
          .populate("applicableTo")
          .lean();

      for (const item of cart.items) {
          const productId = item.productId._id;
          let couponId = cart.appliedCoupon ? cart.appliedCoupon._id : null;
          let offerId = null;

          const applicableOffers = allOffers.filter((offer) => {
              const offerId = offer.applicableTo?._id?.toString();
              return (
                  (offer.offerType === "Category" && offerId === item.productId.category?._id?.toString()) ||
                  (offer.offerType === "subCategory" && offerId === item.productId.subCategory?._id?.toString()) ||
                  (offer.offerType === "Product" && offerId === item.productId._id.toString())
              );
          });

          const existingDiscount = user.usedDiscounts.find(d => d.productId.toString() === productId.toString());

          const validOffers = applicableOffers.filter( offer => !existingDiscount || !existingDiscount.offerId || offer._id.toString() !== existingDiscount.offerId.toString());

          if (validOffers.length > 0) {
              const bestOffer = validOffers.reduce((best, current) => {
                  const bestDiscount = best ? best.discountType === "percentage" ? (item.price * best.discountAmount) / 100 : best.discountAmount : 0;
                  const currentDiscount = current.discountType === "percentage" ? (item.price * current.discountAmount) / 100 : current.discountAmount;
                  return currentDiscount > bestDiscount ? current : best;
              }, null);
              offerId = bestOffer ? bestOffer._id : null;
          }

          if (couponId || offerId) {
              const discountExists = user.usedDiscounts.some(d => d.productId.toString() === productId.toString() && (!offerId || d.offerId?.toString() === offerId?.toString()) &&(!couponId || d.couponId?.toString() === couponId?.toString())
              );
              if (!discountExists) {
                  usedDiscounts.push({ productId, couponId, offerId });
              }
          }
      }

      if (usedDiscounts.length > 0) {
          await User.updateOne(
              { _id: userId },
              { $addToSet: { usedDiscounts: { $each: usedDiscounts } } }
          );
      }

      const orderedItems = cart.items.map((item) => ({
          product: item.productId._id,
          quantity: item.quantity,
          price: item.productId.salePrice,
      }));

      const totalPrice = cart.totalAmount + cart.offerDiscount + cart.couponDiscount;
        const offerDiscount = cart.offerDiscount;
        const couponDiscount = cart.couponDiscount;
        const discount = offerDiscount + couponDiscount; 
        const tax = 100;
        const shipping = 0;
        const finalAmount = cart.totalAmount  

        const newOrder = new Order({
            userId: user._id,
            orderedItems,
            totalPrice,
            discount,
            offerDiscount, 
            couponDiscount, 
            tax,
            shipping,
            finalAmount,
            address: {
                addressType: selectedAddress.addressType,
                name: selectedAddress.name,
                city: selectedAddress.city,
                landmark: selectedAddress.landMark,
                state: selectedAddress.state,
                pincode: selectedAddress.pincode.toString(),
                phone: selectedAddress.phone,
                isDefault: selectedAddress.isDefault,
            },

          paymentMethod: paymentMethod === "cod" ? "COD" : paymentMethod === "Wallet" ? "Wallet" : "Razorpay",
          status: "Pending",
          paymentStatus: "Pending",
          couponApplied: !!cart.appliedCoupon,
      });

      if (paymentMethod === "cod") {
          for (let item of cart.items) {
              await Product.findOneAndUpdate(item.productId._id, {
                  $inc: { quantity: -item.quantity },
              });
          }

          await newOrder.save();
          await Cart.findOneAndUpdate(
              { userId },
              { items: [], appliedCoupon: null, couponDiscount: 0, offerDiscount: 0, totalAmount: 0 }
          );

          return res.redirect("/successPage");

      } else if (paymentMethod === "Razorpay") {

          for (let item of cart.items) {
              const product = await Product.findById(item.productId._id);
              if (product.quantity < item.quantity) {
                  return res.status(400).json({ success: false, message: `${product.name} is out of stock` });
              }
          }

          const razorpayOrder = await razorpay.orders.create({
              amount: finalAmount * 100,
              currency: "INR",
              receipt: `order_${newOrder._id}`,
          });

          newOrder.razorpayOrderId = razorpayOrder.id;
          await newOrder.save();

          return res.json({
              success: true,
              razorpayOrderId: razorpayOrder.id,
              amount: razorpayOrder.amount,
              currency: razorpayOrder.currency,
              key: process.env.RAZORPAY_KEY_ID,
              orderId: newOrder._id.toString(),
              user: {
                  name: user.name,
                  email: user.email,
                  contact: selectedAddress.phone,
              },
          });

      } else if (paymentMethod === "Wallet") {

          for (let item of cart.items) {
              const product = await Product.findById(item.productId._id);
              if (product.quantity < item.quantity) {
                  return res.status(400).json({ success: false, message: `${product.name} is out of stock` });
              }
          }

          let wallet = await Wallet.findOne({ userId });

          if (wallet.balance < finalAmount) {
              return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
          }

          wallet = await Wallet.findOneAndUpdate(
              { userId },
              {
                  $inc: { balance: -finalAmount },
                  $push: {
                      transactions: {
                          amount: finalAmount,
                          type: "Debit",
                          method: "OrderPayment",
                          status: "Completed",
                          description: `Payment for order ${newOrder._id}`,
                          date: new Date(),
                      },
                  },
                  $set: { lastUpdated: new Date() },
              },
              { new: true }
          );

          for (let item of cart.items) {
              await Product.findByIdAndUpdate(item.productId._id, {
                  $inc: { quantity: -item.quantity },
              });
          }

          newOrder.paymentStatus = "Completed";
          newOrder.status = "Pending";
          await newOrder.save();

          await Cart.findOneAndUpdate(
              { userId },
              { items: [], appliedCoupon: null, couponDiscount: 0, offerDiscount: 0, totalAmount: 0 }
          );

          return res.status(200).json({
              success: true,
              message: "Order placed successfully using Wallet",
              redirectUrl: "/successPage",
          });
          
      } else {

          return res.status(400).json({ success: false, message: "Invalid payment method" });

      }

  } catch (error) {

      console.error("error in checkOutSubmit:", error);
      return res.redirect("/pageNotFound");

  }
};


const verifyPayment = async (req, res) => {

  try {

    const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body

    const order = await Order.findById(orderId)
    if (!orderId) {
      return res.status(400).json({ success: false, message: "order not found" })
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature === razorpay_signature) {
      order.paymentStatus = 'Completed';
      order.razorpayPaymentId = razorpay_payment_id;
      order.razorpaySignature = razorpay_signature;
      order.status = 'Pending';

      for (let item of order.orderedItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: -item.quantity },
        });
      }
      await Cart.findOneAndUpdate({ userId: order.userId }, { items: [] });

      await order.save();
      return res.json({ success: true, message: 'Payment verified successfully' });

    } else {

      order.status = 'Payment Failed'
      order.paymentStatus = 'Failed';
      await order.save();
      return res.json({ success: false, message: 'Invalid payment signature' });

    }

  } catch (error) {

    console.error('Error in verifyPayment:', error);
    return res.status(500).json({ success: false, message: 'Server error' });

  }
}

const retryPayment = async (req, res) => {

  try {

    const { orderId } = req.body;
    const userId = req.session.user;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== userId) {
      return res.status(400).json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus === 'Completed') {
      return res.status(400).json({ success: false, message: 'Payment already completed' });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: order.finalAmount * 100,
      currency: 'INR',
      receipt: `order_${order._id}_retry`,
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
      orderId: order._id,
      user: {
        name: user.name,
        email: user.email,
        contact: user.phone || order.address.phone,
      },
    });
    
  } catch (error) {

    console.error('Error in retryPayment:', error);
    return res.status(500).json({ success: false, message: 'Server error' });

  }
};

const successPage = async (req, res) => {

  try {

    const userId = req.session.user
    const user = await User.findById(userId)
    if (!user) {
      return res.redirect("/login")
    }

    const order = await Order.findOne({ userId }).sort({ createdAt: -1 })

    if (!order) {
      return res.redirect("/pageNotFound")
    }

    const addressString = `${order.address.name}, ${order.address.addressType}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}, Phone: ${order.address.phone}`;

    return res.render("successPage", {
      user,
      orderId: order._id,
      totalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod,
      address: addressString,
      estimatedDelivery: '7-12 Business Days',
    })

  } catch (error) {

    console.log("error in successPage", error)
    return res.redirect("/pageNotFound")

  }
};


const paymentFailure = async (req, res) => {

  try {

    const userId = req.session.user
    const user = await User.findById(userId)
    if (!user) {
      return res.redirect("/login")
    }

    const orderId = req.query.orderId

    const orderData = await Order.findById(orderId)

    const addressString = `${orderData.address.name}, ${orderData.address.addressType}, ${orderData.address.city}, ${orderData.address.state} - ${orderData.address.pincode}, Phone: ${orderData.address.phone}`;

    orderData.status = 'Payment Failed';
    orderData.paymentStatus = 'Failed';
    await orderData.save()

    return res.render('paymentFailure', {
      user,
      orderId: orderData._id,
      totalAmount: orderData.finalAmount,
      paymentMethod: orderData.paymentMethod,
      address: addressString,
      estimatedDelivery: '7-12 Business Days',
    });

  } catch (error) {

    console.log("error in paymentFailure", error)
    return res.redirect("/pageNotFound")

  }
}


module.exports = {

  getCartPage,
  addCart,
  cartQuantity,
  deleteCart,
  cartCheckout,
  getWishlist,
  addWishlist,
  checkWishlist,
  deleteWishlist,
  checkOut,
  editCheckoutAddress,
  addCheckoutAddress,
  checkOutSubmit,
  verifyPayment,
  retryPayment,
  paymentFailure,
  successPage,
  applyCoupon,
  removeCoupon
}  