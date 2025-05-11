const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema")


const getAddressPage = async (req, res) => {

    try {
 
        if (req.session.user) {

            const userId = req.session.user
            const user = await User.findById(userId)

            const userAddress = await Address.findOne({ userId: userId })

            res.render("addressPage", {
                user: user,
                userAddress,
                activePage: "addresses"
            })

        } else {

            res.redirect("/login")
        }

    } catch (error) {

        console.log("error in address", error)
        res.redirect("/pageNotFound")

    }
}

const getAddAddress = async (req, res) => {

    try {

        const userId = req.session.user
        const user = await User.findById(userId)

        if (userId) {

            return res.render("addAddress", {
                user: user,
                activePage: "addresses"
            })

        } else {

            console.log("no user found")
            res.redirect("/login")
        }

    } catch (error) {

        console.log("error in the getAddAddress", error)
        res.redirect("/pageNotFound")

    }
}

const addAddress = async (req, res) => {

    try {

        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        const { addressType, name, city, landMark, state, pincode, phone } = req.body;

        const userAddress = await Address.findOne({ userId: userData._id });
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{ addressType, name, city, landMark, state, pincode, phone }]
            });
            await newAddress.save();
        } else {
            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone });
            await userAddress.save();
        }

        return res.json({success:true ,message:"address added successfully"})

    } catch (error) {

        console.log("error in addAddressPage", error);
        return res.json({success:false ,message:"Internal server error"})
    }
};


const getEditAddress = async (req, res) => {

    try {
        
        const addressId = req.query.id
        const userId = req.session.user
        const user = await User.findById(userId)

        const currentAddress = await Address.findOne({
            "address._id": addressId, userId: userId
        });

        if (!currentAddress) {
            return res.redirect("/pageNotFound")
        }

        const addressData = currentAddress.address.find((item) => {
            return item._id.toString() === addressId.toString()
        })

        if (!addressData) {
            return res.redirect("/pageNotFound");
        }

        res.render("editAddress", {
            user: user,
            address: addressData,
            activePage: "addresses"
        })

    } catch (error) {

        console.log("error in edit address", error)
        res.redirect("/pageNotFound")
    }
};

const postEditAddress = async (req, res) => {

    try {

        const addressId = req.body.addressId;
        const { addressType, name, city, landMark, state, pincode, phone } = req.body;

        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.json({success:false ,message:"Address not found"});
        }

        await Address.updateOne(
            { "address._id": addressId },
            {
                $set: {
                    "address.$.addressType": addressType,
                    "address.$.name": name,
                    "address.$.city": city,
                    "address.$.landMark": landMark,
                    "address.$.state": state,
                    "address.$.pincode": pincode,
                    "address.$.phone": phone
                }
            }
        );

        return res.json({success:true, message:"Address updated successfully"})

    } catch (error) {

        console.log("error in the editAddress", error)
        return res.json({success:false, message:"Internal server error"})

    }
}


const deleteAddress = async (req, res) => {

    try {

        const userId = req.session.user
        const addressId = req.query.id;
        const findAddress = await Address.findOne({ "address._id": addressId, userId: userId });
        if (!findAddress) {
            return res.json({success:false ,message:"Address not found"})
        }

        await Address.updateOne(
            { "address._id": addressId },
            { $pull: { address: { _id: addressId } } }
        );
        return res.json({success:true ,message:"Address deleted successfully "})


    } catch (error) {

        console.log("/error in deleteAddress", error);
        return res.json({success:false ,message:"Internal server error"})

    }
}

const setDefaultAddress = async (req, res) => {

    try {

        const addressId = req.query.id
        const userId = req.session.user

        const findAddress = await Address.findOne({ "address._id": addressId, userId: userId })
        if (!findAddress) {
            return res.json({success:false ,message:"Address not found"})
        }

        await Address.updateMany(
            { userId },
            { $set: { "address.$[].isDefault": false } }
        );

        await Address.updateOne(
            { "address._id": addressId },
            { $set: { "address.$.isDefault": true } }
        );

        return res.json({success:true ,message:"Address set as default successfully"})


    } catch (error) {

        console.log("error in setDefaultAddress", error);
        return res.json({success:false,message:"internal server error"});

    }
}

module.exports = {
    getAddressPage,
    getAddAddress,
    addAddress,
    getEditAddress,
    postEditAddress,
    deleteAddress,
    setDefaultAddress
}