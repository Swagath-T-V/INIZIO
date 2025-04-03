const Order =  require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")



const getOrderPage = async (req, res) => {

    try {

        const userId = req.session.user;
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect("/login");
        }

        const { search } = req.query;
        let orderData;

        if (search) {
            orderData = await Order.find({      
                userId: userId,
                $or: [
                    { orderId: { $regex: search, $options: 'i' } },
                    { 'orderedItems.product': {
                        $in: await Product.find({
                            name: { $regex: search, $options: 'i' }
                        })
                    }}
                ]
            }).populate('orderedItems.product');

        } else {

            orderData = await Order.find({ userId: userId }).populate('orderedItems.product');

        }

        res.render("order", {
            user,
            orderData,
            activePage: "orders",
            searchQuery: search || ''
        });
        
    } catch (error) {

        console.log("error in getOrderPage", error);
        return res.redirect("/pageNotFound");

    }
};

const orderDetails = async(req,res)=>{

    try {

        const userId = req.session.user
        const user = await User.findById(userId)
        const {orderID} = req.query
        // console.log(orderID)

        const orderData = await Order.find({_id:orderID}).populate('orderedItems.product')

        res.render("orderDetails",{
            orderData,
            user,
            activePage:"orders"
            
        })
        
    } catch (error) {

        console.log("error in orderDetails",error)
        return res.redirect("/pageNotFound")
        
    }
}

const cancelOrder = async(req,res)=>{

    try {

        const { orderId } = req.query;
        const userId = req.session.user;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: "User not found",
                redirectUrl: "/login" 
            });
        }

        const orderData = await Order.findOne({ _id: orderId }).populate("orderedItems.product");
        if (!orderData) {
            return res.status(400).json({ 
                success: false,
                message: "Order not found" 
            });
        }

        await Order.findByIdAndUpdate(
            { _id: orderId },
            { $set: { status: "Cancelled" } },
            { new: true }
        );

        for (let item of orderData.orderedItems) {
            await Product.findByIdAndUpdate(
                item.product._id,
                { $inc: { quantity: item.quantity } }
            );
        }

        return res.status(200).json({ 
            success: true,
            message: "Order cancelled successfully" 
        });
        
    } catch (error) {

        console.error("Error in deleteOrder:", error);
        res.status(500).json({ message: "Internal server error" });
        
    }
}

const returnProduct = async (req,res)=>{

    try {

        const userId = req.session.user
        const user = await User.findById(userId)

        if(!user){
            return res.status(401).json({success:false,message:"user not found",redirectUrl:"/login"})
        }

        const {orderId,productId,returnReason,returnDetails} = req.body

        if(!orderId || !returnReason || !productId){
            return res.status(400).json({success:false,message:" orderID,productId and return Reason are require"})
        }

        const orderData = await Order.findOne({_id: orderId,userId: userId,'orderedItems.product': productId})
        if(!orderData){
            return res.status(400).json({success:false,message:"order is not found"})
        }

        const itemIndex = orderData.orderedItems.findIndex(item => item.product.toString() === productId);
        if (itemIndex === -1) {
            return res.status(400).json({ success: false, message: "Product not found in order" });
        }

        orderData.orderedItems[itemIndex].returnStatus = "Return Requested";
        orderData.orderedItems[itemIndex].returnReason = returnReason;
        orderData.orderedItems[itemIndex].returnDetails = returnDetails;

        orderData.status ="Return Request"

        await orderData.save()

        return res.status(200).json({success:true,message:"return request submitted successfully"})
        
    } catch (error) {

        console.log("error in returnOrder",error)
        return res.status(500).json({success:false,message:"server error"})
        
    }
}


const getInvoice = async (req, res) => {

    try {
        
        const { orderId } = req.query;
        // console.log("orderid",orderId)
        const userId = req.session.user;

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect("/pageNotFound");
        }

        const orderData = await Order.findOne({ _id: orderId })
            .populate("orderedItems.product")
            .populate("userId");

        if (!orderData) {
            return res.redirect("/pageNotFound");
        }

        res.render("invoice", {
            user: user,
            order: orderData,
            orderDate: orderData.createdAt.toLocaleDateString(),
            invoiceNumber: orderData._id
        });

    } catch (error) {
        console.log("error in getInvoice", error);
        return res.redirect("/pageNotFound");
    }
};


module.exports={
    getOrderPage,
    orderDetails,
    cancelOrder,
    returnProduct,
    getInvoice
}