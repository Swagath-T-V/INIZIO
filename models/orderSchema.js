const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const {Schema} = mongoose;
const {v4:uuidv4} = require('uuid')

const orderSchema = new Schema({
    orderId:{
        type:String,
        default:()=>uuidv4(),
        unique:true
    },
    userId :{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },

    orderedItems:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
            type:Number,
            required:true
        },
        price:{
            type:Number,
            default:0
        },
        returnStatus: {
            type: String,
            enum: ["Not Returned","Return Requested", "Returned","Return Rejected"],
            default: "Not Returned",
        },
        returnReason: { 
            type: String,
            default: null
        },
        returnDetails: { 
            type: String,
            default: null
        }

    }],
    totalPrice:{
        type:Number,
        required:true
    },
    discount:{
        type:Number,
        default:0
    },
    tax: {  
        type: Number,
        default: 0
    },
    shipping: {  
        type: Number,
        default: 0
    },
    finalAmount:{
        type:Number,
        required:true
    },
    address: { 
        type: {
            addressType: { type: String, required: true },
            name: { type: String, required: true },
            city: { type: String, required: true },
            landmark: { type: String ,require:true},
            state: { type: String, required: true },
            pincode: { type: String, required: true },
            phone: { type: String, required: true },
            isDefault: { type: Boolean, default: false },
        },
        required: true,
    },
    paymentMethod: {  
        type: String,
        enum: ["COD","Razorpay",'Wallet'], 
        required: true,
        default: "COD"
    },      
    invoiceDate:{
        type:Date,
        default:Date.now
    },
    status:{
        type:String,
        required:true,
        enum:["Pending","Processing","Shipped", "Out for Delivery","Delivered","Cancelled","Return Request","Returned","Return Rejected","Payment Failed"],
        default:"Pending"
    },
    createdAt:{
        type:Date,
        default:Date.now,
        required:true,
    },
    couponApplied:{
        type:Boolean,
        default:false
    },
    razorpayOrderId:{
        type:String
    },
    razorpayPaymentId:{
        type:String
    },
    razorpaySignature:{
        type:String
    },
    paymentStatus:{
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Pending',
    }
      
})


const Order = mongoose.model("Order",orderSchema)
module.exports = Order