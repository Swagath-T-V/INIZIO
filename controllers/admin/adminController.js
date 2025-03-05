const User = require("../../models/userSchema")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")


const pageerror = async (req,res)=>{

    try {
        return res.render("pageerror")
    } catch (error) {
        return res.redirect("/pageerror")
    }

}

const loadLogin = async(req,res)=>{
    
    if(req.session.admin){
        return res.redirect("/dashboard")
    }else{
        res.render("admin-login")
    }
}

const login = async (req,res)=>{

    try {
        
        const {email,password} = req.body
        
        const admin = await User.findOne({email,isAdmin:true})
        
        if(admin){
            const passwordMatch = await bcrypt.compare(password,admin.password)
            if(!passwordMatch){
                return res.status(400).json({success:false,message:"Incorrect password"})

            }else{
                req.session.user = admin._id;
                return res.status(200).json({success:true,redirectUrl:"/admin"})
            }
        }else{
            return res.status(400).json({success:false,message:"Admin not found,please login as admin"})
        }

    } catch (error) {
        
        console.error("Login error", error);
        return res.status(500).json({ success: false, message: "Login failed, Please try again" });
    }

}

const loadDashboard = async(req,res)=>{
    try {

        res.render("dashboard")

    } catch (error) {

        res.redirect("/pageerror")
        
    }
}

const logout = async(req,res)=>{
    try {
        
        req.session.destroy((err)=>{
            if(err){
                console.log("error in destroy",err)
                return re.redirect("/pageerror")
            }else{
                return res.redirect("/admin/login")
            }
        })
    } catch (error) {
        console.log("logout error",err)
        res.redirect("/pageerror")
    }
}
module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}