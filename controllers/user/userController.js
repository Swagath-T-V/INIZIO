const User = require("../../models/userSchema")
const nodemailer = require("nodemailer")
const env = require("dotenv")
env.config()
const bcrypt = require("bcrypt")


const pageNotFound =async (req,res)=>{

    try {
        
        return res.render("page-404")

    } catch (error) {

        res.redirect("/pageNotFound")
        
    }
}


const loadHome =async (req,res)=>{

    try {

        const userId = req.session.user
        if(userId){

            const userData =await User.findOne({_id:userId})
            res.render("home",{user:userData})

        }else{
            return res.render("home")
        }
        
    } catch (error) {
        
        console.log("HOME page not found",error)
        res.status(500).send("server error")

    }
}

const loadSignup =async (req,res)=>{

    try {

        return res.render("signup")
        
    } catch (error) {

        console.log("signup page not found",error)
        res.status(500).send("server error")
        
    }
}

function generateOtp(){

    return Math.floor(100000 + Math.random()*900000).toString()

}

async function sendVerificationEmail(email,otp){

    try {
        
        const transporter = nodemailer.createTransport({

            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }

        })

        const info = await transporter.sendMail({

            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Verify your account",
            text:`Your OTP is ${otp}`,
            html:`<b>Your OTP: ${otp}</b>`,

        })
        
        return info.accepted.length>0 

    } catch (error) {
        
        console.error("Error in sending Email",error)
        return false

    }
}


const signup = async (req, res) => {

    try {

        const { name, email, phone, password } = req.body;
        console.log(name, email, phone, password);
        
        const findUser = await User.findOne({ email });
        if (findUser) {
            
            return res.status(400).json({
                success: false,
                message: "User already exists"

            });
        }
        
        const otp = generateOtp();
        
        const emailSent = await sendVerificationEmail(email, otp);
        
        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: "Failed to send verification email. Please try again."
            });
        }
        
        req.session.userOtp = otp;

        req.session.userData = { name, email, phone, password};
        
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


const getOptPage = async (req,res)=>{

    try {
        
        res.render( "verify-otp")

    } catch (error) {

        res.status(500).send("an error found while rendering otp page")
        
    }
}

const resentOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp(); 
        
        req.session.userOtp = otp; 
        console.log("resend otp")

        const emailSent = await sendVerificationEmail(email, otp);
        console.log('this is email from resend',emailSent)
        
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

        if (otp === userOtp) {
            const user = req.session.userData;
            const passwordHash = await bcrypt.hash(user.password,10);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
                googleId: user.googleId || undefined, 
            });

            await saveUserData.save();

            req.session.user = saveUserData._id;
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
};


const loadLogin = async (req,res)=>{
    
    try {
        
        if(!req.session.user){
            res.render("login")
        }else{
            res.redirect("/")
        }

    } catch (error) {

        console.error("error in loadlogin",error)
        res.redirect("/pageNotFound")
        
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(password)
        
        const findUser = await User.findOne({ isAdmin: 0, email: email});
        
        if (!findUser) {
            return res.status(400).json({ success: false, message: "User not found" });
        }
        
        if (findUser.isBlocked) {
            return res.status(400).json({ success: false, message: "User is blocked by the Admin" });
        }

        // console.log(findUser.password)
        
        // console.log('Input Password:', password);
        // console.log('Stored Hashed Password:', findUser.password);

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        // console.log('Password Match Result:', passwordMatch);
        // console.log('Password Length:', password.length);
        // console.log('Stored Password Length:', findUser.password.length);

        
        if (!passwordMatch) {
            return res.status(400).json({ success: false, message: "Incorrect password" });
        }
        
        req.session.user = findUser._id;
        
        return res.status(200).json({ success: true, redirectUrl: "/" });

    } catch (error) {
        console.error("Login error", error);
        return res.status(500).json({ success: false, message: "Login failed, Please try again" });
    }
};

const logout = async(req,res)=>{
    try {
        
        req.session.destroy((err)=>{
            if(err){
                console.log("error in destroy",err)
                return re.redirect("/pageNotFound")
            }else{
                return res.redirect("/")
            }
        })
    } catch (error) {
        console.log("logout error",err)
        res.redirect("/pageNotFound")
    }
}

module.exports = {
    loadHome,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    getOptPage,
    loadLogin,
    login,
    resentOtp,
    logout

}