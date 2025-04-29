const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema")


const getWallet = async (req, res) => {

    try {

        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;
        if (page < 1) page = 1;

        const limit = 4;

        const userSearchQuery = {
            isAdmin: false,
            $or: [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ],
        };

        const userData = await User.find(userSearchQuery)
            .sort({ createdOn: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .select("name email phone")
            .exec();

        const count = await User.countDocuments(userSearchQuery);

        res.render("walletAdmin", {
            data: userData,
            search: search,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            totalUsers: count,
            activePage: "wallet",
        });

    } catch (error) {

        console.log("Error in getWallet", error);
        res.redirect("/admin/pageerror");

    }
};


const viewWallet = async (req, res) => {

    try {

        const { id } = req.query;
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;
        if (page < 1) page = 1;

        const limit = 5;

        const wallet = await Wallet.findOne({ userId: id }).populate('userId')


        let transactions = wallet.transactions
            .filter((transaction) => transaction.transactionId.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalTransactions = transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);

        if (page > totalPages && totalPages > 0) page = totalPages;

        const paginatedTransactions = transactions.slice((page - 1) * limit, page * limit);

        const walletData = [{ transactions: paginatedTransactions }];

        return res.render("viewWallet", {
            wallet,
            search: search,
            currentPage: page,
            totalPages: totalPages,
            activePage: "wallet",
            walletData,
            id,

        });

    } catch (error) {

        console.log("error in viewWallet", error);
        return res.redirect("/admin/pageerror");

    }
};

const viewWalletDetails = async (req, res) => {

    try {

        const { transactionId } = req.query
        //  console.log(transactionId);

        const wallet = await Wallet.findOne({ "transactions.transactionId": transactionId }).populate("userId")

        const transaction = wallet.transactions.find(t => t.transactionId === transactionId)

        const user = wallet.userId;
        // console.log(user)

        const orderId = transaction.orderId
        // console.log(orderId)

        const order = await Order.findById(orderId).populate('orderedItems.product')
        // console.log("order",order)

        let address = order.address
        // console.log(address)

        return res.render("walletDetails", {
            order,
            transaction,
            address,
            user,
            activePage: "wallet",
            userId: wallet.userId._id.toString()
        })

    } catch (error) {

        console.log("error in viewWalletDetails", error);
        return res.redirect("/admin/pageerror");

    }
}

module.exports = {

    getWallet,
    viewWallet,
    viewWalletDetails

};
