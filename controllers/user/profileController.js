const User = require("../../models/userSchema")
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
const fs = require('fs');
const path = require('path');

 
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

        await transporter.sendMail({
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

const userProfile = async (req, res) => {

    try {

        const userId = req.session.user

        if (!userId) {
            return res.redirect("/login")
        }

        const userData = await User.findById(userId);

        if (!userData) {
            return res.redirect("/login")
        }

        res.render("profile", {
            user: userData,
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
            return res.status(401).json({ success: false, message: "Unauthorized", redirectUrl: "/login" });
        }

        const userId = req.session.user;
        const userData = await User.findById(userId);
        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found", redirectUrl: "/login" });
        }

        const { name, phone, email } = req.body;
        const emailChanged = email && email !== userData.email;

        const updateData = {
            name: name || userData.name,
            phone: phone || userData.phone,
            email: email || userData.email
        };

        if (req.file) {
            updateData.profileImage = `/uploads/profile-images/${req.file.filename}`;
        }

        if (emailChanged) {
            const emailExists = await User.findOne({ email });
            if (emailExists && emailExists._id.toString() !== userId) {
                return res.status(400).json({
                    success: false,
                    message: "Email already in use by another user"
                });
            }

            const { otp, expiryTime } = generateOtp();
            console.log("OTP SENT:", otp);

            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.tempProfileData = updateData;
                req.session.otp = otp;
                req.session.otpExpiry = expiryTime;

                return res.status(200).json({
                    success: true,
                    requiresOTP: true,
                    message: "An OTP has been sent to your email.",
                    redirectUrl: "/userVerifyOtp"
                });
            } else {

                return res.status(500).json({ success: false, message: "Failed to send verification email" });
            }
        } else {
            await User.updateOne({ _id: userId }, { $set: updateData });

            return res.status(200).json({
                success: true,
                message: "Profile updated successfully",
                redirectUrl: "/userProfile"
            });
        }

    } catch (error) {

        console.error("Error in changeUserProfile:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};


const getUserVerifyOtp = async (req, res) => {

    try {

        const email = req.session.tempProfileData?.email || '';

        if(!email){
            res.redirect("/pageNotFound")
        }
        res.render("userVerifyOtp")

    } catch (error) {

        console.error("Error in getUserVerifyOtp:", error)
        res.redirect("/pageNotFound")

    }
};



const verifyUserOtp = async (req, res) => {

    try {

        const { otp } = req.body;
        const storedOtp = req.session.otp;
        const otpExpiry = req.session.otpExpiry;
        const currentTime = Date.now();

        if (currentTime > otpExpiry) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new OTP."
            });
        }

        if (String(otp) !== String(storedOtp)) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP, please try again."
            });
        }

        const userId = req.session.user;
        const tempData = req.session.tempProfileData;
        const userData = await User.findById(userId);

        if (!tempData || !userId || !userData) {
            return res.status(400).json({
                success: false,
                message: "Session data missing. Please try again."
            });
        }

        await User.updateOne(
            { _id: userId },
            {
                $set: {
                    name: tempData.name,
                    phone: tempData.phone,
                    email: tempData.email,
                    profileImage: tempData.profileImage || userData.profileImage
                }
            }
        );

        delete req.session.tempProfileData;
        delete req.session.otp;
        delete req.session.otpExpiry;

        return res.status(200).json({
            success: true,
            message: "Email verified and profile updated successfully.",
            redirectUrl: "/userProfile"
        });

    } catch (error) {

        console.error("Error verifying OTP:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred."
        });
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


const getChangePassword = async (req, res) => {

    try {

        return res.render("changePassword")

    } catch (error) {

        console.log("error in changePassword", error)
        return res.redirect("/pageNotFound")

    }
}


const changePassword = async (req, res) => {

    try {

        const userId = req.session.user;
        if (!userId) {
            return res.json({ success: false, message: "Unauthorized", redirectUrl: "/login" });
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.json({ success: false, message: "User not found", redirectUrl: "/login" });
        }

        const { currentPass, newPass1, newPass2 } = req.body;

        const isMatch = await bcrypt.compare(currentPass, userData.password);
        if (!isMatch) {
            return res.json({ success: false, message: "Current password is incorrect" });
        }
        
        if (!newPass1) {
            return res.json({ success: false, message: "Please enter a new password" });
        }

        if (newPass1 !== newPass2) {
            return res.json({ success: false, message: "New passwords do not match" });
        }

        const passwordHash = await bcrypt.hash(newPass1, 10);
        await User.updateOne({ _id: userId }, { $set: { password: passwordHash } });

        return res.json({
            success: true,
            message: "Password changed successfully",
            redirectUrl: "/userProfile"
        });

    } catch (error) {

        console.error("Error in changePassword:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const deleteProfileImage = async (req, res) => {

    try {

        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please log in."
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (user.profileImage) {
            const imagePath = path.join(__dirname, "../../public", user.profileImage);
            try {
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                    console.log(`Deleted image file: ${imagePath}`);
                } else {
                    console.warn(`Image file not found: ${imagePath}`);
                }
            } catch (fileError) {
                console.error(`Error deleting image file: ${fileError.message}`);
            }

            user.profileImage = '';
            await user.save();

            return res.status(200).json({
                success: true,
                message: "Profile image removed successfully."
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "No profile image to remove."
            });
        }

    } catch (error) {
        
        console.error("Error deleting profile image:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while removing the profile image."
        });
    }
};



module.exports = {

    userProfile,
    loadEditProfile,
    changeUserProfile,
    verifyUserOtp,
    resendUserOtp,
    getUserVerifyOtp,
    getChangePassword,
    changePassword,
    deleteProfileImage

}