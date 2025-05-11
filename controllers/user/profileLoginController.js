const User = require("../../models/userSchema")
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")



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

const forgotEmail = async (req, res) => {

    try {

        const { email } = req.body;
        console.log(email)

        const findUser = await User.findOne({ email: email });

        if(!findUser) {
            return res.json({success: false,  message: "User with this email does not exist"});
        }

        if(findUser.googleId){
            return res.json({success:false,message:"Can't change the password"})
        }

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

                return res.json({ success: false, message: 'Failed to send OTP. Please try again.' });
            }

        } 

    } catch (error) {

        console.log("Error in forgotEmail", error);
        return res.json({ success: false, message: "Internal server error" });

    }
};

const getForgotPassOtp = async (req, res) => {

    try {

        res.render("forgotPass-otp")

    } catch (error) {

        console.log("error in getForgotPassOtp", error)
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

        console.log("error in getResetPassword",error)
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


module.exports = {

    getForgotPage,
    forgotEmail,
    getForgotPassOtp,
    verifyForgotPassOtp,
    resentOtp,
    getResetPassword,
    postnewPassword,
}