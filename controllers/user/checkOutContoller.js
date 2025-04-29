

const Product = require("../../models/productSchema")
const User = require("../../models/userSchema")
const Cart = require("../../models/cartSchema")
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const crypto = require("crypto")
const razorpay = require('../../config/razorpay')
const Wallet = require("../../models/walletSchema")
const Offer = require("../../models/offerSchema")
const { calculateShippingCharge } = require("../../utils/shippingCharge")




const checkOut = async (req, res) => {

    try {

        const userId = req.session.user
        const user = await User.findById(userId)

        if (!user) {
            return res.redirect("/login")
        }

        const addressDocument = await Address.findOne({ userId })
        const addresses = addressDocument ? addressDocument.address : []

        const cart = await Cart.findOne({ userId }).populate({
            path: "items.productId",
            populate: [
                { path: "category", select: "name" },
                { path: "subCategory", select: "name" },
                { path: "brand", select: "name" },
            ],
        });

        const totalAmount = cart.items.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0)
        const Discount = cart.items.reduce((sum, item) => sum + ((item.productId.regularPrice - item.productId.salePrice) * item.quantity), 0)

        const defaultAddress = addresses.find((addr) => addr.isDefault) || addresses[0];
        const shippingCharge = defaultAddress ? calculateShippingCharge(defaultAddress.pincode, totalAmount) : 0;

        return res.render("checkOut", {
            user,
            cart,
            address: addresses,
            totalAmount: totalAmount,
            Discount: Discount,
            shippingCharge
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
            .populate({
                path: "items.productId",
                populate: [
                    { path: "category", select: "name" },
                    { path: "subCategory", select: "name" },
                    { path: "brand", select: "name" },
                ],
            })
            .populate("appliedCoupon");

        if (!cart || !cart.items.length) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        if (paymentMethod === "cod" && cart.totalAmount > 1000) {
            return res.status(400).json({
                success: false,
                message: "Cash on Delivery is not available for orders above ₹1000",
            });
        }

        const allOffers = await Offer.find({
            isListed: true,
            isDelete: false,
            validUpto: { $gte: new Date() },
        })
            .populate("applicableTo")
            .lean();

        const orderedItems = cart.items.map((item) => {
            const product = item.productId;
            let offerAmount = 0;
            let discountedPrice = item.price;

            const applicableOffers = allOffers.filter((offer) => {
                const offerId = offer.applicableTo?._id?.toString();
                return (
                    (offer.offerType === "Category" && offerId === product.category?._id?.toString()) ||
                    (offer.offerType === "subCategory" && offerId === product.subCategory?._id?.toString()) ||
                    (offer.offerType === "Product" && offerId === product._id.toString()) ||
                    (offer.offerType === "Brand" && offerId === product.brand?._id?.toString())
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
                    offerAmount = discountAmount * item.quantity;
                }
            }

            return {
                product: item.productId._id,
                quantity: item.quantity,
                price: item.productId.salePrice,
                offerAmount,
            };
        });

        const totalPriceBeforeShipping = cart.totalAmount + cart.offerDiscount + cart.couponDiscount;
        const shippingCharge = calculateShippingCharge(selectedAddress.pincode, totalPriceBeforeShipping);

        const totalPrice = cart.totalAmount + cart.offerDiscount + cart.couponDiscount;
        const offerDiscount = cart.offerDiscount;
        const couponDiscount = cart.couponDiscount;
        const discount = offerDiscount + couponDiscount;
        const finalAmount = cart.totalAmount + shippingCharge;

        const newOrder = new Order({
            userId: user._id,
            orderedItems,
            totalPrice,
            discount,
            offerDiscount,
            couponDiscount,
            shippingCharge,
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
            couponId: cart.appliedCoupon ? cart.appliedCoupon._id : null,
            couponCode: cart.appliedCoupon ? cart.appliedCoupon.couponCode : null,
        });

        if (paymentMethod === "cod") {
            const usedDiscounts = [];
            if (cart.appliedCoupon) {
                for (const item of cart.items) {
                    const productId = item.productId._id;
                    const couponId = cart.appliedCoupon._id;
                    const discountExists = user.usedDiscounts.some(
                        (d) => d.productId.toString() === productId.toString() && d.couponId?.toString() === couponId.toString()
                    );
                    if (!discountExists) {
                        usedDiscounts.push({ productId, couponId });
                    }
                }
                if (usedDiscounts.length > 0) {
                    await User.updateOne(
                        { _id: userId },
                        { $addToSet: { usedDiscounts: { $each: usedDiscounts } } }
                    );
                }
            }

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
            const usedDiscounts = [];
            if (cart.appliedCoupon) {
                for (const item of cart.items) {
                    const productId = item.productId._id;
                    const couponId = cart.appliedCoupon._id;
                    const discountExists = user.usedDiscounts.some(
                        (d) => d.productId.toString() === productId.toString() && d.couponId?.toString() === couponId.toString()
                    );
                    if (!discountExists) {
                        usedDiscounts.push({ productId, couponId });
                    }
                }
                if (usedDiscounts.length > 0) {
                    await User.updateOne(
                        { _id: userId },
                        { $addToSet: { usedDiscounts: { $each: usedDiscounts } } }
                    );
                }
            }

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
                            orderId: newOrder._id,
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

        const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        const order = await Order.findById(orderId).populate({
            path: "orderedItems.product",
            populate: [
                { path: "category", select: "name" },
                { path: "subCategory", select: "name" },
                { path: "brand", select: "name" },
            ],
        });
        if (!order) {
            return res.status(400).json({ success: false, message: "Order not found" });
        }

        const user = await User.findById(order.userId);
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generatedSignature === razorpay_signature) {
            if (order.couponApplied) {
                const cart = await Cart.findOne({ userId: order.userId }).populate("appliedCoupon");
                if (cart && cart.appliedCoupon) {
                    const usedDiscounts = [];
                    for (const item of order.orderedItems) {
                        const productId = item.product._id;
                        const couponId = cart.appliedCoupon._id;
                        const discountExists = user.usedDiscounts.some(
                            (d) => d.productId.toString() === productId.toString() && d.couponId?.toString() === couponId.toString()
                        );
                        if (!discountExists) {
                            usedDiscounts.push({ productId, couponId });
                        }
                    }
                    if (usedDiscounts.length > 0) {
                        await User.updateOne(
                            { _id: order.userId },
                            { $addToSet: { usedDiscounts: { $each: usedDiscounts } } }
                        );
                    }
                }
            }

            order.paymentStatus = "Completed";
            order.razorpayPaymentId = razorpay_payment_id;
            order.razorpaySignature = razorpay_signature;
            order.status = "Pending";

            for (let item of order.orderedItems) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { quantity: -item.quantity },
                });
            }

            await Cart.findOneAndUpdate(
                { userId: order.userId },
                { items: [], appliedCoupon: null, couponDiscount: 0, offerDiscount: 0, totalAmount: 0 }
            );

            await order.save();
            return res.json({ success: true, message: "Payment verified successfully" });

        } else {
            order.status = "Payment Failed";
            order.paymentStatus = "Failed";
            await order.save();
            return res.json({ success: false, message: "Invalid payment signature" });
        }

    } catch (error) {

        console.error("Error in verifyPayment:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};


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
            shippingCharge: order.shippingCharge,
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

        const orderData = await Order.findOne({ _id: orderId, userId: userId })

        const addressString = `${orderData.address.name}, ${orderData.address.addressType}, ${orderData.address.city}, ${orderData.address.state} - ${orderData.address.pincode}, Phone: ${orderData.address.phone}`;

        orderData.status = 'Payment Failed';
        orderData.paymentStatus = 'Failed';
        await orderData.save()

        return res.render('paymentFailure', {
            user,
            orderId: orderData._id,
            totalAmount: orderData.finalAmount,
            shippingCharge: orderData.shippingCharge,
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

    checkOut,
    editCheckoutAddress,
    addCheckoutAddress,
    checkOutSubmit,
    verifyPayment,
    retryPayment,
    paymentFailure,
    successPage,

}