const Wallet = require("../../models/walletSchema");

const walletPage = async (req, res) => {

    try {

        const user = req.session.user;
        const wallet = await Wallet.findOne({ userId: user }).populate('userId');

        if (!wallet) {
            return res.redirect("/pageNotFound");
        }

        const recentTransactions = (wallet.transactions)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 4);

        res.render('wallet', {
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
        const user = req.session.user;

        const wallet = await Wallet.findOne({ userId: user }).populate('userId');

        if (!wallet) {
            return res.redirect("/pageNotFound");
        }

        const sortedTransactions = (wallet.transactions)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.render('walletViewAll', {
            wallet: {...wallet.toObject(),transactions: sortedTransactions},
            activePage: 'wallet'
        });

    } catch (error) {
        console.log("Error in walletViewAll", error);
        return res.redirect("/pageNotFound");
    }
};

const addToWallet = async (req, res) => {

    try {

        const user = req.session.user

        const { amount } = req.body
        console.log(amount)

        
        const amountToAdd= parseInt(amount);
        // console.log("amountToAdda",amountToAdd)

        let wallet = await Wallet.findOne({ userId: user });

        wallet.balance += amountToAdd;
        wallet.transactions.push({
            transactionId: Math.random().toString(36).substr(2, 9),
            amount: amountToAdd,
            type: "Credit",
            method: "UserAdded",
            status: "Completed",
            description: "Added by the user",
            date: new Date()
        });
        wallet.lastUpdated = new Date();

        await wallet.save();

        return res.status(200).json({success:true,message:"amount added successfully"})

    } catch (error) {

        console.log("Error in addToWallet", error);
        return res.status(500).json({success:false,message:'internal server error'})
        
    }
}

module.exports = {
    walletPage,
    walletViewAll,
    addToWallet
};