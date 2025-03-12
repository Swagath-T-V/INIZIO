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
    brand:{
        type:String,
        required:true
    },
    category:{
        type:String,
        required:false
    },
    subCategory : {
        type:String,
        enum:["Men","Women","Kids"],
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
    isDeleted : {
        type:Boolean,
        default:false
    },
    status : {
        type:String,
        enum:["Available","Out of Stock","Discontinued"],
        required:true,
        default:"Available"
    },
    createdAt : {
        type :Date,
        default:Date.now
    }
},{timestamp:true})

const Product = mongoose.model("Product",productSchema)

module.exports = Product