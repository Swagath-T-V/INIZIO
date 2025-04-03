const Order =  require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")


const getOrderPage = async (req, res) => {

    try {

        if (req.session.admin) {
            let search = req.query.search || "";
            let status = req.query.status || "";
            let date = req.query.date || "";
            const page = parseInt(req.query.page) || 1;
            const limit = 5;
            const skip = (page - 1) * limit;

            let query = {};

            if (search) {
                query.$or = [
                    { orderId: { $regex: search, $options: "i" } },
                    { "userId": { 
                        $in: await User.find({ 
                            name: { $regex: search, $options: "i" }
                        })
                    }}
                ];
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


const getAdminOrderDetails = async(req,res)=>{
    
    try {

        if(req.session.admin){

            const {orderId} = req.query
            
            const orderData = await Order.findOne({_id:orderId}).populate("orderedItems.product").populate("userId")            

            res.render("adminOrder",{
                orderData,
                activePage:"orders"
            })
        }
        
    } catch (error) {
        
        console.log("error in getAdminOrderDetails",error)
        return res.redirect("/admin/pageerror")
        
    }
}


const updateOrderStatus = async (req, res) => {

    try {

        if (!req.session.admin) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const { orderId, itemId, status } = req.body;
        const order = await Order.findOne({ _id: orderId }).populate('orderedItems.product');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        let message = 'Status updated successfully';

        if (itemId) {

            const item = order.orderedItems.find(i => i._id.toString() === itemId);
            if (!item) {
                return res.status(404).json({ success: false, message: 'Item not found' });
            }

            if (item.returnStatus === "Return Requested") {
                item.returnStatus = status;
                if (status === "Returned") {
                    await Product.findByIdAndUpdate(item.product._id, { $inc: { quantity: item.quantity } });
                    message = 'Return approved';
                } else if (status === "Return Rejected") {
                    message = 'Return rejected';
                }
            }

            order.status = order.orderedItems.every(i => i.returnStatus === "Returned") ? "Returned" : "Delivered";

        } else {

            order.status = status;

        }

        await order.save();
        res.json({ success: true, message });

    } catch (error) {

        console.log("Error in updateOrderStatus:", error);
        res.status(500).json({ success: false, message: 'Server error' });
        
    }
};


module.exports = {

    getOrderPage,
    getAdminOrderDetails,
    updateOrderStatus

}