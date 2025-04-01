const { findById } = require("../../models/categorySchema")
const Order =  require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")


const getOrderPage = async(req,res)=>{

    try {

        const userId = req.session.user 
        const user = await User.findById(userId)
        if(!user){
            return res.redirect("/login")
        }

        const orderData = await Order.find({userId:userId}).populate('orderedItems.product')
        // console.log(orderData)
        res.render("order",{
            user,
            orderData,
            activePage:"orders"
        })
        
    } catch (error) {

        console.log("error in getOrderPage",error)
        return res.redirect("/pageNotFound")
        
    }
}

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

const deleteOrder = async(req,res)=>{

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

        // Restore product quantities
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

const returnOrder = async (req,res)=>{

    try {

        const userId = req.session.user
        const user = await User.findById(userId)
        if(!user){
            return res.status(401).json({success:false,message:"user not found",redirectUrl:"/login"})
        }

        const {orderId,returnReason,returnDetails} = req.body

        if(!orderId || !returnReason){
            return res.status(400).json({success:false,message:" orderID and return Reason are require"})
        }

        const orderData = await Order.findOne({_id:orderId})
        if(!orderData){
            return res.status(400).json({success:false,message:"order is not found"})
        }

        await Order.findByIdAndUpdate(
            {_id:orderId},
            {
                $set:{
                    status:"Return Request",
                    returnReason:returnReason,
                    returnDetails:returnDetails
                }
            },
            {new:true}
        )

        await orderData.save()

        return res.status(200).json({success:true,message:"return request submitted successfully"})
        
    } catch (error) {

        console.log("error in returnOrder",error)
        return res.status(500).json({success:false,message:"server error"})
        
    }
}



module.exports={
    getOrderPage,
    orderDetails,
    deleteOrder,
    returnOrder
}