const mongoose = require("mongoose")
const { Schema } = mongoose

const couponSchema = new Schema({
    couponName: {
        type: String,
        required: true,

    },
    couponCode: {
        type: String,
        required: true,
        unique: true
    },
    startingDate: {
        type: Date,
        required: true
    },
    expireOn: {
        type: Date,
        required: true
    },
    offerPrice: {
        type: Number,
        required: true
    },
    minimumPurchase: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'Expired', 'Disabled'],
        default: 'Active'
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "user",
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isDelete: {
        type: Boolean,
        default: false
    }
})

const Coupons = mongoose.model("Coupons", couponSchema)

module.exports = Coupons