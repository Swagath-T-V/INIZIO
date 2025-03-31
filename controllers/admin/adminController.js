const User = require("../../models/userSchema")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")


const pageerror = async (req,res)=>{

    try {

        return res.render("pageerror")

    } catch (error) {

        console.log("error in the page error",error)
        return res.redirect("/admin/pageerror")

    }

}

const loadLogin = async(req,res)=>{

    try {
        
        if(req.session.admin){

            return res.redirect("/admin/dashboard")
    
        }else{
    
            res.render("admin-login")
    
        }

    } catch (error) {

        console.log("error in the loadLogin",error)
        req.redirect("/admin/pageeeror")
        
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

                req.session.admin = admin._id;
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

        res.render("dashboard",{

            activePage: 'dashboard'

        })

    } catch (error) {

        console.log("Error in loadDashboard",error)
        res.redirect("/admin/pageerror")

    }
}

const logout = async(req,res)=>{

    try {

        req.session.destroy((err)=>{
            if(err){

                console.log("error in destroy",err)
                return res.redirect("/admin/pageerror")

            }else{
                
                return res.redirect("/admin/login")
            }
        })

    } catch (error) {

        console.log("logout error",error)
        res.redirect("/admin/pageerror")
    }
}


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}