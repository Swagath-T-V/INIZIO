const User = require("../../models/userSchema")
const env = require("dotenv").config()
const nodemailer = require("nodemailer")

const customerInfo = async(req,res)=>{

    try {
        
        let search =req.query.search || ""
        let page =parseInt(req.query.page) || ""
        if(page<1)page=1

        const limit = 3
        
        const userData = await User.find({
            isAdmin:false,
            $or:[
                {name:{ $regex:".*" + search+ ".*"}},
                {email:{ $regex:".*" + search + ".*"}}
            ]
        })
        .sort({ createdOn: -1 })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec()

        const count = await User.find({
            isAdmin:false,
            $or:[
                {name:{ $regex:".*" + search+ ".*"}},
                {email:{ $regex:".*" + search + ".*"}}
            ]
        }).countDocuments()

        res.render("customers", {
            data: userData,  
            search: search, 
            currentPage: page,     
            totalPages: Math.ceil(count / limit), 
            totalUsers: count ,
            activePage: 'users'
        });

    } catch (error) {

        console.log("Error in customerInfo",error)
        res.redirect("/admin/pageerror")
        
    } 

}

const transporter =nodemailer.createTransport({
    service:"gmail",
    port:587,
    secure:false,
    requireTLS:true,
    auth: {
        user:process.env.NODEMAILER_EMAIL,
        pass:process.env.NODEMAILER_PASSWORD,
    }
})

async function sendMail({to,subject,text,html}){
    try{
        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to,
            subject,
            text,
            html
        })
        return info.accepted.length>0
    }catch(error){
        console.log("Error in sending mail in customer",error)
        return false
    }
} 

const customerBlocked = async(req,res)=>{
    try {
        const id = req.query.id
        const user = await User.findById(id)
        if(!user){
            return res.json({success:false,message:"user not found"})
        }

        await User.updateOne({_id:id},{$set:{isBlocked:true}})

        const emailSubject = "Your account has been blocked";
        const emailText = "Dear User, your account has been blocked. Please contact support if you think this is an error.";
        const emailHtml = "<p>Dear User,</p><p>Your account has been blocked. Please contact for support.</p>";
        const emailSent = await sendMail({ to: user.email, subject: emailSubject, text: emailText, html: emailHtml });

        if(emailSent){
            return res.json({success:true})
        }else{
            return res.json({success:false,message:"Failed in sending mail"})
        }

    } catch (error) {

        console.log("Error in customer Blocked",error)
        return res.json({success:false})
    }
}

const customerunBlocked = async(req,res)=>{
    try {
        const id =req.query.id
        const user = await User.findById(id)
        if(!user){
            return res.json({success:false,message:"user not found"})
        }
        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        const emailSubject = "Your account has been unblocked";
        const emailText = "Dear User, your account has been unblocked. You can now access your account again.";
        const emailHtml = "<p>Dear User,</p><p>Your account has been unblocked. You can now access your account again.</p>";
        const emailSent = await sendMail({ to: user.email, subject: emailSubject, text: emailText, html: emailHtml });

        if(emailSent){
            return res.json({success:true})
        }else{
            return res.json({success:false,message:"Failed in sending mail"})
        }

    } catch (error) {

        console.log("Error in customer unBlock",error)
        return res.json({success:false,message:"Error in processing unBlock"})
    }
}


module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked
}
