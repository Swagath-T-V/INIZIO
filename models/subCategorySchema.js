const mongoose = require("mongoose")
const { Schema } = mongoose

const subCategorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    isListed: {
        type: Boolean,
        default: true
    },
    isDelete: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

const subCategory = mongoose.model("subCategory", subCategorySchema)

module.exports = subCategory