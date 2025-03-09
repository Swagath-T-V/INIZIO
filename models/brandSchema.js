const mongoose = require("mongoose")
const {Schema} = mongoose

const brandSchema = new Schema({
    name : {
        type:String,
        required:true
    },
    brandImage:{
        type:[String],
        required:false
    },
    // isBlocked:{
    //     type:Boolean,
    //     default:false
    // },
    isListed:{
        type:Boolean,
        default:true
    },
    isDelete :{
        type:Boolean,
        default:false
    },
    createdAt :{
        type:Date,
        default:Date.now
    }
})

const Brand = mongoose.model("Brand",brandSchema)

module.exports = Brand