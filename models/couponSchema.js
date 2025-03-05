const mongoose = require("mongoose")
const {Schema} = mongoose

const couponSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    createdOn :{
        type:Date,
        required:true
    },
    expireOn :{
        type:Date,
        required:true
    },
    offerPrice:{
        type:Number,
        required:true
    },
    minimumPrice:{
        type:Number,
        required:true 
    },
    isList :{
        type:Boolean,
        required:true
    },
    userId :{
        type:Schema.Types.ObjectId,
        ref:"user",
        required:true
    }
})

const Coupons = mongoose.model("Coupons",couponSchema)

module.exports = Coupons