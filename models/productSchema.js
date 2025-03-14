const mongoose =require("mongoose")
const {Schema} = mongoose

const productSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:false
    },
    category:{
        type:String,
        required:false
    },
    subCategory : {
        type:String,
        required:true,
    },
    regularPrice:{
        type:Number,
        required:true
    },
    salePrice:{
        type:Number,
        required:true
    },
    // productOffer:{
    //     type:Number,
    //     default:0
    // },
    quantity:{
        type:Number,
        default:true
    },
    Images:{
        type:[String],
        required:true
    },
    isDelete : {
        type:Boolean,
        default:false
    },
    createdAt : {
        type :Date,
        default:Date.now
    }
},{timestamps:true})

const Product = mongoose.model("Product",productSchema)

module.exports = Product