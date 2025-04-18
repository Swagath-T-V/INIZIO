const User = require("../../models/userSchema")
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")
const env = require("dotenv").config()
const session = require("express-session")
const Address = require("../../models/addressSchema")


const getForgotPage = async (req, res) => {

    try {

        res.render("forgot-password")

    } catch (error) {

        console.log("Error in getForgotPage", error)
        res.redirect("/pageNotFound")

    }
}
 
function generateOtp() {

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = Date.now() + 60000;
    return { otp, expiryTime };

}

async function sendVerificationEmail(email, otp) {

    try {

        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }

        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for Password Reset",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,

        })
        return true

    } catch (error) {

        console.error("Error in sending Email", error)
        return false

    }
}

const forgotEmail = async (req, res) => {

    try {

        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            })
        }

        const findUser = await User.findOne({ email: email });

        if (findUser) {

            const { otp, expiryTime } = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);

            if (emailSent) {
                req.session.userOtp = otp;
                req.session.otpExpiry = expiryTime;
                req.session.email = email;

                console.log("OTP IS :", otp);

                return res.status(200).json({
                    success: true,
                    message: "OTP has been sent to your email,Valid for 1 minute only.",
                    redirectUrl: "/forgotPass-otp",
                    expiryTime: expiryTime
                });

            } else {

                return res.status(400).json({
                    success: false,
                    message: 'Failed to send OTP. Please try again.'
                });
            }

        } else {

            return res.status(400).json({
                success: false,
                message: "User with this email does not exist",
                redirectUrl: "/forgot-password"
            });
        }

    } catch (error) {

        console.log("Error in forgotEmail", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const getForgotPassOtp = async (req, res) => {

    try {

        res.render("forgotPass-otp")

    } catch (error) {

        console.log("error in getForgotPassOtp",error)
        res.redirect("/pageNotFound")

    }
}

const resentOtp = async (req, res) => {

    try {

        const email = req.session.email

        if (!email) {

            return res.status(400).json({ success: false, message: "Email not found " })
        }

        const { otp, expiryTime } = generateOtp()
        req.session.userOtp = otp
        req.session.otpExpiry = expiryTime


        const emailSent = await sendVerificationEmail(email, otp)
        console.log('this is email from resend', emailSent)

        if (emailSent) {

            console.log("Resend OTP = ", otp)

            return res.status(200).json({ success: true, message: "OTP resent successfully" })

        } else {

            return res.status(500).json({ success: false, message: "Failed to resend OTP, please try again" })

        }

    } catch (error) {

        console.error("Error resending OTP:", error)
        return res.status(500).json({ success: false, message: "Internal server error" })

    }
}

const verifyForgotPassOtp = async (req, res) => {

    try {

        const { otp } = req.body
        const userOtp = req.session.userOtp
        const otpExpiry = req.session.otpExpiry
        const currentTime = Date.now()

        if (currentTime > otpExpiry) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new OTP.",
            });
        }


        if (String(otp) === String(userOtp)) {

            res.status(200).json({
                success: true,
                message: "OTP verified successfully",
                redirectUrl: "/reset-password",
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Invalid OTP, please try again.",
            });
        }

    } catch (error) {

        console.error("Error verifying OTP:", error)
        res.status(500).json({ success: false, message: "An error occurred." })

    }
}

const getResetPassword = async (req, res) => {

    try {

        res.render("reset-password")

    } catch (error) {

        res.redirect("/pageNotFound")

    }
}

const postnewPassword = async (req, res) => {

    try {

        const { newPass1, newPass2 } = req.body
        const email = req.session.email

        if (newPass1 === newPass2) {
            const passwordHash = await bcrypt.hash(newPass1, 10)
            await User.updateOne({ email: email }, { $set: { password: passwordHash } })

            return res.status(200).json({ success: true, redirectUrl: "/login" })

        } else {

            res.render("reset-password", { message: "Password do not match" })
        }

    } catch (error) {

        console.error("Error in postNewPassword:", error)
        return res.status(500).json({ success: false, message: "Internal server error" })

    }
}

/////////////////////////////////////profile/////////////////////////////////////////////////////////////////////////

const userProfile = async (req, res) => {

    try {

        const userId = req.session.user

        if (!userId) {
            return res.redirect("/login")
        }

        const userData = await User.findById(userId);
        const addressData = await Address.findOne({ userId: userId })

        if (!userData) {
            return res.redirect("/login")
        }

        res.render("profile", {
            user: userData,
            address: addressData,
            activePage: "profile"
        });

    } catch (error) {

        console.log("error in userProfile", error)
        res.redirect("/pageNotFound")
    }

}

const loadEditProfile = async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login")
        }

        const userId = req.session.user
        const userData = await User.findById(userId)

        if (!userData) {
            console.error('User not found ')
            return res.redirect("/login")
        }

        res.render("editUserProfile", {
            user: userData,
            activePage: "profile"
        });


    } catch (error) {

        console.error("Error in loadEditProfile:", error)
        res.redirect("/pageNotFound")

    }
}

