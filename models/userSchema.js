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
        unique:true,
       
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
})

const User=mongoose.model("User",userSchema)

module.exports =User