const mongoose = require('mongoose');
const { Schema } = mongoose

const offerSchema = new Schema({
    offerName: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    discountType: {
        type: String,
        enum: ['percentage'],
        required: true
    },
    discountAmount: {
        type: Number,
        required: true
    },
    validFrom: {
        type: Date,
        required: true
    },
    validUpto: {
        type: Date,
        required: true
    },
    offerType: {
        type: String,
        enum: ['Category', 'subCategory', 'Product', 'Brand'],
        required: true
    },
    applicableTo: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'offerTypeRef'
    },
    offerTypeRef: {
        type: String,
        required: true,
        enum: ['Category', 'subCategory', 'Product', 'Brand']
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isListed: {
        type: Boolean,
        default: true
    },
    isDelete: {
        type: Boolean,
        default: false
    }
});

const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;