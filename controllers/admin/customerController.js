const User = require("../../models/userSchema")

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

const customerBlocked = async(req,res)=>{
    try {
        const id = req.query.id
        const user =    await User.updateOne({_id:id},{$set:{isBlocked:true}})


        res.redirect("/admin/users")
    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}

const customerunBlocked = async(req,res)=>{
    try {
        const id =req.query.id
        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect("/admin/users")
    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}



module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked
}
