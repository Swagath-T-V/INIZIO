const User = require("../../models/userSchema")

const customerInfo = async(req,res)=>{

    try {
        
        let search =""
        if(req.query.search){
            search = req.query.search
        }
        let page = 1
        if(req.query.page){
            page=req.query.page
        }
        const limit = 3
        const userData = await User.find({
            isAdmin:false,
            $or:[
                {name:{ $regex:".*" + search+ ".*"}},
                {email:{ $regex:".*" + search + ".*"}}
            ]
        })
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
            data: userData,  // Pass the user data to the view
            search: search,  // Pass the search term                                                  here
            page: page,      // Pass the current page number
            totalPages: Math.ceil(count / limit),  // Calculate the total number of pages
            totalUsers: count  // Pass the total number of users matching the search
        });

    } catch (error) {
        
    }

}

module.exports = {
    customerInfo
}