const changeUserProfile = async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Unauthorized", redirectUrl: "/login" })
        }

        const userId = req.session.user
        const userData = await User.findById(userId)
        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found", redirectUrl: "/login" })
        }

        const { name, phone, email } = req.body

        const emailChanged = email && email !== userData.email

        if (emailChanged) {
            const emailExists = await User.findOne({ email })
            if (emailExists && emailExists._id.toString() !== userId) {
                return res.status(400).json({
                    success: false,
                    message: "Email already in use by another user"
                });
            }

            const { otp, expiryTime } = generateOtp()
            console.log("OTP SENT:", otp)

            const emailSent = await sendVerificationEmail(email, otp)
            if (emailSent) {
                req.session.tempProfileData = { name, phone, email }

                req.session.otp = otp
                req.session.otpExpiry = expiryTime

                return res.status(200).json({
                    success: true,
                    requiresOTP: true,
                    message: "An OTP has been sent to your email.",
                    redirectUrl: "/userVerifyOtp"
                });
            } else {

                return res.status(500).json({ success: false, message: "Failed to send verification email" })

            }

        } else {

            userData.name = name || userData.name
            userData.phone = phone || userData.phone
            userData.email = email || userData.email

            await userData.save()

            return res.status(200).json({
                success: true,
                message: "Profile updated successfully",
                redirectUrl: "/userProfile"
            })
        }

    } catch (error) {

        console.error("Error in changeUserProfile:", error)
        return res.status(500).json({ success: false, message: "Server error" })

    }
};

const getUserVerifyOtp = async (req, res) => {

    try {

        const email = req.session.tempProfileData?.email || '';
        res.render("userVerifyOtp")

    } catch (error) {

        console.error("Error in getUserVerifyOtp:", error)
        res.redirect("/pageNotFound")

    }
};

const verifyUserOtp = async (req, res) => {

    try {
        const { otp } = req.body
        const storedOtp = req.session.otp
        const otpExpiry = req.session.otpExpiry
        const currentTime = Date.now()

        if (currentTime > otpExpiry) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new OTP.",
            });
        }

        if (String(otp) !== String(storedOtp)) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP, please try again.",
            });
        }

        const userId = req.session.user
        const tempData = req.session.tempProfileData

        if (!tempData || !userId) {
            return res.status(400).json({
                success: false,
                message: "Session data missing. Please try again.",
            });
        }

        await User.updateOne(
            { _id: userId },
            {
                $set: {
                    name: tempData.name,
                    phone: tempData.phone,
                    email: tempData.email,
                },
            }
        );

        delete req.session.tempProfileData
        delete req.session.otp
        delete req.session.otpExpiry

        return res.status(200).json({
            success: true,
            message: "Email verified and profile updated successfully.",
            redirectUrl: "/userProfile",
        })

    } catch (error) {

        console.error("Error verifying OTP:", error)
        return res.status(500).json({
            success: false,
            message: "An error occurred.",

        })
    }
};


const resendUserOtp = async (req, res) => {

    try {

        const email = req.session.tempProfileData?.email

        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session." })
        }

        const { otp, expiryTime } = generateOtp()
        req.session.otp = otp
        req.session.otpExpiry = expiryTime
        console.log("RESENT OTP :", otp)

        const emailSent = await sendVerificationEmail(email, otp)

        if (!emailSent) {
            return res.status(500).json({ success: false, message: "Failed to send OTP email." })
        }

        return res.status(200).json({ success: true, message: "OTP resent successfully" })

    } catch (error) {

        return res.status(500).json({ success: false, message: "Internal server error: " + error.message })
    }
};

//////////////////////////////////////////address//////////////////////////////////////////////////////////////////

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

        res.redirect("/addressPage?success=Address added successfully");

    } catch (error) {

        console.log("error in addAddressPage", error);
        res.redirect("/addressPage?error=Failed to add address");
    }
};


const getEditAddress = async (req, res) => {

    try {
        const addressId = req.query.id
        const userId = req.session.user
        const user = await User.findById(userId)

        const currentAddress = await Address.findOne({
            "address._id": addressId
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
        const userId = req.session.user;
        const { addressType, name, city, landMark, state, pincode, phone } = req.body;

        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.redirect("/addressPage?error=Address not found");
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

        return res.redirect("/addressPage?success=Address updated successfully");

    } catch (error) {

        console.log("error in the editAddress", error)
        return res.redirect("/addressPage?error=Failed to update address")

    }
}


const deleteAddress = async (req, res) => {

    try {

        const addressId = req.query.id;
        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.redirect("/addressPage?error=Address not found");
        }

        await Address.updateOne(
            { "address._id": addressId },
            { $pull: { address: { _id: addressId } } }
        );

        return res.redirect("/addressPage?success=Address deleted successfully");

    } catch (error) {

        console.log("/error in deleteAddress", error);
        return res.redirect("/addressPage?error=Failed to delete address")
        
    }
}

module.exports = {
    getForgotPage,
    forgotEmail,
    getForgotPassOtp,
    verifyForgotPassOtp,
    resentOtp,
    getResetPassword,
    postnewPassword,
    userProfile,
    loadEditProfile,
    changeUserProfile,
    verifyUserOtp,
    resendUserOtp,
    getUserVerifyOtp,
    getAddressPage,
    getAddAddress,
    addAddress,
    getEditAddress,
    postEditAddress,
    deleteAddress
}