const mongoose = require('mongoose')
const {Schema} = mongoose

const walletSchema = new Schema({

    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    balance: {
        type: Number,
        required: true,
        default: 0,
    },
    currency: {
        type: String,
        default: "INR" 
    }, 
    transactions: [{
        transactionId: {
            type: String,
            unique: false,
            default: () => Math.random().toString(36).substr(2, 9)
        },
        amount: {
            type: Number,
            required: true         
        },
        type: {
            type: String,
            enum: ["Credit", "Debit"],
            required: true
        },
        method: {
            type: String,
            enum: ["Razorpay", "Cashback", "Refund","OrderPayment","Referral"],
            required: true
        },
        status: {
            type: String,
            enum: ["Pending", "Completed", "Failed"],
            default: "Pending"
        },
        date: {
            type: Date,
            default: Date.now
        },
        description: {
            type: String,
            default: "No description provided"
        },
        orderId: {
            type: String,
            default: null 
        }
    }],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
    
}, { timestamps: true })

const Wallet =mongoose.model("Wallet",walletSchema)
module.exports = Wallet