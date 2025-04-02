const Order =  require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")



const getOrderPage = async (req,res)=>{

    try {
        
        if(req.session.admin){

            const orderData = await Order.find({}).populate("orderedItems.product").populate("userId")

            return res.render("orderPage",{
                orderData,
                activePage:"orders"
    
            })

        }
        
    } catch (error) {
        
        console.log("error in getOrderPage",error)
        return res.redirect("/admin/pageerror")
    }
}


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
        if (req.session.admin) {
            const { orderId, status } = req.body;

            const orderData = await Order.findOne({ _id: orderId }).populate('orderedItems.product');

            if (!orderData) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            orderData.status = status;

            let message = 'Status updated successfully'

            if (status === "Returned") {
                for (let item of orderData.orderedItems) {
                    if (item.returnStatus === "Return Requested") {
                        item.returnStatus = "Returned";
                        await Product.findByIdAndUpdate(
                            item.product._id,
                            { $inc: { quantity: item.quantity } },
                            { new: true }
                        );
                        message = 'Return request approved successfully'
                    }
                }
            } else if (status === "Return Rejected") {
                for (let item of orderData.orderedItems) {
                    if (item.returnStatus === "Return Requested") {
                        item.returnStatus = "Return Rejected";
                        message = 'Return request rejected successfully';
                    }
                }
            }

            await orderData.save();

            res.json({ success: true, message: message });
        }
    } catch (error) {
        console.log("error in updateOrderStatus", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


module.exports = {

    getOrderPage,
    getAdminOrderDetails,
    updateOrderStatus

}