const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema")

const walletPage = async (req, res) => {

    try {

        const userId = req.session.user;
        const user = await User.findById(userId)
        const wallet = await Wallet.findOne({ userId: user })

        if (!wallet) {
            return res.redirect("/pageNotFound");
        }

        const recentTransactions = (wallet.transactions)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 4);

        res.render('wallet', {
            user,
            wallet: { ...wallet.toObject(), transactions: recentTransactions },
            activePage: 'wallet'
        });

    } catch (error) {

        console.log("Error in walletPage", error);
        return res.redirect("/pageNotFound");

    }
};

const walletViewAll = async (req, res) => {

    try {
        const userId = req.session.user;
        const user = await User.findById(userId)

        const wallet = await Wallet.findOne({ userId: user })

        if (!wallet) {
            return res.redirect("/pageNotFound");
        }

        const sortedTransactions = (wallet.transactions)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.render('walletViewAll', {
            user,
            wallet: { ...wallet.toObject(), transactions: sortedTransactions },
            activePage: 'wallet'
        });

    } catch (error) {
        console.log("Error in walletViewAll", error);
        return res.redirect("/pageNotFound");
    }
};



module.exports = {
    walletPage,
    walletViewAll,
};