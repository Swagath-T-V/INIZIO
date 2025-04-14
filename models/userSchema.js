const mongoose = require("mongoose")
const {Schema} = mongoose

const userSchema = new Schema({
    name : {
        type:String,
        required:true
    },
    email : {
        type:String,
        required:true,
        unique:true
    },
    phone : {
        type:String,
        required:false,
        unique:false,
       
    },
    googleId:{
        type:String,
        unique:true,
        required:false,
        sparse:true
    },
    password : {
        type:String,
        required:false
    },
    isBlocked : {
        type:Boolean,
        default:false
    },
    isAdmin : {
        type:Boolean,
        default:false
    },
    createdOn : {
        type:Date,
        default:Date.now,
    },
    profileImage:{
        type:String,
        required:false,
    },
    usedDiscounts: [{
        productId: { 
            type: Schema.Types.ObjectId, 
            ref: "Product" 
        },
        couponId: { 
            type: Schema.Types.ObjectId, 
            ref: "Coupons", 
            default: null 
        },
        offerId: { 
            type: Schema.Types.ObjectId, 
            ref: "Offer", 
            default: null 
        },
        }],
})

const User=mongoose.model("User",userSchema)

module.exports =User