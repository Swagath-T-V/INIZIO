const mongoose = require("mongoose")
const { Schema } = mongoose

const productSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    },
    brand: {
        type: Schema.Types.ObjectId,
        ref: 'Brand',
        required: false
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: false
    },
    subCategory: {
        type: Schema.Types.ObjectId,
        ref: 'subCategory',
        required: true,
    },
    salePrice: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        default: 0
    },
    isListed: {
        type: Boolean,
        default: true
    },
    Images: {
        type: [String],
        required: true
    },
    isDelete: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    material: {
        type: String,
        default: "N/A"
    },
    dimensions: {
        type: String,
        default: "N/A"
    },
    weight: {
        type: String,
        default: "N/A"
    }
}, { timestamps: true })

const Product = mongoose.model("Product", productSchema)

module.exports = Product 