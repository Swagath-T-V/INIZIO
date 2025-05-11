const Order = require("../../models/orderSchema")
const Product = require("../../models/productSchema")
const Wallet = require("../../models/walletSchema")
const Coupon = require("../../models/couponSchema")


const getOrderPage = async (req, res) => {

    try {

        if (req.session.admin) {
            let search = req.query.search || "";
            let status = req.query.status || "";
            let date = req.query.date || "";
            const page = parseInt(req.query.page) || 1;
            const limit = 6 ;
            const skip = (page - 1) * limit;

            let query = {
                $nor: [{ paymentMethod: "Razorpay", paymentStatus: "Pending" }],
            };

            if (search) {
               query.orderId = {$regex : search , $options: "i"}
            }

            if (status) {
                query.status = status;
            }

            if (date) {
                const now = new Date();
                let startDate;

                switch (date) {
                    case "today":
                        startDate = new Date(now.setHours(0, 0, 0, 0));
                        break;
                    case "week":
                        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
                        startDate.setHours(0, 0, 0, 0);
                        break;
                    case "month":
                        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                        break;
                }

                if (startDate) {
                    query.createdAt = { $gte: startDate };
                }
            }

            const totalOrders = await Order.countDocuments(query);
            const totalPages = Math.ceil(totalOrders / limit);

            const orderData = await Order.find(query)
                .populate("orderedItems.product")
                .populate("userId")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            return res.render("orderPage", {
                orderData,
                activePage: "orders",
                currentPage: page,
                totalPages: totalPages,
                totalOrders: totalOrders,
                search: search,
                status: status,
                date: date
            });
        }

    } catch (error) {

        console.log("error in getOrderPage", error);
        return res.redirect("/admin/pageerror");
    }
};


const getAdminOrderDetails = async (req, res) => {

    try {

        if (req.session.admin) {

            const { orderId } = req.query

            const orderData = await Order.findOne({ _id: orderId }).populate("orderedItems.product").populate("userId")

            res.render("adminOrder", {
                orderData,
                activePage: "orders"
            })
        }

    } catch (error) {

        console.log("error in getAdminOrderDetails", error)
        return res.redirect("/admin/pageerror")

    }
}


const updateOrderStatus = async (req, res) => {

    try {

        const { orderId, itemId, status } = req.body;
        // console.log(orderId, itemId, status)

        const order = await Order.findOne({ _id: orderId }).populate('orderedItems.product');

        if (!order) {
            return res.json({ success: false, message: 'Order not found' });
        }

        let message = 'Status updated successfully';
        let refundAmount = 0;

        if (itemId) {

            const item = order.orderedItems.find(i => i._id.toString() === itemId);

            if (!item) {
                return res.json({ success: false, message: 'Item not found' });
            }

            if (item.returnStatus === "Return Requested") {

                item.returnStatus = status;

                if (status === "Returned") {
                    
                    await Product.findByIdAndUpdate(item.product._id, { $inc: { quantity: item.quantity } });
                    message = 'Return approved';

                    const itemPrice = Math.max((item.price * item.quantity) - (item.offerAmount || 0), 0);
                    refundAmount = itemPrice;


                    if ( order.couponDiscount > 0) {
                        const totalPrice = order.orderedItems.reduce((sum, i) => sum + Math.max((i.price * i.quantity) - (i.offerAmount || 0), 0), 0);

                        const totalReturned = order.orderedItems
                            .filter((i) => i.returnStatus === "Returned" && i._id.toString() !== itemId)
                            .reduce((sum, i) => sum + Math.max((i.price * i.quantity) - (i.offerAmount || 0), 0), 0);

                        const remainingPrice = order.finalAmount - (totalReturned + itemPrice);

                        const coupon = await Coupon.findOne({_id: order.couponId, status: "Active" });

                        if (remainingPrice < coupon.minimumPurchase) {
                            const itemCouponShare = totalPrice > 0 ? (order.couponDiscount * (itemPrice / totalPrice)) : 0;
                            refundAmount -= itemCouponShare;
                            message = "Return approved and amount refunded to wallet";
                        }
                    }

                    refundAmount = Math.max(refundAmount, 0);

                    const wallet = await Wallet.findOne({ userId: order.userId });
                    const totalRefunded = wallet?.transactions
                        ?.filter(t => t.orderId?.toString() === orderId && t.type === "Credit" && t.method === "Refund")
                        ?.reduce((sum, t) => sum + t.amount, 0) || 0;


                    const maxRefund = order.finalAmount - totalRefunded;
                    // console.log(maxRefund)
                    refundAmount = Math.min(refundAmount, maxRefund);

                    item.refundAmount = refundAmount;

                    if (refundAmount <= 0) {
                        message = 'Return approved, but no refundable amount available';
                    } else {
                        await Wallet.findOneAndUpdate(
                            { userId: order.userId },
                            {
                                $inc: { balance: refundAmount },
                                $push: {
                                    transactions: {
                                        amount: refundAmount,
                                        type: "Credit",
                                        method: "Refund",
                                        status: "Completed",
                                        description: `Refund for order ${order.orderId}, item ${item.product._id}`,
                                        date: new Date(),
                                        orderId: order._id
                                    }
                                },
                                $set: { lastUpdated: new Date() }
                            },
                            { new: true, upsert: true }
                        );
                    }
                } else if (status === "Return Rejected") {
                    message = 'Return rejected';
                }
            }

            order.status = order.orderedItems.every(i => i.returnStatus === "Returned") ? "Returned" : "Delivered";

        } else {

            order.status = status;

            if (status === 'Cancelled') {
                if (order.paymentMethod === "Razorpay" || order.paymentMethod === "Wallet") {

                    refundAmount = order.finalAmount - order.shippingCharge;

                    await Wallet.findOneAndUpdate(
                        { userId: order.userId },
                        {
                            $inc: { balance: refundAmount },
                            $push: {
                                transactions: {
                                    amount: refundAmount,
                                    type: "Credit",
                                    method: "Refund",
                                    status: "Completed",
                                    description: `Refund for cancelled order ${order.orderId}`,
                                    date: new Date(),
                                    orderId: order._id
                                }
                            },
                            $set: { lastUpdated: new Date() }
                        }, { new: true }
                    )
                    message = `Order cancelled and amount refunded to wallet`;

                    await Order.findOneAndUpdate(
                        { _id: orderId },
                        { $set: { finalAmount: refundAmount } },
                        { new: true }
                    );


                } else if (order.paymentMethod === "COD") {
                    refundAmount = order.finalAmount - order.shippingCharge
                    if(order.finalAmount < 0 ){
                        order.finalAmount = 0
                    }
                    
                    message = `Order cancelled successfully`;

                    await Order.findOneAndUpdate(
                        { _id: orderId },
                        { $set: { finalAmount: refundAmount } },
                        { new: true }
                    );
                }
            }

        }

        if (status === "Cancelled") {
            for (const item of order.orderedItems) {
                await Product.findByIdAndUpdate(item.product._id, { $inc: { quantity: item.quantity } });
            }
        }

        await order.save();
        res.json({ success: true, message });

    } catch (error) {

        console.log("Error in updateOrderStatus:", error);
        res.json({ success: false, message: 'Server error' });

    }
};


module.exports = {

    getOrderPage,
    getAdminOrderDetails,
    updateOrderStatus

}