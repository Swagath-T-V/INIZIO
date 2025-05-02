const User = require("../../models/userSchema")
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")
const Wallet = require("../../models/walletSchema")
const { v4: uuidv4 } = require('uuid');


const pageNotFound = async (req, res) => {

    try {

        return res.render("page-404")

    } catch (error) {

        console.log("error in pageNotFound", error)
        res.redirect("/pageNotFound")

    }
}


const loadSignup = async (req, res) => {

    try {

        const referralToken = req.query.ref;
        if (referralToken) {
            req.session.referralToken = referralToken;
        }

        return res.render("signup")

    } catch (error) {

        console.log("signup page not found", error)
        res.status(500).send("server error")

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
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,

        })

        return info.accepted.length > 0

    } catch (error) {

        console.error("Error in sending Email", error)
        return false

    }
}


const signup = async (req, res) => {

    try {

        const { name, email, phone, password } = req.body;
        console.log(name, email, phone, password);

        const findUser = await User.findOne({ email });
        if (findUser) {

            return res.json({
                success: false,
                message: "User already exists"

            });
        }

        const { otp, expiryTime } = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: "Failed to send verification email. Please try again."
            });
        }

        req.session.userOtp = { otp, expiryTime };
        req.session.userData = { name, email, phone, password }


        console.log("OTP Sent:", otp);

        return res.status(200).json({
            success: true,
            message: "Signup successful! OTP has been sent to your email.",
            redirectUrl: "/verify-otp"
        });

    } catch (error) {

        console.error("Signup error:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred. Please try again later."
        });
    }
};


const getOptPage = async (req, res) => {

    try {

        res.render("verify-otp")

    } catch (error) {

        res.status(500).send("An error found while rendering otp page")
        res.redirect("/pageNotFound")

    }
}

const resentOtp = async (req, res) => {

    try {

        const { email } = req.session.userData;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const { otp, expiryTime } = generateOtp();

        req.session.userOtp = { otp, expiryTime }

        const emailSent = await sendVerificationEmail(email, otp);
        // console.log('this is email from resend',emailSent)

        if (emailSent) {

            console.log("Resend OTP = ", otp);
            return res.status(200).json({ success: true, message: "OTP resent successfully" });

        } else {

            return res.status(500).json({ success: false, message: "Failed to resend OTP, please try again" });

        }

    } catch (error) {

        console.error("Error resending OTP:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });

    }
}


const verifyOtp = async (req, res) => {

    try {

        const { otp } = req.body;
        const userOtp = req.session.userOtp;
        const currentTime = Date.now();

        if (currentTime > userOtp.expiryTime) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new OTP.",
            });
        }

        if (otp === userOtp.otp) {

            const user = req.session.userData;
            const passwordHash = await bcrypt.hash(user.password, 10);
            const referralToken = uuidv4().replace(/-/g, '').slice(0, 10);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
                googleId: user.googleId || undefined,
                referralToken
            });

            await saveUserData.save();

            const newWallet = new Wallet({
                userId: saveUserData._id

            })

            await newWallet.save()

            const referralTokenFromUrl = req.session.referralToken;
            if (referralTokenFromUrl) {
                const referrer = await User.findOne({ referralToken: referralTokenFromUrl });
                if (referrer && referrer._id.toString() !== saveUserData._id.toString()) {
                    await Wallet.findOneAndUpdate(
                        { userId: referrer._id },
                        {
                            $inc: { balance: 500 },
                            $push: {
                                transactions: {
                                    amount: 500,
                                    type: "Credit",
                                    method: "Referral",
                                    status: "Completed",
                                    description: `Referral bonus for inviting ${saveUserData.email}`,
                                    date: new Date()
                                }
                            },
                            $set: { lastUpdated: new Date() }
                        },
                        { new: true }
                    );

                    await Wallet.findOneAndUpdate(
                        { userId: saveUserData._id },
                        {
                            $inc: { balance: 250 },
                            $push: {
                                transactions: {
                                    amount: 250,
                                    type: "Credit",
                                    method: "Referral",
                                    status: "Completed",
                                    description: `Welcome bonus for joining via referral`,
                                    date: new Date()
                                }
                            },
                            $set: { lastUpdated: new Date() }
                        },
                        { new: true }
                    );
                }
            }

            req.session.user = saveUserData._id;
            delete req.session.userOtp;
            delete req.session.userData;
            delete req.session.referralToken;

            res.status(200).json({
                success: true,
                message: "OTP verified successfully",
                redirectUrl: "/",
            });

        } else {

            res.status(400).json({
                success: false,
                message: "Invalid OTP, please try again.",
            });
        }

    } catch (error) {

        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: "An error occurred." });

    }
}

const loadLogin = async (req, res) => {

    try {

        if (!req.session.user) {

            res.render("login")

        } else {

            res.redirect("/")

        }

    } catch (error) {

        console.error("error in loadlogin", error)
        res.redirect("/pageNotFound")

    }
}


const login = async (req, res) => {

    try {

        const { email, password } = req.body;
        const findUser = await User.findOne({ email: email });

        if (!findUser || findUser.isBlocked) {

            return res.status(400).json({
                success: false,
                message: findUser ? "User is blocked by the Admin" : "User not found"
            });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {

            return res.status(400).json({ success: false, message: "Incorrect password" });
        }

        req.session.user = findUser._id;

        return res.status(200).json({ success: true, redirectUrl: "/" });

    } catch (error) {

        console.error("Login error", error);
        return res.status(500).json({ success: false, message: "Login failed, Please try again" });

    }
}


const logout = async (req, res) => {

    try {

        // req.session.destroy((err)=>{

        //     if(err){
        //         console.log("error in destroy",err)
        //         return re.redirect("/pageNotFound")
        //     }else{
        //         return res.redirect("/")
        //     }

        // })/

        req.session.user = null
        return res.redirect('/')

    } catch (error) {

        console.log("logout error", error)
        res.redirect("/pageNotFound")

    }
}





module.exports = {

    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    getOptPage,
    loadLogin,
    login,
    resentOtp,
    logout,

}
