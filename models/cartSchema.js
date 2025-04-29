const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            default: 1,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            default: 'placed',
            enum: ['placed', 'shipped', 'delivered', 'cancelled']
        },
        cancellationReason: {
            type: String,
            default: 'none'
        }
    }],
    appliedCoupon: {
        type: Schema.Types.ObjectId,
        ref: 'Coupons',
        default: null,
    },
    totalAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    offerDiscount: {
        type: Number,
        default: 0,
        min: 0
    },
    couponDiscount: {
        type: Number,
        default: 0,
        min: 0
    },
    offerAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
}, { timestamps: true });

const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;